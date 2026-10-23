package studio

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"layerto/services/core/internal/gateway"
	"layerto/services/core/internal/httpx"
)

// The community feed: posts in spaces, votes, threaded comments, saves and reports.
// Posts can link to a model, a dataset listing, a published paper or a URL.

var communitySpaces = []map[string]string{
	// General & Community
	{"id": "general", "name": "General", "description": "Open discussion about AI, data and building with Layerto"},
	{"id": "research", "name": "Research", "description": "Pre-prints, novel methodologies, and research findings"},
	{"id": "showcase", "name": "Showcase", "description": "Community demos, finished apps, and trained model showcases"},
	{"id": "help", "name": "Help & Support", "description": "Questions, debugging, and collaborative technical help"},
	{"id": "jobs", "name": "Jobs & Collabs", "description": "Find research collaborators, dataset contributors, and teams"},

	// Computer Science & AI
	{"id": "computer-vision", "name": "Computer Vision", "description": "Detection, segmentation, tracking, and 3D reconstruction"},
	{"id": "nlp", "name": "Natural Language Processing", "description": "LLMs, embeddings, tokenizers, and multilingual language models"},
	{"id": "datasets", "name": "Datasets & Benchmarks", "description": "Image collections, ground-truth labels, and validation benchmarks"},
	{"id": "ml-infra", "name": "ML Systems & MLOps", "description": "Inference pipelines, cluster deployment, latency, and quantization"},
	{"id": "reinforcement-learning", "name": "Reinforcement Learning", "description": "Policy gradients, sim-to-real, reward models, and multi-agent systems"},
	{"id": "robotics", "name": "Robotics & Autonomous Systems", "description": "SLAM, path planning, lidar perception, and manipulator control"},
	{"id": "speech-audio", "name": "Speech & Audio Processing", "description": "Acoustic ASR, voice synthesis, diarization, and audio codecs"},
	{"id": "cybersecurity-ai", "name": "Cybersecurity & AI Safety", "description": "Adversarial robustness, jailbreak defense, and model red-teaming"},

	// Zoology & Wildlife
	{"id": "wildlife", "name": "Wildlife Monitoring", "description": "Camera traps, individual re-identification, and migration corridors"},
	{"id": "marine-biology", "name": "Marine Biology & Re-ID", "description": "Underwater imagery, coral reef health, and pelagic species census"},
	{"id": "bioacoustics", "name": "Bioacoustics & Soundscapes", "description": "Passive acoustic monitoring, vocalization classification, and soundscapes"},
	{"id": "entomology", "name": "Entomology & Insect Diversity", "description": "Pollinator monitoring, insect trap sensors, and pest classification"},
	{"id": "animal-behavior", "name": "Animal Behavioral Tracking", "description": "Kinematic pose tracking, social dynamics, and foraging ethology"},
	{"id": "ornithology", "name": "Ornithology & Migration", "description": "Radar flight tracking, acoustic flight calls, and plumage classification"},

	// Botany & Plant Science
	{"id": "plant-pathology", "name": "Plant Pathology", "description": "Crop leaf lesions, bacterial blights, and deficiency diagnosis"},
	{"id": "flora-taxonomy", "name": "Flora & Herbarium Taxonomy", "description": "Herbarium specimen digitization, morphological keys, and classification"},
	{"id": "crop-vision", "name": "Agricultural & Crop Vision", "description": "Precision farming, yield estimation, weed detection, and drone NDVI"},
	{"id": "forestry-canopy", "name": "Forestry & Canopy Ecology", "description": "Canopy height models, tree species segmentation, and biomass estimation"},
	{"id": "soil-sensing", "name": "Soil & Nutrient Sensing", "description": "Reflectance spectroscopy, organic carbon mapping, and root imaging"},
	{"id": "horticulture", "name": "Horticulture & Greenhouse AI", "description": "Controlled environment agriculture, hydroponics, and maturity grading"},

	// Medicine & Healthcare
	{"id": "medical-imaging", "name": "Medical Imaging & Diagnostics", "description": "MRI, CT, X-ray segmentation, and diagnostic anomaly detection"},
	{"id": "genomics-ai", "name": "Genomics & Bioinformatics", "description": "DNA/RNA sequencing, protein folding, and variant pathogenicity"},
	{"id": "histology", "name": "Histology & Digital Pathology", "description": "Whole slide biopsy imaging, cell nuclei classification, and grading"},
	{"id": "biosignals", "name": "Bio-Signals & Telemedicine", "description": "ECG/EEG waveforms, wearable biometric telemetry, and patient monitoring"},
	{"id": "pharmacology", "name": "Pharmacology & Drug Discovery", "description": "Molecular docking, binding affinity prediction, and chemical screening"},

	// Physics, Earth & Space
	{"id": "astronomy", "name": "Astronomy & Deep Sky Surveys", "description": "Telescope surveys, galaxy morphology, exoplanet transit detection"},
	{"id": "remote-sensing", "name": "Remote Sensing & Earth Observation", "description": "Multispectral satellite observation, land cover, and urban heat maps"},
	{"id": "climate-ai", "name": "Meteorology & Climate Modeling", "description": "Weather forecasting, storm tracking, precipitation, and carbon cycles"},
	{"id": "geophysics", "name": "Geophysics & Seismology", "description": "Seismic wave analysis, fault rupture modeling, and tremor monitoring"},

	// Management & Governance
	{"id": "ai-governance", "name": "AI Governance & Ethics", "description": "Model risk auditing, bias mitigation, compliance, and model cards"},
	{"id": "lab-ops", "name": "Research & Lab Operations", "description": "GPU budget allocation, lab protocols, team collaboration, and reproducibility"},
	{"id": "project-strategy", "name": "Project Strategy & Grants", "description": "Research roadmap planning, grant milestone tracking, and consortium deliverables"},
	{"id": "data-licensing", "name": "Data Licensing & IP Management", "description": "Dataset copyrights, commercial licensing, open-source attribution, and provenance"},
}

