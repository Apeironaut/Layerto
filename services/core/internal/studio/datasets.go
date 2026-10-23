package studio

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"io"
	"net/http"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"layerto/services/core/internal/billing"
	"layerto/services/core/internal/catalog"
	"layerto/services/core/internal/gateway"
	"layerto/services/core/internal/httpx"
)

// Retention rules
//
//	keep = true            : kept until the user deletes it (needs a plan with keep_datasets)
//	keep = false, untrained: deleted after 30 days without changes (each upload/label extends it)
//	keep = false, trained  : deleted `dataset_retention_days` (default 3) after training finishes
const idleDays = 30
const maxClasses = 100
const maxUploadFiles = 200

type dataset struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	ProjectID   *string  `json:"project_id"`
	Classes     []string `json:"classes"`
	Keep        bool     `json:"keep"`
	DeleteAfter *string  `json:"delete_after"`
	PurgedAt    *string  `json:"purged_at"`
	Bytes       int64    `json:"bytes"`
	Images      int      `json:"images"`
	Labeled     int      `json:"labeled"`
	Boxes       int      `json:"boxes"`
	Trained     bool     `json:"trained"`
	Kind        string   `json:"kind"`
	Description string   `json:"description"`
	License     string   `json:"license"`
	SourceID    *string  `json:"source_listing_id"`
	Owner       string   `json:"owner"`
	UserID      string   `json:"-"`
	CreatedAt   string   `json:"created_at"`
	UpdatedAt   string   `json:"updated_at"`
}

const datasetCols = `d.id::text, d.name, d.project_id::text, d.classes, d.keep, d.delete_after, d.purged_at, d.bytes, d.created_at, d.updated_at,
	(SELECT count(*) FROM dataset_images i WHERE i.dataset_id = d.id),
	(SELECT count(*) FROM dataset_images i WHERE i.dataset_id = d.id AND i.labeled),
	(SELECT COALESCE(sum(jsonb_array_length(i.boxes)), 0) FROM dataset_images i WHERE i.dataset_id = d.id),
	EXISTS (SELECT 1 FROM training_jobs j WHERE j.dataset_id = d.id AND j.status = 'succeeded'),
	d.kind, d.description, d.license, d.source_listing_id::text, COALESCE((SELECT username FROM user_profiles WHERE user_id = d.user_id), ''), d.user_id::text`

func scanDataset(row interface{ Scan(...any) error }) (dataset, error) {
	var d dataset
	var classes []byte
	var del, purged *time.Time
	var c, u time.Time
	err := row.Scan(&d.ID, &d.Name, &d.ProjectID, &classes, &d.Keep, &del, &purged, &d.Bytes, &c, &u, &d.Images, &d.Labeled, &d.Boxes, &d.Trained,
		&d.Kind, &d.Description, &d.License, &d.SourceID, &d.Owner, &d.UserID)
	d.Classes = jsonStrings(classes)
	if del != nil {
		s := ts(*del)
		d.DeleteAfter = &s
	}
	if purged != nil {
		s := ts(*purged)
		d.PurgedAt = &s
	}
	d.CreatedAt, d.UpdatedAt = ts(c), ts(u)
	return d, err
}

// Datasets in a project shared with a team can be edited by its editors and seen by its viewers.
const dsWrite = `(d.user_id = $2 OR (d.project_id IS NOT NULL AND hub_project_write(d.project_id, $2)))`
const dsRead = `(d.user_id = $2 OR (d.project_id IS NOT NULL AND hub_project_read(d.project_id, $2)))`

func (h *Handler) loadDataset(ctx context.Context, uid, id string) (dataset, error) {
	return scanDataset(h.pool.QueryRow(ctx, `SELECT `+datasetCols+` FROM datasets d WHERE d.id = $1 AND `+dsWrite, id, uid))
}

