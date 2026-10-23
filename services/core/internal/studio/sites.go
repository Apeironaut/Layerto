package studio

import (
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"layerto/services/core/internal/billing"
	"layerto/services/core/internal/catalog"
	"layerto/services/core/internal/gateway"
	"layerto/services/core/internal/httpx"
	"layerto/services/core/internal/models"
)

type site struct {
	ID          string            `json:"id"`
	Slug        string            `json:"slug"`
	ModelSlug   string            `json:"model_slug"`
	ModelName   string            `json:"model_name"`
	Title       string            `json:"title"`
	Tagline     string            `json:"tagline"`
	Description string            `json:"description"`
	Template    string            `json:"template"`
	Theme       map[string]string `json:"theme"`
	CTALabel    string            `json:"cta_label"`
	CTAURL      string            `json:"cta_url"`
	MonthlyCap  string            `json:"monthly_cap_usd"`
	SpentMonth  string            `json:"spent_this_month_usd"`
	Published   bool              `json:"published"`
	Disabled    bool              `json:"disabled_by_admin"`
	CreatedAt   string            `json:"created_at"`
	UpdatedAt   string            `json:"updated_at"`
}

const siteCols = `s.id::text, s.slug, m.slug, m.name, s.title, s.tagline, s.description, s.template, s.theme, s.cta_label, s.cta_url,
	s.monthly_cap, s.published, s.disabled_by_admin, s.created_at, s.updated_at,
	(SELECT COALESCE(sum((e.payload->>'charge')::bigint), 0) FROM events e WHERE e.type = 'request.executed' AND e.user_id = s.user_id
	   AND e.payload->>'site_id' = s.id::text AND e.created_at >= date_trunc('month', now()))`
const siteFrom = ` FROM model_sites s JOIN models m ON m.id = s.model_id`

func scanSite(row interface{ Scan(...any) error }) (site, error) {
	var s site
	var theme []byte
	var capMicro, spent int64
	var c, u time.Time
	err := row.Scan(&s.ID, &s.Slug, &s.ModelSlug, &s.ModelName, &s.Title, &s.Tagline, &s.Description, &s.Template, &theme,
		&s.CTALabel, &s.CTAURL, &capMicro, &s.Published, &s.Disabled, &c, &u, &spent)
	s.Theme = map[string]string{}
	_ = json.Unmarshal(theme, &s.Theme)
	s.MonthlyCap, s.SpentMonth = usd(capMicro), usd(spent)
	s.CreatedAt, s.UpdatedAt = ts(c), ts(u)
	return s, err
}

// GET /api/studio/sites
func (h *Handler) HandleListSites(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	rows, err := h.pool.Query(r.Context(), `SELECT `+siteCols+siteFrom+` WHERE s.user_id = $1 ORDER BY s.created_at DESC`, uid)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer rows.Close()
	out := []site{}
	for rows.Next() {
		s, err := scanSite(rows)
		if err != nil {
			internal(w, r, err)
			return
		}
		out = append(out, s)
	}
	httpx.JSON(w, http.StatusOK, out)
}

type siteInput struct {
	Slug        *string            `json:"slug"`
	ModelSlug   *string            `json:"model_slug"`
	Title       *string            `json:"title"`
	Tagline     *string            `json:"tagline"`
	Description *string            `json:"description"`
	Template    *string            `json:"template"`
	Theme       *map[string]string `json:"theme"`
	CTALabel    *string            `json:"cta_label"`
	CTAURL      *string            `json:"cta_url"`
	MonthlyCap  *string            `json:"monthly_cap_usd"`
	Published   *bool              `json:"published"`
}

var hexColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
var siteSlugRe = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$`)
var reservedSites = map[string]bool{"admin": true, "api": true, "app": true, "www": true, "docs": true, "layerto": true, "dashboard": true}

// siteExtras validates the button link and the monthly cap (shared by create and update).
func siteExtras(w http.ResponseWriter, r *http.Request, in siteInput) (*int64, bool) {
	if in.CTAURL != nil && *in.CTAURL != "" && !strings.HasPrefix(*in.CTAURL, "https://") && !strings.HasPrefix(*in.CTAURL, "mailto:") {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_url", "Button link must start with https:// or mailto:")
		return nil, false
	}
	if in.MonthlyCap == nil {
		return nil, true
	}
	c, err := billing.ParseAmountUSD(*in.MonthlyCap)
	if err != nil || c < 0 || c > 10_000_000_000 {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_cap", "Enter a monthly limit in USD, for example 5.00")
		return nil, false
	}
	return &c, true
}

func cleanTheme(t map[string]string) (map[string]string, error) {
	out := map[string]string{}
	for k, v := range t {
		switch k {
		case "primary", "accent", "background":
			if !hexColor.MatchString(v) {
				return nil, errors.New("colors must look like #A1B2C3")
			}
			out[k] = strings.ToUpper(v)
		case "mode":
			if v != "light" && v != "dark" {
				return nil, errors.New("mode must be light or dark")
			}
			out[k] = v
		case "font":
			if v != "sans" && v != "serif" && v != "mono" {
				return nil, errors.New("font must be sans, serif or mono")
			}
			out[k] = v
		}
	}
	return out, nil
}

// the model must be the user's own, or a public marketplace/platform model
func (h *Handler) siteModelID(r *http.Request, uid, slug string) (string, bool) {
	var id string
	var owner *string
	var vis *string
	err := h.pool.QueryRow(r.Context(), `SELECT m.id::text, o.owner_id::text, o.visibility FROM models m
		LEFT JOIN model_ownership o ON o.model_id = m.id WHERE m.slug = $1 AND m.enabled`, slug).Scan(&id, &owner, &vis)
	if err != nil {
		return "", false
	}
	if owner != nil && *owner != uid && (vis == nil || *vis != "public") {
		return "", false
	}
	return id, true
}

// POST /api/studio/sites
func (h *Handler) HandleCreateSite(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	var in siteInput
	if !decodeJSON(w, r, &in, 32<<10) {
		return
	}
	ctx := r.Context()
	if in.ModelSlug == nil || in.Title == nil || strings.TrimSpace(*in.Title) == "" {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Choose a model and a title")
		return
	}
	if !h.requireFeature(w, r, uid, "sites") {
		return
	}
	modelID, ok := h.siteModelID(r, uid, *in.ModelSlug)
	if !ok {
		notFound(w, r, "Model")
		return
	}
	var dataLicense string
	_ = h.pool.QueryRow(ctx, `SELECT data_license FROM model_ownership WHERE model_id = $1`, modelID).Scan(&dataLicense)
	if dataLicense == "research_only" {
		httpx.WriteError(w, r, http.StatusForbidden, "license_restricted", "This model was trained on research-only data, so it can't get a public website.")
		return
	}
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
	if u.Sites >= plan.Plan.Sites {
		quotaError(w, r, "site")
		return
	}
	slug := slugify(*in.Title, 30)
	if in.Slug != nil && *in.Slug != "" {
		slug = strings.ToLower(*in.Slug)
	}
	if !siteSlugRe.MatchString(slug) || reservedSites[slug] {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_slug", "Address must be 3-40 lowercase letters, numbers or dashes")
		return
	}
	theme := map[string]string{"primary": "#B91C3C", "mode": "light", "font": "sans"}
	if in.Theme != nil {
		t, err := cleanTheme(*in.Theme)
		if err != nil {
			httpx.WriteError(w, r, http.StatusBadRequest, "invalid_theme", err.Error())
			return
		}
		for k, v := range t {
			theme[k] = v
		}
	}
	tj, _ := json.Marshal(theme)
	tmpl := "demo"
	if in.Template != nil {
		tmpl = *in.Template
	}
	capMicro, ok := siteExtras(w, r, in)
	if !ok {
		return
	}
	var id string
	err = h.pool.QueryRow(ctx, `INSERT INTO model_sites (user_id, model_id, slug, title, tagline, description, template, theme,
		cta_label, cta_url, monthly_cap, published)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11, 5000000),COALESCE($12, false)) RETURNING id::text`,
		uid, modelID, slug, strings.TrimSpace(*in.Title), deref(in.Tagline), deref(in.Description), tmpl, tj,
		deref(in.CTALabel), deref(in.CTAURL), capMicro, in.Published).Scan(&id)
	if err != nil {
		if strings.Contains(err.Error(), "23505") || strings.Contains(err.Error(), "duplicate") {
			httpx.WriteError(w, r, http.StatusConflict, "slug_taken", "That address is taken. Try another.")
			return
		}
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_site", "Couldn't create the site (check the fields)")
		return
	}
	s, _ := scanSite(h.pool.QueryRow(ctx, `SELECT `+siteCols+siteFrom+` WHERE s.id = $1`, id))
	httpx.JSON(w, http.StatusCreated, s)
}

// PATCH /api/studio/sites/{id}
func (h *Handler) HandleUpdateSite(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if !validID(id) {
		notFound(w, r, "Site")
		return
	}
	var in siteInput
	if !decodeJSON(w, r, &in, 32<<10) {
		return
	}
	ctx := r.Context()
	var themeJSON []byte
	if in.Theme != nil {
		t, err := cleanTheme(*in.Theme)
		if err != nil {
			httpx.WriteError(w, r, http.StatusBadRequest, "invalid_theme", err.Error())
			return
		}
		themeJSON, _ = json.Marshal(t)
	}
	var modelID *string
	if in.ModelSlug != nil {
		mid, ok := h.siteModelID(r, uid, *in.ModelSlug)
		if !ok {
			notFound(w, r, "Model")
			return
		}
		modelID = &mid
	}
	capMicro, ok := siteExtras(w, r, in)
	if !ok {
		return
	}
	tag, err := h.pool.Exec(ctx, `UPDATE model_sites SET
		model_id = COALESCE($3::uuid, model_id), title = COALESCE($4, title), tagline = COALESCE($5, tagline),
		description = COALESCE($6, description), template = COALESCE($7, template), theme = COALESCE($8, theme),
		cta_label = COALESCE($9, cta_label), cta_url = COALESCE($10, cta_url), monthly_cap = COALESCE($11, monthly_cap),
		published = COALESCE($12, published), updated_at = now()
		WHERE id = $1 AND user_id = $2`, id, uid, modelID, trimPtr(in.Title), trimPtr(in.Tagline), trimPtr(in.Description), in.Template,
		nullBytes(themeJSON), trimPtr(in.CTALabel), trimPtr(in.CTAURL), capMicro, in.Published)
	if err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_site", "Couldn't save (check the lengths of the fields)")
		return
	}
	if tag.RowsAffected() == 0 {
		notFound(w, r, "Site")
		return
	}
	s, _ := scanSite(h.pool.QueryRow(ctx, `SELECT `+siteCols+siteFrom+` WHERE s.id = $1`, id))
	httpx.JSON(w, http.StatusOK, s)
}

// DELETE /api/studio/sites/{id}
func (h *Handler) HandleDeleteSite(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if !validID(id) {
		notFound(w, r, "Site")
		return
	}
	tag, err := h.pool.Exec(r.Context(), `DELETE FROM model_sites WHERE id = $1 AND user_id = $2`, id, uid)
	if err != nil {
		internal(w, r, err)
		return
	}
	if tag.RowsAffected() == 0 {
		notFound(w, r, "Site")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- public site (no auth)

type publicSite struct {
	Slug        string            `json:"slug"`
	Title       string            `json:"title"`
	Tagline     string            `json:"tagline"`
	Description string            `json:"description"`
	Template    string            `json:"template"`
	Theme       map[string]string `json:"theme"`
	CTALabel    string            `json:"cta_label"`
	CTAURL      string            `json:"cta_url"`
	ModelName   string            `json:"model_name"`
	Classes     []string          `json:"classes"`
	Metrics     map[string]any    `json:"metrics"`
	Owner       string            `json:"owner"`
	Available   bool              `json:"available"`
}

type siteRuntime struct {
	ID, OwnerID, ModelSlug, Endpoint string
	Cap, Spent                       int64
}

func (h *Handler) loadPublicSite(r *http.Request, slug string) (publicSite, siteRuntime, error) {
	var ps publicSite
	var rt siteRuntime
	var theme, classes, metrics []byte
	err := h.pool.QueryRow(r.Context(), `SELECT s.id::text, s.user_id::text, m.slug, m.runpod_endpoint, s.slug, s.title, s.tagline, s.description,
		s.template, s.theme, s.cta_label, s.cta_url, m.name, COALESCE(o.classes, '[]'), COALESCE(o.metrics, '{}'),
		COALESCE(up.username, ''), s.monthly_cap,
		(SELECT COALESCE(sum((e.payload->>'charge')::bigint), 0) FROM events e WHERE e.type = 'request.executed' AND e.user_id = s.user_id
		   AND e.payload->>'site_id' = s.id::text AND e.created_at >= date_trunc('month', now()))
		FROM model_sites s JOIN models m ON m.id = s.model_id LEFT JOIN model_ownership o ON o.model_id = m.id
		LEFT JOIN user_profiles up ON up.user_id = s.user_id JOIN users u ON u.id = s.user_id
		WHERE s.slug = $1 AND s.published AND NOT s.disabled_by_admin AND m.enabled AND u.status = 'active'`, slug).
		Scan(&rt.ID, &rt.OwnerID, &rt.ModelSlug, &rt.Endpoint, &ps.Slug, &ps.Title, &ps.Tagline, &ps.Description, &ps.Template, &theme,
			&ps.CTALabel, &ps.CTAURL, &ps.ModelName, &classes, &metrics, &ps.Owner, &rt.Cap, &rt.Spent)
	if err != nil {
		return ps, rt, err
	}
	ps.Theme = map[string]string{}
	_ = json.Unmarshal(theme, &ps.Theme)
	ps.Classes, ps.Metrics = jsonStrings(classes), jsonMap(metrics)
	ps.Available = rt.Spent < rt.Cap
	return ps, rt, nil
}

// GET /v1/sites/{slug}
func (h *Handler) HandlePublicSite(w http.ResponseWriter, r *http.Request) {
	ps, _, err := h.loadPublicSite(r, chi.URLParam(r, "slug"))
	if err != nil {
		notFound(w, r, "Site")
		return
	}
	httpx.JSON(w, http.StatusOK, ps)
}

// POST /v1/sites/{slug}/run  (multipart "image"; billed to the site owner up to the monthly cap)
func (h *Handler) HandleSiteRun(w http.ResponseWriter, r *http.Request) {
	ps, rt, err := h.loadPublicSite(r, chi.URLParam(r, "slug"))
	if err != nil {
		notFound(w, r, "Site")
		return
	}
	ip := r.RemoteAddr
	if host, _, err := net.SplitHostPort(ip); err == nil {
		ip = host
	}
	if !h.siteLimit.Allow(ps.Slug + "|" + ip) {
		httpx.WriteError(w, r, http.StatusTooManyRequests, "rate_limited", "Too many tries. Wait a minute and try again.")
		return
	}
	if !ps.Available {
		httpx.WriteError(w, r, http.StatusServiceUnavailable, "site_limit_reached", "This demo has reached its monthly limit. Please try again next month.")
		return
	}
	if custom, err := catalog.Lookup(r.Context(), h.pool, rt.ModelSlug); err != nil || !catalog.CanUse(custom, rt.OwnerID) {
		notFound(w, r, "Site")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, gateway.MaxBodyBytes)
	file, _, err := r.FormFile("image")
	if err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_image", "Upload an image in the \"image\" field")
		return
	}
	img, err := io.ReadAll(io.LimitReader(file, gateway.MaxImageBytes+1))
	_ = file.Close()
	if err != nil || len(img) > gateway.MaxImageBytes {
		httpx.WriteError(w, r, http.StatusRequestEntityTooLarge, "image_too_large", "Image must be under 10 MB")
		return
	}
	if err := gateway.ValidateImage(img); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_image", err.Error())
		return
	}
	res, err := h.gw.ExecuteBilledCall(r.Context(), gateway.ExecuteCallParams{
		RequestID: httpx.NewUUIDv4(), UserID: rt.OwnerID, ModelSlug: rt.ModelSlug, ModelEndpoint: rt.Endpoint,
		Route: "site", Source: "site", MatchedKeyword: "site", ImageBytes: img,
		Extra: map[string]any{"site_id": rt.ID},
	})
	if err != nil {
		switch {
		case errors.Is(err, billing.ErrInsufficientBalance):
			httpx.WriteError(w, r, http.StatusServiceUnavailable, "site_unavailable", "This demo is temporarily unavailable.")
		case errors.Is(err, models.ErrModelTimeout):
			httpx.WriteError(w, r, http.StatusGatewayTimeout, "model_timeout", "The model took too long. Try again.")
		default:
			httpx.WriteError(w, r, http.StatusBadGateway, "model_error", "The model couldn't process this image.")
		}
		return
	}
	// Images are never stored: the image only lived in memory for this request.
	httpx.JSON(w, http.StatusOK, map[string]any{"predictions": res.Predictions, "latency_ms": res.LatencyMs})
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return strings.TrimSpace(*s)
}
