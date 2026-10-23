package studio

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"layerto/services/core/internal/catalog"
	"layerto/services/core/internal/httpx"
)

// ---- research areas

type area struct {
	ID                  string          `json:"id"`
	OwnerID             string          `json:"owner_id"`
	Owner               string          `json:"owner"`
	TeamID              *string         `json:"team_id"`
	TeamName            string          `json:"team_name"`
	Name                string          `json:"name"`
	Description         string          `json:"description"`
	Color               string          `json:"color"`
	Status              string          `json:"status"`
	IsPublic            bool            `json:"is_public"`
	Discipline          string          `json:"discipline"`
	Hypothesis          string          `json:"hypothesis"`
	ReproducibilityLock bool            `json:"reproducibility_lock"`
	StorageBytesUsed    int64           `json:"storage_bytes_used"`
	StorageQuotaBytes   int64           `json:"storage_quota_bytes"`
	GpuSecondsUsed      int64           `json:"gpu_seconds_used"`
	GpuCreditsBudget    int64           `json:"gpu_credits_budget"`
	GpuCreditsUsed      int64           `json:"gpu_credits_used"`
	CreatorID           string          `json:"creator_id"`
	CustomMetrics       json.RawMessage `json:"custom_metrics"`
	IsolationLevel      string          `json:"isolation_level"`
	Role                string          `json:"role"` // owner, editor, viewer
	Papers              int             `json:"papers"`
	Experiments         int             `json:"experiments"`
	Findings            int             `json:"findings"`
	Notes               int             `json:"notes"`
	OpenTasks           int             `json:"open_tasks"`
	Specimens           int             `json:"specimens"`
	CustomFields        json.RawMessage `json:"custom_fields"`
	DataTypes           json.RawMessage `json:"data_types"`
	PrivacyShieldConfig json.RawMessage `json:"privacy_shield_config"`
	ComplianceVaultType string          `json:"compliance_vault_type"`
	EnabledModules      json.RawMessage `json:"enabled_modules"`
	MethodologySteps    json.RawMessage `json:"methodology_steps"`
	CreatedAt           string          `json:"created_at"`
	UpdatedAt           string          `json:"updated_at"`
}

const areaCols = `ra.id::text, ra.owner_id::text, COALESCE(up.username, ''), ra.team_id::text, COALESCE(t.name, ''), ra.name, ra.description,
	ra.color, ra.status, ra.is_public, COALESCE(ra.discipline, 'zoology'), COALESCE(ra.hypothesis, ''), COALESCE(ra.reproducibility_lock, false),
	COALESCE(ra.storage_bytes_used, 0)::bigint, COALESCE(ra.gpu_seconds_used, 0)::bigint, COALESCE(ra.custom_metrics, '[]'::jsonb), COALESCE(ra.isolation_level, 'air_gapped'),
	ra.created_at, ra.updated_at,
	CASE WHEN ra.owner_id = $1 OR ra.creator_id = $1 THEN 'owner' ELSE COALESCE((SELECT CASE WHEN m.role = 'viewer' THEN 'viewer' ELSE 'editor' END
		FROM team_members m WHERE m.team_id = ra.team_id AND m.user_id = $1 AND m.status = 'active'), 'viewer') END,
	(SELECT count(*) FROM papers x WHERE x.area_id = ra.id), (SELECT count(*) FROM experiments x WHERE x.area_id = ra.id),
	(SELECT count(*) FROM findings x WHERE x.area_id = ra.id), (SELECT count(*) FROM research_notes x WHERE x.area_id = ra.id),
	(SELECT count(*) FROM research_tasks x WHERE x.area_id = ra.id AND NOT x.done),
	(SELECT count(*) FROM research_specimens x WHERE x.area_id = ra.id),
	COALESCE(ra.creator_id, ra.owner_id)::text,
	COALESCE(ra.storage_quota_bytes, 0)::bigint,
	COALESCE(ra.gpu_credits_budget, 0)::bigint,
	COALESCE(ra.gpu_credits_used, 0)::bigint,
	COALESCE(ra.custom_fields, '[]'::jsonb),
	COALESCE(ra.data_types, '["Images"]'::jsonb),
	COALESCE(ra.privacy_shield_config, '{"shield_type":"geo_privacy","enabled":true}'::jsonb),
	COALESCE(ra.compliance_vault_type, 'permits'),
	COALESCE(ra.enabled_modules, '[]'::jsonb),
	COALESCE(ra.methodology_steps, '[]'::jsonb)
	FROM research_areas ra LEFT JOIN user_profiles up ON up.user_id = ra.owner_id LEFT JOIN teams t ON t.id = ra.team_id`

func scanArea(row pgx.Row) (area, error) {
	var a area
	var c, u time.Time
	var cm, cf, dt, psc, em, ms []byte
	err := row.Scan(&a.ID, &a.OwnerID, &a.Owner, &a.TeamID, &a.TeamName, &a.Name, &a.Description, &a.Color, &a.Status, &a.IsPublic,
		&a.Discipline, &a.Hypothesis, &a.ReproducibilityLock, &a.StorageBytesUsed, &a.GpuSecondsUsed, &cm, &a.IsolationLevel,
		&c, &u, &a.Role, &a.Papers, &a.Experiments, &a.Findings, &a.Notes, &a.OpenTasks, &a.Specimens,
		&a.CreatorID, &a.StorageQuotaBytes, &a.GpuCreditsBudget, &a.GpuCreditsUsed,
		&cf, &dt, &psc, &a.ComplianceVaultType, &em, &ms)
	a.CreatedAt, a.UpdatedAt = ts(c), ts(u)
	if len(cm) > 0 {
		a.CustomMetrics = cm
	} else {
		a.CustomMetrics = json.RawMessage("[]")
	}
	if len(cf) > 0 {
		a.CustomFields = cf
	} else {
		a.CustomFields = json.RawMessage("[]")
	}
	if len(dt) > 0 {
		a.DataTypes = dt
	} else {
		a.DataTypes = json.RawMessage(`["Images"]`)
	}
	if len(psc) > 0 {
		a.PrivacyShieldConfig = psc
	} else {
		a.PrivacyShieldConfig = json.RawMessage(`{"shield_type":"geo_privacy","enabled":true}`)
	}
	if len(em) > 0 {
		a.EnabledModules = em
	} else {
		a.EnabledModules = json.RawMessage("[]")
	}
	if len(ms) > 0 {
		a.MethodologySteps = ms
	} else {
		a.MethodologySteps = json.RawMessage("[]")
	}
	return a, err
}

func (h *Handler) HandleListAreas(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok || !h.requireFeature(w, r, uid, "research") {
		return
	}
	rows, err := h.pool.Query(r.Context(), `SELECT `+areaCols+` WHERE hub_area_read(ra.id, $1) ORDER BY ra.status = 'archived', ra.updated_at DESC`, uid)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer rows.Close()
	out := []area{}
	for rows.Next() {
		a, err := scanArea(rows)
		if err != nil {
			internal(w, r, err)
			return
		}
		out = append(out, a)
	}
	httpx.JSON(w, http.StatusOK, out)
}