func (h *Handler) loadDatasetRead(ctx context.Context, uid, id string) (dataset, error) {
	return scanDataset(h.pool.QueryRow(ctx, `SELECT `+datasetCols+` FROM datasets d WHERE d.id = $1 AND `+dsRead, id, uid))
}

// GET /api/studio/datasets?project_id=
func (h *Handler) HandleListDatasets(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	q := `SELECT ` + datasetCols + ` FROM datasets d WHERE (d.user_id = $1 OR (d.project_id IS NOT NULL AND hub_project_read(d.project_id, $1)))`
	args := []any{uid}
	if pid := r.URL.Query().Get("project_id"); validID(pid) {
		args = append(args, pid)
		q += fmt.Sprintf(` AND d.project_id = $%d`, len(args))
	}
	if k := r.URL.Query().Get("kind"); k == "training" || k == "bundle" {
		args = append(args, k)
		q += fmt.Sprintf(` AND d.kind = $%d`, len(args))
	}
	rows, err := h.pool.Query(r.Context(), q+` ORDER BY d.updated_at DESC`, args...)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer rows.Close()
	out := []dataset{}
	for rows.Next() {
		d, err := scanDataset(rows)
		if err != nil {
			internal(w, r, err)
			return
		}
		out = append(out, d)
	}
	httpx.JSON(w, http.StatusOK, out)
}

type datasetInput struct {
	Name        *string   `json:"name"`
	ProjectID   *string   `json:"project_id"`
	Classes     *[]string `json:"classes"`
	Keep        *bool     `json:"keep"`
	Kind        *string   `json:"kind"` // "training" (default) or "bundle" (images for sale)
	Description *string   `json:"description"`
}

func cleanClasses(in []string) ([]string, error) {
	seen := map[string]bool{}
	out := make([]string, 0, len(in))
	for _, c := range in {
		c = strings.TrimSpace(c)
		if c == "" {
			continue
		}
		if len(c) > 60 {
			return nil, fmt.Errorf("class names must be 60 characters or fewer")
		}
		if seen[strings.ToLower(c)] {
			return nil, fmt.Errorf("class %q is listed twice", c)
		}
		seen[strings.ToLower(c)] = true
		out = append(out, c)
	}
	if len(out) > maxClasses {
		return nil, fmt.Errorf("at most %d classes", maxClasses)
	}
	return out, nil
}

func (h *Handler) ownsProject(ctx context.Context, uid string, pid *string) bool {
	if pid == nil || *pid == "" {
		return true
	}
	if !validID(*pid) {
		return false
	}
	var ok bool
	_ = h.pool.QueryRow(ctx, `SELECT hub_project_write($1::uuid, $2::uuid)`, *pid, uid).Scan(&ok)
	return ok
}

