package studio

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"layerto/services/core/internal/billing"
	"layerto/services/core/internal/catalog"
	"layerto/services/core/internal/httpx"
)

type myModel struct {
	ID          string         `json:"id"`
	Slug        string         `json:"slug"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	License     string         `json:"license"`
	PriceUSD    string         `json:"price_usd"`
	Enabled     bool           `json:"enabled"`
	Visibility  string         `json:"visibility"`
	ReviewNote  string         `json:"review_note"`
	Classes     []string       `json:"classes"`
	Metrics     map[string]any `json:"metrics"`
	ProjectID   *string        `json:"project_id"`
	JobID       *string        `json:"job_id"`
	CreatedAt   string         `json:"created_at"`
	PublishedAt *string        `json:"published_at"`
	Calls30d    int64          `json:"calls_30d"`
	EarnedUSD   string         `json:"earned_usd"`
	OwnerName   string         `json:"owner"`
	History     []any          `json:"history"`
	Source      string         `json:"source"`       // trained (metrics measured by Layerto) or imported (self-reported)
	DataLicense string         `json:"data_license"` // license of purchased training data, if any
	Size        string         `json:"size"`
}

const myModelCols = `m.id::text, m.slug, m.name, m.description, m.license, m.price_per_call, m.enabled, o.visibility, o.review_note,
	o.classes, o.metrics, o.project_id::text, o.job_id::text, o.created_at, o.published_at,
	(SELECT count(*) FROM events e WHERE e.type = 'request.executed' AND e.payload->>'model_slug' = m.slug AND e.created_at > now() - interval '30 days'),
	(SELECT COALESCE(sum((e.payload->>'amount')::bigint), 0) FROM events e WHERE e.type = 'creator.reward' AND e.user_id = o.owner_id AND e.payload->>'model_slug' = m.slug),
	COALESCE((SELECT username FROM user_profiles WHERE user_id = o.owner_id), (SELECT email FROM users WHERE id = o.owner_id), ''),
	o.history, o.source, o.data_license`

func scanMyModel(row interface{ Scan(...any) error }) (myModel, error) {
	var m myModel
	var price, earned int64
	var classes, metrics []byte
	var c time.Time
	var pub *time.Time
	var hist []byte
	err := row.Scan(&m.ID, &m.Slug, &m.Name, &m.Description, &m.License, &price, &m.Enabled, &m.Visibility, &m.ReviewNote,
		&classes, &metrics, &m.ProjectID, &m.JobID, &c, &pub, &m.Calls30d, &earned, &m.OwnerName, &hist, &m.Source, &m.DataLicense)
	m.PriceUSD, m.EarnedUSD = usd(price), usd(earned)
	m.Classes, m.Metrics = jsonStrings(classes), jsonMap(metrics)
	_ = json.Unmarshal(hist, &m.History)
	if m.History == nil {
		m.History = []any{}
	}
	m.Size, _ = m.Metrics["size"].(string)
	m.CreatedAt = ts(c)
	if pub != nil {
		s := ts(*pub)
		m.PublishedAt = &s
	}
	return m, err
}

// GET /api/studio/models
func (h *Handler) HandleListMyModels(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	q := `SELECT ` + myModelCols + ` FROM model_ownership o JOIN models m ON m.id = o.model_id
		WHERE (o.owner_id = $1 OR (o.project_id IS NOT NULL AND hub_project_read(o.project_id, $1)))`
	args := []any{uid}
	if p := r.URL.Query().Get("project_id"); validID(p) {
		args = append(args, p)
		q += ` AND o.project_id = $2`
	} else {
		q += ` AND o.owner_id = $1`
	}
	rows, err := h.pool.Query(r.Context(), q+` ORDER BY o.created_at DESC`, args...)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer rows.Close()
	out := []myModel{}
	for rows.Next() {
		m, err := scanMyModel(rows)
		if err != nil {
			internal(w, r, err)
			return
		}
		out = append(out, m)
	}
	httpx.JSON(w, http.StatusOK, out)
}

func (h *Handler) writeMyModel(w http.ResponseWriter, r *http.Request, uid, slug string) {
	m, err := scanMyModel(h.pool.QueryRow(r.Context(), `SELECT `+myModelCols+` FROM model_ownership o JOIN models m ON m.id = o.model_id
		WHERE o.owner_id = $1 AND m.slug = $2`, uid, slug))
	if isNoRows(err) {
		notFound(w, r, "Model")
		return
	}
	if err != nil {
		internal(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, m)
}

// GET /api/studio/models/{slug}
func (h *Handler) HandleGetMyModel(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	h.writeMyModel(w, r, uid, chi.URLParam(r, "slug"))
}

// PATCH /api/studio/models/{slug} {"name","description","license","price_usd","project_id"}
// Changing the price or details of a public model sends it back to review.
func (h *Handler) HandleUpdateMyModel(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	slug := chi.URLParam(r, "slug")
	var in struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
		License     *string `json:"license"`
		PriceUSD    *string `json:"price_usd"`
		ProjectID   *string `json:"project_id"`
	}
	if !decodeJSON(w, r, &in, 16<<10) {
		return
	}
	ctx := r.Context()
	var modelID, vis string
	if err := h.pool.QueryRow(ctx, `SELECT m.id::text, o.visibility FROM models m JOIN model_ownership o ON o.model_id = m.id
		WHERE m.slug = $1 AND o.owner_id = $2`, slug, uid).Scan(&modelID, &vis); err != nil {
		notFound(w, r, "Model")
		return
	}
	if in.Name != nil && (strings.TrimSpace(*in.Name) == "" || len(*in.Name) > 80) {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_name", "Name must be 1-80 characters")
		return
	}
	if in.Description != nil && len(*in.Description) > 2000 {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_description", "Description is too long (2000 characters max)")
		return
	}
	if in.License != nil && len(*in.License) > 80 {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_license", "License is too long")
		return
	}
	var price *int64
	if in.PriceUSD != nil {
		p, err := billing.ParseAmountUSD(*in.PriceUSD)
		if err == nil {
			err = billing.ValidateModelPrice(p)
		}
		if err != nil {
			httpx.WriteError(w, r, http.StatusBadRequest, "invalid_price", "Enter a valid price per call in USD (e.g. 0.002)")
			return
		}
		price = &p
	}
	if in.ProjectID != nil && !h.ownsProject(ctx, uid, in.ProjectID) {
		notFound(w, r, "Project")
		return
	}
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `UPDATE models SET name = COALESCE($2, name), description = COALESCE($3, description),
		license = COALESCE($4, license), price_per_call = COALESCE($5, price_per_call) WHERE id = $1`,
		modelID, trimPtr(in.Name), trimPtr(in.Description), trimPtr(in.License), price); err != nil {
		internal(w, r, err)
		return
	}
	if in.ProjectID != nil {
		var pid any
		if *in.ProjectID != "" {
			pid = *in.ProjectID
		}
		if _, err := tx.Exec(ctx, `UPDATE model_ownership SET project_id = $2::uuid WHERE model_id = $1`, modelID, pid); err != nil {
			internal(w, r, err)
			return
		}
	}
	listingChanged := in.Name != nil || in.Description != nil || in.License != nil || price != nil
	if vis == "public" && listingChanged {
		if _, err := tx.Exec(ctx, `UPDATE model_ownership SET visibility = 'pending', review_note = 'Changed after publishing; waiting for review.' WHERE model_id = $1`, modelID); err != nil {
			internal(w, r, err)
			return
		}
	}
	if err := tx.Commit(ctx); err != nil {
		internal(w, r, err)
		return
	}
	h.writeMyModel(w, r, uid, slug)
}

// POST /api/studio/models/{slug}/publish  -> pending admin review
func (h *Handler) HandlePublish(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	slug := chi.URLParam(r, "slug")
	if !h.requireFeature(w, r, uid, "sell_models") {
		return
	}
	var desc, dataLicense string
	var metrics []byte
	if err := h.pool.QueryRow(r.Context(), `SELECT m.description, o.metrics, o.data_license FROM models m JOIN model_ownership o ON o.model_id = m.id
		WHERE m.slug = $1 AND o.owner_id = $2`, slug, uid).Scan(&desc, &metrics, &dataLicense); err != nil {
		notFound(w, r, "Model")
		return
	}
	if dataLicense == "research_only" {
		httpx.WriteError(w, r, http.StatusForbidden, "license_restricted",
			"This model was trained on a dataset bought under a research-only license, so it can't be offered on the marketplace. Use it privately or in your research.")
		return
	}
	if len(strings.TrimSpace(desc)) < 20 {
		httpx.WriteError(w, r, http.StatusBadRequest, "description_needed", "Write a description (at least 20 characters) so people know what the model does.")
		return
	}
	if _, ok := jsonMap(metrics)["map50_95"]; !ok {
		httpx.WriteError(w, r, http.StatusBadRequest, "metrics_needed", "Only models with measured accuracy can be published.")
		return
	}
	if _, err := h.pool.Exec(r.Context(), `UPDATE model_ownership SET visibility = 'pending', review_note = '' FROM models m
		WHERE m.id = model_ownership.model_id AND m.slug = $1 AND model_ownership.owner_id = $2 AND visibility IN ('private','rejected')`, slug, uid); err != nil {
		internal(w, r, err)
		return
	}
	h.writeMyModel(w, r, uid, slug)
}

// POST /api/studio/models/{slug}/unpublish  -> private again (owner only)
func (h *Handler) HandleUnpublish(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	slug := chi.URLParam(r, "slug")
	if _, err := h.pool.Exec(r.Context(), `UPDATE model_ownership SET visibility = 'private', published_at = NULL FROM models m
		WHERE m.id = model_ownership.model_id AND m.slug = $1 AND model_ownership.owner_id = $2`, slug, uid); err != nil {
		internal(w, r, err)
		return
	}
	h.writeMyModel(w, r, uid, slug)
}

// DELETE /api/studio/models/{slug}  (removes the model, its weights and its sites)
func (h *Handler) HandleDeleteMyModel(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	slug := chi.URLParam(r, "slug")
	var modelID, key string
	if err := h.pool.QueryRow(r.Context(), `SELECT m.id::text, o.weights_key FROM models m JOIN model_ownership o ON o.model_id = m.id
		WHERE m.slug = $1 AND o.owner_id = $2`, slug, uid).Scan(&modelID, &key); err != nil {
		notFound(w, r, "Model")
		return
	}
	// The models row is referenced by the request history, so it is disabled, not deleted.
	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		internal(w, r, err)
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	if _, err := tx.Exec(r.Context(), `DELETE FROM model_sites WHERE model_id = $1`, modelID); err != nil {
		internal(w, r, err)
		return
	}
	if _, err := tx.Exec(r.Context(), `DELETE FROM model_ownership WHERE model_id = $1`, modelID); err != nil {
		internal(w, r, err)
		return
	}
	if _, err := tx.Exec(r.Context(), `UPDATE models SET enabled = false, slug = slug || '-deleted-' || substr(md5(random()::text), 1, 6) WHERE id = $1`, modelID); err != nil {
		internal(w, r, err)
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		internal(w, r, err)
		return
	}
	_ = h.store.Delete(key)
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/studio/marketplace?q=  (public user-trained models)
func (h *Handler) HandleMarketplace(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	sort := "o.published_at DESC NULLS LAST"
	switch r.URL.Query().Get("sort") {
	case "popular":
		sort = "16 DESC, o.published_at DESC NULLS LAST"
	case "accuracy":
		sort = "(o.metrics->>'map50_95')::float8 DESC NULLS LAST"
	}
	rows, err := h.pool.Query(r.Context(), `SELECT `+myModelCols+`
		FROM model_ownership o JOIN models m ON m.id = o.model_id
		WHERE o.visibility = 'public' AND m.enabled
		  AND ($1 = '' OR m.name ILIKE '%' || $1 || '%' OR m.description ILIKE '%' || $1 || '%' OR o.classes::text ILIKE '%' || $1 || '%')
		ORDER BY `+sort+` LIMIT 200`, q)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer rows.Close()
	out := []myModel{}
	for rows.Next() {
		m, err := scanMyModel(rows)
		if err != nil {
			internal(w, r, err)
			return
		}
		m.EarnedUSD = "" // private to the owner
		m.ReviewNote = ""
		m.ProjectID, m.JobID = nil, nil
		out = append(out, m)
	}
	httpx.JSON(w, http.StatusOK, out)
}

// GET /api/studio/earnings  (creator rewards, spendable credit)
func (h *Handler) HandleEarnings(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	var total, month int64
	var calls int64
	err := h.pool.QueryRow(r.Context(), `SELECT
		COALESCE(sum((payload->>'amount')::bigint), 0),
		COALESCE(sum((payload->>'amount')::bigint) FILTER (WHERE created_at >= date_trunc('month', now())), 0),
		count(*)
		FROM events WHERE type = 'creator.reward' AND user_id = $1`, uid).Scan(&total, &month, &calls)
	if err != nil {
		internal(w, r, err)
		return
	}
	var bps int64 = 2500
	_ = h.pool.QueryRow(r.Context(), `SELECT value::text::bigint FROM platform_settings WHERE key = 'creator_reward_bps'`).Scan(&bps)
	var dsTotal, dsMonth int64
	var dsSales int64
	_ = h.pool.QueryRow(r.Context(), `SELECT COALESCE(sum((payload->>'amount')::bigint), 0),
		COALESCE(sum((payload->>'amount')::bigint) FILTER (WHERE created_at >= date_trunc('month', now())), 0), count(*)
		FROM events WHERE type = 'dataset.sale' AND user_id = $1`, uid).Scan(&dsTotal, &dsMonth, &dsSales)
	sellerBps := catalog.IntSetting(r.Context(), h.pool, "bundle_seller_share_bps", 8000)
	httpx.JSON(w, http.StatusOK, map[string]any{
		"total_usd": usd(total), "this_month_usd": usd(month), "paid_calls": calls,
		"share_percent": float64(bps) / 100, "payout": "credit",
		"datasets_total_usd": usd(dsTotal), "datasets_this_month_usd": usd(dsMonth), "dataset_sales": dsSales,
		"dataset_share_percent": float64(sellerBps) / 100,
	})
}

// POST /api/studio/models/import  multipart: weights (LTVision .pt), name, classes (JSON list), size, metrics (JSON), project_id
// Brings your own LTVision weights. Their metrics are self-reported and shown that way.
func (h *Handler) HandleImportModel(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok || !h.requireFeature(w, r, uid, "train") {
		return
	}
	ctx := r.Context()
	plan, err := h.userPlan(ctx, uid)
	if err != nil {
		internal(w, r, err)
		return
	}
	u, err := h.usage(ctx, uid)
	if err != nil {
		internal(w, r, err)
		return
	}
	if u.PrivateModels >= plan.Plan.PrivateModels {
		quotaError(w, r, "model")
		return
	}
	weights, ok := readUpload(w, r, "weights", 1024<<20)
	if !ok {
		return
	}
	if len(weights) < 1024 || !strings.HasPrefix(string(weights[:2]), "PK") {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_weights", "Upload a PyTorch .pt file saved by LTVision (a zip-based torch checkpoint)")
		return
	}
	name := strings.TrimSpace(r.FormValue("name"))
	if name == "" || len([]rune(name)) > 80 {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_name", "Model name must be 1-80 characters")
		return
	}
	var classes []string
	if err := json.Unmarshal([]byte(r.FormValue("classes")), &classes); err != nil || len(classes) == 0 {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_classes", "List the model's classes in training order")
		return
	}
	classes, err = cleanClasses(classes)
	if err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_classes", err.Error())
		return
	}
	size := r.FormValue("size")
	if _, ok := secPerImage[size]; !ok {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_size", "Pick the LTVision size the weights were trained with")
		return
	}
	raw := map[string]any{}
	if m := r.FormValue("metrics"); m != "" {
		_ = json.Unmarshal([]byte(m), &raw)
	}
	metrics := cleanMetrics(raw)
	metrics["size"] = size
	metrics["self_reported"] = true
	var pid *string
	if p := r.FormValue("project_id"); p != "" {
		pid = &p
	}
	if !h.ownsProject(ctx, uid, pid) {
		notFound(w, r, "Project")
		return
	}
	var username, modelID, endpoint string
	_ = h.pool.QueryRow(ctx, `SELECT username FROM user_profiles WHERE user_id = $1`, uid).Scan(&username)
	if username == "" {
		username = "u"
	}
	if err := catalog.Setting(ctx, h.pool, "ltvision_endpoint", &endpoint); err != nil || endpoint == "" {
		endpoint = "ltvision-ep"
	}
	if err := h.pool.QueryRow(ctx, `SELECT gen_random_uuid()::text`).Scan(&modelID); err != nil {
		internal(w, r, err)
		return
	}
	key := "weights/" + modelID + ".pt"
	if err := h.store.Put(key, weights); err != nil {
		internal(w, r, err)
		return
	}
	slug := fmt.Sprintf("%s-%s-%s", slugify(username, 30), slugify(name, 40), modelID[:4])
	cj, _ := json.Marshal(classes)
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `INSERT INTO models (id, slug, name, description, license, is_open, runpod_endpoint, price_per_call, enabled, meta)
		VALUES ($1,$2,$3,'','owner',false,$4,2000,true,'{"kind":"custom"}')`, modelID, slug, name, endpoint); err != nil {
		_ = h.store.Delete(key)
		internal(w, r, err)
		return
	}
	if _, err := tx.Exec(ctx, `INSERT INTO model_ownership (model_id, owner_id, project_id, weights_key, classes, metrics, source)
		VALUES ($1,$2,$3::uuid,$4,$5,$6,'imported')`, modelID, uid, pid, key, cj, mustJSON(metrics)); err != nil {
		_ = h.store.Delete(key)
		internal(w, r, err)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		_ = h.store.Delete(key)
		internal(w, r, err)
		return
	}
	h.writeMyModel(w, r, uid, slug)
}