type areaInput struct {
	Name                *string         `json:"name"`
	Description         *string         `json:"description"`
	Color               *string         `json:"color"`
	Status              *string         `json:"status"`
	IsPublic            *bool           `json:"is_public"`
	Discipline          *string         `json:"discipline"`
	Hypothesis          *string         `json:"hypothesis"`
	ReproducibilityLock *bool           `json:"reproducibility_lock"`
	CustomMetrics       json.RawMessage `json:"custom_metrics"`
	CustomFields        json.RawMessage `json:"custom_fields"`
	DataTypes           json.RawMessage `json:"data_types"`
	PrivacyShieldConfig json.RawMessage `json:"privacy_shield_config"`
	ComplianceVaultType *string         `json:"compliance_vault_type"`
	EnabledModules      json.RawMessage `json:"enabled_modules"`
	MethodologySteps    json.RawMessage `json:"methodology_steps"`
	TeamID              *string         `json:"team_id"`
}

var hexColorRe = regexp.MustCompile(`^#[0-9A-Fa-f]{6}$`)

func (in *areaInput) validate() string {
	if in.Name != nil && (strings.TrimSpace(*in.Name) == "" || len([]rune(*in.Name)) > 80) {
		return "Name must be 1-80 characters"
	}
	if in.Description != nil && len([]rune(*in.Description)) > 2000 {
		return "Description is too long"
	}
	if in.Color != nil && !hexColorRe.MatchString(*in.Color) {
		return "Colour must look like #A3122A"
	}
	if in.Status != nil && *in.Status != "active" && *in.Status != "paused" && *in.Status != "archived" {
		return "Status must be active, paused or archived"
	}
	if in.Hypothesis != nil && len([]rune(*in.Hypothesis)) > 4000 {
		return "Hypothesis is too long (4000 characters max)"
	}
	return ""
}

