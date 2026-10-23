package studio

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"layerto/services/core/internal/httpx"
)

// A small, typed CRUD layer for the research workspace. Each entity (papers, experiments,
// findings, notes, literature, tasks) is a table with owner_id + area_id; access is the owner,
// or members of the team the area is shared with (editors and owners can change things).

type field struct {
	name     string
	kind     string // text, int, bool, json, date, enum, area, uuid (read-only)
	max      int    // text: max characters; json: max bytes; int: max value
	min      int    // int: min value
	enum     []string
	required bool
	readOnly bool // returned but not settable through the API
}

type entity struct {
	table      string
	noun       string // for activity: "paper"
	titleField string
	fields     []field
	order      string
	hasUpdated bool
	// optional hooks
	beforeUpdate func(ctx context.Context, h *Handler, id string, set map[string]any) error
	afterWrite   func(ctx context.Context, h *Handler, id string)
}

var dateRe = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

func (e *entity) selectCols() string {
	cols := []string{"t.id::text AS id", "t.owner_id::text AS owner_id", "COALESCE(up.username, '') AS owner", "t.area_id::text AS area_id", "t.created_at"}
	if e.hasUpdated {
		cols = append(cols, "t.updated_at")
	}
	for _, f := range e.fields {
		switch f.kind {
		case "area":
			continue
		case "date":
			cols = append(cols, fmt.Sprintf("to_char(t.%s, 'YYYY-MM-DD') AS %s", f.name, f.name))
		case "uuid":
			cols = append(cols, fmt.Sprintf("t.%s::text AS %s", f.name, f.name))
		case "float":
			cols = append(cols, fmt.Sprintf("COALESCE(t.%s, 0.0)::float8 AS %s", f.name, f.name))
		case "int64":
			cols = append(cols, fmt.Sprintf("COALESCE(t.%s, 0)::bigint AS %s", f.name, f.name))
		default:
			cols = append(cols, "t."+f.name)
		}
	}
	return strings.Join(cols, ", ") + " FROM " + e.table + " t LEFT JOIN user_profiles up ON up.user_id = t.owner_id"
}

