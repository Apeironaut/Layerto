package studio

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"layerto/services/core/internal/auth"
	"layerto/services/core/internal/billing"
	"layerto/services/core/internal/httpx"
)

func adminID(r *http.Request) *string {
	if u, ok := auth.UserFromContext(r.Context()); ok {
		s := uuidStr(u.ID)
		return &s
	}
	return nil
}

// GET /admin/studio/overview
func (h *Handler) HandleAdminOverview(w http.ResponseWriter, r *http.Request) {
	var o struct {
		Datasets       int    `json:"datasets"`
		Images         int    `json:"images"`
		StorageBytes   int64  `json:"storage_bytes"`
		PendingDeletes int    `json:"datasets_pending_delete"`
		JobsQueued     int    `json:"jobs_queued"`
		JobsRunning    int    `json:"jobs_running"`
		JobsDone30d    int    `json:"jobs_succeeded_30d"`
		CustomModels   int    `json:"custom_models"`
		PendingReview  int    `json:"models_pending_review"`
		PublicModels   int    `json:"public_models"`
		Sites          int    `json:"sites"`
		PaidPlans      int    `json:"paid_plans"`
		Rewards30d     string `json:"creator_rewards_30d_usd"`
		Training30d    string `json:"training_revenue_30d_usd"`
		Plans30d       string `json:"plan_revenue_30d_usd"`
		PackageReady   bool   `json:"ltvision_package_ready"`
	}
	var rewards, training, plans int64
	err := h.pool.QueryRow(r.Context(), `SELECT
		(SELECT count(*) FROM datasets WHERE purged_at IS NULL),
		(SELECT count(*) FROM dataset_images),
		(SELECT COALESCE(sum(bytes),0) FROM datasets WHERE purged_at IS NULL),
		(SELECT count(*) FROM datasets WHERE purged_at IS NULL AND NOT keep AND delete_after < now() + interval '3 days'),
		(SELECT count(*) FROM training_jobs WHERE status = 'queued'),
		(SELECT count(*) FROM training_jobs WHERE status = 'running'),
		(SELECT count(*) FROM training_jobs WHERE status = 'succeeded' AND finished_at > now() - interval '30 days'),
		(SELECT count(*) FROM model_ownership),
		(SELECT count(*) FROM model_ownership WHERE visibility = 'pending'),
		(SELECT count(*) FROM model_ownership WHERE visibility = 'public'),
		(SELECT count(*) FROM model_sites),
		(SELECT count(*) FROM subscriptions WHERE plan <> 'free' AND period_end > now()),
		(SELECT COALESCE(sum((payload->>'amount')::bigint),0) FROM events WHERE type = 'creator.reward' AND created_at > now() - interval '30 days'),
		(SELECT COALESCE(-sum((payload->>'amount')::bigint),0) FROM events WHERE type IN ('training.charged','training.refunded') AND created_at > now() - interval '30 days'),
		(SELECT COALESCE(-sum((payload->>'amount')::bigint),0) FROM events WHERE type = 'plan.charged' AND created_at > now() - interval '30 days')`).
		Scan(&o.Datasets, &o.Images, &o.StorageBytes, &o.PendingDeletes, &o.JobsQueued, &o.JobsRunning, &o.JobsDone30d,
			&o.CustomModels, &o.PendingReview, &o.PublicModels, &o.Sites, &o.PaidPlans, &rewards, &training, &plans)
	if err != nil {
		internal(w, r, err)
		return
	}
	o.Rewards30d, o.Training30d, o.Plans30d = usd(rewards), usd(training), usd(plans)
	_, perr := h.store.PlainPath(ltvisionPackageKey)
	o.PackageReady = perr == nil
	httpx.JSON(w, http.StatusOK, o)
}

