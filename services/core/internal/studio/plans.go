package studio

import (
	"context"
	"errors"
	"log"
	"net/http"
	"sort"
	"time"

	"layerto/services/core/internal/billing"
	"layerto/services/core/internal/catalog"
	"layerto/services/core/internal/httpx"
)

func logf(format string, args ...any) { log.Printf("[studio] "+format, args...) }

// Plan limits. Prices are micro-USD per 30 days, paid from the prepaid balance.
// Features gate whole sections (see featureLabels); audience says which kind of user the plan is for.
type Plan struct {
	Name          string   `json:"name"`
	Audience      string   `json:"audience"`
	Description   string   `json:"description"`
	Price         int64    `json:"price"`
	Projects      int      `json:"projects"`
	StorageMB     int64    `json:"storage_mb"`
	KeepDatasets  bool     `json:"keep_datasets"`
	Sites         int      `json:"sites"`
	PrivateModels int      `json:"private_models"`
	TeamSeats     int      `json:"team_seats"`
	Features      []string `json:"features"`
}

func (p Plan) Has(feature string) bool {
	for _, f := range p.Features {
		if f == feature {
			return true
		}
	}
	return false
}

var planOrder = map[string]int{"free": 0, "photographer": 1, "solo": 2, "research_free": 3, "researcher": 4, "enterprise": 5, "lab": 6}

// fallbackPlan is where a paid plan goes when it ends: researchers keep their free research workspace.
func fallbackPlan(all map[string]Plan, id string) string {
	if p, ok := all[id]; ok && p.Audience == "researcher" {
		if _, ok := all["research_free"]; ok {
			return "research_free"
		}
	}
	return "free"
}

func (h *Handler) plans(ctx context.Context) (map[string]Plan, error) {
	var p map[string]Plan
	if err := catalog.Setting(ctx, h.pool, "plans", &p); err != nil {
		return nil, err
	}
	if _, ok := p["free"]; !ok {
		p["free"] = Plan{Name: "Free", Audience: "everyone", Projects: 2, StorageMB: 1024, Sites: 1, PrivateModels: 2,
			Features: []string{"community", "marketplace_buy", "projects", "train"}}
	}
	return p, nil
}

type userPlanInfo struct {
	ID        string
	Plan      Plan // effective limits: plan + add-ons
	PeriodEnd *time.Time
	AutoRenew bool
	Granted   bool
	Addons    map[string]int // active add-on -> quantity
}

// userPlan returns the active plan; a paid plan past its period end counts as free until
// the janitor renews or downgrades it.
func (h *Handler) userPlan(ctx context.Context, userID string) (userPlanInfo, error) {
	plans, err := h.plans(ctx)
	if err != nil {
		return userPlanInfo{}, err
	}
	info := userPlanInfo{ID: "free", AutoRenew: true}
	var periodEnd *time.Time
	var granted *string
	err = h.pool.QueryRow(ctx, `SELECT plan, period_end, auto_renew, granted_by::text FROM subscriptions WHERE user_id = $1`, userID).
		Scan(&info.ID, &periodEnd, &info.AutoRenew, &granted)
	if err != nil && !isNoRows(err) {
		return info, err
	}
	info.PeriodEnd = periodEnd
	info.Granted = granted != nil
	if plans[info.ID].Price > 0 && periodEnd != nil && periodEnd.Before(time.Now()) {
		info.ID = fallbackPlan(plans, info.ID)
	}
	p, ok := plans[info.ID]
	if !ok {
		info.ID, p = "free", plans["free"]
	}
	p.Features = append([]string(nil), p.Features...)
	info.Addons = map[string]int{}
	rows, err := h.pool.Query(ctx, `SELECT addon, quantity FROM subscription_addons WHERE user_id = $1 AND period_end > now()`, userID)
	if err == nil {
		addons, _ := h.addons(ctx)
		for rows.Next() {
			var a string
			var q int
			if rows.Scan(&a, &q) == nil {
				info.Addons[a] = q
				if def, ok := addons[a]; ok {
					p.StorageMB += def.StorageMB * int64(q)
				}
			}
		}
		rows.Close()
	}
	info.Plan = p
	return info, nil
}

type usage struct {
	Projects      int   `json:"projects"`
	StorageBytes  int64 `json:"storage_bytes"`
	Sites         int   `json:"sites"`
	PrivateModels int   `json:"private_models"`
	TeamMembers   int   `json:"team_members"`
}