// POST /api/studio/datasets
func (h *Handler) HandleCreateDataset(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	var in datasetInput
	if !decodeJSON(w, r, &in, 32<<10) {
		return
	}
	ctx := r.Context()
	if in.Name == nil || strings.TrimSpace(*in.Name) == "" || len(*in.Name) > 80 {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_name", "Dataset name must be 1-80 characters")
		return
	}
	classes := []string{}
	if in.Classes != nil {
		c, err := cleanClasses(*in.Classes)
		if err != nil {
			httpx.WriteError(w, r, http.StatusBadRequest, "invalid_classes", err.Error())
			return
		}
		classes = c
	}
	kind := "training"
	if in.Kind != nil && *in.Kind == "bundle" {
		kind = "bundle"
	}
	if kind == "bundle" {
		if !h.requireFeature(w, r, uid, "sell_images") {
			return
		}
		in.ProjectID, in.Keep = nil, nil
	} else if !h.requireFeature(w, r, uid, "train") {
		return
	}
	if in.Description != nil && len([]rune(*in.Description)) > 2000 {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_description", "Description is too long (2000 characters max)")
		return
	}
	if !h.ownsProject(ctx, uid, in.ProjectID) {
		notFound(w, r, "Project")
		return
	}
	keep := (in.Keep != nil && *in.Keep) || kind == "bundle"
	if keep && kind != "bundle" {
		plan, err := h.userPlan(ctx, uid)
		if err != nil {
			internal(w, r, err)
			return
		}
		if !plan.Plan.KeepDatasets {
			httpx.WriteError(w, r, http.StatusForbidden, "plan_limit", "Keeping datasets after training needs the Researcher or Lab plan.")
			return
		}
	}
	cj, _ := json.Marshal(classes)
	var pid any
	if in.ProjectID != nil && *in.ProjectID != "" {
		pid = *in.ProjectID
	}
	var del any
	if !keep {
		del = time.Now().Add(idleDays * 24 * time.Hour)
	}
	var id string
	if err := h.pool.QueryRow(ctx, `INSERT INTO datasets (user_id, project_id, name, classes, keep, delete_after, kind, description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id::text`,
		uid, pid, strings.TrimSpace(*in.Name), cj, keep, del, kind, deref(in.Description)).Scan(&id); err != nil {
		internal(w, r, err)
		return
	}
	d, err := h.loadDataset(ctx, uid, id)
	if err != nil {
		internal(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, d)
}

// GET /api/studio/datasets/{id}
func (h *Handler) HandleGetDataset(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	d, err := h.loadDatasetRead(r.Context(), uid, chi.URLParam(r, "id"))
	if isNoRows(err) || !validID(chi.URLParam(r, "id")) {
		notFound(w, r, "Dataset")
		return
	}
	if err != nil {
		internal(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, d)
}

// PATCH /api/studio/datasets/{id}  (name, project, classes, keep)
func (h *Handler) HandleUpdateDataset(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if !validID(id) {
		notFound(w, r, "Dataset")
		return
	}
	var in datasetInput
	if !decodeJSON(w, r, &in, 32<<10) {
		return
	}
	ctx := r.Context()
	d, err := h.loadDataset(ctx, uid, id)
	if isNoRows(err) {
		notFound(w, r, "Dataset")
		return
	}
	if err != nil {
		internal(w, r, err)
		return
	}
	if d.PurgedAt != nil {
		httpx.WriteError(w, r, http.StatusConflict, "dataset_deleted", "This dataset's images were deleted.")
		return
	}
	if in.Name != nil && (strings.TrimSpace(*in.Name) == "" || len(*in.Name) > 80) {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_name", "Dataset name must be 1-80 characters")
		return
	}
	if in.ProjectID != nil && !h.ownsProject(ctx, uid, in.ProjectID) {
		notFound(w, r, "Project")
		return
	}
	var classesJSON []byte
	if in.Classes != nil {
		c, err := cleanClasses(*in.Classes)
		if err != nil {
			httpx.WriteError(w, r, http.StatusBadRequest, "invalid_classes", err.Error())
			return
		}
		if len(c) < len(d.Classes) {
			// removing classes would orphan boxes; renaming and adding are fine
			var maxUsed int
			_ = h.pool.QueryRow(ctx, `SELECT COALESCE(max((b->>'c')::int), -1) FROM dataset_images i, jsonb_array_elements(i.boxes) b WHERE i.dataset_id = $1`, id).Scan(&maxUsed)
			if maxUsed >= len(c) {
				httpx.WriteError(w, r, http.StatusConflict, "class_in_use", "A class you removed is still used by boxes. Delete those boxes first.")
				return
			}
		}
		classesJSON, _ = json.Marshal(c)
	}
	var newDel any = nil
	setDel := false
	if in.Keep != nil {
		if *in.Keep {
			plan, err := h.userPlan(ctx, uid)
			if err != nil {
				internal(w, r, err)
				return
			}
			if !plan.Plan.KeepDatasets {
				httpx.WriteError(w, r, http.StatusForbidden, "plan_limit", "Keeping datasets after training needs the Researcher or Lab plan.")
				return
			}
			setDel = true // NULL: no auto-delete
		} else {
			setDel = true
			newDel = h.defaultDeleteAfter(ctx, d.Trained)
		}
	}
	var pid any
	setProject := in.ProjectID != nil
	if setProject && *in.ProjectID != "" {
		pid = *in.ProjectID
	}
	_, err = h.pool.Exec(ctx, `UPDATE datasets SET
		name = COALESCE($3, name),
		classes = COALESCE($4, classes),
		keep = COALESCE($5, keep),
		delete_after = CASE WHEN $6 THEN $7 ELSE delete_after END,
		project_id = CASE WHEN $8 THEN $9::uuid ELSE project_id END,
		description = COALESCE($10, description),
		updated_at = now()
		WHERE id = $1 AND (user_id = $2 OR (project_id IS NOT NULL AND hub_project_write(project_id, $2)))`, id, uid, trimPtr(in.Name), nullBytes(classesJSON), in.Keep, setDel, newDel, setProject, pid, trimPtr(in.Description))
	if err != nil {
		internal(w, r, err)
		return
	}
	d, _ = h.loadDataset(ctx, uid, id)
	httpx.JSON(w, http.StatusOK, d)
}

func (h *Handler) defaultDeleteAfter(ctx context.Context, trained bool) time.Time {
	if trained {
		days := catalog.IntSetting(ctx, h.pool, "dataset_retention_days", 3)
		return time.Now().Add(time.Duration(days) * 24 * time.Hour)
	}
	return time.Now().Add(idleDays * 24 * time.Hour)
}

// touch extends the idle deadline of a not-kept, untrained dataset after activity.
func (h *Handler) touch(ctx context.Context, id string) {
	_, _ = h.pool.Exec(ctx, `UPDATE datasets SET updated_at = now(),
		delete_after = CASE WHEN keep THEN NULL
		  WHEN EXISTS (SELECT 1 FROM training_jobs j WHERE j.dataset_id = datasets.id AND j.status = 'succeeded') THEN delete_after
		  ELSE now() + make_interval(days => $2) END
		WHERE id = $1`, id, idleDays)
}

// DELETE /api/studio/datasets/{id}  (deletes every image now; trained models are not affected)
func (h *Handler) HandleDeleteDataset(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if !validID(id) {
		notFound(w, r, "Dataset")
		return
	}
	var exists bool
	_ = h.pool.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM datasets WHERE id = $1 AND user_id = $2)`, id, uid).Scan(&exists)
	if !exists {
		notFound(w, r, "Dataset")
		return
	}
	var sold bool
	_ = h.pool.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM dataset_purchases p JOIN dataset_listings l ON l.id = p.listing_id WHERE l.dataset_id = $1)`, id).Scan(&sold)
	if sold {
		httpx.WriteError(w, r, http.StatusConflict, "dataset_sold", "People have bought this dataset and can still copy it into their projects. Take the listing off sale instead.")
		return
	}
	if err := h.purgeDataset(r.Context(), id, true); err != nil {
		internal(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// purgeDataset deletes the dataset's files and image rows. remove=true also deletes the
// dataset row (user action); the janitor keeps the row, marked purged, for history.
func (h *Handler) purgeDataset(ctx context.Context, id string, remove bool) error {
	if err := h.store.DeletePrefix("datasets/" + id); err != nil {
		return err
	}
	if remove {
		_, err := h.pool.Exec(ctx, `DELETE FROM datasets WHERE id = $1`, id)
		return err
	}
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `DELETE FROM dataset_images WHERE dataset_id = $1`, id); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE datasets SET purged_at = now(), bytes = 0, delete_after = NULL WHERE id = $1`, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ---- images

type datasetImage struct {
	ID       string `json:"id"`
	FileName string `json:"file_name"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
	Boxes    []box  `json:"boxes"`
	Labeled  bool   `json:"labeled"`
}

type box struct {
	C int     `json:"c"`
	X float64 `json:"x"`
	Y float64 `json:"y"`
	W float64 `json:"w"`
	H float64 `json:"h"`
}

// POST /api/studio/datasets/{id}/images  (multipart, field "images", many files)
func (h *Handler) HandleUploadImages(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if !validID(id) {
		notFound(w, r, "Dataset")
		return
	}
	ctx := r.Context()
	d, err := h.loadDataset(ctx, uid, id)
	if isNoRows(err) {
		notFound(w, r, "Dataset")
		return
	}
	if err != nil {
		internal(w, r, err)
		return
	}
	if d.PurgedAt != nil {
		httpx.WriteError(w, r, http.StatusConflict, "dataset_deleted", "This dataset's images were deleted. Create a new dataset.")
		return
	}
	// storage counts against the dataset owner's plan (also when a teammate uploads)
	plan, err := h.userPlan(ctx, d.UserID)
	if err != nil {
		internal(w, r, err)
		return
	}
	u, err := h.usage(ctx, d.UserID)
	if err != nil {
		internal(w, r, err)
		return
	}
	limit := plan.Plan.StorageMB << 20
	r.Body = http.MaxBytesReader(w, r.Body, 250<<20)
	mr, err := r.MultipartReader()
	if err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Send images as multipart/form-data in the \"images\" field")
		return
	}
	type result struct {
		FileName string `json:"file_name"`
		Error    string `json:"error,omitempty"`
	}
	results := []result{}
	added, addedBytes := 0, int64(0)
	for n := 0; ; n++ {
		part, err := mr.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			httpx.WriteError(w, r, http.StatusBadRequest, "upload_failed", "The upload was interrupted or too large (250 MB per request)")
			return
		}
		if part.FormName() != "images" {
			_ = part.Close()
			continue
		}
		if len(results) >= maxUploadFiles {
			_ = part.Close()
			break
		}
		name := path.Base(strings.ReplaceAll(part.FileName(), "\\", "/"))
		if len(name) > 200 {
			name = name[:200]
		}
		buf, err := io.ReadAll(io.LimitReader(part, gateway.MaxImageBytes+1))
		_ = part.Close()
		if err != nil {
			results = append(results, result{name, "could not read"})
			continue
		}
		if len(buf) > gateway.MaxImageBytes {
			results = append(results, result{name, "larger than 10 MB"})
			continue
		}
		if err := gateway.ValidateImage(buf); err != nil {
			results = append(results, result{name, err.Error()})
			continue
		}
		cfg, format, err := image.DecodeConfig(bytes.NewReader(buf))
		if err != nil {
			results = append(results, result{name, "not a readable image"})
			continue
		}
		if u.StorageBytes+addedBytes+int64(len(buf)) > limit {
			results = append(results, result{name, "storage limit of your plan reached"})
			continue
		}
		var imgID string
		if err := h.pool.QueryRow(ctx, `SELECT gen_random_uuid()::text`).Scan(&imgID); err != nil {
			internal(w, r, err)
			return
		}
		key := "datasets/" + id + "/" + imgID
		if err := h.store.Put(key, buf); err != nil {
			internal(w, r, err)
			return
		}
		if _, err := h.pool.Exec(ctx, `INSERT INTO dataset_images (id, dataset_id, file_name, storage_key, mime, width, height, bytes)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, imgID, id, name, key, "image/"+format, cfg.Width, cfg.Height, len(buf)); err != nil {
			_ = h.store.Delete(key)
			internal(w, r, err)
			return
		}
		added++
		addedBytes += int64(len(buf))
		results = append(results, result{FileName: name})
	}
	if added > 0 {
		_, _ = h.pool.Exec(ctx, `UPDATE datasets SET bytes = bytes + $2 WHERE id = $1`, id, addedBytes)
		h.touch(ctx, id)
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"added": added, "results": results})
}

// GET /api/studio/datasets/{id}/images?offset=&limit=&filter=all|labeled|unlabeled
func (h *Handler) HandleListImages(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if !validID(id) || !h.canReadDataset(r.Context(), uid, id) {
		notFound(w, r, "Dataset")
		return
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}
	filter := ""
	switch r.URL.Query().Get("filter") {
	case "labeled":
		filter = " AND labeled"
	case "unlabeled":
		filter = " AND NOT labeled"
	}
	rows, err := h.pool.Query(r.Context(), `SELECT id::text, file_name, width, height, boxes, labeled FROM dataset_images
		WHERE dataset_id = $1`+filter+` ORDER BY created_at, id LIMIT $2 OFFSET $3`, id, limit, offset)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer rows.Close()
	out := []datasetImage{}
	for rows.Next() {
		var im datasetImage
		var bx []byte
		if err := rows.Scan(&im.ID, &im.FileName, &im.Width, &im.Height, &bx, &im.Labeled); err != nil {
			internal(w, r, err)
			return
		}
		_ = json.Unmarshal(bx, &im.Boxes)
		if im.Boxes == nil {
			im.Boxes = []box{}
		}
		out = append(out, im)
	}
	httpx.JSON(w, http.StatusOK, out)
}

func (h *Handler) ownsDataset(ctx context.Context, uid, id string) bool {
	var ok bool
	_ = h.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM datasets d WHERE d.id = $1 AND `+dsWrite+` AND d.purged_at IS NULL)`, id, uid).Scan(&ok)
	return ok
}