// teamWritable: the user is an active owner/editor of the team (needed to share things with it).
func (h *Handler) teamWritable(ctx context.Context, uid, teamID string) bool {
	var ok bool
	_ = h.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM team_members WHERE team_id = $1::uuid AND user_id = $2 AND status = 'active' AND role IN ('owner','editor'))`,
		teamID, uid).Scan(&ok)
	return ok
}

func (h *Handler) HandleCreateArea(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok || !h.requireFeature(w, r, uid, "research") {
		return
	}
	var in areaInput
	if !decodeJSON(w, r, &in, 64<<10) {
		return
	}
	if in.Name == nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_name", "Give the research area a name")
		return
	}
	if msg := in.validate(); msg != "" {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_area", msg)
		return
	}
	var team any
	if in.TeamID != nil && *in.TeamID != "" {
		if !validID(*in.TeamID) || !h.teamWritable(r.Context(), uid, *in.TeamID) {
			httpx.WriteError(w, r, http.StatusForbidden, "team_forbidden", "You can only share with teams you can edit")
			return
		}
		team = *in.TeamID
	}
	color := "#A3122A"
	if in.Color != nil {
		color = *in.Color
	}
	discipline := "zoology"
	if in.Discipline != nil && *in.Discipline != "" {
		discipline = *in.Discipline
	}
	hypothesis := ""
	if in.Hypothesis != nil {
		hypothesis = *in.Hypothesis
	}
	var cm any = []byte("[]")
	if len(in.CustomMetrics) > 0 {
		cm = in.CustomMetrics
	}
	var cf any = []byte("[]")
	if len(in.CustomFields) > 0 {
		cf = in.CustomFields
	}
	var dt any = []byte(`["Images"]`)
	if len(in.DataTypes) > 0 {
		dt = in.DataTypes
	}
	var psc any = []byte(`{"shield_type":"geo_privacy","enabled":true}`)
	if len(in.PrivacyShieldConfig) > 0 {
		psc = in.PrivacyShieldConfig
	}
	cvt := "permits"
	if in.ComplianceVaultType != nil && *in.ComplianceVaultType != "" {
		cvt = *in.ComplianceVaultType
	}
	var em any = []byte("[]")
	if len(in.EnabledModules) > 0 {
		em = in.EnabledModules
	}
	var ms any = []byte("[]")
	if len(in.MethodologySteps) > 0 {
		ms = in.MethodologySteps
	}
	var id string
	err := h.pool.QueryRow(r.Context(), `INSERT INTO research_areas (owner_id, creator_id, team_id, name, description, color, status, is_public, discipline, hypothesis, custom_metrics, custom_fields, data_types, privacy_shield_config, compliance_vault_type, enabled_modules, methodology_steps)
		VALUES ($1, $1, $2::uuid, $3, $4, $5, COALESCE($6, 'active'), COALESCE($7, false), $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14, $15::jsonb, $16::jsonb) RETURNING id::text`,
		uid, team, strings.TrimSpace(*in.Name), deref(in.Description), color, in.Status, in.IsPublic, discipline, hypothesis, cm, cf, dt, psc, cvt, em, ms).Scan(&id)
	if err != nil {
		internal(w, r, err)
		return
	}
	h.logActivity(r.Context(), uid, id, "created", "area", id, "created research area “"+strings.TrimSpace(*in.Name)+"”")
	a, _ := scanArea(h.pool.QueryRow(r.Context(), `SELECT `+areaCols+` WHERE ra.id = $2`, uid, id))
	httpx.JSON(w, http.StatusCreated, a)
}

func (h *Handler) HandleGetArea(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok || !h.requireFeature(w, r, uid, "research") {
		return
	}
	id := chi.URLParam(r, "id")
	if !validID(id) {
		notFound(w, r, "Research area")
		return
	}
	a, err := scanArea(h.pool.QueryRow(r.Context(), `SELECT `+areaCols+` WHERE ra.id = $2 AND hub_area_read(ra.id, $1)`, uid, id))
	if isNoRows(err) {
		notFound(w, r, "Research area")
		return
	}
	if err != nil {
		internal(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, a)
}

func (h *Handler) HandleUpdateArea(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok || !h.requireFeature(w, r, uid, "research") {
		return
	}
	id := chi.URLParam(r, "id")
	var in areaInput
	if !validID(id) || !decodeJSON(w, r, &in, 64<<10) {
		if !validID(id) {
			notFound(w, r, "Research area")
		}
		return
	}
	if msg := in.validate(); msg != "" {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_area", msg)
		return
	}
	ctx := r.Context()
	var owner string
	var allowed bool
	if err := h.pool.QueryRow(ctx, `SELECT owner_id::text, hub_area_write(id, $2) FROM research_areas WHERE id = $1`, id, uid).Scan(&owner, &allowed); err != nil || !allowed {
		notFound(w, r, "Research area")
		return
	}
	setTeam, team := false, any(nil)
	if in.TeamID != nil {
		if owner != uid {
			httpx.WriteError(w, r, http.StatusForbidden, "owner_only", "Only the area's owner can change who it is shared with")
			return
		}
		setTeam = true
		if *in.TeamID != "" {
			if !validID(*in.TeamID) || !h.teamWritable(ctx, uid, *in.TeamID) {
				httpx.WriteError(w, r, http.StatusForbidden, "team_forbidden", "You can only share with teams you can edit")
				return
			}
			team = *in.TeamID
		}
	}
	var cm any = nil
	if len(in.CustomMetrics) > 0 {
		cm = in.CustomMetrics
	}
	var cf any = nil
	if len(in.CustomFields) > 0 {
		cf = in.CustomFields
	}
	var dt any = nil
	if len(in.DataTypes) > 0 {
		dt = in.DataTypes
	}
	var psc any = nil
	if len(in.PrivacyShieldConfig) > 0 {
		psc = in.PrivacyShieldConfig
	}
	var em any = nil
	if len(in.EnabledModules) > 0 {
		em = in.EnabledModules
	}
	var ms any = nil
	if len(in.MethodologySteps) > 0 {
		ms = in.MethodologySteps
	}
	if _, err := h.pool.Exec(ctx, `UPDATE research_areas SET name = COALESCE($2, name), description = COALESCE($3, description),
		color = COALESCE($4, color), status = COALESCE($5, status), is_public = COALESCE($6, is_public),
		discipline = COALESCE($7, discipline), hypothesis = COALESCE($8, hypothesis),
		reproducibility_lock = COALESCE($9, reproducibility_lock),
		custom_metrics = CASE WHEN $10::jsonb IS NOT NULL THEN $10::jsonb ELSE custom_metrics END,
		custom_fields = CASE WHEN $11::jsonb IS NOT NULL THEN $11::jsonb ELSE custom_fields END,
		data_types = CASE WHEN $12::jsonb IS NOT NULL THEN $12::jsonb ELSE data_types END,
		privacy_shield_config = CASE WHEN $13::jsonb IS NOT NULL THEN $13::jsonb ELSE privacy_shield_config END,
		compliance_vault_type = COALESCE($14, compliance_vault_type),
		enabled_modules = CASE WHEN $15::jsonb IS NOT NULL THEN $15::jsonb ELSE enabled_modules END,
		methodology_steps = CASE WHEN $16::jsonb IS NOT NULL THEN $16::jsonb ELSE methodology_steps END,
		team_id = CASE WHEN $17 THEN $18::uuid ELSE team_id END, updated_at = now() WHERE id = $1`,
		id, trimPtr(in.Name), trimPtr(in.Description), in.Color, in.Status, in.IsPublic,
		in.Discipline, in.Hypothesis, in.ReproducibilityLock, cm, cf, dt, psc, in.ComplianceVaultType, em, ms, setTeam, team); err != nil {
		internal(w, r, err)
		return
	}
	if setTeam && team != nil {
		h.logActivity(ctx, uid, id, "shared", "area", id, "shared this area with the team")
	}
	h.HandleGetArea(w, r)
}

func (h *Handler) HandleDeleteArea(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok || !h.requireFeature(w, r, uid, "research") {
		return
	}
	id := chi.URLParam(r, "id")
	if !validID(id) {
		notFound(w, r, "Research area")
		return
	}
	tag, err := h.pool.Exec(r.Context(), `DELETE FROM research_areas WHERE id = $1 AND owner_id = $2`, id, uid)
	if err != nil {
		internal(w, r, err)
		return
	}
	if tag.RowsAffected() == 0 {
		notFound(w, r, "Research area")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- overview

func (h *Handler) HandleResearchOverview(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok || !h.requireFeature(w, r, uid, "research") {
		return
	}
	ctx := r.Context()
	scope := func(t string) string {
		return `FROM ` + t + ` t WHERE (t.owner_id = $1 OR (t.area_id IS NOT NULL AND hub_area_read(t.area_id, $1)))`
	}
	var areas, papers, published, inReview, exps, running, findings, notes, toRead, openTasks int
	_ = h.pool.QueryRow(ctx, `SELECT
		(SELECT count(*) FROM research_areas ra WHERE hub_area_read(ra.id, $1) AND ra.status <> 'archived'),
		(SELECT count(*) `+scope("papers")+`),
		(SELECT count(*) `+scope("papers")+` AND (t.status = 'published' OR t.on_layerto)),
		(SELECT count(*) `+scope("papers")+` AND t.status IN ('submitted','under_review')),
		(SELECT count(*) `+scope("experiments")+`),
		(SELECT count(*) `+scope("experiments")+` AND t.status = 'running'),
		(SELECT count(*) `+scope("findings")+`),
		(SELECT count(*) `+scope("research_notes")+`),
		(SELECT count(*) `+scope("literature")+` AND t.status = 'to_read'),
		(SELECT count(*) `+scope("research_tasks")+` AND NOT t.done)`, uid).
		Scan(&areas, &papers, &published, &inReview, &exps, &running, &findings, &notes, &toRead, &openTasks)

	upRows, _ := h.pool.Query(ctx, `SELECT `+entTasks.selectCols()+` WHERE `+readScope+` AND NOT t.done AND t.due_date IS NOT NULL
		AND t.due_date <= current_date + 45 ORDER BY t.due_date LIMIT 10`, uid)
	upcoming := []map[string]any{}
	if upRows != nil {
		upcoming, _ = rowsToMaps(upRows)
	}
	expRows, _ := h.pool.Query(ctx, `SELECT `+entExperiments.selectCols()+` WHERE `+readScope+` ORDER BY t.updated_at DESC LIMIT 6`, uid)
	recent := []map[string]any{}
	if expRows != nil {
		recent, _ = rowsToMaps(expRows)
	}
	info, _ := h.userPlan(ctx, uid)
	u, _ := h.usage(ctx, uid)
	var gpuSeconds int64
	_ = h.pool.QueryRow(ctx, `SELECT seconds FROM gpu_credits WHERE user_id = $1`, uid).Scan(&gpuSeconds)
	var allocatedStorage, allocatedGpuCredits, usedGpuCredits int64
	_ = h.pool.QueryRow(ctx, `SELECT COALESCE(SUM(storage_quota_bytes), 0), COALESCE(SUM(gpu_credits_budget), 0), COALESCE(SUM(gpu_credits_used), 0)
		FROM research_areas WHERE (owner_id = $1 OR creator_id = $1) AND status <> 'archived'`, uid).Scan(&allocatedStorage, &allocatedGpuCredits, &usedGpuCredits)
	storageLimit := int64(info.Plan.StorageMB) << 20
	storageUnallocated := storageLimit - allocatedStorage
	if storageUnallocated < 0 {
		storageUnallocated = 0
	}
	gpuCreditsLimit := gpuSeconds / 36
	gpuCreditsUnallocated := gpuCreditsLimit - allocatedGpuCredits
	if gpuCreditsUnallocated < 0 {
		gpuCreditsUnallocated = 0
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"areas": areas, "papers": papers, "papers_published": published, "papers_in_review": inReview,
		"experiments": exps, "experiments_running": running, "findings": findings, "notes": notes,
		"to_read": toRead, "open_tasks": openTasks, "upcoming": upcoming, "recent_experiments": recent,
		"storage_bytes":             u.StorageBytes,
		"storage_limit_bytes":       storageLimit,
		"storage_allocated_bytes":   allocatedStorage,
		"storage_unallocated_bytes": storageUnallocated,
		"gpu_credits":               gpuCreditsLimit - usedGpuCredits,
		"gpu_credits_limit":         gpuCreditsLimit,
		"gpu_credits_allocated":     allocatedGpuCredits,
		"gpu_credits_used":          usedGpuCredits,
		"gpu_hours":                 math.Round(float64(gpuSeconds)/36) / 100,
		"plan":                      info.Plan.Name,
	})
}

type allocationItem struct {
	AreaID            string `json:"area_id"`
	StorageQuotaBytes int64  `json:"storage_quota_bytes"`
	GpuCreditsBudget  int64  `json:"gpu_credits_budget"`
}

type updateAllocationsPayload struct {
	Allocations []allocationItem `json:"allocations"`
}

func (h *Handler) HandleUpdateAllocations(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok || !h.requireFeature(w, r, uid, "research") {
		return
	}
	var in updateAllocationsPayload
	if !decodeJSON(w, r, &in, 64<<10) {
		return
	}
	ctx := r.Context()

	info, err := h.userPlan(ctx, uid)
	if err != nil {
		internal(w, r, err)
		return
	}
	storageLimit := int64(info.Plan.StorageMB) << 20

	var gpuSeconds int64
	_ = h.pool.QueryRow(ctx, `SELECT seconds FROM gpu_credits WHERE user_id = $1`, uid).Scan(&gpuSeconds)
	gpuCreditsLimit := gpuSeconds / 36

	var totalAllocatedStorage, totalAllocatedGpuCredits int64
	for _, it := range in.Allocations {
		if !validID(it.AreaID) {
			httpx.WriteError(w, r, http.StatusBadRequest, "invalid_id", "Invalid area ID in allocations")
			return
		}
		if it.StorageQuotaBytes < 0 || it.GpuCreditsBudget < 0 {
			httpx.WriteError(w, r, http.StatusBadRequest, "invalid_value", "Allocations cannot be negative")
			return
		}
		totalAllocatedStorage += it.StorageQuotaBytes
		totalAllocatedGpuCredits += it.GpuCreditsBudget
	}

	if totalAllocatedStorage > storageLimit {
		httpx.WriteError(w, r, http.StatusBadRequest, "storage_pool_exceeded",
			fmt.Sprintf("Total allocated storage (%d GB) exceeds your global pool limit (%d GB)",
				totalAllocatedStorage/(1<<30), storageLimit/(1<<30)))
		return
	}

	if totalAllocatedGpuCredits > gpuCreditsLimit {
		httpx.WriteError(w, r, http.StatusBadRequest, "gpu_pool_exceeded",
			fmt.Sprintf("Total allocated GPU credits (%d) exceeds your available pool (%d credits)",
				totalAllocatedGpuCredits, gpuCreditsLimit))
		return
	}

	tx, err := h.pool.Begin(ctx)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer tx.Rollback(ctx)

	for _, it := range in.Allocations {
		_, err := tx.Exec(ctx, `UPDATE research_areas SET storage_quota_bytes = $1, gpu_credits_budget = $2, updated_at = now()
			WHERE id = $3 AND (owner_id = $4 OR creator_id = $4)`, it.StorageQuotaBytes, it.GpuCreditsBudget, it.AreaID, uid)
		if err != nil {
			internal(w, r, err)
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		internal(w, r, err)
		return
	}

	h.HandleListAreas(w, r)
}

// ---- activity feed: own actions, shared areas and teams

func (h *Handler) HandleActivity(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	q := `SELECT a.id, COALESCE(up.username, ''), a.area_id::text, COALESCE(ra.name, ''), a.team_id::text, a.verb, a.object_type, a.object_id, a.summary, a.created_at
		FROM hub_activity a LEFT JOIN user_profiles up ON up.user_id = a.actor_id LEFT JOIN research_areas ra ON ra.id = a.area_id
		WHERE (a.actor_id = $1 OR (a.area_id IS NOT NULL AND hub_area_read(a.area_id, $1))
		   OR (a.team_id IS NOT NULL AND EXISTS (SELECT 1 FROM team_members m WHERE m.team_id = a.team_id AND m.user_id = $1 AND m.status = 'active')))`
	args := []any{uid}
	if a := r.URL.Query().Get("area"); validID(a) {
		args = append(args, a)
		q += ` AND a.area_id = $2`
	} else if t := r.URL.Query().Get("team"); validID(t) {
		args = append(args, t)
		q += ` AND a.team_id = $2`
	}
	rows, err := h.pool.Query(r.Context(), q+` ORDER BY a.id DESC LIMIT 100`, args...)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id int64
		var actor, verb, ot, oid, summary, areaName string
		var areaID, teamID *string
		var c time.Time
		if rows.Scan(&id, &actor, &areaID, &areaName, &teamID, &verb, &ot, &oid, &summary, &c) == nil {
			out = append(out, map[string]any{"id": id, "actor": actor, "area_id": areaID, "area_name": areaName, "team_id": teamID,
				"verb": verb, "object_type": ot, "object_id": oid, "summary": summary, "created_at": ts(c)})
		}
	}
	httpx.JSON(w, http.StatusOK, out)
}

// ---- experiments recorded from training runs

func (h *Handler) startExperimentTx(ctx context.Context, tx pgx.Tx, uid, jobID string, projectID *string, name string, p trainParams) error {
	pj, _ := json.Marshal(p)
	_, err := tx.Exec(ctx, `INSERT INTO experiments (owner_id, area_id, project_id, job_id, name, status, params, tags)
		VALUES ($1, (SELECT pr.area_id FROM projects pr JOIN research_areas ra ON ra.id = pr.area_id WHERE pr.id = $2::uuid),
		        $2::uuid, $3, $4, 'planned', $5, '["training"]')`, uid, projectID, jobID, name, pj)
	return err
}

func pctStr(v any) string {
	if f, ok := v.(float64); ok {
		return fmt.Sprintf("%.1f%%", f*100)
	}
	return "—"
}

// completeExperimentTx marks the run's experiment done, copies its metrics and learning curve, and
// writes an automatic lab note comparing it with the best earlier run in the same project.
func (h *Handler) completeExperimentTx(ctx context.Context, tx pgx.Tx, jobID, modelSlug string, metrics map[string]any) error {
	var expID, owner, name string
	var area, project *string
	err := tx.QueryRow(ctx, `UPDATE experiments e SET status = 'done', metrics = $2, history = j.history, updated_at = now()
		FROM training_jobs j WHERE e.job_id = j.id AND j.id = $1
		RETURNING e.id::text, e.owner_id::text, e.name, e.area_id::text, e.project_id::text`, jobID, mustJSON(metrics)).
		Scan(&expID, &owner, &name, &area, &project)
	if isNoRows(err) {
		return nil // runs from before the research workspace existed
	}
	if err != nil {
		return err
	}
	var prevName string
	var prevMap *float64
	if project != nil {
		_ = tx.QueryRow(ctx, `SELECT name, (metrics->>'map50_95')::float8 FROM experiments
			WHERE project_id = $1::uuid AND id <> $2::uuid AND status = 'done' AND metrics ? 'map50_95'
			ORDER BY (metrics->>'map50_95')::float8 DESC LIMIT 1`, *project, expID).Scan(&prevName, &prevMap)
	}
	var b strings.Builder
	fmt.Fprintf(&b, "Training run “%s” finished.\n\n", name)
	fmt.Fprintf(&b, "- Model: %s\n", modelSlug)
	if s, ok := metrics["size"].(string); ok {
		fmt.Fprintf(&b, "- LTVision-%s", s)
		if e, ok := metrics["epochs"].(float64); ok {
			fmt.Fprintf(&b, ", %d epochs", int(e))
		}
		if im, ok := metrics["img"].(float64); ok {
			fmt.Fprintf(&b, " at %d px", int(im))
		}
		b.WriteString("\n")
	}
	fmt.Fprintf(&b, "- mAP50-95 %s, mAP50 %s", pctStr(metrics["map50_95"]), pctStr(metrics["map50"]))
	if v, ok := metrics["map75"]; ok {
		fmt.Fprintf(&b, ", mAP75 %s", pctStr(v))
	}
	if be, ok := metrics["best_epoch"].(float64); ok {
		fmt.Fprintf(&b, " (best epoch %d)", int(be))
	}
	b.WriteString("\n")
	if cur, ok := metrics["map50_95"].(float64); ok && prevMap != nil {
		diff := (cur - *prevMap) * 100
		verdict := "better than"
		if diff < 0 {
			verdict = "worse than"
		} else if math.Abs(diff) < 0.05 {
			verdict = "the same as"
		}
		fmt.Fprintf(&b, "- %+.1f points mAP50-95: %s the previous best run in this project (“%s”, %s)\n", diff, verdict, prevName, pctStr(*prevMap))
	}
	b.WriteString("\nMeasured by Layerto on the held-out validation split. Add your interpretation below.")
	_, err = tx.Exec(ctx, `INSERT INTO research_notes (owner_id, area_id, title, body, auto) VALUES ($1, $2::uuid, $3, $4, true)`,
		owner, area, truncate("Run summary: "+name, 200), b.String())
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO hub_activity (actor_id, area_id, team_id, verb, object_type, object_id, summary)
		VALUES ($1, $2::uuid, (SELECT team_id FROM research_areas WHERE id = $2::uuid), 'finished', 'experiment', $3, $4)`,
		owner, area, expID, truncate(fmt.Sprintf("training run “%s” finished: mAP50-95 %s", name, pctStr(metrics["map50_95"])), 300))
	return err
}