func rowsToMaps(rows pgx.Rows) ([]map[string]any, error) {
	defer rows.Close()
	out := []map[string]any{}
	fds := rows.FieldDescriptions()
	for rows.Next() {
		vals, err := rows.Values()
		if err != nil {
			return nil, err
		}
		m := make(map[string]any, len(vals))
		for i, v := range vals {
			if t, ok := v.(time.Time); ok {
				v = ts(t)
			}
			m[fds[i].Name] = v
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// parseFields validates a JSON body against the entity fields. partial = PATCH.
func (e *entity) parseFields(in map[string]json.RawMessage, partial bool) (map[string]any, error) {
	set := map[string]any{}
	for _, f := range e.fields {
		raw, present := in[f.name]
		if !present {
			if f.required && !partial {
				return nil, fmt.Errorf("%s is required", strings.ReplaceAll(f.name, "_", " "))
			}
			continue
		}
		if f.readOnly {
			continue
		}
		if string(raw) == "null" {
			if f.kind == "area" || f.kind == "date" || f.kind == "int" || f.kind == "float" || f.kind == "int64" {
				set[f.name] = nil
				continue
			}
			return nil, fmt.Errorf("%s can't be empty", f.name)
		}
		switch f.kind {
		case "text", "enum", "area", "date":
			var s string
			if json.Unmarshal(raw, &s) != nil {
				return nil, fmt.Errorf("%s must be text", f.name)
			}
			s = strings.TrimSpace(s)
			switch f.kind {
			case "text":
				if len([]rune(s)) > f.max {
					return nil, fmt.Errorf("%s is too long (%d characters max)", strings.ReplaceAll(f.name, "_", " "), f.max)
				}
				if f.required && s == "" {
					return nil, fmt.Errorf("%s is required", strings.ReplaceAll(f.name, "_", " "))
				}
			case "enum":
				ok := false
				for _, v := range f.enum {
					ok = ok || v == s
				}
				if !ok {
					return nil, fmt.Errorf("%s must be one of %s", f.name, strings.Join(f.enum, ", "))
				}
			case "area":
				if s == "" {
					set[f.name] = nil
					continue
				}
				if !validID(s) {
					return nil, fmt.Errorf("unknown research area")
				}
			case "date":
				if s == "" {
					set[f.name] = nil
					continue
				}
				if !dateRe.MatchString(s) {
					return nil, fmt.Errorf("%s must be a date like 2026-12-31", strings.ReplaceAll(f.name, "_", " "))
				}
			}
			set[f.name] = s
		case "int":
			var n int
			if json.Unmarshal(raw, &n) != nil || n < f.min || n > f.max {
				return nil, fmt.Errorf("%s must be a number from %d to %d", f.name, f.min, f.max)
			}
			set[f.name] = n
		case "int64":
			var n int64
			if json.Unmarshal(raw, &n) != nil {
				return nil, fmt.Errorf("%s must be a number", f.name)
			}
			set[f.name] = n
		case "float":
			var fl float64
			if json.Unmarshal(raw, &fl) != nil {
				return nil, fmt.Errorf("%s must be a decimal number", f.name)
			}
			set[f.name] = fl
		case "bool":
			var b bool
			if json.Unmarshal(raw, &b) != nil {
				return nil, fmt.Errorf("%s must be true or false", f.name)
			}
			set[f.name] = b
		case "json":
			if len(raw) > f.max {
				return nil, fmt.Errorf("%s is too large", f.name)
			}
			var v any
			if json.Unmarshal(raw, &v) != nil {
				return nil, fmt.Errorf("%s is not valid JSON", f.name)
			}
			set[f.name] = []byte(raw)
		}
	}
	return set, nil
}

const readScope = `(t.owner_id = $1 OR (t.area_id IS NOT NULL AND hub_area_read(t.area_id, $1)))`

func (h *Handler) researchList(e *entity) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, ok := currentUser(w, r)
		if !ok || !h.requireFeature(w, r, uid, "research") {
			return
		}
		q := `SELECT ` + e.selectCols() + ` WHERE ` + readScope
		args := []any{uid}
		area := r.Header.Get("X-Research-Area-ID")
		if area == "" {
			area = r.URL.Query().Get("area")
		}
		switch {
		case area == "none":
			q += ` AND t.area_id IS NULL`
		case validID(area):
			args = append(args, area)
			q += fmt.Sprintf(` AND t.area_id = $%d`, len(args))
		}
		if s := strings.TrimSpace(r.URL.Query().Get("q")); s != "" && e.titleField != "" {
			args = append(args, s)
			q += fmt.Sprintf(` AND t.%s ILIKE '%%' || $%d || '%%'`, e.titleField, len(args))
		}
		if e.table == "experiments" {
			if p := r.URL.Query().Get("project"); validID(p) {
				args = append(args, p)
				q += fmt.Sprintf(` AND t.project_id = $%d`, len(args))
			}
		}
		rows, err := h.pool.Query(r.Context(), q+` ORDER BY `+e.order+` LIMIT 500`, args...)
		if err != nil {
			internal(w, r, err)
			return
		}
		out, err := rowsToMaps(rows)
		if err != nil {
			internal(w, r, err)
			return
		}
		httpx.JSON(w, http.StatusOK, out)
	}
}

func (h *Handler) researchGetOne(ctx context.Context, e *entity, uid, id string) (map[string]any, error) {
	rows, err := h.pool.Query(ctx, `SELECT `+e.selectCols()+` WHERE t.id = $2 AND `+readScope, uid, id)
	if err != nil {
		return nil, err
	}
	list, err := rowsToMaps(rows)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, pgx.ErrNoRows
	}
	return list[0], nil
}

func (h *Handler) researchGet(e *entity) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, ok := currentUser(w, r)
		if !ok || !h.requireFeature(w, r, uid, "research") {
			return
		}
		id := chi.URLParam(r, "id")
		if !validID(id) {
			notFound(w, r, e.noun)
			return
		}
		m, err := h.researchGetOne(r.Context(), e, uid, id)
		if isNoRows(err) {
			notFound(w, r, capital(e.noun))
			return
		}
		if err != nil {
			internal(w, r, err)
			return
		}
		httpx.JSON(w, http.StatusOK, m)
	}
}