var domainSpaces = map[string]bool{
	// General & Community
	"general":          true,
	"research":         true,
	"showcase":         true,
	"help":             true,
	"jobs":             true,

	// Computer Science & AI
	"computer-vision":        true,
	"nlp":                    true,
	"datasets":               true,
	"ml-infra":               true,
	"reinforcement-learning": true,
	"robotics":               true,
	"speech-audio":           true,
	"cybersecurity-ai":       true,

	// Zoology & Wildlife
	"wildlife":        true,
	"marine-biology":  true,
	"bioacoustics":    true,
	"entomology":      true,
	"animal-behavior": true,
	"ornithology":     true,

	// Botany & Plant Science
	"plant-pathology": true,
	"flora-taxonomy":  true,
	"crop-vision":     true,
	"forestry-canopy": true,
	"soil-sensing":    true,
	"horticulture":    true,

	// Medicine & Healthcare
	"medical-imaging": true,
	"genomics-ai":     true,
	"histology":       true,
	"biosignals":      true,
	"pharmacology":    true,

	// Physics, Earth & Space
	"astronomy":      true,
	"remote-sensing": true,
	"climate-ai":     true,
	"geophysics":     true,

	// Management & Governance
	"ai-governance":    true,
	"lab-ops":          true,
	"project-strategy": true,
	"data-licensing":   true,
}