// usage counts what the user owns. Storage = dataset images (incl. dataset bundles for sale) + research files + paper PDFs.
func (h *Handler) usage(ctx context.Context, userID string) (usage, error) {
	var u usage
	err := h.pool.QueryRow(ctx, `
		SELECT (SELECT count(*) FROM projects WHERE user_id = $1),
		       (SELECT COALESCE(sum(bytes), 0) FROM datasets WHERE user_id = $1 AND purged_at IS NULL)
		         + (SELECT COALESCE(sum(bytes), 0) FROM research_files WHERE owner_id = $1)
		         + (SELECT COALESCE(sum(pdf_bytes), 0) FROM papers WHERE owner_id = $1),
		       (SELECT count(*) FROM model_sites WHERE user_id = $1),
		       (SELECT count(*) FROM model_ownership WHERE owner_id = $1),
		       (SELECT count(DISTINCT m.user_id) FROM team_members m JOIN teams t ON t.id = m.team_id WHERE t.owner_id = $1 AND m.user_id <> $1)`, userID).
		Scan(&u.Projects, &u.StorageBytes, &u.Sites, &u.PrivateModels, &u.TeamMembers)
	return u, err
}

var errQuota = errors.New("plan limit reached")

func quotaError(w http.ResponseWriter, r *http.Request, what string) {
	httpx.WriteError(w, r, http.StatusForbidden, "plan_limit", "Your plan's "+what+" limit is reached. Upgrade your plan to add more.")
}

type planItem struct {
	ID string `json:"id"`
	Plan
}

// GET /api/studio/plan
func (h *Handler) HandleGetPlan(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	info, err := h.userPlan(ctx, uid)
	if err != nil {
		internal(w, r, err)
		return
	}
	u, err := h.usage(ctx, uid)
	if err != nil {
		internal(w, r, err)
		return
	}
	all, _ := h.plans(ctx)
	items := make([]planItem, 0, len(all))
	for id, p := range all {
		items = append(items, planItem{ID: id, Plan: p})
	}
	sort.Slice(items, func(a, b int) bool { return planOrder[items[a].ID] < planOrder[items[b].ID] })
	var end *string
	if info.PeriodEnd != nil && all[info.ID].Price > 0 {
		s := ts(*info.PeriodEnd)
		end = &s
	}
	var gpuSeconds int64
	_ = h.pool.QueryRow(ctx, `SELECT seconds FROM gpu_credits WHERE user_id = $1`, uid).Scan(&gpuSeconds)
	addonRows := []map[string]any{}
	if rows, err := h.pool.Query(ctx, `SELECT addon, quantity, period_end, auto_renew FROM subscription_addons WHERE user_id = $1 AND period_end > now() ORDER BY addon`, uid); err == nil {
		for rows.Next() {
			var a string
			var q int
			var pe time.Time
			var ar bool
			if rows.Scan(&a, &q, &pe, &ar) == nil {
				addonRows = append(addonRows, map[string]any{"id": a, "quantity": q, "period_end": ts(pe), "auto_renew": ar})
			}
		}
		rows.Close()
	}
	addonDefs, _ := h.addons(ctx)
	bundles, _ := h.gpuBundles(ctx)
	track := h.track(ctx, uid)
	httpx.JSON(w, http.StatusOK, map[string]any{
		"current": info.ID, "limits": info.Plan, "period_end": end, "auto_renew": info.AutoRenew,
		"granted": info.Granted, "usage": u, "plans": items, "features": info.Plan.Features,
		"addons": addonRows, "addon_catalog": addonDefs, "gpu_bundles": bundles, "gpu_hours": float64(gpuSeconds) / 3600,
		"track": track, "feature_labels": featureLabels,
	})
}