func mustJSON(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}

// ---- papers: PDF, BibTeX, publishing on Layerto

func (h *Handler) paperAccess(ctx context.Context, uid, id string, write bool) (owner string, ok bool) {
	var area *string
	if err := h.pool.QueryRow(ctx, `SELECT owner_id::text, area_id::text FROM papers WHERE id = $1`, id).Scan(&owner, &area); err != nil {
		return "", false
	}
	if owner == uid {
		return owner, true
	}
	if area == nil {
		return owner, false
	}
	fn := "hub_area_read"
	if write {
		fn = "hub_area_write"
	}
	var allowed bool
	_ = h.pool.QueryRow(ctx, `SELECT `+fn+`($1::uuid, $2::uuid)`, *area, uid).Scan(&allowed)
	return owner, allowed
}

func (h *Handler) checkStorage(ctx context.Context, uid string, add int64) bool {
	info, err := h.userPlan(ctx, uid)
	if err != nil {
		return false
	}
	u, err := h.usage(ctx, uid)
	if err != nil {
		return false
	}
	return u.StorageBytes+add <= info.Plan.StorageMB<<20
}

func storageFull(w http.ResponseWriter, r *http.Request) {
	httpx.WriteError(w, r, http.StatusForbidden, "storage_full", "Your storage is full. Delete files or add a storage add-on in Plan.")
}