func capital(s string) string {
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

// checkAreaWrite: an area set on an item must be one the user can write to.
func (h *Handler) checkAreaWrite(ctx context.Context, uid string, area any) bool {
	s, ok := area.(string)
	if !ok || s == "" {
		return true
	}
	var allowed bool
	_ = h.pool.QueryRow(ctx, `SELECT hub_area_write($1::uuid, $2::uuid)`, s, uid).Scan(&allowed)
	return allowed
}

func (h *Handler) researchCreate(e *entity) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, ok := currentUser(w, r)
		if !ok || !h.requireFeature(w, r, uid, "research") {
			return
		}
		var in map[string]json.RawMessage
		if !decodeJSONLoose(w, r, &in, 256<<10) {
			return
		}
		set, err := e.parseFields(in, false)
		if err != nil {
			httpx.WriteError(w, r, http.StatusBadRequest, "invalid_field", err.Error())
			return
		}
		if set["area_id"] == nil || set["area_id"] == "" {
			if hArea := r.Header.Get("X-Research-Area-ID"); validID(hArea) {
				set["area_id"] = hArea
			}
		}
		if !h.checkAreaWrite(r.Context(), uid, set["area_id"]) {
			httpx.WriteError(w, r, http.StatusForbidden, "area_forbidden", "You can't add to that research area")
			return
		}
		cols := []string{"owner_id"}
		vals := []string{"$1"}
		args := []any{uid}
		for _, f := range e.fields {
			v, present := set[f.name]
			if !present {
				continue
			}
			args = append(args, v)
			cols = append(cols, f.name)
			cast := ""
			switch f.kind {
			case "json":
				cast = "::jsonb"
			case "area":
				cast = "::uuid"
			case "date":
				cast = "::date"
			case "float":
				cast = "::float8"
			case "int64":
				cast = "::bigint"
			}
			vals = append(vals, fmt.Sprintf("$%d%s", len(args), cast))
		}
		var id string
		err = h.pool.QueryRow(r.Context(), `INSERT INTO `+e.table+` (`+strings.Join(cols, ",")+`) VALUES (`+strings.Join(vals, ",")+`) RETURNING id::text`, args...).Scan(&id)
		if err != nil {
			httpx.WriteError(w, r, http.StatusBadRequest, "invalid_field", "Couldn't save: check the fields' lengths and values")
			return
		}
		title, _ := set[e.titleField].(string)
		h.logActivity(r.Context(), uid, set["area_id"], "added", e.noun, id, fmt.Sprintf("added %s “%s”", e.noun, title))
		if e.afterWrite != nil {
			e.afterWrite(r.Context(), h, id)
		}
		m, _ := h.researchGetOne(r.Context(), e, uid, id)
		httpx.JSON(w, http.StatusCreated, m)
	}
}

func (h *Handler) researchWritable(ctx context.Context, e *entity, uid, id string) (area *string, ok bool) {
	var owner string
	err := h.pool.QueryRow(ctx, `SELECT owner_id::text, area_id::text FROM `+e.table+` WHERE id = $1`, id).Scan(&owner, &area)
	if err != nil {
		return nil, false
	}
	if owner == uid {
		return area, true
	}
	if area == nil {
		return nil, false
	}
	var allowed bool
	_ = h.pool.QueryRow(ctx, `SELECT hub_area_write($1::uuid, $2::uuid)`, *area, uid).Scan(&allowed)
	return area, allowed
}

