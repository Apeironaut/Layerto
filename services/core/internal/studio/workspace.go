package studio

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"layerto/services/core/internal/httpx"
)

type project struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Slug        string   `json:"slug"`
	Description string   `json:"description"`
	Notes       string   `json:"notes"`
	IsPublic    bool     `json:"is_public"`
	CreatedAt   string   `json:"created_at"`
	UpdatedAt   string   `json:"updated_at"`
	Datasets    int      `json:"datasets"`
	Models      int      `json:"models"`
	Jobs        int      `json:"jobs"`
	BestMap     *float64 `json:"best_map,omitempty"`
	TeamID      *string  `json:"team_id"`
	TeamName    *string  `json:"team_name"`
	AreaID      *string  `json:"area_id"`
	OwnerID     string   `json:"-"`
	Owner       string   `json:"owner"`
	Role        string   `json:"role,omitempty"` // owner, editor or viewer (for the signed-in user)
}

const projectCols = `p.id::text, p.name, p.slug, p.description, p.notes, p.is_public, p.created_at, p.updated_at,
	(SELECT count(*) FROM datasets d WHERE d.project_id = p.id),
	(SELECT count(*) FROM model_ownership o WHERE o.project_id = p.id),
	(SELECT count(*) FROM training_jobs j WHERE j.project_id = p.id),
	(SELECT max((o.metrics->>'map50_95')::float8) FROM model_ownership o WHERE o.project_id = p.id),
	p.team_id::text, (SELECT name FROM teams WHERE id = p.team_id), p.area_id::text, p.user_id::text,
	COALESCE((SELECT username FROM user_profiles WHERE user_id = p.user_id), '')`

func scanProject(row interface{ Scan(...any) error }) (project, error) {
	var p project
	var c, u time.Time
	err := row.Scan(&p.ID, &p.Name, &p.Slug, &p.Description, &p.Notes, &p.IsPublic, &c, &u, &p.Datasets, &p.Models, &p.Jobs, &p.BestMap,
		&p.TeamID, &p.TeamName, &p.AreaID, &p.OwnerID, &p.Owner)
	p.CreatedAt, p.UpdatedAt = ts(c), ts(u)
	return p, err
}

// GET /api/studio/projects
func (h *Handler) HandleListProjects(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	rows, err := h.pool.Query(r.Context(), `SELECT `+projectCols+` FROM projects p WHERE hub_project_read(p.id, $1) ORDER BY p.updated_at DESC`, uid)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer rows.Close()
	out := []project{}
	for rows.Next() {
		p, err := scanProject(rows)
		if err != nil {
			internal(w, r, err)
			return
		}
		p.Role = h.projectRole(r.Context(), uid, p)
		out = append(out, p)
	}
	httpx.JSON(w, http.StatusOK, out)
}

type projectInput struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Notes       *string `json:"notes"`
	IsPublic    *bool   `json:"is_public"`
	TeamID      *string `json:"team_id"` // owner only; "" = not shared
	AreaID      *string `json:"area_id"` // link to a research area; "" = none
}

func (h *Handler) projectRole(ctx context.Context, uid string, p project) string {
	if p.OwnerID == uid {
		return "owner"
	}
	if p.TeamID != nil {
		if role := h.teamRole(ctx, uid, *p.TeamID); role == "viewer" {
			return "viewer"
		} else if role != "" {
			return "editor"
		}
	}
	return "viewer"
}