// POST /api/research/papers/{id}/pdf  multipart "file"
func (h *Handler) HandleUploadPaperPDF(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok || !h.requireFeature(w, r, uid, "research") {
		return
	}
	id := chi.URLParam(r, "id")
	if !validID(id) {
		notFound(w, r, "Paper")
		return
	}
	owner, allowed := h.paperAccess(r.Context(), uid, id, true)
	if !allowed {
		notFound(w, r, "Paper")
		return
	}
	data, ok := readUpload(w, r, "file", 50<<20)
	if !ok {
		return
	}
	if !bytes.HasPrefix(data, []byte("%PDF-")) {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_pdf", "That isn't a PDF file")
		return
	}
	var old int64
	_ = h.pool.QueryRow(r.Context(), `SELECT pdf_bytes FROM papers WHERE id = $1`, id).Scan(&old)
	if !h.checkStorage(r.Context(), owner, int64(len(data))-old) {
		storageFull(w, r)
		return
	}
	key := "papers/" + id + ".pdf"
	if err := h.store.Put(key, data); err != nil {
		internal(w, r, err)
		return
	}
	if _, err := h.pool.Exec(r.Context(), `UPDATE papers SET pdf_key = $2, pdf_bytes = $3, updated_at = now() WHERE id = $1`, id, key, len(data)); err != nil {
		internal(w, r, err)
		return
	}
	m, _ := h.researchGetOne(r.Context(), entPapers, uid, id)
	httpx.JSON(w, http.StatusOK, m)
}

func readUpload(w http.ResponseWriter, r *http.Request, field string, max int64) ([]byte, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, max+(1<<20))
	f, _, err := r.FormFile(field)
	if err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_upload", fmt.Sprintf("Upload a file in the %q field (max %d MB)", field, max>>20))
		return nil, false
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, max+1))
	if err != nil || int64(len(data)) > max {
		httpx.WriteError(w, r, http.StatusRequestEntityTooLarge, "file_too_large", fmt.Sprintf("The file must be under %d MB", max>>20))
		return nil, false
	}
	return data, true
}

// GET /api/research/papers/{id}/pdf
func (h *Handler) HandlePaperPDF(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if !validID(id) {
		notFound(w, r, "Paper")
		return
	}
	if _, allowed := h.paperAccess(r.Context(), uid, id, false); !allowed {
		notFound(w, r, "Paper")
		return
	}
	h.servePaperPDF(w, r, id)
}

func (h *Handler) servePaperPDF(w http.ResponseWriter, r *http.Request, id string) {
	var key, title string
	if err := h.pool.QueryRow(r.Context(), `SELECT pdf_key, title FROM papers WHERE id = $1`, id).Scan(&key, &title); err != nil || key == "" {
		notFound(w, r, "PDF")
		return
	}
	data, err := h.store.Get(key)
	if err != nil {
		notFound(w, r, "PDF")
		return
	}
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s.pdf"`, slugify(title, 60)))
	_, _ = w.Write(data)
}

// bibtex builds a BibTeX entry for a paper.
func bibtex(p map[string]any) string {
	str := func(k string) string { s, _ := p[k].(string); return s }
	authors := []string{}
	if list, ok := p["authors"].([]any); ok {
		for _, a := range list {
			if s, ok := a.(string); ok && s != "" {
				authors = append(authors, s)
			}
		}
	}
	year := ""
	switch y := p["year"].(type) {
	case int32:
		year = fmt.Sprint(y)
	case int64:
		year = fmt.Sprint(y)
	case float64:
		year = fmt.Sprint(int(y))
	}
	first := "anon"
	if len(authors) > 0 {
		parts := strings.Fields(authors[0])
		first = strings.ToLower(regexp.MustCompile(`[^A-Za-z]`).ReplaceAllString(parts[len(parts)-1], ""))
	}
	titleWord := ""
	for _, wd := range strings.Fields(str("title")) {
		if len(wd) > 3 {
			titleWord = strings.ToLower(regexp.MustCompile(`[^A-Za-z]`).ReplaceAllString(wd, ""))
			break
		}
	}
	kind := "article"
	if str("venue") == "" {
		kind = "misc"
	}
	var b strings.Builder
	fmt.Fprintf(&b, "@%s{%s%s%s,\n", kind, first, year, titleWord)
	fmt.Fprintf(&b, "  title = {%s},\n", str("title"))
	if len(authors) > 0 {
		fmt.Fprintf(&b, "  author = {%s},\n", strings.Join(authors, " and "))
	}
	if str("venue") != "" {
		fmt.Fprintf(&b, "  journal = {%s},\n", str("venue"))
	}
	if year != "" {
		fmt.Fprintf(&b, "  year = {%s},\n", year)
	}
	if str("doi") != "" {
		fmt.Fprintf(&b, "  doi = {%s},\n", str("doi"))
	}
	if str("arxiv") != "" {
		fmt.Fprintf(&b, "  eprint = {%s},\n  archivePrefix = {arXiv},\n", str("arxiv"))
	}
	if str("url") != "" {
		fmt.Fprintf(&b, "  url = {%s},\n", str("url"))
	}
	b.WriteString("}\n")
	return b.String()
}