func (h *Handler) canReadDataset(ctx context.Context, uid, id string) bool {
	var ok bool
	_ = h.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM datasets d WHERE d.id = $1 AND `+dsRead+` AND d.purged_at IS NULL)`, id, uid).Scan(&ok)
	return ok
}

// GET /api/studio/datasets/{id}/images/{imageId}/file
func (h *Handler) HandleImageFile(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id, imgID := chi.URLParam(r, "id"), chi.URLParam(r, "imageId")
	if !validID(id) || !validID(imgID) || !h.canReadDataset(r.Context(), uid, id) {
		notFound(w, r, "Image")
		return
	}
	var key, mime string
	if err := h.pool.QueryRow(r.Context(), `SELECT storage_key, mime FROM dataset_images WHERE id = $1 AND dataset_id = $2`, imgID, id).Scan(&key, &mime); err != nil {
		notFound(w, r, "Image")
		return
	}
	data, err := h.store.Get(key)
	if err != nil {
		notFound(w, r, "Image")
		return
	}
	w.Header().Set("Content-Type", mime)
	w.Header().Set("Cache-Control", "private, max-age=3600")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	_, _ = w.Write(data)
}

// PUT /api/studio/datasets/{id}/images/{imageId}/boxes {"boxes": [...], "labeled": true}
func (h *Handler) HandleSaveBoxes(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id, imgID := chi.URLParam(r, "id"), chi.URLParam(r, "imageId")
	if !validID(id) || !validID(imgID) {
		notFound(w, r, "Image")
		return
	}
	var in struct {
		Boxes   []box `json:"boxes"`
		Labeled *bool `json:"labeled"`
	}
	if !decodeJSON(w, r, &in, 256<<10) {
		return
	}
	ctx := r.Context()
	d, err := h.loadDataset(ctx, uid, id)
	if err != nil || d.PurgedAt != nil {
		notFound(w, r, "Dataset")
		return
	}
	var width, height int
	if err := h.pool.QueryRow(ctx, `SELECT width, height FROM dataset_images WHERE id = $1 AND dataset_id = $2`, imgID, id).Scan(&width, &height); err != nil {
		notFound(w, r, "Image")
		return
	}
	if len(in.Boxes) > 1000 {
		httpx.WriteError(w, r, http.StatusBadRequest, "too_many_boxes", "At most 1000 boxes per image")
		return
	}
	clean := make([]box, 0, len(in.Boxes))
	for _, b := range in.Boxes {
		if b.C < 0 || b.C >= len(d.Classes) {
			httpx.WriteError(w, r, http.StatusBadRequest, "invalid_box", "A box uses a class that doesn't exist")
			return
		}
		// clamp into the image; drop boxes smaller than 2 px
		x1, y1 := clamp(b.X, 0, float64(width)), clamp(b.Y, 0, float64(height))
		x2, y2 := clamp(b.X+b.W, 0, float64(width)), clamp(b.Y+b.H, 0, float64(height))
		if x2-x1 < 2 || y2-y1 < 2 {
			continue
		}
		clean = append(clean, box{C: b.C, X: round1(x1), Y: round1(y1), W: round1(x2 - x1), H: round1(y2 - y1)})
	}
	labeled := true // saving counts as reviewed; an image with no boxes is a valid "nothing here" example
	if in.Labeled != nil {
		labeled = *in.Labeled
	}
	bj, _ := json.Marshal(clean)
	if _, err := h.pool.Exec(ctx, `UPDATE dataset_images SET boxes = $3, labeled = $4 WHERE id = $1 AND dataset_id = $2`, imgID, id, bj, labeled); err != nil {
		internal(w, r, err)
		return
	}
	h.touch(ctx, id)
	httpx.JSON(w, http.StatusOK, map[string]any{"id": imgID, "boxes": clean, "labeled": labeled})
}

// DELETE /api/studio/datasets/{id}/images/{imageId}
func (h *Handler) HandleDeleteImage(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id, imgID := chi.URLParam(r, "id"), chi.URLParam(r, "imageId")
	if !validID(id) || !validID(imgID) || !h.ownsDataset(r.Context(), uid, id) {
		notFound(w, r, "Image")
		return
	}
	var key string
	var size int64
	if err := h.pool.QueryRow(r.Context(), `DELETE FROM dataset_images WHERE id = $1 AND dataset_id = $2 RETURNING storage_key, bytes`, imgID, id).Scan(&key, &size); err != nil {
		notFound(w, r, "Image")
		return
	}
	_ = h.store.Delete(key)
	_, _ = h.pool.Exec(r.Context(), `UPDATE datasets SET bytes = GREATEST(0, bytes - $2), updated_at = now() WHERE id = $1`, id, size)
	w.WriteHeader(http.StatusNoContent)
}

// purgeExpired deletes datasets whose delete_after has passed (run by the janitor).
func (h *Handler) purgeExpired(ctx context.Context) {
	rows, err := h.pool.Query(ctx, `SELECT id::text FROM datasets WHERE purged_at IS NULL AND NOT keep AND delete_after IS NOT NULL AND delete_after < now()`)
	if err != nil {
		logf("purge query: %v", err)
		return
	}
	var ids []string
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			ids = append(ids, id)
		}
	}
	rows.Close()
	for _, id := range ids {
		if err := h.purgeDataset(ctx, id, false); err != nil {
			logf("purge %s: %v", id, err)
		} else {
			logf("dataset %s deleted by retention policy", id)
		}
	}
}

// ---- small helpers

func clamp(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func round1(v float64) float64 { return float64(int64(v*10+0.5)) / 10 }

func itoa(i int) string { return strconv.Itoa(i) }

func jsonStrings(b []byte) []string {
	var s []string
	_ = json.Unmarshal(b, &s)
	if s == nil {
		s = []string{}
	}
	return s
}

func jsonMap(b []byte) map[string]any {
	m := map[string]any{}
	_ = json.Unmarshal(b, &m)
	return m
}

func nullBytes(b []byte) any {
	if b == nil {
		return nil
	}
	return b
}

func usd(micro int64) string { return billing.FormatMicroUSD(micro) }