// POST /api/studio/projects
func (h *Handler) HandleCreateProject(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	var in projectInput
	if !decodeJSON(w, r, &in, 64<<10) {
		return
	}
	if in.Name == nil || strings.TrimSpace(*in.Name) == "" || len(*in.Name) > 80 {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_name", "Project name must be 1-80 characters")
		return
	}
	ctx := r.Context()
	if !h.requireFeature(w, r, uid, "projects") {
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
	if u.Projects >= plan.Plan.Projects {
		quotaError(w, r, "project")
		return
	}
	name := strings.TrimSpace(*in.Name)
	base := slugify(name, 50)
	slug := base
	for i := 2; ; i++ {
		var exists bool
		if err := h.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM projects WHERE user_id = $1 AND slug = $2)`, uid, slug).Scan(&exists); err != nil {
			internal(w, r, err)
			return
		}
		if !exists {
			break
		}
		slug = base + "-" + itoa(i)
	}
	desc, notes, pub := "", "", false
	if in.Description != nil {
		desc = *in.Description
	}
	if in.Notes != nil {
		notes = *in.Notes
	}
	if in.IsPublic != nil {
		pub = *in.IsPublic
	}
	var id string
	team, area, msg := h.projectLinks(ctx, uid, in)
	if msg != "" {
		httpx.WriteError(w, r, http.StatusForbidden, "link_forbidden", msg)
		return
	}
	err = h.pool.QueryRow(ctx, `INSERT INTO projects (user_id, name, slug, description, notes, is_public, team_id, area_id) VALUES ($1,$2,$3,$4,$5,$6,$7::uuid,$8::uuid) RETURNING id::text`,
		uid, name, slug, desc, notes, pub, team, area).Scan(&id)
	if err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_project", "Couldn't create the project (check the lengths of the fields)")
		return
	}
	h.writeProject(w, r, uid, id)
}

// projectLinks validates the team and research area a project is linked to.
func (h *Handler) projectLinks(ctx context.Context, uid string, in projectInput) (team, area any, msg string) {
	if in.TeamID != nil && *in.TeamID != "" {
		if !validID(*in.TeamID) || !h.teamWritable(ctx, uid, *in.TeamID) {
			return nil, nil, "You can only share with teams you can edit"
		}
		team = *in.TeamID
	}
	if in.AreaID != nil && *in.AreaID != "" {
		if !validID(*in.AreaID) || !h.checkAreaWrite(ctx, uid, *in.AreaID) {
			return nil, nil, "You can only link research areas you can edit"
		}
		area = *in.AreaID
	}
	return team, area, ""
}

func (h *Handler) writeProject(w http.ResponseWriter, r *http.Request, uid, id string) {
	p, err := scanProject(h.pool.QueryRow(r.Context(), `SELECT `+projectCols+` FROM projects p WHERE p.id = $1 AND hub_project_read(p.id, $2)`, id, uid))
	if isNoRows(err) {
		notFound(w, r, "Project")
		return
	}
	if err != nil {
		internal(w, r, err)
		return
	}
	p.Role = h.projectRole(r.Context(), uid, p)
	httpx.JSON(w, http.StatusOK, p)
}

// GET /api/studio/projects/{id}
func (h *Handler) HandleGetProject(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if !validID(id) {
		notFound(w, r, "Project")
		return
	}
	h.writeProject(w, r, uid, id)
}

// PATCH /api/studio/projects/{id}
func (h *Handler) HandleUpdateProject(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if !validID(id) {
		notFound(w, r, "Project")
		return
	}
	var in projectInput
	if !decodeJSON(w, r, &in, 64<<10) {
		return
	}
	if in.Name != nil && (strings.TrimSpace(*in.Name) == "" || len(*in.Name) > 80) {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_name", "Project name must be 1-80 characters")
		return
	}
	ctx := r.Context()
	var owner string
	var canWrite bool
	if err := h.pool.QueryRow(ctx, `SELECT user_id::text, hub_project_write(id, $2) FROM projects WHERE id = $1`, id, uid).Scan(&owner, &canWrite); err != nil || !canWrite {
		notFound(w, r, "Project")
		return
	}
	if (in.TeamID != nil || in.IsPublic != nil) && owner != uid {
		httpx.WriteError(w, r, http.StatusForbidden, "owner_only", "Only the project's owner can change sharing")
		return
	}
	team, area, msg := h.projectLinks(ctx, uid, in)
	if msg != "" {
		httpx.WriteError(w, r, http.StatusForbidden, "link_forbidden", msg)
		return
	}
	tag, err := h.pool.Exec(ctx, `UPDATE projects SET
		name = COALESCE($3, name), description = COALESCE($4, description), notes = COALESCE($5, notes),
		is_public = COALESCE($6, is_public),
		team_id = CASE WHEN $7 THEN $8::uuid ELSE team_id END,
		area_id = CASE WHEN $9 THEN $10::uuid ELSE area_id END, updated_at = now()
		WHERE id = $1 AND hub_project_write(id, $2)`, id, uid, trimPtr(in.Name), in.Description, in.Notes, in.IsPublic,
		in.TeamID != nil, team, in.AreaID != nil, area)
	if err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_project", "Couldn't save (check the lengths of the fields)")
		return
	}
	if tag.RowsAffected() == 0 {
		notFound(w, r, "Project")
		return
	}
	h.writeProject(w, r, uid, id)
}

// DELETE /api/studio/projects/{id} (datasets and models stay, just unlinked)
func (h *Handler) HandleDeleteProject(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if !validID(id) {
		notFound(w, r, "Project")
		return
	}
	tag, err := h.pool.Exec(r.Context(), `DELETE FROM projects WHERE id = $1 AND user_id = $2`, id, uid)
	if err != nil {
		internal(w, r, err)
		return
	}
	if tag.RowsAffected() == 0 {
		notFound(w, r, "Project")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- researcher profile

type profile struct {
	Headline    string `json:"headline"`
	Bio         string `json:"bio"`
	Affiliation string `json:"affiliation"`
	Website     string `json:"website"`
	IsPublic    bool   `json:"is_public"`
}

// GET /api/studio/profile
func (h *Handler) HandleGetProfile(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	var p profile
	err := h.pool.QueryRow(r.Context(), `SELECT headline, bio, affiliation, website, is_public FROM researcher_profiles WHERE user_id = $1`, uid).
		Scan(&p.Headline, &p.Bio, &p.Affiliation, &p.Website, &p.IsPublic)
	if err != nil && !isNoRows(err) {
		internal(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

// PUT /api/studio/profile
func (h *Handler) HandlePutProfile(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	var p profile
	if !decodeJSON(w, r, &p, 16<<10) {
		return
	}
	if p.Website != "" && !strings.HasPrefix(p.Website, "https://") && !strings.HasPrefix(p.Website, "http://") {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_website", "Website must start with https://")
		return
	}
	_, err := h.pool.Exec(r.Context(), `
		INSERT INTO researcher_profiles (user_id, headline, bio, affiliation, website, is_public) VALUES ($1,$2,$3,$4,$5,$6)
		ON CONFLICT (user_id) DO UPDATE SET headline=$2, bio=$3, affiliation=$4, website=$5, is_public=$6, updated_at=now()`,
		uid, strings.TrimSpace(p.Headline), strings.TrimSpace(p.Bio), strings.TrimSpace(p.Affiliation), strings.TrimSpace(p.Website), p.IsPublic)
	if err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_profile", "Couldn't save (headline 120, bio 2000, affiliation 120 characters max)")
		return
	}
	h.HandleGetProfile(w, r)
}

// ---- public pages (no auth)

type publicModel struct {
	Slug        string         `json:"slug"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Metrics     map[string]any `json:"metrics"`
	Classes     []string       `json:"classes"`
	Public      bool           `json:"public_api"`
	PriceUSD    string         `json:"price_usd"`
}

// GET /v1/public/profiles/{username}
func (h *Handler) HandlePublicProfile(w http.ResponseWriter, r *http.Request) {
	username := strings.ToLower(chi.URLParam(r, "username"))
	ctx := r.Context()
	var uid, first, last string
	var p profile
	err := h.pool.QueryRow(ctx, `
		SELECT u.id::text, up.first_name, up.last_name, rp.headline, rp.bio, rp.affiliation, rp.website
		FROM user_profiles up JOIN users u ON u.id = up.user_id JOIN researcher_profiles rp ON rp.user_id = u.id
		WHERE up.username = $1 AND rp.is_public AND u.status = 'active'`, username).
		Scan(&uid, &first, &last, &p.Headline, &p.Bio, &p.Affiliation, &p.Website)
	if isNoRows(err) {
		notFound(w, r, "Profile")
		return
	}
	if err != nil {
		internal(w, r, err)
		return
	}
	rows, err := h.pool.Query(ctx, `SELECT `+projectCols+` FROM projects p WHERE p.user_id = $1 AND p.is_public ORDER BY p.updated_at DESC`, uid)
	if err != nil {
		internal(w, r, err)
		return
	}
	projects := []project{}
	for rows.Next() {
		pr, err := scanProject(rows)
		if err == nil {
			pr.Notes = "" // notes are shown on the project page only
			projects = append(projects, pr)
		}
	}
	rows.Close()
	models, err := h.publicModelsFor(r, `o.owner_id = $1 AND o.visibility = 'public'`, uid)
	if err != nil {
		internal(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"username": username, "first_name": first, "last_name": last,
		"headline": p.Headline, "bio": p.Bio, "affiliation": p.Affiliation, "website": p.Website,
		"projects": projects, "models": models,
	})
}

// GET /v1/public/profiles/{username}/projects/{slug}
func (h *Handler) HandlePublicProject(w http.ResponseWriter, r *http.Request) {
	username := strings.ToLower(chi.URLParam(r, "username"))
	slug := chi.URLParam(r, "slug")
	ctx := r.Context()
	var uid, first, last string
	err := h.pool.QueryRow(ctx, `
		SELECT u.id::text, up.first_name, up.last_name FROM user_profiles up JOIN users u ON u.id = up.user_id
		JOIN researcher_profiles rp ON rp.user_id = u.id WHERE up.username = $1 AND rp.is_public AND u.status = 'active'`, username).
		Scan(&uid, &first, &last)
	if isNoRows(err) {
		notFound(w, r, "Project")
		return
	}
	if err != nil {
		internal(w, r, err)
		return
	}
	pr, err := scanProject(h.pool.QueryRow(ctx, `SELECT `+projectCols+` FROM projects p WHERE p.user_id = $1 AND p.slug = $2 AND p.is_public`, uid, slug))
	if isNoRows(err) {
		notFound(w, r, "Project")
		return
	}
	if err != nil {
		internal(w, r, err)
		return
	}
	// a public project shows the results of all its models; only public ones are callable
	models, err := h.publicModelsFor(r, `o.project_id = $1`, pr.ID)
	if err != nil {
		internal(w, r, err)
		return
	}
	type dsSummary struct {
		Name    string   `json:"name"`
		Images  int      `json:"images"`
		Labeled int      `json:"labeled"`
		Classes []string `json:"classes"`
	}
	rows, err := h.pool.Query(ctx, `SELECT d.name, d.classes,
		(SELECT count(*) FROM dataset_images i WHERE i.dataset_id = d.id),
		(SELECT count(*) FROM dataset_images i WHERE i.dataset_id = d.id AND i.labeled)
		FROM datasets d WHERE d.project_id = $1 ORDER BY d.created_at`, pr.ID)
	if err != nil {
		internal(w, r, err)
		return
	}
	datasets := []dsSummary{}
	for rows.Next() {
		var d dsSummary
		var cls []byte
		if rows.Scan(&d.Name, &cls, &d.Images, &d.Labeled) == nil {
			d.Classes = jsonStrings(cls)
			datasets = append(datasets, d)
		}
	}
	rows.Close()
	httpx.JSON(w, http.StatusOK, map[string]any{
		"owner":   map[string]string{"username": username, "first_name": first, "last_name": last},
		"project": pr, "models": models, "datasets": datasets,
	})
}

func (h *Handler) publicModelsFor(r *http.Request, where string, arg any) ([]publicModel, error) {
	rows, err := h.pool.Query(r.Context(), `
		SELECT m.slug, m.name, m.description, o.metrics, o.classes, o.visibility = 'public', m.price_per_call
		FROM model_ownership o JOIN models m ON m.id = o.model_id WHERE `+where+` ORDER BY o.created_at DESC`, arg)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []publicModel{}
	for rows.Next() {
		var pm publicModel
		var metrics, classes []byte
		var price int64
		if err := rows.Scan(&pm.Slug, &pm.Name, &pm.Description, &metrics, &classes, &pm.Public, &price); err != nil {
			return nil, err
		}
		pm.Metrics = jsonMap(metrics)
		pm.Classes = jsonStrings(classes)
		pm.PriceUSD = usd(price)
		out = append(out, pm)
	}
	return out, nil
}

func trimPtr(s *string) *string {
	if s == nil {
		return nil
	}
	t := strings.TrimSpace(*s)
	return &t
}