// GET /api/research/papers/{id}/bibtex
func (h *Handler) HandlePaperBibtex(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if !validID(id) {
		notFound(w, r, "Paper")
		return
	}
	m, err := h.researchGetOne(r.Context(), entPapers, uid, id)
	if err != nil {
		notFound(w, r, "Paper")
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = io.WriteString(w, bibtex(m))
}

// POST /api/research/papers/{id}/publish {"on_layerto": true}
func (h *Handler) HandlePublishPaper(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok || !h.requireFeature(w, r, uid, "research") {
		return
	}
	id := chi.URLParam(r, "id")
	var in struct {
		OnLayerto bool `json:"on_layerto"`
	}
	if !validID(id) || !decodeJSON(w, r, &in, 256) {
		if !validID(id) {
			notFound(w, r, "Paper")
		}
		return
	}
	var owner, abstract string
	var authors []byte
	if err := h.pool.QueryRow(r.Context(), `SELECT owner_id::text, abstract, authors FROM papers WHERE id = $1`, id).Scan(&owner, &abstract, &authors); err != nil || owner != uid {
		notFound(w, r, "Paper")
		return
	}
	if in.OnLayerto {
		if len([]rune(strings.TrimSpace(abstract))) < 50 {
			httpx.WriteError(w, r, http.StatusBadRequest, "abstract_needed", "Add an abstract (at least 50 characters) before publishing")
			return
		}
		if len(jsonStrings(authors)) == 0 {
			httpx.WriteError(w, r, http.StatusBadRequest, "authors_needed", "Add at least one author before publishing")
			return
		}
	}
	if _, err := h.pool.Exec(r.Context(), `UPDATE papers SET on_layerto = $2,
		published_at = CASE WHEN $2 THEN COALESCE(published_at, now()) ELSE NULL END, updated_at = now() WHERE id = $1`, id, in.OnLayerto); err != nil {
		internal(w, r, err)
		return
	}
	if in.OnLayerto {
		var title string
		var area *string
		_ = h.pool.QueryRow(r.Context(), `SELECT title, area_id::text FROM papers WHERE id = $1`, id).Scan(&title, &area)
		var a any
		if area != nil {
			a = *area
		}
		h.logActivity(r.Context(), uid, a, "published", "paper", id, "published paper “"+title+"” on Layerto")
	}
	m, _ := h.researchGetOne(r.Context(), entPapers, uid, id)
	httpx.JSON(w, http.StatusOK, m)
}

// public publications

const publicPaperCols = `p.id::text, p.title, p.authors, p.venue, p.year, p.status, p.doi, p.arxiv, p.url, p.abstract, p.keywords,
	p.pdf_key <> '', p.published_at, p.model_slugs, COALESCE(up.username, ''), COALESCE(up.first_name || ' ' || up.last_name, '')
	FROM papers p JOIN users u ON u.id = p.owner_id LEFT JOIN user_profiles up ON up.user_id = p.owner_id`

func scanPublicPaper(row pgx.Row) (map[string]any, error) {
	var id, title, venue, status, doi, arxiv, url, abstract, owner, ownerName string
	var authors, keywords, models []byte
	var year *int32
	var hasPDF bool
	var pub *time.Time
	if err := row.Scan(&id, &title, &authors, &venue, &year, &status, &doi, &arxiv, &url, &abstract, &keywords, &hasPDF, &pub, &models, &owner, &ownerName); err != nil {
		return nil, err
	}
	m := map[string]any{"id": id, "title": title, "authors": jsonStrings(authors), "venue": venue, "year": year, "status": status,
		"doi": doi, "arxiv": arxiv, "url": url, "abstract": abstract, "keywords": jsonStrings(keywords), "has_pdf": hasPDF,
		"model_slugs": jsonStrings(models), "owner": owner, "owner_name": strings.TrimSpace(ownerName)}
	if pub != nil {
		m["published_at"] = ts(*pub)
	}
	m["bibtex"] = bibtex(map[string]any{"title": title, "authors": anyStrings(jsonStrings(authors)), "venue": venue, "year": int32OrNil(year), "doi": doi, "arxiv": arxiv, "url": url})
	return m, nil
}

func anyStrings(s []string) []any {
	out := make([]any, len(s))
	for i, v := range s {
		out[i] = v
	}
	return out
}

func int32OrNil(v *int32) any {
	if v == nil {
		return nil
	}
	return *v
}

// GET /v1/public/papers?q=&author=
func (h *Handler) HandlePublicPapers(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	author := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("author")))
	rows, err := h.pool.Query(r.Context(), `SELECT `+publicPaperCols+`
		WHERE p.on_layerto AND u.status = 'active'
		  AND ($1 = '' OR p.title ILIKE '%' || $1 || '%' OR p.abstract ILIKE '%' || $1 || '%' OR p.keywords::text ILIKE '%' || $1 || '%')
		  AND ($2 = '' OR up.username = $2)
		ORDER BY p.published_at DESC LIMIT 100`, q, author)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		m, err := scanPublicPaper(rows)
		if err == nil {
			out = append(out, m)
		}
	}
	httpx.JSON(w, http.StatusOK, out)
}

// GET /v1/public/papers/{id}
func (h *Handler) HandlePublicPaper(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !validID(id) {
		notFound(w, r, "Paper")
		return
	}
	m, err := scanPublicPaper(h.pool.QueryRow(r.Context(), `SELECT `+publicPaperCols+` WHERE p.id = $1 AND p.on_layerto AND u.status = 'active'`, id))
	if err != nil {
		notFound(w, r, "Paper")
		return
	}
	httpx.JSON(w, http.StatusOK, m)
}

// GET /v1/public/papers/{id}/pdf
func (h *Handler) HandlePublicPaperPDF(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var on bool
	if !validID(id) || h.pool.QueryRow(r.Context(), `SELECT on_layerto FROM papers WHERE id = $1`, id).Scan(&on) != nil || !on {
		notFound(w, r, "PDF")
		return
	}
	h.servePaperPDF(w, r, id)
}

// ---- literature: BibTeX import

var bibFieldRe = regexp.MustCompile(`(?s)(\w+)\s*=\s*(\{((?:[^{}]|\{[^{}]*\})*)\}|"([^"]*)"|(\d+))`)

// parseBibtex reads entries from BibTeX text (title, author, year, journal/booktitle, doi, url),
// matching braces so one-line and multi-line entries both work.
func parseBibtex(text string) []map[string]string {
	out := []map[string]string{}
	for i := 0; i < len(text) && len(out) < 500; i++ {
		if text[i] != '@' {
			continue
		}
		open := strings.IndexByte(text[i:], '{')
		if open < 0 {
			break
		}
		start := i + open
		depth, end := 0, -1
		for j := start; j < len(text); j++ {
			if text[j] == '{' {
				depth++
			} else if text[j] == '}' {
				depth--
				if depth == 0 {
					end = j
					break
				}
			}
		}
		if end < 0 {
			break
		}
		body := text[start+1 : end]
		f := map[string]string{"_raw": text[i : end+1]}
		if c := strings.IndexByte(body, ','); c >= 0 {
			body = body[c+1:]
		}
		for _, m := range bibFieldRe.FindAllStringSubmatch(body, -1) {
			v := m[3]
			if v == "" {
				v = m[4]
			}
			if v == "" {
				v = m[5]
			}
			v = strings.Join(strings.Fields(strings.NewReplacer("{", "", "}", "").Replace(latexToUnicode(v))), " ")
			f[strings.ToLower(m[1])] = v
		}
		if f["title"] != "" {
			out = append(out, f)
		}
		i = end
	}
	return out
}

