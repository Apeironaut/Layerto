package studio

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"layerto/services/core/internal/billing"
	"layerto/services/core/internal/catalog"
	"layerto/services/core/internal/httpx"
)

// featureLabels names each plan feature for upgrade messages and the plan pages.
var featureLabels = map[string]string{
	"community":       "Community",
	"marketplace_buy": "Buy from the marketplace",
	"projects":        "Projects",
	"train":           "Annotation and training",
	"sites":           "Model websites",
	"sell_models":     "Sell models",
	"sell_images":     "Sell image datasets",
	"research":        "Research workspace",
	"teams":           "Teams",
	"portfolio":       "Portfolio site",
	"gpu_bundles":     "GPU hour bundles",
}

// requireFeature writes a 403 "plan_feature" error when the user's plan lacks the feature.
// The message says which plan they are on and what to pick instead.
func (h *Handler) requireFeature(w http.ResponseWriter, r *http.Request, uid, feature string) bool {
	info, err := h.userPlan(r.Context(), uid)
	if err != nil {
		internal(w, r, err)
		return false
	}
	if info.Plan.Has(feature) {
		return true
	}
	label := featureLabels[feature]
	if label == "" {
		label = feature
	}
	hint := "Upgrade your plan to use it."
	switch feature {
	case "research", "portfolio":
		hint = "It comes with the Research plans (Research Free, Researcher Pro) and Enterprise."
	case "teams":
		hint = "It comes with Researcher Pro and Enterprise."
	case "sell_images":
		hint = "It comes with the Photographer, Solo, Researcher Pro and Enterprise plans."
	case "projects", "train":
		if info.Plan.Audience == "photographer" {
			hint = "The Photographer plan is for selling image datasets. Switch to Solo, a Research plan or Enterprise to build models."
		}
	}
	httpx.WriteError(w, r, http.StatusForbidden, "plan_feature", label+" isn't included in your "+info.Plan.Name+" plan. "+hint)
	return false
}

// ---- tracks and UI settings

var validTracks = map[string]bool{"": true, "photographer": true, "solo": true, "researcher": true, "enterprise": true, "student": true}

func (h *Handler) track(ctx context.Context, uid string) string {
	var t string
	_ = h.pool.QueryRow(ctx, `SELECT track FROM user_settings WHERE user_id = $1`, uid).Scan(&t)
	return t
}

func (h *Handler) setTrackFromPlan(ctx context.Context, uid string, p Plan) {
	t := p.Audience
	if t == "everyone" || !validTracks[t] {
		return
	}
	_, _ = h.pool.Exec(ctx, `INSERT INTO user_settings (user_id, track) VALUES ($1, $2)
		ON CONFLICT (user_id) DO UPDATE SET track = $2, updated_at = now()`, uid, t)
}

// GET /api/me/settings
func (h *Handler) HandleGetSettings(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	track, ui := "", json.RawMessage(`{}`)
	_ = h.pool.QueryRow(r.Context(), `SELECT track, ui FROM user_settings WHERE user_id = $1`, uid).Scan(&track, &ui)
	httpx.JSON(w, http.StatusOK, map[string]any{"track": track, "ui": ui})
}

// PUT /api/me/settings {"track": "researcher", "ui": {...}}
func (h *Handler) HandlePutSettings(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	var in struct {
		Track *string          `json:"track"`
		UI    *json.RawMessage `json:"ui"`
	}
	if !decodeJSON(w, r, &in, 8<<10) {
		return
	}
	if in.Track != nil && !validTracks[*in.Track] {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_track", "Unknown account type")
		return
	}
	var ui []byte
	if in.UI != nil {
		var m map[string]any
		if json.Unmarshal(*in.UI, &m) != nil {
			httpx.WriteError(w, r, http.StatusBadRequest, "invalid_ui", "UI settings must be an object")
			return
		}
		ui = *in.UI
	}
	_, err := h.pool.Exec(r.Context(), `INSERT INTO user_settings (user_id, track, ui) VALUES ($1, COALESCE($2, ''), COALESCE($3::jsonb, '{}'))
		ON CONFLICT (user_id) DO UPDATE SET track = COALESCE($2, user_settings.track), ui = COALESCE($3::jsonb, user_settings.ui), updated_at = now()`,
		uid, in.Track, nullBytes(ui))
	if err != nil {
		internal(w, r, err)
		return
	}
	h.HandleGetSettings(w, r)
}