func validSpace(s string) bool {
	s = strings.TrimSpace(s)
	if domainSpaces[s] {
		return true
	}
	if strings.HasPrefix(s, "c-") || strings.HasPrefix(s, "custom-") {
		if len(s) > 64 {
			return false
		}
		for _, r := range s {
			if !((r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == '_') {
				return false
			}
		}
		return true
	}
	return false
}

type post struct {
	ID          string  `json:"id"`
	Space       string  `json:"space"`
	Title       string  `json:"title"`
	Body        string  `json:"body"`
	LinkKind    string  `json:"link_kind"`
	LinkRef     string  `json:"link_ref"`
	LinkTitle   string  `json:"link_title"`
	HasImage    bool    `json:"has_image"`
	Score       int     `json:"score"`
	Comments    int     `json:"comments"`
	Author      string  `json:"author"`
	AuthorName  string  `json:"author_name"`
	AuthorTrack string  `json:"author_track"`
	MyVote      int     `json:"my_vote"`
	Saved       bool    `json:"saved"`
	Mine        bool    `json:"mine"`
	Removed     bool    `json:"removed"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
	Edited      bool    `json:"edited"`
	Hot         float64 `json:"-"`
}

const postCols = `p.id::text, p.space, p.title, p.body, p.link_kind, p.link_ref,
	CASE p.link_kind
		WHEN 'model' THEN COALESCE((SELECT name FROM models WHERE slug = p.link_ref), '')
		WHEN 'listing' THEN COALESCE((SELECT title FROM dataset_listings WHERE id::text = p.link_ref AND status = 'public'), '')
		WHEN 'paper' THEN COALESCE((SELECT title FROM papers WHERE id::text = p.link_ref AND on_layerto), '')
		ELSE '' END,
	p.image_key <> '', p.score, p.comments, COALESCE(up.username, ''), COALESCE(up.first_name || ' ' || up.last_name, ''),
	COALESCE((SELECT track FROM user_settings WHERE user_id = p.author_id), ''),
	COALESCE((SELECT value FROM community_votes v WHERE v.post_id = p.id AND v.user_id = $1), 0),
	EXISTS (SELECT 1 FROM community_saves s WHERE s.post_id = p.id AND s.user_id = $1),
	p.author_id = $1, p.removed, p.created_at, p.updated_at
	FROM community_posts p LEFT JOIN user_profiles up ON up.user_id = p.author_id`

func scanPost(row interface{ Scan(...any) error }) (post, error) {
	var p post
	var c, u time.Time
	var vote int16
	err := row.Scan(&p.ID, &p.Space, &p.Title, &p.Body, &p.LinkKind, &p.LinkRef, &p.LinkTitle, &p.HasImage, &p.Score, &p.Comments,
		&p.Author, &p.AuthorName, &p.AuthorTrack, &vote, &p.Saved, &p.Mine, &p.Removed, &c, &u)
	p.MyVote = int(vote)
	p.AuthorName = strings.TrimSpace(p.AuthorName)
	p.CreatedAt, p.UpdatedAt = ts(c), ts(u)
	p.Edited = u.Sub(c) > time.Minute
	return p, err
}

// GET /api/community/posts?space=&sort=hot|new|top&q=&saved=1&author=&offset=
func (h *Handler) HandleListPosts(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	qs := r.URL.Query()
	where := []string{"NOT p.removed"}
	args := []any{uid}
	add := func(cond string, v any) {
		args = append(args, v)
		where = append(where, fmt.Sprintf(cond, len(args)))
	}
	if sp := qs.Get("space"); validSpace(sp) {
		add("p.space = $%d", sp)
	}
	if q := strings.TrimSpace(qs.Get("q")); q != "" {
		add("(p.title ILIKE '%%' || $%[1]d || '%%' OR p.body ILIKE '%%' || $%[1]d || '%%')", q)
	}
	if a := strings.ToLower(strings.TrimSpace(qs.Get("author"))); a != "" {
		add("up.username = $%d", a)
	}
	if qs.Get("saved") == "1" {
		where = append(where, "EXISTS (SELECT 1 FROM community_saves s WHERE s.post_id = p.id AND s.user_id = $1)")
	}
	order := `(p.score + p.comments * 0.5 + 1) / power(extract(epoch FROM now() - p.created_at) / 3600 + 2, 1.5) DESC`
	switch qs.Get("sort") {
	case "new":
		order = "p.created_at DESC"
	case "top":
		where = append(where, "p.created_at > now() - interval '30 days'")
		order = "p.score DESC, p.created_at DESC"
	}
	offset, _ := strconv.Atoi(qs.Get("offset"))
	if offset < 0 || offset > 5000 {
		offset = 0
	}
	rows, err := h.pool.Query(r.Context(), `SELECT `+postCols+` WHERE `+strings.Join(where, " AND ")+` ORDER BY `+order+
		fmt.Sprintf(` LIMIT 30 OFFSET %d`, offset), args...)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer rows.Close()
	out := []post{}
	for rows.Next() {
		p, err := scanPost(rows)
		if err != nil {
			internal(w, r, err)
			return
		}
		if len([]rune(p.Body)) > 600 {
			p.Body = string([]rune(p.Body)[:600]) + "…"
		}
		out = append(out, p)
	}
	httpx.JSON(w, http.StatusOK, out)
}

// GET /api/community/meta  (spaces with post counts, top contributors this month)
func (h *Handler) HandleCommunityMeta(w http.ResponseWriter, r *http.Request) {
	if _, ok := currentUser(w, r); !ok {
		return
	}
	counts := map[string]int{}
	if rows, err := h.pool.Query(r.Context(), `SELECT space, count(*) FROM community_posts WHERE NOT removed GROUP BY space`); err == nil {
		for rows.Next() {
			var s string
			var n int
			if rows.Scan(&s, &n) == nil {
				counts[s] = n
			}
		}
		rows.Close()
	}
	spaces := []map[string]any{}
	for _, sp := range communitySpaces {
		spaces = append(spaces, map[string]any{"id": sp["id"], "name": sp["name"], "description": sp["description"], "posts": counts[sp["id"]]})
	}
	top := []map[string]any{}
	if rows, err := h.pool.Query(r.Context(), `SELECT COALESCE(up.username, ''), COALESCE((SELECT track FROM user_settings WHERE user_id = p.author_id), ''),
		sum(p.score)::int, count(*)::int FROM community_posts p LEFT JOIN user_profiles up ON up.user_id = p.author_id
		WHERE NOT p.removed AND p.created_at > now() - interval '30 days' GROUP BY up.username, p.author_id ORDER BY 3 DESC, 4 DESC LIMIT 8`); err == nil {
		for rows.Next() {
			var u, t string
			var score, n int
			if rows.Scan(&u, &t, &score, &n) == nil && u != "" {
				top = append(top, map[string]any{"username": u, "track": t, "score": score, "posts": n})
			}
		}
		rows.Close()
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"spaces": spaces, "top_contributors": top})
}

// POST /api/community/posts  multipart: space, title, body, link_kind, link_ref, image (optional)
func (h *Handler) HandleCreatePost(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	var recent int
	_ = h.pool.QueryRow(ctx, `SELECT count(*) FROM community_posts WHERE author_id = $1 AND created_at > now() - interval '1 hour'`, uid).Scan(&recent)
	if recent >= 10 {
		httpx.WriteError(w, r, http.StatusTooManyRequests, "slow_down", "You've posted a lot in the last hour. Try again a bit later.")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 6<<20)
	if err := r.ParseMultipartForm(6 << 20); err != nil {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_request", "Send the post as multipart/form-data (image up to 5 MB)")
		return
	}
	space := r.FormValue("space")
	title := strings.TrimSpace(r.FormValue("title"))
	body := strings.TrimSpace(r.FormValue("body"))
	linkKind, linkRef := r.FormValue("link_kind"), strings.TrimSpace(r.FormValue("link_ref"))
	if !validSpace(space) {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_space", "Pick a space for your post")
		return
	}
	if n := len([]rune(title)); n < 3 || n > 200 {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_title", "The title must be 3-200 characters")
		return
	}
	if len([]rune(body)) > 20000 {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_body", "The post is too long (20,000 characters max)")
		return
	}
	switch linkKind {
	case "":
		linkRef = ""
	case "url":
		if !strings.HasPrefix(linkRef, "https://") && !strings.HasPrefix(linkRef, "http://") || len(linkRef) > 300 {
			httpx.WriteError(w, r, http.StatusBadRequest, "invalid_link", "Links must start with https://")
			return
		}
	case "model", "listing", "paper":
		if linkRef == "" || len(linkRef) > 300 {
			httpx.WriteError(w, r, http.StatusBadRequest, "invalid_link", "Choose what to link")
			return
		}
	default:
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_link", "Unknown link type")
		return
	}
	imageKey := ""
	var imgData []byte
	if f, _, err := r.FormFile("image"); err == nil {
		buf := make([]byte, 5<<20+1)
		n, _ := readFull(f, buf)
		_ = f.Close()
		if n > 5<<20 {
			httpx.WriteError(w, r, http.StatusRequestEntityTooLarge, "image_too_large", "Images must be under 5 MB")
			return
		}
		imgData = buf[:n]
		if err := gateway.ValidateImage(imgData); err != nil {
			httpx.WriteError(w, r, http.StatusBadRequest, "invalid_image", err.Error())
			return
		}
	}
	var id string
	if err := h.pool.QueryRow(ctx, `SELECT gen_random_uuid()::text`).Scan(&id); err != nil {
		internal(w, r, err)
		return
	}
	if imgData != nil {
		imageKey = "community/" + id
		if err := h.store.Put(imageKey, imgData); err != nil {
			internal(w, r, err)
			return
		}
	}
	if _, err := h.pool.Exec(ctx, `INSERT INTO community_posts (id, author_id, space, title, body, link_kind, link_ref, image_key, score)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1)`, id, uid, space, title, body, linkKind, linkRef, imageKey); err != nil {
		if imageKey != "" {
			_ = h.store.Delete(imageKey)
		}
		internal(w, r, err)
		return
	}
	_, _ = h.pool.Exec(ctx, `INSERT INTO community_votes (post_id, user_id, value) VALUES ($1,$2,1)`, id, uid)
	h.writePost(w, r, uid, id, http.StatusCreated)
}

func readFull(f interface{ Read([]byte) (int, error) }, buf []byte) (int, error) {
	n := 0
	for n < len(buf) {
		m, err := f.Read(buf[n:])
		n += m
		if err != nil {
			return n, nil
		}
	}
	return n, nil
}

func (h *Handler) writePost(w http.ResponseWriter, r *http.Request, uid, id string, status int) {
	p, err := scanPost(h.pool.QueryRow(r.Context(), `SELECT `+postCols+` WHERE p.id = $2 AND (NOT p.removed OR p.author_id = $1)`, uid, id))
	if err != nil {
		notFound(w, r, "Post")
		return
	}
	httpx.JSON(w, status, p)
}

type comment struct {
	ID          string  `json:"id"`
	ParentID    *string `json:"parent_id"`
	Body        string  `json:"body"`
	Author      string  `json:"author"`
	AuthorTrack string  `json:"author_track"`
	Mine        bool    `json:"mine"`
	Removed     bool    `json:"removed"`
	CreatedAt   string  `json:"created_at"`
}

// GET /api/community/posts/{id}  (full post + comments)
func (h *Handler) HandleGetPost(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if !validID(id) {
		notFound(w, r, "Post")
		return
	}
	p, err := scanPost(h.pool.QueryRow(r.Context(), `SELECT `+postCols+` WHERE p.id = $2 AND (NOT p.removed OR p.author_id = $1)`, uid, id))
	if err != nil {
		notFound(w, r, "Post")
		return
	}
	rows, err := h.pool.Query(r.Context(), `SELECT c.id::text, c.parent_id::text, c.body, COALESCE(up.username, ''),
		COALESCE((SELECT track FROM user_settings WHERE user_id = c.author_id), ''), c.author_id = $2, c.removed, c.created_at
		FROM community_comments c LEFT JOIN user_profiles up ON up.user_id = c.author_id WHERE c.post_id = $1 ORDER BY c.created_at`, id, uid)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer rows.Close()
	comments := []comment{}
	for rows.Next() {
		var c comment
		var t time.Time
		if rows.Scan(&c.ID, &c.ParentID, &c.Body, &c.Author, &c.AuthorTrack, &c.Mine, &c.Removed, &t) == nil {
			c.CreatedAt = ts(t)
			if c.Removed {
				c.Body, c.Author = "", ""
			}
			comments = append(comments, c)
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"post": p, "comments": comments})
}

// PATCH /api/community/posts/{id} {"title","body"} (author)
func (h *Handler) HandleUpdatePost(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	var in struct {
		Title *string `json:"title"`
		Body  *string `json:"body"`
	}
	if !validID(id) || !decodeJSON(w, r, &in, 32<<10) {
		if !validID(id) {
			notFound(w, r, "Post")
		}
		return
	}
	if in.Title != nil {
		if n := len([]rune(strings.TrimSpace(*in.Title))); n < 3 || n > 200 {
			httpx.WriteError(w, r, http.StatusBadRequest, "invalid_title", "The title must be 3-200 characters")
			return
		}
	}
	if in.Body != nil && len([]rune(*in.Body)) > 20000 {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_body", "The post is too long")
		return
	}
	tag, err := h.pool.Exec(r.Context(), `UPDATE community_posts SET title = COALESCE($3, title), body = COALESCE($4, body), updated_at = now()
		WHERE id = $1 AND author_id = $2 AND NOT removed`, id, uid, trimPtr(in.Title), trimPtr(in.Body))
	if err != nil || tag.RowsAffected() == 0 {
		notFound(w, r, "Post")
		return
	}
	h.writePost(w, r, uid, id, http.StatusOK)
}

// DELETE /api/community/posts/{id} (author)
func (h *Handler) HandleDeletePost(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	var key string
	if !validID(id) || h.pool.QueryRow(r.Context(), `DELETE FROM community_posts WHERE id = $1 AND author_id = $2 RETURNING image_key`, id, uid).Scan(&key) != nil {
		notFound(w, r, "Post")
		return
	}
	if key != "" {
		_ = h.store.Delete(key)
	}
	w.WriteHeader(http.StatusNoContent)
}

// POST /api/community/posts/{id}/vote {"value": 1|0|-1}
func (h *Handler) HandleVotePost(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	var in struct {
		Value int `json:"value"`
	}
	if !validID(id) || !decodeJSON(w, r, &in, 128) || in.Value < -1 || in.Value > 1 {
		if validID(id) && (in.Value < -1 || in.Value > 1) {
			httpx.WriteError(w, r, http.StatusBadRequest, "invalid_vote", "Vote must be 1, 0 or -1")
		} else if !validID(id) {
			notFound(w, r, "Post")
		}
		return
	}
	ctx := r.Context()
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var exists bool
	if tx.QueryRow(ctx, `SELECT true FROM community_posts WHERE id = $1 AND NOT removed FOR UPDATE`, id).Scan(&exists) != nil {
		notFound(w, r, "Post")
		return
	}
	var old int16
	_ = tx.QueryRow(ctx, `SELECT value FROM community_votes WHERE post_id = $1 AND user_id = $2`, id, uid).Scan(&old)
	if in.Value == 0 {
		_, err = tx.Exec(ctx, `DELETE FROM community_votes WHERE post_id = $1 AND user_id = $2`, id, uid)
	} else {
		_, err = tx.Exec(ctx, `INSERT INTO community_votes (post_id, user_id, value) VALUES ($1,$2,$3)
			ON CONFLICT (post_id, user_id) DO UPDATE SET value = $3`, id, uid, in.Value)
	}
	if err == nil {
		_, err = tx.Exec(ctx, `UPDATE community_posts SET score = score + $2 WHERE id = $1`, id, in.Value-int(old))
	}
	if err != nil || tx.Commit(ctx) != nil {
		internal(w, r, err)
		return
	}
	h.writePost(w, r, uid, id, http.StatusOK)
}

// POST /api/community/posts/{id}/save {"saved": true}
func (h *Handler) HandleSavePost(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	var in struct {
		Saved bool `json:"saved"`
	}
	if !validID(id) || !decodeJSON(w, r, &in, 128) {
		if !validID(id) {
			notFound(w, r, "Post")
		}
		return
	}
	var err error
	if in.Saved {
		_, err = h.pool.Exec(r.Context(), `INSERT INTO community_saves (post_id, user_id) SELECT id, $2 FROM community_posts WHERE id = $1 ON CONFLICT DO NOTHING`, id, uid)
	} else {
		_, err = h.pool.Exec(r.Context(), `DELETE FROM community_saves WHERE post_id = $1 AND user_id = $2`, id, uid)
	}
	if err != nil {
		internal(w, r, err)
		return
	}
	h.writePost(w, r, uid, id, http.StatusOK)
}

// POST /api/community/posts/{id}/comments {"body","parent_id"}
func (h *Handler) HandleCreateComment(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	var in struct {
		Body     string `json:"body"`
		ParentID string `json:"parent_id"`
	}
	if !validID(id) || !decodeJSON(w, r, &in, 16<<10) {
		if !validID(id) {
			notFound(w, r, "Post")
		}
		return
	}
	in.Body = strings.TrimSpace(in.Body)
	if n := len([]rune(in.Body)); n < 1 || n > 5000 {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_comment", "Comments must be 1-5000 characters")
		return
	}
	ctx := r.Context()
	var recent int
	_ = h.pool.QueryRow(ctx, `SELECT count(*) FROM community_comments WHERE author_id = $1 AND created_at > now() - interval '10 minutes'`, uid).Scan(&recent)
	if recent >= 30 {
		httpx.WriteError(w, r, http.StatusTooManyRequests, "slow_down", "Too many comments in a short time. Wait a few minutes.")
		return
	}
	var parent any
	if in.ParentID != "" {
		var ok bool
		if !validID(in.ParentID) || h.pool.QueryRow(ctx, `SELECT true FROM community_comments WHERE id = $1 AND post_id = $2`, in.ParentID, id).Scan(&ok) != nil {
			httpx.WriteError(w, r, http.StatusBadRequest, "invalid_parent", "You're replying to a comment that doesn't exist")
			return
		}
		parent = in.ParentID
	}
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		internal(w, r, err)
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var cid string
	if err := tx.QueryRow(ctx, `INSERT INTO community_comments (post_id, author_id, parent_id, body)
		SELECT id, $2, $3::uuid, $4 FROM community_posts WHERE id = $1 AND NOT removed RETURNING id::text`, id, uid, parent, in.Body).Scan(&cid); err != nil {
		notFound(w, r, "Post")
		return
	}
	if _, err := tx.Exec(ctx, `UPDATE community_posts SET comments = comments + 1 WHERE id = $1`, id); err != nil {
		internal(w, r, err)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		internal(w, r, err)
		return
	}
	h.HandleGetPost(w, r)
}

// DELETE /api/community/comments/{id} (author: shown as "deleted" so replies keep their place)
func (h *Handler) HandleDeleteComment(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	tag, err := h.pool.Exec(r.Context(), `UPDATE community_comments SET removed = true WHERE id = $1 AND author_id = $2`, id, uid)
	if err != nil || tag.RowsAffected() == 0 {
		notFound(w, r, "Comment")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// POST /api/community/report {"post_id"|"comment_id", "reason"}
func (h *Handler) HandleReport(w http.ResponseWriter, r *http.Request) {
	uid, ok := currentUser(w, r)
	if !ok {
		return
	}
	var in struct {
		PostID    string `json:"post_id"`
		CommentID string `json:"comment_id"`
		Reason    string `json:"reason"`
	}
	if !decodeJSON(w, r, &in, 4<<10) {
		return
	}
	in.Reason = strings.TrimSpace(in.Reason)
	if in.Reason == "" || len([]rune(in.Reason)) > 500 || (validID(in.PostID) == validID(in.CommentID)) {
		httpx.WriteError(w, r, http.StatusBadRequest, "invalid_report", "Say what's wrong (500 characters max)")
		return
	}
	var post, cmt any
	if validID(in.PostID) {
		post = in.PostID
	} else {
		cmt = in.CommentID
	}
	if _, err := h.pool.Exec(r.Context(), `INSERT INTO community_reports (post_id, comment_id, reporter_id, reason) VALUES ($1::uuid, $2::uuid, $3, $4)`,
		post, cmt, uid, in.Reason); err != nil {
		httpx.WriteError(w, r, http.StatusNotFound, "not_found", "That post or comment no longer exists")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

// GET /api/community/posts/{id}/image
func (h *Handler) HandlePostImage(w http.ResponseWriter, r *http.Request) {
	if _, ok := currentUser(w, r); !ok {
		return
	}
	id := chi.URLParam(r, "id")
	var key string
	if !validID(id) || h.pool.QueryRow(r.Context(), `SELECT image_key FROM community_posts WHERE id = $1 AND NOT removed`, id).Scan(&key) != nil || key == "" {
		notFound(w, r, "Image")
		return
	}
	data, err := h.store.Get(key)
	if err != nil {
		notFound(w, r, "Image")
		return
	}
	w.Header().Set("Content-Type", http.DetectContentType(data))
	w.Header().Set("Cache-Control", "private, max-age=86400")
	_, _ = w.Write(data)
}

// ---- admin moderation

// GET /admin/community/reports?resolved=0
func (h *Handler) HandleAdminReports(w http.ResponseWriter, r *http.Request) {
	rows, err := h.pool.Query(r.Context(), `SELECT rp.id::text, rp.reason, rp.resolved, rp.created_at, COALESCE(ur.username, ''),
		rp.post_id::text, rp.comment_id::text, COALESCE(p.title, cp.title, ''), COALESCE(c.body, p.body, ''),
		COALESCE(pa.username, ca.username, ''), COALESCE(p.removed, c.removed, false)
		FROM community_reports rp
		LEFT JOIN community_posts p ON p.id = rp.post_id
		LEFT JOIN community_comments c ON c.id = rp.comment_id
		LEFT JOIN community_posts cp ON cp.id = c.post_id
		LEFT JOIN user_profiles ur ON ur.user_id = rp.reporter_id
		LEFT JOIN user_profiles pa ON pa.user_id = p.author_id
		LEFT JOIN user_profiles ca ON ca.user_id = c.author_id
		WHERE ($1 = '1' OR NOT rp.resolved) ORDER BY rp.resolved, rp.created_at DESC LIMIT 300`, r.URL.Query().Get("all"))
	if err != nil {
		internal(w, r, err)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, reason, reporter, title, body, author string
		var resolved, removed bool
		var c time.Time
		var pid, cid *string
		if rows.Scan(&id, &reason, &resolved, &c, &reporter, &pid, &cid, &title, &body, &author, &removed) == nil {
			out = append(out, map[string]any{"id": id, "reason": reason, "resolved": resolved, "created_at": ts(c), "reporter": reporter,
				"post_id": pid, "comment_id": cid, "title": title, "body": truncate(body, 600), "author": author, "removed": removed})
		}
	}
	httpx.JSON(w, http.StatusOK, out)
}

// GET /admin/community/posts?q=  (recent posts for moderation)
func (h *Handler) HandleAdminPosts(w http.ResponseWriter, r *http.Request) {
	rows, err := h.pool.Query(r.Context(), `SELECT `+postCols+` WHERE ($2 = '' OR p.title ILIKE '%' || $2 || '%') ORDER BY p.created_at DESC LIMIT 200`,
		"00000000-0000-0000-0000-000000000000", strings.TrimSpace(r.URL.Query().Get("q")))
	if err != nil {
		internal(w, r, err)
		return
	}
	defer rows.Close()
	out := []post{}
	for rows.Next() {
		if p, err := scanPost(rows); err == nil {
			out = append(out, p)
		}
	}
	httpx.JSON(w, http.StatusOK, out)
}

// POST /admin/community/posts/{id}/remove {"removed": true}  and  /admin/community/comments/{id}/remove
func (h *Handler) HandleAdminRemovePost(w http.ResponseWriter, r *http.Request) {
	h.adminRemove(w, r, "community_posts")
}

func (h *Handler) HandleAdminRemoveComment(w http.ResponseWriter, r *http.Request) {
	h.adminRemove(w, r, "community_comments")
}

func (h *Handler) adminRemove(w http.ResponseWriter, r *http.Request, table string) {
	id := chi.URLParam(r, "id")
	var in struct {
		Removed bool `json:"removed"`
	}
	if !validID(id) || !decodeJSON(w, r, &in, 128) {
		if !validID(id) {
			notFound(w, r, "Item")
		}
		return
	}
	tag, err := h.pool.Exec(r.Context(), `UPDATE `+table+` SET removed = $2 WHERE id = $1`, id, in.Removed)
	if err != nil || tag.RowsAffected() == 0 {
		notFound(w, r, "Item")
		return
	}
	col := "post_id"
	if table == "community_comments" {
		col = "comment_id"
	}
	_, _ = h.pool.Exec(r.Context(), `UPDATE community_reports SET resolved = true WHERE `+col+` = $1`, id)
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

// POST /admin/community/reports/{id}/resolve
func (h *Handler) HandleAdminResolveReport(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tag, err := h.pool.Exec(r.Context(), `UPDATE community_reports SET resolved = true WHERE id = $1`, id)
	if err != nil || tag.RowsAffected() == 0 {
		notFound(w, r, "Report")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}
