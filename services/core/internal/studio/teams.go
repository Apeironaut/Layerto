package studio

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"layerto/services/core/internal/httpx"
)

// Teams let people work together: projects and research areas can be shared with a team.
// Owners and editors can change shared things; viewers can only look. Seats come from the
// team owner's plan (team_seats).

type teamMember struct {
	UserID    string `json:"user_id"`
	Username  string `json:"username"`
	Name      string `json:"name"`
	Role      string `json:"role"`
	Status    string `json:"status"`
	CreatedAt string `json:"created_at"`
}

type teamOut struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	Description string       `json:"description"`
	OwnerID     string       `json:"owner_id"`
	Owner       string       `json:"owner"`
	MyRole      string       `json:"my_role"`
	MyStatus    string       `json:"my_status"`
	Members     []teamMember `json:"members"`
	Seats       int          `json:"seats"`
	Projects    []idName     `json:"projects"`
	Areas       []idName     `json:"areas"`
	CreatedAt   string       `json:"created_at"`
}

type idName struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func (h *Handler) loadTeam(ctx context.Context, uid, id string) (teamOut, error) {
	var t teamOut
	var c time.Time
	err := h.pool.QueryRow(ctx, `SELECT t.id::text, t.name, t.description, t.owner_id::text, COALESCE(up.username, ''), m.role, m.status, t.created_at
		FROM teams t JOIN team_members m ON m.team_id = t.id AND m.user_id = $1 LEFT JOIN user_profiles up ON up.user_id = t.owner_id
		WHERE t.id = $2`, uid, id).Scan(&t.ID, &t.Name, &t.Description, &t.OwnerID, &t.Owner, &t.MyRole, &t.MyStatus, &c)
	if err != nil {
		return t, err
	}
	t.CreatedAt = ts(c)
	t.Members = []teamMember{}
	rows, err := h.pool.Query(ctx, `SELECT m.user_id::text, COALESCE(up.username, ''), COALESCE(up.first_name || ' ' || up.last_name, ''), m.role, m.status, m.created_at
		FROM team_members m LEFT JOIN user_profiles up ON up.user_id = m.user_id WHERE m.team_id = $1 ORDER BY m.role = 'owner' DESC, m.created_at`, id)
	if err != nil {
		return t, err
	}
	for rows.Next() {
		var m teamMember
		var mc time.Time
		if rows.Scan(&m.UserID, &m.Username, &m.Name, &m.Role, &m.Status, &mc) == nil {
			m.Name = strings.TrimSpace(m.Name)
			m.CreatedAt = ts(mc)
			t.Members = append(t.Members, m)
		}
	}
	rows.Close()
	if info, err := h.userPlan(ctx, t.OwnerID); err == nil {
		t.Seats = info.Plan.TeamSeats
	}
	t.Projects, t.Areas = []idName{}, []idName{}
	if t.MyStatus == "active" {
		if rows, err := h.pool.Query(ctx, `SELECT id::text, name FROM projects WHERE team_id = $1 ORDER BY name`, id); err == nil {
			for rows.Next() {
				var x idName
				if rows.Scan(&x.ID, &x.Name) == nil {
					t.Projects = append(t.Projects, x)
				}
			}
			rows.Close()
		}
		if rows, err := h.pool.Query(ctx, `SELECT id::text, name FROM research_areas WHERE team_id = $1 ORDER BY name`, id); err == nil {
			for rows.Next() {
				var x idName
				if rows.Scan(&x.ID, &x.Name) == nil {
					t.Areas = append(t.Areas, x)
				}
			}
			rows.Close()
		}
	}
	return t, nil
}