func (h *Handler) researchUpdate(e *entity) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, ok := currentUser(w, r)
		if !ok || !h.requireFeature(w, r, uid, "research") {
			return
		}
		id := chi.URLParam(r, "id")
		if !validID(id) {
			notFound(w, r, capital(e.noun))
			return
		}
		var in map[string]json.RawMessage
		if !decodeJSONLoose(w, r, &in, 256<<10) {
			return
		}
		area, writable := h.researchWritable(r.Context(), e, uid, id)
		if !writable {
			notFound(w, r, capital(e.noun))
			return
		}
		set, err := e.parseFields(in, true)
		if err != nil {
			httpx.WriteError(w, r, http.StatusBadRequest, "invalid_field", err.Error())
			return
		}
		if newArea, changed := set["area_id"]; changed && !h.checkAreaWrite(r.Context(), uid, newArea) {
			httpx.WriteError(w, r, http.StatusForbidden, "area_forbidden", "You can't move it to that research area")
			return
		}
		if e.table == "research_collaboration_contracts" {
			var creatorID, targetRole string
			_ = h.pool.QueryRow(r.Context(), `SELECT ra.creator_id::text, COALESCE(c.role, 'editor')
				FROM research_collaboration_contracts c JOIN research_areas ra ON ra.id = c.area_id WHERE c.id = $1`, id).Scan(&creatorID, &targetRole)
			if targetRole == "owner" && uid != creatorID {
				httpx.WriteError(w, r, http.StatusForbidden, "forbidden", "Only the original research area creator can demote or alter co-owners")
				return
			}
		}
		if e.beforeUpdate != nil {
			if err := e.beforeUpdate(r.Context(), h, id, set); err != nil {
				httpx.WriteError(w, r, http.StatusBadRequest, "invalid_field", err.Error())
				return
			}
		}
		if len(set) > 0 {
			parts := []string{}
			args := []any{id}
			for _, f := range e.fields {
				v, present := set[f.name]
				if !present {
					continue
				}
				args = append(args, v)
				cast := ""
				switch f.kind {
				case "json":
					cast = "::jsonb"
				case "area":
					cast = "::uuid"
				case "date":
					cast = "::date"
				case "float":
					cast = "::float8"
				case "int64":
					cast = "::bigint"
				}
				parts = append(parts, fmt.Sprintf("%s = $%d%s", f.name, len(args), cast))
			}
			if e.hasUpdated {
				parts = append(parts, "updated_at = now()")
			}
			if _, err := h.pool.Exec(r.Context(), `UPDATE `+e.table+` SET `+strings.Join(parts, ", ")+` WHERE id = $1`, args...); err != nil {
				httpx.WriteError(w, r, http.StatusBadRequest, "invalid_field", "Couldn't save: check the fields' lengths and values")
				return
			}
		}
		m, err := h.researchGetOne(r.Context(), e, uid, id)
		if err != nil {
			internal(w, r, err)
			return
		}
		title, _ := m[e.titleField].(string)
		var areaAny any
		if a, ok := m["area_id"].(string); ok {
			areaAny = a
		} else if area != nil {
			areaAny = *area
		}
		h.logActivity(r.Context(), uid, areaAny, "updated", e.noun, id, fmt.Sprintf("updated %s “%s”", e.noun, title))
		if e.afterWrite != nil {
			e.afterWrite(r.Context(), h, id)
		}
		httpx.JSON(w, http.StatusOK, m)
	}
}

func (h *Handler) researchDelete(e *entity) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, ok := currentUser(w, r)
		if !ok || !h.requireFeature(w, r, uid, "research") {
			return
		}
		id := chi.URLParam(r, "id")
		if !validID(id) {
			notFound(w, r, capital(e.noun))
			return
		}
		area, writable := h.researchWritable(r.Context(), e, uid, id)
		if !writable {
			notFound(w, r, capital(e.noun))
			return
		}
		if e.table == "research_collaboration_contracts" {
			var creatorID, targetRole string
			_ = h.pool.QueryRow(r.Context(), `SELECT ra.creator_id::text, COALESCE(c.role, 'editor')
				FROM research_collaboration_contracts c JOIN research_areas ra ON ra.id = c.area_id WHERE c.id = $1`, id).Scan(&creatorID, &targetRole)
			if targetRole == "owner" && uid != creatorID {
				httpx.WriteError(w, r, http.StatusForbidden, "forbidden", "Only the original research area creator can remove co-owners")
				return
			}
		}
		var title string
		_ = h.pool.QueryRow(r.Context(), `SELECT `+e.titleField+` FROM `+e.table+` WHERE id = $1`, id).Scan(&title)
		if e.table == "papers" || e.table == "research_files" {
			h.deleteStoredFile(r.Context(), e.table, id)
		}
		if _, err := h.pool.Exec(r.Context(), `DELETE FROM `+e.table+` WHERE id = $1`, id); err != nil {
			internal(w, r, err)
			return
		}
		var areaAny any
		if area != nil {
			areaAny = *area
		}
		h.logActivity(r.Context(), uid, areaAny, "deleted", e.noun, id, fmt.Sprintf("deleted %s “%s”", e.noun, title))
		w.WriteHeader(http.StatusNoContent)
	}
}

func (h *Handler) deleteStoredFile(ctx context.Context, table, id string) {
	col := "storage_key"
	if table == "papers" {
		col = "pdf_key"
	}
	var key string
	_ = h.pool.QueryRow(ctx, `SELECT `+col+` FROM `+table+` WHERE id = $1`, id).Scan(&key)
	if key != "" {
		_ = h.store.Delete(key)
	}
}