// POST /api/research/literature/import {"bibtex": "...", "area_id": "..."}
func (h *Handler) HandleImportBibtex(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok || !h.requireFeature(w, r, uid, "research") {
		return
	}
	var in struct {
		Bibtex string `json:"bibtex"`
		AreaID string `json:"area_id"`
	}
	if !decodeJSON(w, r, &in, 512<<10) {
		return
	}
	var area any
	if in.AreaID != "" {
		if !validID(in.AreaID) || !h.checkAreaWrite(r.Context(), uid, in.AreaID) {
			httpx.WriteError(w, r, http.StatusForbidden, "area_forbidden", "You can't add to that research area")
			return
		}
		area = in.AreaID
	}
	entries := parseBibtex(in.Bibtex)
	if len(entries) == 0 {
		httpx.WriteError(w, r, http.StatusBadRequest, "no_entries", "No BibTeX entries with a title were found")
		return
	}
	added := 0
	for _, e := range entries {
		var year any
		var y int
		if _, err := fmt.Sscanf(e["year"], "%d", &y); err == nil && y > 1500 && y < 2200 {
			year = y
		}
		venue := e["journal"]
		if venue == "" {
			venue = e["booktitle"]
		}
		url := e["url"]
		if url == "" && e["eprint"] != "" {
			url = "https://arxiv.org/abs/" + e["eprint"]
		}
		if _, err := h.pool.Exec(r.Context(), `INSERT INTO literature (owner_id, area_id, title, authors, year, venue, url, doi, bibtex)
			VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8, $9)`, uid, area, truncate(e["title"], 400), truncate(e["author"], 1000), year,
			truncate(venue, 300), truncate(url, 500), truncate(e["doi"], 200), truncate(e["_raw"], 10000)); err == nil {
			added++
		}
	}
	h.logActivity(r.Context(), uid, area, "imported", "reference", "", fmt.Sprintf("imported %d references from BibTeX", added))
	httpx.JSON(w, http.StatusOK, map[string]any{"added": added, "found": len(entries)})
}

// ---- files

var allowedFileExt = map[string]string{
	".pdf": "application/pdf", ".csv": "text/csv", ".tsv": "text/tab-separated-values", ".json": "application/json",
	".txt": "text/plain", ".md": "text/markdown", ".tex": "text/x-tex", ".bib": "text/plain", ".zip": "application/zip",
	".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml",
	".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation", ".py": "text/x-python",
	".ipynb": "application/json", ".yaml": "text/yaml", ".yml": "text/yaml", ".npy": "application/octet-stream", ".pt": "application/octet-stream",
}

func (h *Handler) HandleListFiles(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok || !h.requireFeature(w, r, uid, "research") {
		return
	}
	q := `SELECT t.id::text, t.name, t.mime, t.bytes, t.area_id::text, COALESCE(up.username, ''), t.created_at FROM research_files t
		LEFT JOIN user_profiles up ON up.user_id = t.owner_id WHERE ` + readScope
	args := []any{uid}
	if a := r.URL.Query().Get("area"); validID(a) {
		args = append(args, a)
		q += ` AND t.area_id = $2`
	}
	rows, err := h.pool.Query(r.Context(), q+` ORDER BY t.created_at DESC LIMIT 500`, args...)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, name, mime, owner string
		var n int64
		var area *string
		var c time.Time
		if rows.Scan(&id, &name, &mime, &n, &area, &owner, &c) == nil {
			out = append(out, map[string]any{"id": id, "name": name, "mime": mime, "bytes": n, "area_id": area, "owner": owner, "created_at": ts(c)})
		}
	}
	httpx.JSON(w, http.StatusOK, out)
}

// POST /api/research/files  multipart: file, area_id
func (h *Handler) HandleUploadFile(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok || !h.requireFeature(w, r, uid, "research") {
		return
	}
	data, ok := readUpload(w, r, "file", 100<<20)
	if !ok {
		return
	}
	_, hdr, _ := r.FormFile("file")
	name := filepath.Base(strings.TrimSpace(hdr.Filename))
	mime, allowed := allowedFileExt[strings.ToLower(filepath.Ext(name))]
	if !allowed || len(name) > 200 {
		httpx.WriteError(w, r, http.StatusBadRequest, "file_type", "That file type isn't supported. Use PDF, CSV, JSON, TXT, Markdown, LaTeX, ZIP, images, Office files, notebooks or weights.")
		return
	}
	var area any
	if a := r.FormValue("area_id"); a != "" {
		if !validID(a) || !h.checkAreaWrite(r.Context(), uid, a) {
			httpx.WriteError(w, r, http.StatusForbidden, "area_forbidden", "You can't add to that research area")
			return
		}
		area = a
	}
	if !h.checkStorage(r.Context(), uid, int64(len(data))) {
		storageFull(w, r)
		return
	}
	var id string
	if err := h.pool.QueryRow(r.Context(), `SELECT gen_random_uuid()::text`).Scan(&id); err != nil {
		internal(w, r, err)
		return
	}
	key := "research/" + uid + "/" + id
	if err := h.store.Put(key, data); err != nil {
		internal(w, r, err)
		return
	}
	if _, err := h.pool.Exec(r.Context(), `INSERT INTO research_files (id, owner_id, area_id, name, mime, bytes, storage_key) VALUES ($1,$2,$3::uuid,$4,$5,$6,$7)`,
		id, uid, area, name, mime, len(data), key); err != nil {
		_ = h.store.Delete(key)
		internal(w, r, err)
		return
	}
	h.logActivity(r.Context(), uid, area, "uploaded", "file", id, "uploaded file “"+name+"”")
	httpx.JSON(w, http.StatusCreated, map[string]any{"id": id, "name": name, "mime": mime, "bytes": len(data), "area_id": area})
}

// GET /api/research/files/{id}
func (h *Handler) HandleDownloadFile(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	var key, name, mime string
	if !validID(id) || h.pool.QueryRow(r.Context(), `SELECT t.storage_key, t.name, t.mime FROM research_files t WHERE t.id = $2 AND `+readScope, uid, id).
		Scan(&key, &name, &mime) != nil {
		notFound(w, r, "File")
		return
	}
	data, err := h.store.Get(key)
	if err != nil {
		notFound(w, r, "File")
		return
	}
	w.Header().Set("Content-Type", mime)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, strings.ReplaceAll(name, `"`, "")))
	_, _ = w.Write(data)
}

var entFiles = &entity{table: "research_files", noun: "file", titleField: "name", order: "t.created_at DESC"}

// ---- portfolio sites (<subdomain>.layerto.com)

var reservedSubdomains = map[string]bool{"www": true, "api": true, "app": true, "admin": true, "dashboard": true, "docs": true,
	"mail": true, "status": true, "blog": true, "help": true, "support": true, "layerto": true, "static": true, "cdn": true, "wiki": true}