// GET /api/teams  (teams I'm in, including invitations)
func (h *Handler) HandleListTeams(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	rows, err := h.pool.Query(r.Context(), `SELECT team_id::text FROM team_members WHERE user_id = $1 ORDER BY created_at`, uid)
	if err != nil {
		internal(w, r, err)
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
	out := []teamOut{}
	for _, id := range ids {
		if t, err := h.loadTeam(r.Context(), uid, id); err == nil {
			out = append(out, t)
		}
	}
	httpx.JSON(w, http.StatusOK, out)
}

// POST /api/teams {"name","description"}
func (h *Handler) HandleCreateTeam(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok || !h.requireFeature(w, r, uid, "teams") {
		return
	}
	var in struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if !decodeJSON(w, r, &in, 4<<10) {
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" || len([]rune(in.Name)) > 80 || len([]rune(in.Description)) > 500 {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_team", "Team name must be 1-80 characters")
		return
	}
	var owned int
	_ = h.pool.QueryRow(r.Context(), `SELECT count(*) FROM teams WHERE owner_id = $1`, uid).Scan(&owned)
	if owned >= 20 {
		httpx.WriteError(w, r, http.StatusForbidden, "plan_limit", "You can own up to 20 teams")
		return
	}
	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		internal(w, r, err)
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	var id string
	if err := tx.QueryRow(r.Context(), `INSERT INTO teams (owner_id, name, description) VALUES ($1,$2,$3) RETURNING id::text`, uid, in.Name, strings.TrimSpace(in.Description)).Scan(&id); err != nil {
		internal(w, r, err)
		return
	}
	if _, err := tx.Exec(r.Context(), `INSERT INTO team_members (team_id, user_id, role, status) VALUES ($1,$2,'owner','active')`, id, uid); err != nil {
		internal(w, r, err)
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		internal(w, r, err)
		return
	}
	_, _ = h.pool.Exec(r.Context(), `INSERT INTO hub_activity (actor_id, team_id, verb, object_type, object_id, summary) VALUES ($1,$2,'created','team',$2,$3)`,
		uid, id, "created the team “"+in.Name+"”")
	t, _ := h.loadTeam(r.Context(), uid, id)
	httpx.JSON(w, http.StatusCreated, t)
}

func (h *Handler) teamRole(ctx context.Context, uid, id string) string {
	var role string
	_ = h.pool.QueryRow(ctx, `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2 AND status = 'active'`, id, uid).Scan(&role)
	return role
}

// GET /api/teams/{id}
func (h *Handler) HandleGetTeam(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if !validID(id) {
		notFound(w, r, "Team")
		return
	}
	t, err := h.loadTeam(r.Context(), uid, id)
	if err != nil {
		notFound(w, r, "Team")
		return
	}
	httpx.JSON(w, http.StatusOK, t)
}

// PATCH /api/teams/{id} {"name","description"} (owner)
func (h *Handler) HandleUpdateTeam(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	var in struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
	}
	if !validID(id) || !decodeJSON(w, r, &in, 4<<10) {
		if !validID(id) {
			notFound(w, r, "Team")
		}
		return
	}
	if h.teamRole(r.Context(), uid, id) != "owner" {
		notFound(w, r, "Team")
		return
	}
	if in.Name != nil && (strings.TrimSpace(*in.Name) == "" || len([]rune(*in.Name)) > 80) {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_team", "Team name must be 1-80 characters")
		return
	}
	if _, err := h.pool.Exec(r.Context(), `UPDATE teams SET name = COALESCE($2, name), description = COALESCE($3, description) WHERE id = $1`,
		id, trimPtr(in.Name), trimPtr(in.Description)); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_team", "Couldn't save the team")
		return
	}
	h.HandleGetTeam(w, r)
}