// logActivity records what happened in an area (and its team) for the shared activity feed.
func (h *Handler) logActivity(ctx context.Context, actor string, area any, verb, objType, objID, summary string) {
	a, _ := area.(string)
	if a == "" {
		_, _ = h.pool.Exec(ctx, `INSERT INTO hub_activity (actor_id, verb, object_type, object_id, summary) VALUES ($1,$2,$3,$4,$5)`,
			actor, verb, objType, objID, truncate(summary, 300))
		return
	}
	_, _ = h.pool.Exec(ctx, `INSERT INTO hub_activity (actor_id, area_id, team_id, verb, object_type, object_id, summary)
		SELECT $1, ra.id, ra.team_id, $3, $4, $5, $6 FROM research_areas ra WHERE ra.id = $2::uuid`,
		actor, a, verb, objType, objID, truncate(summary, 300))
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n-1]) + "…"
}

// decodeJSONLoose decodes into a generic map (fields are validated by the entity spec).
func decodeJSONLoose(w http.ResponseWriter, r *http.Request, dst any, limit int64) bool {
	r.Body = http.MaxBytesReader(w, r.Body, limit)
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return false
	}
	return true
}

// ---- the entities

var entPapers = &entity{
	table: "papers", noun: "paper", titleField: "title", hasUpdated: true, order: "t.updated_at DESC",
	fields: []field{
		{name: "area_id", kind: "area"},
		{name: "title", kind: "text", max: 300, required: true},
		{name: "authors", kind: "json", max: 8 << 10},
		{name: "venue", kind: "text", max: 200},
		{name: "year", kind: "int", min: 1900, max: 2200},
		{name: "status", kind: "enum", enum: []string{"idea", "drafting", "submitted", "under_review", "accepted", "published"}},
		{name: "doi", kind: "text", max: 200},
		{name: "arxiv", kind: "text", max: 50},
		{name: "url", kind: "text", max: 500},
		{name: "abstract", kind: "text", max: 10000},
		{name: "keywords", kind: "json", max: 4 << 10},
		{name: "model_slugs", kind: "json", max: 4 << 10},
		{name: "on_layerto", kind: "bool", readOnly: true},
		{name: "published_at", kind: "text", readOnly: true},
		{name: "pdf_bytes", kind: "int", readOnly: true},
	},
}

var entExperiments = &entity{
	table: "experiments", noun: "experiment", titleField: "name", hasUpdated: true, order: "t.created_at DESC",
	fields: []field{
		{name: "area_id", kind: "area"},
		{name: "name", kind: "text", max: 120, required: true},
		{name: "hypothesis", kind: "text", max: 4000},
		{name: "status", kind: "enum", enum: []string{"planned", "running", "done", "failed", "cancelled"}},
		{name: "params", kind: "json", max: 16 << 10},
		{name: "metrics", kind: "json", max: 64 << 10},
		{name: "conclusion", kind: "text", max: 10000},
		{name: "tags", kind: "json", max: 4 << 10},
		{name: "history", kind: "json", readOnly: true},
		{name: "job_id", kind: "uuid", readOnly: true},
		{name: "project_id", kind: "uuid", readOnly: true},
	},
	beforeUpdate: func(ctx context.Context, h *Handler, id string, set map[string]any) error {
		var jobID *string
		_ = h.pool.QueryRow(ctx, `SELECT job_id::text FROM experiments WHERE id = $1`, id).Scan(&jobID)
		if jobID != nil {
			_, p := set["params"]
			_, m := set["metrics"]
			_, s := set["status"]
			if p || m || s {
				return fmt.Errorf("params, metrics and status of a training run are recorded by Layerto and can't be edited")
			}
		}
		return nil
	},
}

var entFindings = &entity{
	table: "findings", noun: "finding", titleField: "title", hasUpdated: true, order: "t.updated_at DESC",
	fields: []field{
		{name: "area_id", kind: "area"},
		{name: "title", kind: "text", max: 200, required: true},
		{name: "body", kind: "text", max: 10000},
		{name: "evidence", kind: "json", max: 16 << 10},
		{name: "confidence", kind: "enum", enum: []string{"low", "medium", "high"}},
		{name: "status", kind: "enum", enum: []string{"open", "confirmed", "refuted"}},
	},
}

var entNotes = &entity{
	table: "research_notes", noun: "note", titleField: "title", hasUpdated: true, order: "t.pinned DESC, t.updated_at DESC",
	fields: []field{
		{name: "area_id", kind: "area"},
		{name: "title", kind: "text", max: 200, required: true},
		{name: "body", kind: "text", max: 50000},
		{name: "pinned", kind: "bool"},
		{name: "auto", kind: "bool", readOnly: true},
	},
}