// ---- add-ons

type Addon struct {
	Name      string `json:"name"`
	Price     int64  `json:"price"`
	StorageMB int64  `json:"storage_mb"`
	Requires  string `json:"requires"` // plan feature needed to buy it ("" = anyone)
}

func (h *Handler) addons(ctx context.Context) (map[string]Addon, error) {
	var a map[string]Addon
	if err := catalog.Setting(ctx, h.pool, "addons", &a); err != nil {
		return map[string]Addon{}, err
	}
	return a, nil
}

func (h *Handler) hasAddon(ctx context.Context, uid, addon string) bool {
	var ok bool
	_ = h.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM subscription_addons WHERE user_id = $1 AND addon = $2 AND period_end > now())`, uid, addon).Scan(&ok)
	return ok
}

// POST /api/studio/addons {"addon": "storage_10gb", "quantity": 2}  (charged now for 30 days)
func (h *Handler) HandleBuyAddon(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	var in struct {
		Addon    string `json:"addon"`
		Quantity int    `json:"quantity"`
	}
	if !decodeJSON(w, r, &in, 512) {
		return
	}
	ctx := r.Context()
	defs, _ := h.addons(ctx)
	def, found := defs[in.Addon]
	if !found {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_addon", "Unknown add-on")
		return
	}
	if in.Quantity <= 0 {
		in.Quantity = 1
	}
	if in.Quantity > 100 || (def.StorageMB == 0 && in.Quantity != 1) {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_quantity", "Invalid quantity")
		return
	}
	if def.Requires != "" && !h.requireFeature(w, r, uid, def.Requires) {
		return
	}
	var curQty int
	var curEnd *time.Time
	_ = h.pool.QueryRow(ctx, `SELECT quantity, period_end FROM subscription_addons WHERE user_id = $1 AND addon = $2`, uid, in.Addon).Scan(&curQty, &curEnd)
	start := time.Now()
	charge := def.Price * int64(in.Quantity)
	qty := in.Quantity
	if curEnd != nil && curEnd.After(start) {
		// active already: buying more storage adds to the running period at full price; same quantity extends it
		if def.StorageMB > 0 && in.Quantity != curQty {
			if in.Quantity <= curQty {
				httpx.WriteError(w, r, http.StatusBadRequest, "invalid_quantity", "To lower the amount, turn off auto-renew and buy again when it ends.")
				return
			}
			charge = def.Price * int64(in.Quantity-curQty)
			start = curEnd.Add(-30 * 24 * time.Hour)
		} else {
			start = *curEnd
		}
	}
	end := start.Add(30 * 24 * time.Hour)
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if charge > 0 {
		if _, err := billing.AdjustTx(ctx, tx, uid, -charge, "addon.charged", map[string]any{"addon": in.Addon, "quantity": qty, "period_end": ts(end)}); err != nil {
			if errors.Is(err, billing.ErrInsufficientBalance) {
				httpx.WriteError(w, r, http.StatusPaymentRequired, "insufficient_balance", "Your balance is too low. Add credit first.")
				return
			}
			internal(w, r, err)
			return
		}
	}
	if _, err := tx.Exec(ctx, `INSERT INTO subscription_addons (user_id, addon, quantity, period_end, auto_renew) VALUES ($1,$2,$3,$4,true)
		ON CONFLICT (user_id, addon) DO UPDATE SET quantity = $3, period_end = $4, auto_renew = true, updated_at = now()`, uid, in.Addon, qty, end); err != nil {
		internal(w, r, err)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		internal(w, r, err)
		return
	}
	h.HandleGetPlan(w, r)
}

// PATCH /api/studio/addons/{addon} {"auto_renew": false}
func (h *Handler) HandleAddonRenew(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	var in struct {
		AutoRenew bool `json:"auto_renew"`
	}
	if !decodeJSON(w, r, &in, 256) {
		return
	}
	tag, err := h.pool.Exec(r.Context(), `UPDATE subscription_addons SET auto_renew = $3, updated_at = now() WHERE user_id = $1 AND addon = $2`,
		uid, chi.URLParam(r, "addon"), in.AutoRenew)
	if err != nil || tag.RowsAffected() == 0 {
		notFound(w, r, "Add-on")
		return
	}
	h.HandleGetPlan(w, r)
}

func (h *Handler) renewAddons(ctx context.Context) {
	rows, err := h.pool.Query(ctx, `SELECT user_id::text, addon, quantity, auto_renew FROM subscription_addons WHERE period_end < now()`)
	if err != nil {
		return
	}
	type due struct {
		uid, addon string
		qty        int
		auto       bool
	}
	var list []due
	for rows.Next() {
		var d due
		if rows.Scan(&d.uid, &d.addon, &d.qty, &d.auto) == nil {
			list = append(list, d)
		}
	}
	rows.Close()
	defs, _ := h.addons(ctx)
	for _, d := range list {
		def, ok := defs[d.addon]
		renewed := false
		if ok && d.auto {
			end := time.Now().Add(30 * 24 * time.Hour)
			tx, err := h.pool.Begin(ctx)
			if err == nil {
				if _, err = billing.AdjustTx(ctx, tx, d.uid, -def.Price*int64(d.qty), "addon.charged", map[string]any{"addon": d.addon, "quantity": d.qty, "period_end": ts(end), "renewal": true}); err == nil {
					if _, err = tx.Exec(ctx, `UPDATE subscription_addons SET period_end = $3, updated_at = now() WHERE user_id = $1 AND addon = $2`, d.uid, d.addon, end); err == nil {
						renewed = tx.Commit(ctx) == nil
					}
				}
				_ = tx.Rollback(ctx)
			}
		}
		if !renewed {
			_, _ = h.pool.Exec(ctx, `DELETE FROM subscription_addons WHERE user_id = $1 AND addon = $2 AND period_end < now()`, d.uid, d.addon)
			if d.addon == "portfolio" {
				_, _ = h.pool.Exec(ctx, `UPDATE portfolios SET enabled = false WHERE user_id = $1`, d.uid)
			}
		}
	}
}

// ---- GPU hour bundles (prepaid training time, used before the balance)

type GPUBundle struct {
	ID    string  `json:"id"`
	Name  string  `json:"name"`
	Hours float64 `json:"hours"`
	Price int64   `json:"price"`
}

func (h *Handler) gpuBundles(ctx context.Context) ([]GPUBundle, error) {
	var b []GPUBundle
	if err := catalog.Setting(ctx, h.pool, "gpu_bundles", &b); err != nil {
		return []GPUBundle{}, err
	}
	return b, nil
}

// POST /api/studio/gpu-bundles {"id": "gpu10"}
func (h *Handler) HandleBuyGPUBundle(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	var in struct {
		ID string `json:"id"`
	}
	if !decodeJSON(w, r, &in, 256) {
		return
	}
	if !h.requireFeature(w, r, uid, "gpu_bundles") {
		return
	}
	ctx := r.Context()
	bundles, _ := h.gpuBundles(ctx)
	var b *GPUBundle
	for i := range bundles {
		if bundles[i].ID == strings.TrimSpace(in.ID) {
			b = &bundles[i]
		}
	}
	if b == nil || b.Hours <= 0 {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_bundle", "Unknown GPU bundle")
		return
	}
	secs := int64(b.Hours * 3600)
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := billing.AdjustTx(ctx, tx, uid, -b.Price, "gpu_bundle.charged", map[string]any{"bundle": b.ID, "hours": b.Hours}); err != nil {
		if errors.Is(err, billing.ErrInsufficientBalance) {
			httpx.WriteError(w, r, http.StatusPaymentRequired, "insufficient_balance", "Your balance is too low. Add credit first.")
			return
		}
		internal(w, r, err)
		return
	}
	if _, err := tx.Exec(ctx, `INSERT INTO gpu_credits (user_id, seconds) VALUES ($1, $2)
		ON CONFLICT (user_id) DO UPDATE SET seconds = gpu_credits.seconds + $2, updated_at = now()`, uid, secs); err != nil {
		internal(w, r, err)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		internal(w, r, err)
		return
	}
	h.HandleGetPlan(w, r)
}