// DELETE /api/teams/{id} (owner): shared projects and areas go back to their owners.
func (h *Handler) HandleDeleteTeam(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if !validID(id) || h.teamRole(r.Context(), uid, id) != "owner" {
		notFound(w, r, "Team")
		return
	}
	if _, err := h.pool.Exec(r.Context(), `DELETE FROM teams WHERE id = $1`, id); err != nil {
		internal(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// POST /api/teams/{id}/members {"username","role"}  (owner invites; seats from the owner's plan)
func (h *Handler) HandleInviteMember(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	var in struct {
		Username string `json:"username"`
		Role     string `json:"role"`
	}
	if !validID(id) || !decodeJSON(w, r, &in, 1<<10) {
		if !validID(id) {
			notFound(w, r, "Team")
		}
		return
	}
	ctx := r.Context()
	if h.teamRole(ctx, uid, id) != "owner" {
		notFound(w, r, "Team")
		return
	}
	if in.Role != "editor" && in.Role != "viewer" {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_role", "Role must be editor or viewer")
		return
	}
	var member string
	if err := h.pool.QueryRow(ctx, `SELECT up.user_id::text FROM user_profiles up JOIN users u ON u.id = up.user_id
		WHERE up.username = $1 AND u.status = 'active'`, strings.ToLower(strings.TrimPrefix(strings.TrimSpace(in.Username), "@"))).Scan(&member); err != nil {
		httpx.WriteError(w, r, http.StatusNotFound, "user_not_found", "No active Layerto user has that username")
		return
	}
	info, err := h.userPlan(ctx, uid)
	if err != nil {
		internal(w, r, err)
		return
	}
	var seated int
	_ = h.pool.QueryRow(ctx, `SELECT count(*) FROM team_members WHERE team_id = $1 AND role <> 'owner'`, id).Scan(&seated)
	if seated >= info.Plan.TeamSeats {
		httpx.WriteError(w, r, http.StatusForbidden, "plan_limit", "All the team seats on your plan are used. Remove someone or upgrade.")
		return
	}
	tag, err := h.pool.Exec(ctx, `INSERT INTO team_members (team_id, user_id, role, status, invited_by) VALUES ($1,$2,$3,'invited',$4) ON CONFLICT DO NOTHING`,
		id, member, in.Role, uid)
	if err != nil {
		internal(w, r, err)
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.WriteError(w, r, http.StatusConflict, "already_member", "That person is already in the team or invited")
		return
	}
	_, _ = h.pool.Exec(ctx, `INSERT INTO hub_activity (actor_id, team_id, verb, object_type, object_id, summary) VALUES ($1,$2,'invited','member',$3,$4)`,
		uid, id, member, "invited @"+strings.ToLower(strings.TrimPrefix(in.Username, "@"))+" as "+in.Role)
	h.HandleGetTeam(w, r)
}

// PATCH /api/teams/{id}/members/{userId} {"role"} (owner)
func (h *Handler) HandleSetMemberRole(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id, member := chi.URLParam(r, "id"), chi.URLParam(r, "userId")
	var in struct {
		Role string `json:"role"`
	}
	if !validID(id) || !validID(member) || !decodeJSON(w, r, &in, 256) {
		if !validID(id) || !validID(member) {
			notFound(w, r, "Member")
		}
		return
	}
	if h.teamRole(r.Context(), uid, id) != "owner" || member == uid {
		notFound(w, r, "Member")
		return
	}
	if in.Role != "editor" && in.Role != "viewer" {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_role", "Role must be editor or viewer")
		return
	}
	if _, err := h.pool.Exec(r.Context(), `UPDATE team_members SET role = $3 WHERE team_id = $1 AND user_id = $2 AND role <> 'owner'`, id, member, in.Role); err != nil {
		internal(w, r, err)
		return
	}
	h.HandleGetTeam(w, r)
}

// DELETE /api/teams/{id}/members/{userId}  (owner removes; anyone can remove themselves = leave or decline)
func (h *Handler) HandleRemoveMember(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id, member := chi.URLParam(r, "id"), chi.URLParam(r, "userId")
	if !validID(id) || !validID(member) {
		notFound(w, r, "Member")
		return
	}
	if member != uid && h.teamRole(r.Context(), uid, id) != "owner" {
		notFound(w, r, "Member")
		return
	}
	tag, err := h.pool.Exec(r.Context(), `DELETE FROM team_members WHERE team_id = $1 AND user_id = $2 AND role <> 'owner'`, id, member)
	if err != nil {
		internal(w, r, err)
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.WriteError(w, r, http.StatusBadRequest, "cannot_remove", "The owner can't leave; delete the team instead")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// POST /api/teams/{id}/accept
func (h *Handler) HandleAcceptInvite(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if !validID(id) {
		notFound(w, r, "Invitation")
		return
	}
	tag, err := h.pool.Exec(r.Context(), `UPDATE team_members SET status = 'active' WHERE team_id = $1 AND user_id = $2 AND status = 'invited'`, id, uid)
	if err != nil {
		internal(w, r, err)
		return
	}
	if tag.RowsAffected() == 0 {
		notFound(w, r, "Invitation")
		return
	}
	var username string
	_ = h.pool.QueryRow(r.Context(), `SELECT username FROM user_profiles WHERE user_id = $1`, uid).Scan(&username)
	_, _ = h.pool.Exec(r.Context(), `INSERT INTO hub_activity (actor_id, team_id, verb, object_type, object_id, summary) VALUES ($1,$2,'joined','member',$1,$3)`,
		uid, id, "@"+username+" joined the team")
	h.HandleGetTeam(w, r)
}