var entLiterature = &entity{
	table: "literature", noun: "reference", titleField: "title", hasUpdated: true, order: "t.updated_at DESC",
	fields: []field{
		{name: "area_id", kind: "area"},
		{name: "title", kind: "text", max: 400, required: true},
		{name: "authors", kind: "text", max: 1000},
		{name: "year", kind: "int", min: 1500, max: 2200},
		{name: "venue", kind: "text", max: 300},
		{name: "url", kind: "text", max: 500},
		{name: "doi", kind: "text", max: 200},
		{name: "bibtex", kind: "text", max: 10000},
		{name: "status", kind: "enum", enum: []string{"to_read", "reading", "read"}},
		{name: "rating", kind: "int", min: 0, max: 5},
		{name: "notes", kind: "text", max: 20000},
	},
}

var entTasks = &entity{
	table: "research_tasks", noun: "task", titleField: "title", order: "t.done, t.due_date NULLS LAST, t.created_at DESC",
	fields: []field{
		{name: "area_id", kind: "area"},
		{name: "title", kind: "text", max: 200, required: true},
		{name: "kind", kind: "enum", enum: []string{"task", "deadline", "milestone"}},
		{name: "due_date", kind: "date"},
		{name: "done", kind: "bool"},
	},
}

var entSpecimens = &entity{
	table: "research_specimens", noun: "specimen", titleField: "title", hasUpdated: true, order: "t.created_at DESC",
	fields: []field{
		{name: "area_id", kind: "area", required: true},
		{name: "title", kind: "text", max: 200, required: true},
		{name: "taxonomy_species", kind: "text", max: 200, required: true},
		{name: "common_name", kind: "text", max: 200},
		{name: "media_url", kind: "text", max: 1000},
		{name: "media_type", kind: "enum", enum: []string{"photo", "video", "audio"}},
		{name: "gps_lat", kind: "float"},
		{name: "gps_lng", kind: "float"},
		{name: "habitat", kind: "text", max: 500},
		{name: "morphometrics", kind: "json", max: 16 << 10},
		{name: "observation_date", kind: "date"},
		{name: "notes", kind: "text", max: 10000},
	},
}

var entDatasetSplits = &entity{
	table: "research_dataset_splits", noun: "dataset split", titleField: "version_tag", hasUpdated: false, order: "t.created_at DESC",
	fields: []field{
		{name: "area_id", kind: "area", required: true},
		{name: "version_tag", kind: "text", max: 50, required: true},
		{name: "description", kind: "text", max: 2000},
		{name: "total_samples", kind: "int", min: 0, max: 100000000},
		{name: "train_count", kind: "int", min: 0, max: 100000000},
		{name: "val_count", kind: "int", min: 0, max: 100000000},
		{name: "test_count", kind: "int", min: 0, max: 100000000},
		{name: "class_distribution", kind: "json", max: 32 << 10},
		{name: "leakage_detected", kind: "bool"},
		{name: "leakage_details", kind: "json", max: 64 << 10},
	},
}

var entAblationRuns = &entity{
	table: "research_ablation_runs", noun: "ablation run", titleField: "run_name", hasUpdated: false, order: "t.created_at DESC",
	fields: []field{
		{name: "area_id", kind: "area", required: true},
		{name: "run_name", kind: "text", max: 120, required: true},
		{name: "architecture", kind: "text", max: 100, required: true},
		{name: "is_baseline", kind: "bool"},
		{name: "hyperparameters", kind: "json", max: 32 << 10},
		{name: "metrics", kind: "json", max: 64 << 10},
		{name: "status", kind: "enum", enum: []string{"planned", "running", "completed", "failed"}},
		{name: "notes", kind: "text", max: 10000},
	},
}

var entArenaItems = &entity{
	table: "research_arena_items", noun: "arena item", titleField: "sample_name", hasUpdated: false, order: "t.created_at DESC",
	fields: []field{
		{name: "area_id", kind: "area", required: true},
		{name: "specimen_id", kind: "area"},
		{name: "image_url", kind: "text", max: 1000, required: true},
		{name: "sample_name", kind: "text", max: 150, required: true},
		{name: "ground_truth", kind: "json", max: 16 << 10},
		{name: "model_a_prediction", kind: "json", max: 16 << 10},
		{name: "model_b_prediction", kind: "json", max: 16 << 10},
		{name: "failure_category", kind: "enum", enum: []string{"agreement", "false_positive", "disagreement", "boundary_uncertainty"}},
		{name: "difficulty", kind: "enum", enum: []string{"easy", "medium", "hard"}},
	},
}