var subdomainRe = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$`)

func (h *Handler) HandleGetPortfolio(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	var sub, about string
	var enabled bool
	var theme, sections []byte
	err := h.pool.QueryRow(ctx, `SELECT subdomain, enabled, theme, sections, about FROM portfolios WHERE user_id = $1`, uid).Scan(&sub, &enabled, &theme, &sections, &about)
	if isNoRows(err) {
		_ = h.pool.QueryRow(ctx, `SELECT username FROM user_profiles WHERE user_id = $1`, uid).Scan(&sub)
		sub = strings.ReplaceAll(strings.ToLower(sub), "_", "-")
		theme, sections = []byte(`{}`), []byte(`["about","papers","projects","models","findings"]`)
	} else if err != nil {
		internal(w, r, err)
		return
	}
	var price int64
	if defs, _ := h.addons(ctx); defs != nil {
		price = defs["portfolio"].Price
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"subdomain": sub, "enabled": enabled, "theme": json.RawMessage(theme),
		"sections": jsonStrings(sections), "about": about, "addon_active": h.hasAddon(ctx, uid, "portfolio"),
		"addon_price_usd": usd(price), "saved": err == nil})
}

func (h *Handler) HandlePutPortfolio(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok || !h.requireFeature(w, r, uid, "portfolio") {
		return
	}
	var in struct {
		Subdomain string            `json:"subdomain"`
		Enabled   bool              `json:"enabled"`
		Theme     map[string]string `json:"theme"`
		Sections  []string          `json:"sections"`
		About     string            `json:"about"`
	}
	if !decodeJSON(w, r, &in, 16<<10) {
		return
	}
	in.Subdomain = strings.ToLower(strings.TrimSpace(in.Subdomain))
	if !subdomainRe.MatchString(in.Subdomain) || reservedSubdomains[in.Subdomain] {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_subdomain", "Use 3-32 lowercase letters, numbers or dashes (some names are reserved)")
		return
	}
	if in.Enabled && !h.hasAddon(r.Context(), uid, "portfolio") {
		httpx.WriteError(w, r, http.StatusPaymentRequired, "addon_needed", "Turn on the Portfolio site add-on in Plan to publish your site")
		return
	}
	theme, err := cleanTheme(in.Theme)
	if err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_theme", err.Error())
		return
	}
	valid := map[string]bool{"about": true, "papers": true, "projects": true, "models": true, "findings": true, "datasets": true}
	sections := []string{}
	for _, s := range in.Sections {
		if valid[s] {
			sections = append(sections, s)
		}
	}
	if len([]rune(in.About)) > 5000 {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_about", "About is too long (5000 characters max)")
		return
	}
	_, err = h.pool.Exec(r.Context(), `INSERT INTO portfolios (user_id, subdomain, enabled, theme, sections, about) VALUES ($1,$2,$3,$4,$5,$6)
		ON CONFLICT (user_id) DO UPDATE SET subdomain = $2, enabled = $3, theme = $4, sections = $5, about = $6, updated_at = now()`,
		uid, in.Subdomain, in.Enabled, mustJSON(theme), mustJSON(sections), strings.TrimSpace(in.About))
	if err != nil {
		if strings.Contains(err.Error(), "23505") {
			httpx.WriteError(w, r, http.StatusConflict, "subdomain_taken", "That address is taken. Try another.")
			return
		}
		internal(w, r, err)
		return
	}
	h.HandleGetPortfolio(w, r)
}

// GET /v1/public/portfolio/{subdomain}
func (h *Handler) HandlePublicPortfolio(w http.ResponseWriter, r *http.Request) {
	sub := strings.ToLower(chi.URLParam(r, "subdomain"))
	ctx := r.Context()
	var uid, username, first, last, about string
	var theme, sections []byte
	err := h.pool.QueryRow(ctx, `SELECT p.user_id::text, COALESCE(up.username, ''), COALESCE(up.first_name, ''), COALESCE(up.last_name, ''),
		p.about, p.theme, p.sections FROM portfolios p JOIN users u ON u.id = p.user_id LEFT JOIN user_profiles up ON up.user_id = p.user_id
		WHERE p.subdomain = $1 AND p.enabled AND u.status = 'active'
		  AND EXISTS (SELECT 1 FROM subscription_addons a WHERE a.user_id = p.user_id AND a.addon = 'portfolio' AND a.period_end > now())`, sub).
		Scan(&uid, &username, &first, &last, &about, &theme, &sections)
	if err != nil {
		notFound(w, r, "Portfolio")
		return
	}
	var prof profile
	_ = h.pool.QueryRow(ctx, `SELECT headline, bio, affiliation, website FROM researcher_profiles WHERE user_id = $1`, uid).
		Scan(&prof.Headline, &prof.Bio, &prof.Affiliation, &prof.Website)
	papers := []map[string]any{}
	if rows, err := h.pool.Query(ctx, `SELECT `+publicPaperCols+` WHERE p.owner_id = $1 AND (p.on_layerto OR p.status IN ('accepted','published'))
		ORDER BY COALESCE(p.year, 0) DESC, p.updated_at DESC LIMIT 100`, uid); err == nil {
		for rows.Next() {
			if m, err := scanPublicPaper(rows); err == nil {
				if !m["has_pdf"].(bool) {
					delete(m, "has_pdf")
				}
				papers = append(papers, m)
			}
		}
		rows.Close()
	}
	projects := []project{}
	if rows, err := h.pool.Query(ctx, `SELECT `+projectCols+` FROM projects p WHERE p.user_id = $1 AND p.is_public ORDER BY p.updated_at DESC`, uid); err == nil {
		for rows.Next() {
			if pr, err := scanProject(rows); err == nil {
				pr.Notes = ""
				projects = append(projects, pr)
			}
		}
		rows.Close()
	}
	models, _ := h.publicModelsFor(r, `o.owner_id = $1 AND o.visibility = 'public'`, uid)
	findings := []map[string]any{}
	if rows, err := h.pool.Query(ctx, `SELECT f.title, f.body, f.confidence, ra.name, f.updated_at FROM findings f JOIN research_areas ra ON ra.id = f.area_id
		WHERE f.owner_id = $1 AND ra.is_public AND f.status = 'confirmed' ORDER BY f.updated_at DESC LIMIT 50`, uid); err == nil {
		for rows.Next() {
			var t, b, c, a string
			var u time.Time
			if rows.Scan(&t, &b, &c, &a, &u) == nil {
				findings = append(findings, map[string]any{"title": t, "body": b, "confidence": c, "area": a, "updated_at": ts(u)})
			}
		}
		rows.Close()
	}
	datasets := []map[string]any{}
	if rows, err := h.pool.Query(ctx, `SELECT l.id::text, l.title, l.license, l.price, (SELECT count(*) FROM dataset_images i WHERE i.dataset_id = l.dataset_id)
		FROM dataset_listings l WHERE l.seller_id = $1 AND l.status = 'public' ORDER BY l.published_at DESC LIMIT 50`, uid); err == nil {
		for rows.Next() {
			var id, t, lic string
			var price int64
			var n int
			if rows.Scan(&id, &t, &lic, &price, &n) == nil {
				datasets = append(datasets, map[string]any{"id": id, "title": t, "license": lic, "price_usd": usd(price), "images": n})
			}
		}
		rows.Close()
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"subdomain": sub, "username": username, "name": strings.TrimSpace(first + " " + last), "about": about,
		"headline": prof.Headline, "bio": prof.Bio, "affiliation": prof.Affiliation, "website": prof.Website,
		"theme": json.RawMessage(theme), "sections": jsonStrings(sections),
		"papers": papers, "projects": projects, "models": models, "findings": findings, "datasets": datasets,
	})
}

// ---- research assistant (coming soon): waitlist only, nothing is charged yet

func (h *Handler) HandleAssistantStatus(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	var joined bool
	_ = h.pool.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM assistant_waitlist WHERE user_id = $1)`, uid).Scan(&joined)
	price := catalog.IntSetting(r.Context(), h.pool, "assistant_price_per_message", 20000)
	httpx.JSON(w, http.StatusOK, map[string]any{"available": false, "waitlisted": joined, "price_per_message_usd": usd(price)})
}

func (h *Handler) HandleAssistantWaitlist(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	_, _ = h.pool.Exec(r.Context(), `INSERT INTO assistant_waitlist (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, uid)
	h.HandleAssistantStatus(w, r)
}