// POST /api/studio/plan {"plan": "researcher", "auto_renew": true}
func (h *Handler) HandleBuyPlan(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	var req struct {
		Plan      string `json:"plan"`
		AutoRenew *bool  `json:"auto_renew"`
	}
	if !decodeJSON(w, r, &req, 1<<10) {
		return
	}
	ctx := r.Context()
	all, err := h.plans(ctx)
	if err != nil {
		internal(w, r, err)
		return
	}
	p, ok := all[req.Plan]
	if !ok {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_plan", "Unknown plan")
		return
	}
	auto := true
	if req.AutoRenew != nil {
		auto = *req.AutoRenew
	}
	if p.Price == 0 {
		_, err := h.pool.Exec(ctx, `
			INSERT INTO subscriptions (user_id, plan, period_end, auto_renew) VALUES ($1, $2, NULL, $3)
			ON CONFLICT (user_id) DO UPDATE SET plan = $2, period_end = NULL, auto_renew = $3, granted_by = NULL, updated_at = now()`, uid, req.Plan, auto)
		if err == nil {
			h.setTrackFromPlan(ctx, uid, p)
		}
		if err != nil {
			internal(w, r, err)
			return
		}
		h.HandleGetPlan(w, r)
		return
	}
	cur, err := h.userPlan(ctx, uid)
	if err != nil {
		internal(w, r, err)
		return
	}
	start := time.Now()
	if cur.ID == req.Plan && cur.PeriodEnd != nil && cur.PeriodEnd.After(start) {
		start = *cur.PeriodEnd // extend the running period
	}
	end := start.Add(30 * 24 * time.Hour)

	tx, err := h.pool.Begin(ctx)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := billing.AdjustTx(ctx, tx, uid, -p.Price, "plan.charged", map[string]any{"plan": req.Plan, "period_end": ts(end)}); err != nil {
		if errors.Is(err, billing.ErrInsufficientBalance) {
			httpx.WriteError(w, r, http.StatusPaymentRequired, "insufficient_balance", "Your balance is too low for this plan. Add credit first.")
			return
		}
		internal(w, r, err)
		return
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO subscriptions (user_id, plan, period_end, auto_renew) VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id) DO UPDATE SET plan = $2, period_end = $3, auto_renew = $4, granted_by = NULL, updated_at = now()`,
		uid, req.Plan, end, auto); err != nil {
		internal(w, r, err)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		internal(w, r, err)
		return
	}
	h.setTrackFromPlan(ctx, uid, p)
	h.HandleGetPlan(w, r)
}

// PATCH /api/studio/plan {"auto_renew": false}
func (h *Handler) HandleSetAutoRenew(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	var req struct {
		AutoRenew bool `json:"auto_renew"`
	}
	if !decodeJSON(w, r, &req, 256) {
		return
	}
	if _, err := h.pool.Exec(r.Context(), `
		INSERT INTO subscriptions (user_id, auto_renew) VALUES ($1, $2)
		ON CONFLICT (user_id) DO UPDATE SET auto_renew = $2, updated_at = now()`, uid, req.AutoRenew); err != nil {
		internal(w, r, err)
		return
	}
	h.HandleGetPlan(w, r)
}

// renewPlans renews due paid plans from the balance (auto_renew) or moves them to free.
// Admin-granted plans are never charged; they simply end.
func (h *Handler) renewPlans(ctx context.Context) {
	rows, err := h.pool.Query(ctx, `SELECT user_id::text, plan, auto_renew, granted_by IS NOT NULL FROM subscriptions
		WHERE period_end IS NOT NULL AND period_end < now()`)
	if err != nil {
		logf("renew query: %v", err)
		return
	}
	type due struct {
		uid, plan     string
		auto, granted bool
	}
	var list []due
	for rows.Next() {
		var d due
		if rows.Scan(&d.uid, &d.plan, &d.auto, &d.granted) == nil {
			list = append(list, d)
		}
	}
	rows.Close()
	all, err := h.plans(ctx)
	if err != nil {
		return
	}
	for _, d := range list {
		p, ok := all[d.plan]
		renewed := false
		if ok && d.auto && !d.granted && p.Price > 0 {
			end := time.Now().Add(30 * 24 * time.Hour)
			tx, err := h.pool.Begin(ctx)
			if err == nil {
				if _, err = billing.AdjustTx(ctx, tx, d.uid, -p.Price, "plan.charged", map[string]any{"plan": d.plan, "period_end": ts(end), "renewal": true}); err == nil {
					if _, err = tx.Exec(ctx, `UPDATE subscriptions SET period_end = $2, updated_at = now() WHERE user_id = $1`, d.uid, end); err == nil {
						renewed = tx.Commit(ctx) == nil
					}
				}
				_ = tx.Rollback(ctx)
			}
		}
		if !renewed {
			_, _ = h.pool.Exec(ctx, `UPDATE subscriptions SET plan = $2, period_end = NULL, granted_by = NULL, updated_at = now() WHERE user_id = $1`, d.uid, fallbackPlan(all, d.plan))
		}
	}
}

// GET /v1/studio/info  (public: plans and Studio rules for the website)
func (h *Handler) HandlePublicInfo(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	all, err := h.plans(ctx)
	if err != nil {
		internal(w, r, err)
		return
	}
	items := make([]planItem, 0, len(all))
	for id, p := range all {
		items = append(items, planItem{ID: id, Plan: p})
	}
	sort.Slice(items, func(a, b int) bool { return planOrder[items[a].ID] < planOrder[items[b].ID] })
	bps := catalog.IntSetting(ctx, h.pool, "creator_reward_bps", 2500)
	gpu := catalog.IntSetting(ctx, h.pool, "gpu_price_per_hour", 1500000)
	days := catalog.IntSetting(ctx, h.pool, "dataset_retention_days", 3)
	seller := catalog.IntSetting(ctx, h.pool, "bundle_seller_share_bps", 8000)
	w.Header().Set("Cache-Control", "public, max-age=300")
	httpx.JSON(w, http.StatusOK, map[string]any{
		"plans": items, "creator_share_percent": float64(bps) / 100, "seller_share_percent": float64(seller) / 100,
		"gpu_price_per_hour_usd": usd(gpu), "dataset_retention_days": days,
	})
}