var entCollaborationContracts = &entity{
	table: "research_collaboration_contracts", noun: "collaboration contract", titleField: "collaborator_name", hasUpdated: false, order: "t.created_at DESC",
	fields: []field{
		{name: "area_id", kind: "area", required: true},
		{name: "collaborator_email", kind: "text", max: 200, required: true},
		{name: "collaborator_name", kind: "text", max: 120, required: true},
		{name: "team_name", kind: "text", max: 120},
		{name: "collaboration_model", kind: "enum", enum: []string{"voluntary_credit", "royalty_split", "paid_bounty"}, required: true},
		{name: "credit_roles", kind: "json", max: 16 << 10},
		{name: "royalty_percentage", kind: "float"},
		{name: "bounty_amount_cents", kind: "int64"},
		{name: "bounty_status", kind: "enum", enum: []string{"pending", "escrow_funded", "completed", "paid"}},
		{name: "data_sandbox_permission", kind: "enum", enum: []string{"compute_only", "download_permitted"}},
		{name: "role", kind: "enum", enum: []string{"owner", "editor", "viewer"}},
		{name: "status", kind: "enum", enum: []string{"active", "pending", "completed"}},
	},
}

var entDomainInsights = &entity{
	table: "research_domain_insights", noun: "domain insight", titleField: "title", hasUpdated: false, order: "t.pinned DESC, t.created_at DESC",
	fields: []field{
		{name: "area_id", kind: "area", required: true},
		{name: "title", kind: "text", max: 250, required: true},
		{name: "insight_type", kind: "enum", enum: []string{"model_accuracy", "population_trend", "morphometric_distribution", "detection_summary"}},
		{name: "content", kind: "text", max: 10000, required: true},
		{name: "chart_data", kind: "json", max: 32 << 10},
		{name: "pinned", kind: "bool"},
	},
}

var entPublications = &entity{
	table: "research_publications", noun: "publication", titleField: "title", hasUpdated: true, order: "t.created_at DESC",
	fields: []field{
		{name: "area_id", kind: "area", required: true},
		{name: "title", kind: "text", max: 300, required: true},
		{name: "doi", kind: "text", max: 200},
		{name: "abstract", kind: "text", max: 10000},
		{name: "pdf_url", kind: "text", max: 1000},
		{name: "pricing_model", kind: "enum", enum: []string{"open_access", "tiered", "commercial"}},
		{name: "paper_price_cents", kind: "int64"},
		{name: "dataset_price_cents", kind: "int64"},
		{name: "model_price_cents", kind: "int64"},
		{name: "royalty_split_rules", kind: "json", max: 16 << 10},
		{name: "downloads_count", kind: "int", min: 0, max: 100000000},
		{name: "gross_revenue_cents", kind: "int64"},
		{name: "is_published", kind: "bool"},
		{name: "badges", kind: "json", max: 8 << 10},
	},
}

// ResearchEntities maps URL segments to the generic research entities (for route registration).
func (h *Handler) ResearchEntities() map[string]*entity {
	return map[string]*entity{
		"papers":                  entPapers,
		"experiments":             entExperiments,
		"findings":                entFindings,
		"notes":                   entNotes,
		"literature":              entLiterature,
		"tasks":                   entTasks,
		"specimens":               entSpecimens,
		"dataset-splits":          entDatasetSplits,
		"ablation-runs":           entAblationRuns,
		"arena-items":             entArenaItems,
		"collaboration-contracts": entCollaborationContracts,
		"domain-insights":         entDomainInsights,
		"publications":            entPublications,
	}
}

func (h *Handler) FilesEntity() *entity { return entFiles }

func (h *Handler) ResearchList(e *entity) http.HandlerFunc   { return h.researchList(e) }
func (h *Handler) ResearchCreate(e *entity) http.HandlerFunc { return h.researchCreate(e) }
func (h *Handler) ResearchGet(e *entity) http.HandlerFunc    { return h.researchGet(e) }
func (h *Handler) ResearchUpdate(e *entity) http.HandlerFunc { return h.researchUpdate(e) }
func (h *Handler) ResearchDelete(e *entity) http.HandlerFunc { return h.researchDelete(e) }