// GET /admin/studio/models?status=pending|public|private|rejected|all
func (h *Handler) HandleAdminModels(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	where := ""
	args := []any{}
	if status != "" && status != "all" {
		where = ` WHERE o.visibility = $1`
		args = append(args, status)
	}
	rows, err := h.pool.Query(r.Context(), `SELECT `+myModelCols+`
		FROM model_ownership o JOIN models m ON m.id = o.model_id`+where+` ORDER BY (o.visibility = 'pending') DESC, o.created_at DESC LIMIT 500`, args...)
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

// POST /admin/studio/models/{slug}/review {"decision":"approve"|"reject"|"unpublish","note":""}
func (h *Handler) HandleAdminReview(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	var in struct {
		Decision string `json:"decision"`
		Note     string `json:"note"`
	}
	if !decodeJSON(w, r, &in, 4<<10) {
		return
	}
	var vis string
	var pub any
	switch in.Decision {
	case "approve":
		vis, pub = "public", time.Now()
	case "reject":
		vis = "rejected"
		if strings.TrimSpace(in.Note) == "" {
			httpx.WriteError(w, r, http.StatusBadRequest, "note_required", "Tell the creator why (it is shown to them)")
			return
		}
	case "unpublish":
		vis = "private"
	default:
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_decision", "decision must be approve, reject or unpublish")
		return
	}
	note := strings.TrimSpace(in.Note)
	if len(note) > 500 {
		note = note[:500]
	}
	tag, err := h.pool.Exec(r.Context(), `UPDATE model_ownership SET visibility = $2, review_note = $3,
		published_at = CASE WHEN $2 = 'public' THEN COALESCE($4, published_at) ELSE NULL END
		FROM models m WHERE m.id = model_ownership.model_id AND m.slug = $1`, slug, vis, note, pub)
	if err != nil {
		internal(w, r, err)
		return
	}
	if tag.RowsAffected() == 0 {
		notFound(w, r, "Model")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"slug": slug, "visibility": vis})
}

// GET /admin/studio/jobs?status=
func (h *Handler) HandleAdminJobs(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	where := ""
	args := []any{}
	if status != "" && status != "all" {
		where = ` WHERE j.status = $1`
		args = append(args, status)
	}
	rows, err := h.pool.Query(r.Context(), `SELECT `+jobCols+jobFrom+where+` ORDER BY j.created_at DESC LIMIT 300`, args...)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer rows.Close()
	out := []jobOut{}
	for rows.Next() {
		j, err := scanJob(rows)
		if err != nil {
			internal(w, r, err)
			return
		}
		out = append(out, j)
	}
	httpx.JSON(w, http.StatusOK, out)
}

// POST /admin/studio/jobs/{id}/cancel  (refunds a Layerto GPU charge)
func (h *Handler) HandleAdminCancelJob(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !validID(id) {
		notFound(w, r, "Training job")
		return
	}
	if err := h.finishJob(r.Context(), id, "", "cancelled", "Cancelled by an administrator. You were refunded."); err != nil {
		httpx.WriteError(w, r, http.StatusConflict, "cannot_cancel", "This training is not queued or running")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

// POST /admin/studio/ltvision-package  (multipart "package": the LTVision zip with train.py)
func (h *Handler) HandleAdminUploadPackage(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 100<<20)
	f, _, err := r.FormFile("package")
	if err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Upload the LTVision zip in the \"package\" field (max 100 MB)")
		return
	}
	data, err := io.ReadAll(f)
	_ = f.Close()
	if err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Couldn't read the upload")
		return
	}
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_package", "That is not a zip file")
		return
	}
	hasTrain := false
	for _, f := range zr.File {
		if strings.HasSuffix(f.Name, "train.py") && !strings.Contains(f.Name, "__MACOSX") {
			hasTrain = true
		}
	}
	if !hasTrain {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_package", "The zip must contain LTVision's train.py")
		return
	}
	if err := h.store.PutPlain(ltvisionPackageKey, data); err != nil {
		internal(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "bytes": len(data)})
}

// GET /admin/studio/datasets
func (h *Handler) HandleAdminDatasets(w http.ResponseWriter, r *http.Request) {
	rows, err := h.pool.Query(r.Context(), `SELECT `+datasetCols+`, COALESCE(up.username, u.email)
		FROM datasets d JOIN users u ON u.id = d.user_id LEFT JOIN user_profiles up ON up.user_id = d.user_id
		ORDER BY d.purged_at IS NOT NULL, d.bytes DESC LIMIT 500`)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer rows.Close()
	type adminDS struct {
		dataset
		Owner string `json:"owner"`
	}
	out := []adminDS{}
	for rows.Next() {
		var d dataset
		var classes []byte
		var del, purged *time.Time
		var c, u time.Time
		var owner string
		if err := rows.Scan(&d.ID, &d.Name, &d.ProjectID, &classes, &d.Keep, &del, &purged, &d.Bytes, &c, &u, &d.Images, &d.Labeled, &d.Boxes, &d.Trained, &owner); err != nil {
			internal(w, r, err)
			return
		}
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
		out = append(out, adminDS{d, owner})
	}
	httpx.JSON(w, http.StatusOK, out)
}

// POST /admin/studio/datasets/{id}/purge  (e.g. abuse or a deletion request)
func (h *Handler) HandleAdminPurgeDataset(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !validID(id) {
		notFound(w, r, "Dataset")
		return
	}
	if err := h.purgeDataset(r.Context(), id, false); err != nil {
		internal(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

// GET /admin/studio/sites
func (h *Handler) HandleAdminSites(w http.ResponseWriter, r *http.Request) {
	rows, err := h.pool.Query(r.Context(), `SELECT `+siteCols+`, COALESCE(up.username, u.email)`+siteFrom+`
		JOIN users u ON u.id = s.user_id LEFT JOIN user_profiles up ON up.user_id = s.user_id ORDER BY s.created_at DESC LIMIT 500`)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer rows.Close()
	type adminSite struct {
		site
		Owner string `json:"owner"`
	}
	out := []adminSite{}
	for rows.Next() {
		var s site
		var theme []byte
		var capMicro, spent int64
		var c, u time.Time
		var owner string
		if err := rows.Scan(&s.ID, &s.Slug, &s.ModelSlug, &s.ModelName, &s.Title, &s.Tagline, &s.Description, &s.Template, &theme,
			&s.CTALabel, &s.CTAURL, &capMicro, &s.Published, &s.Disabled, &c, &u, &spent, &owner); err != nil {
			internal(w, r, err)
			return
		}
		s.Theme = map[string]string{}
		_ = json.Unmarshal(theme, &s.Theme)
		s.MonthlyCap, s.SpentMonth, s.CreatedAt, s.UpdatedAt = usd(capMicro), usd(spent), ts(c), ts(u)
		out = append(out, adminSite{s, owner})
	}
	httpx.JSON(w, http.StatusOK, out)
}

// POST /admin/studio/sites/{id}/disable {"disabled": true}
func (h *Handler) HandleAdminDisableSite(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var in struct {
		Disabled bool `json:"disabled"`
	}
	if !validID(id) || !decodeJSON(w, r, &in, 256) {
		if !validID(id) {
			notFound(w, r, "Site")
		}
		return
	}
	tag, err := h.pool.Exec(r.Context(), `UPDATE model_sites SET disabled_by_admin = $2, updated_at = now() WHERE id = $1`, id, in.Disabled)
	if err != nil || tag.RowsAffected() == 0 {
		notFound(w, r, "Site")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

// GET /admin/studio/settings
func (h *Handler) HandleAdminGetSettings(w http.ResponseWriter, r *http.Request) {
	rows, err := h.pool.Query(r.Context(), `SELECT key, value FROM platform_settings ORDER BY key`)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer rows.Close()
	out := map[string]json.RawMessage{}
	for rows.Next() {
		var k string
		var v []byte
		if rows.Scan(&k, &v) == nil {
			out[k] = v
		}
	}
	httpx.JSON(w, http.StatusOK, out)
}

// PUT /admin/studio/settings {"creator_reward_bps":2500, "gpu_price_per_hour":1500000, "dataset_retention_days":3,
//
//	"ltvision_endpoint":"...", "plans":{...}}
func (h *Handler) HandleAdminPutSettings(w http.ResponseWriter, r *http.Request) {
	var in map[string]json.RawMessage
	if !decodeJSON(w, r, &in, 32<<10) {
		return
	}
	for k, v := range in {
		switch k {
		case "creator_reward_bps", "gpu_price_per_hour", "dataset_retention_days":
			var n int64
			if json.Unmarshal(v, &n) != nil || n < 0 ||
				(k == "creator_reward_bps" && n > 9000) || (k == "dataset_retention_days" && (n < 1 || n > 90)) {
				httpx.WriteError(w, r, http.StatusBadRequest, "invalid_setting", "Invalid value for "+k)
				return
			}
		case "ltvision_endpoint":
			var s string
			if json.Unmarshal(v, &s) != nil || s == "" || len(s) > 100 {
				httpx.WriteError(w, r, http.StatusBadRequest, "invalid_setting", "Invalid endpoint")
				return
			}
		case "bundle_seller_share_bps", "assistant_price_per_message":
			var n int64
			if json.Unmarshal(v, &n) != nil || n < 0 || (k == "bundle_seller_share_bps" && n > 10000) {
				httpx.WriteError(w, r, http.StatusBadRequest, "invalid_setting", "Invalid value for "+k)
				return
			}
		case "addons":
			var a map[string]Addon
			if json.Unmarshal(v, &a) != nil {
				httpx.WriteError(w, r, http.StatusBadRequest, "invalid_setting", "Invalid add-ons")
				return
			}
			for id, ad := range a {
				if ad.Name == "" || ad.Price < 0 || ad.StorageMB < 0 || (ad.Requires != "" && featureLabels[ad.Requires] == "") {
					httpx.WriteError(w, r, http.StatusBadRequest, "invalid_setting", "Invalid add-on "+id)
					return
				}
			}
		case "gpu_bundles":
			var b []GPUBundle
			if json.Unmarshal(v, &b) != nil {
				httpx.WriteError(w, r, http.StatusBadRequest, "invalid_setting", "Invalid GPU bundles")
				return
			}
			for _, x := range b {
				if x.ID == "" || x.Name == "" || x.Hours <= 0 || x.Price < 0 {
					httpx.WriteError(w, r, http.StatusBadRequest, "invalid_setting", "Invalid GPU bundle "+x.ID)
					return
				}
			}
		case "plans":
			var p map[string]Plan
			if json.Unmarshal(v, &p) != nil {
				httpx.WriteError(w, r, http.StatusBadRequest, "invalid_setting", "Invalid plans")
				return
			}
			if _, ok := p["free"]; !ok {
				httpx.WriteError(w, r, http.StatusBadRequest, "invalid_setting", "The free plan must exist")
				return
			}
			for id, pl := range p {
				if pl.Price < 0 || pl.Projects < 0 || pl.StorageMB < 0 || pl.Sites < 0 || pl.PrivateModels < 0 || pl.TeamSeats < 0 || pl.Name == "" || (id == "free" && pl.Price != 0) {
					httpx.WriteError(w, r, http.StatusBadRequest, "invalid_setting", "Invalid limits for plan "+id)
					return
				}
				for _, f := range pl.Features {
					if featureLabels[f] == "" {
						httpx.WriteError(w, r, http.StatusBadRequest, "invalid_setting", "Unknown feature "+f+" in plan "+id)
						return
					}
				}
			}
		default:
			httpx.WriteError(w, r, http.StatusBadRequest, "invalid_setting", "Unknown setting "+k)
			return
		}
	}
	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		internal(w, r, err)
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	for k, v := range in {
		if _, err := tx.Exec(r.Context(), `INSERT INTO platform_settings (key, value, updated_at) VALUES ($1, $2, now())
			ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`, k, []byte(v)); err != nil {
			internal(w, r, err)
			return
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		internal(w, r, err)
		return
	}
	h.HandleAdminGetSettings(w, r)
}

// POST /admin/studio/users/{id}/plan {"plan":"researcher","days":30}  (complimentary plan, not charged)
func (h *Handler) HandleAdminSetPlan(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var in struct {
		Plan string `json:"plan"`
		Days int    `json:"days"`
	}
	if !validID(id) || !decodeJSON(w, r, &in, 512) {
		if !validID(id) {
			notFound(w, r, "User")
		}
		return
	}
	plans, err := h.plans(r.Context())
	if err != nil {
		internal(w, r, err)
		return
	}
	if _, ok := plans[in.Plan]; !ok {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_plan", "Unknown plan")
		return
	}
	if in.Days <= 0 || in.Days > 3650 {
		in.Days = 30
	}
	var end any
	if in.Plan != "free" {
		end = time.Now().Add(time.Duration(in.Days) * 24 * time.Hour)
	}
	_, err = h.pool.Exec(r.Context(), `INSERT INTO subscriptions (user_id, plan, period_end, auto_renew, granted_by) VALUES ($1,$2,$3,false,$4::uuid)
		ON CONFLICT (user_id) DO UPDATE SET plan = $2, period_end = $3, auto_renew = false, granted_by = $4::uuid, updated_at = now()`,
		id, in.Plan, end, adminID(r))
	if err != nil {
		notFound(w, r, "User")
		return
	}
	info, _ := h.userPlan(r.Context(), id)
	httpx.JSON(w, http.StatusOK, map[string]any{"plan": info.ID, "period_end": info.PeriodEnd})
}

// GET /admin/hub/overview  (community, marketplace, research and teams at a glance)
func (h *Handler) HandleAdminHubOverview(w http.ResponseWriter, r *http.Request) {
	var posts, posts7, openReports, listingsPending, listingsPublic, purchases, areas, papersPub, teams, members, portfolios, waitlist int
	var salesVolume int64
	err := h.pool.QueryRow(r.Context(), `SELECT
		(SELECT count(*) FROM community_posts WHERE NOT removed),
		(SELECT count(*) FROM community_posts WHERE created_at > now() - interval '7 days'),
		(SELECT count(*) FROM community_reports WHERE NOT resolved),
		(SELECT count(*) FROM dataset_listings WHERE status = 'pending'),
		(SELECT count(*) FROM dataset_listings WHERE status = 'public'),
		(SELECT count(*) FROM dataset_purchases),
		(SELECT COALESCE(sum(price), 0) FROM dataset_purchases WHERE created_at > now() - interval '30 days'),
		(SELECT count(*) FROM research_areas),
		(SELECT count(*) FROM papers WHERE on_layerto),
		(SELECT count(*) FROM teams),
		(SELECT count(*) FROM team_members WHERE status = 'active' AND role <> 'owner'),
		(SELECT count(*) FROM portfolios WHERE enabled),
		(SELECT count(*) FROM assistant_waitlist)`).
		Scan(&posts, &posts7, &openReports, &listingsPending, &listingsPublic, &purchases, &salesVolume, &areas, &papersPub, &teams, &members, &portfolios, &waitlist)
	if err != nil {
		internal(w, r, err)
		return
	}
	tracks := map[string]int{}
	if rows, err := h.pool.Query(r.Context(), `SELECT track, count(*) FROM user_settings WHERE track <> '' GROUP BY track`); err == nil {
		for rows.Next() {
			var t string
			var n int
			if rows.Scan(&t, &n) == nil {
				tracks[t] = n
			}
		}
		rows.Close()
	}
	plans := map[string]int{}
	if rows, err := h.pool.Query(r.Context(), `SELECT plan, count(*) FROM subscriptions WHERE period_end IS NULL OR period_end > now() GROUP BY plan`); err == nil {
		for rows.Next() {
			var p string
			var n int
			if rows.Scan(&p, &n) == nil {
				plans[p] = n
			}
		}
		rows.Close()
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"posts": posts, "posts_7d": posts7, "open_reports": openReports, "listings_pending": listingsPending,
		"listings_public": listingsPublic, "purchases": purchases, "sales_30d_usd": usd(salesVolume), "research_areas": areas,
		"papers_published": papersPub, "teams": teams, "team_members": members, "portfolios": portfolios,
		"assistant_waitlist": waitlist, "tracks": tracks, "plans": plans,
	})
}

// GET /admin/studio/users/{id}  (studio summary for the user drawer)
func (h *Handler) HandleAdminUserStudio(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !validID(id) {
		notFound(w, r, "User")
		return
	}
	info, err := h.userPlan(r.Context(), id)
	if err != nil {
		internal(w, r, err)
		return
	}
	u, err := h.usage(r.Context(), id)
	if err != nil {
		internal(w, r, err)
		return
	}
	var earned int64
	_ = h.pool.QueryRow(r.Context(), `SELECT COALESCE(sum((payload->>'amount')::bigint),0) FROM events WHERE type = 'creator.reward' AND user_id = $1`, id).Scan(&earned)
	httpx.JSON(w, http.StatusOK, map[string]any{"plan": info.ID, "period_end": info.PeriodEnd, "granted": info.Granted,
		"usage": u, "limits": info.Plan, "earned_usd": usd(earned)})
}

// ---- janitor

// StartJanitor deletes expired datasets, renews/ends plans and fails stuck GPU jobs, hourly.
func (h *Handler) StartJanitor(ctx context.Context) {
	go func() {
		t := time.NewTicker(time.Hour)
		defer t.Stop()
		for {
			h.RunJanitor(ctx)
			select {
			case <-ctx.Done():
				return
			case <-t.C:
			}
		}
	}()
}

func (h *Handler) RunJanitor(ctx context.Context) {
	c, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()
	h.purgeExpired(c)
	h.renewPlans(c)
	h.renewAddons(c)
	h.failStale(c)
}

var _ = billing.ErrInsufficientBalance
