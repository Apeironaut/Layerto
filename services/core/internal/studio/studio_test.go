package studio_test

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"layerto/services/core/internal/auth"
	"layerto/services/core/internal/billing"
	"layerto/services/core/internal/db"
	"layerto/services/core/internal/gateway"
	"layerto/services/core/internal/httpx"
	"layerto/services/core/internal/models"
	"layerto/services/core/internal/storage"
	"layerto/services/core/internal/studio"
	"layerto/services/core/internal/testhelper"
)

type fakeModels struct{ lastParams map[string]any }

func (f *fakeModels) RunSync(ctx context.Context, endpoint, slug, img, prompt string, params map[string]any) (*models.WorkerResponse, error) {
	f.lastParams = params
	bbox := [4]int{1, 2, 3, 4}
	return &models.WorkerResponse{ModelVersion: "test", Predictions: []models.Prediction{{Label: "turtle", Confidence: 0.9, BBox: &bbox}}}, nil
}

type env struct {
	t      *testing.T
	pool   *pgxpool.Pool
	router http.Handler
	gw     *gateway.Handler
	st     *studio.Handler
	store  *storage.Store
	fake   *fakeModels
	users  map[string]*db.User
}

func newUser(t *testing.T, pool *pgxpool.Pool, email, username string, balance int64) *db.User {
	t.Helper()
	ctx := context.Background()
	id := httpx.NewUUIDv4()
	var uid pgtype.UUID
	_ = uid.Scan(id)
	u, err := db.New(pool).CreateUser(ctx, db.CreateUserParams{ID: uid, Email: email, PasswordHash: "x", Role: "user", Status: "active"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO balances (user_id, balance, free_used) VALUES ($1, $2, $3)`, id, balance, billing.FreeCallsLimit); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO user_profiles (user_id, first_name, last_name, username) VALUES ($1, 'Test', 'User', $2)`, id, username); err != nil {
		t.Fatal(err)
	}
	return &u
}

func setup(t *testing.T) *env {
	pool := testhelper.GetTestPool(t)
	t.Cleanup(pool.Close)
	testhelper.ResetTestDB(t, pool)
	store, err := storage.New(t.TempDir(), bytes.Repeat([]byte{7}, 32))
	if err != nil {
		t.Fatal(err)
	}
	fake := &fakeModels{}
	gw := gateway.NewHandler(pool, fake)
	st := studio.NewHandler(pool, store, gw, studio.Options{PublicAPIURL: "http://api.test", WorkerToken: "worker-secret-123"})

	users := map[string]*db.User{}
	withUser := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if u, ok := users[r.Header.Get("X-Test-User")]; ok {
				r = r.WithContext(auth.WithUser(r.Context(), u))
			}
			next.ServeHTTP(w, r)
		})
	}
	r := chi.NewRouter()
	r.Get("/v1/train/trainer.py", st.HandleTrainerScript)
	r.Get("/v1/train/jobs/{id}/spec", st.HandleJobSpec)
	r.Get("/v1/train/jobs/{id}/dataset.zip", st.HandleJobDataset)
	r.Post("/v1/train/jobs/{id}/progress", st.HandleJobProgress)
	r.Post("/v1/train/jobs/{id}/fail", st.HandleJobFail)
	r.Post("/v1/train/jobs/{id}/weights", st.HandleJobWeights)
	r.Post("/v1/train/next", st.HandleClaimJob)
	r.Get("/v1/internal/weights/{key}", st.HandleWorkerWeights)
	r.Get("/v1/public/profiles/{username}", st.HandlePublicProfile)
	r.Get("/v1/public/profiles/{username}/projects/{slug}", st.HandlePublicProject)
	r.Get("/v1/sites/{slug}", st.HandlePublicSite)
	r.Post("/v1/sites/{slug}/run", st.HandleSiteRun)
	r.Group(func(a chi.Router) {
		a.Use(withUser)
		a.Get("/api/studio/plan", st.HandleGetPlan)
		a.Post("/api/studio/plan", st.HandleBuyPlan)
		a.Put("/api/studio/profile", st.HandlePutProfile)
		a.Post("/api/studio/projects", st.HandleCreateProject)
		a.Patch("/api/studio/projects/{id}", st.HandleUpdateProject)
		a.Post("/api/studio/datasets", st.HandleCreateDataset)
		a.Get("/api/studio/datasets/{id}", st.HandleGetDataset)
		a.Patch("/api/studio/datasets/{id}", st.HandleUpdateDataset)
		a.Post("/api/studio/datasets/{id}/images", st.HandleUploadImages)
		a.Get("/api/studio/datasets/{id}/images", st.HandleListImages)
		a.Get("/api/studio/datasets/{id}/images/{imageId}/file", st.HandleImageFile)
		a.Put("/api/studio/datasets/{id}/images/{imageId}/boxes", st.HandleSaveBoxes)
		a.Post("/api/studio/training", st.HandleCreateJob)
		a.Post("/api/studio/training/estimate", st.HandleEstimate)
		a.Get("/api/studio/training/{id}/notebook", st.HandleNotebook)
		a.Get("/api/studio/models", st.HandleListMyModels)
		a.Patch("/api/studio/models/{slug}", st.HandleUpdateMyModel)
		a.Post("/api/studio/models/{slug}/publish", st.HandlePublish)
		a.Get("/api/studio/marketplace", st.HandleMarketplace)
		a.Get("/api/studio/earnings", st.HandleEarnings)
		a.Post("/api/studio/sites", st.HandleCreateSite)
		a.Patch("/api/studio/sites/{id}", st.HandleUpdateSite)
		a.Delete("/api/studio/sites/{id}", st.HandleDeleteSite)
		a.Post("/admin/studio/models/{slug}/review", st.HandleAdminReview)
		a.Put("/admin/studio/settings", st.HandleAdminPutSettings)
	})
	e := &env{t: t, pool: pool, router: r, gw: gw, st: st, store: store, fake: fake}
	e.users = users
	return e
}

func (e *env) do(method, path, user string, body any, hdr map[string]string) (int, []byte) {
	e.t.Helper()
	var rd io.Reader
	ctype := ""
	switch b := body.(type) {
	case nil:
	case []byte:
		rd = bytes.NewReader(b)
	case *multipartBody:
		rd = bytes.NewReader(b.buf.Bytes())
		ctype = b.ctype
	default:
		j, _ := json.Marshal(b)
		rd = bytes.NewReader(j)
		ctype = "application/json"
	}
	req := httptest.NewRequest(method, path, rd)
	if ctype != "" {
		req.Header.Set("Content-Type", ctype)
	}
	if user != "" {
		req.Header.Set("X-Test-User", user)
	}
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	e.router.ServeHTTP(w, req)
	return w.Code, w.Body.Bytes()
}

func (e *env) ok(method, path, user string, body any, want int) map[string]any {
	e.t.Helper()
	code, raw := e.do(method, path, user, body, nil)
	if code != want {
		e.t.Fatalf("%s %s: want %d, got %d: %s", method, path, want, code, raw)
	}
	out := map[string]any{}
	_ = json.Unmarshal(raw, &out)
	return out
}

type multipartBody struct {
	buf   bytes.Buffer
	ctype string
}

func pngBytes(i int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, 64, 48))
	for x := 0; x < 64; x++ {
		for y := 0; y < 48; y++ {
			img.Set(x, y, color.RGBA{uint8(x * 4), uint8(y * 5), uint8(i * 20), 255})
		}
	}
	var b bytes.Buffer
	_ = png.Encode(&b, img)
	return b.Bytes()
}

func balance(t *testing.T, pool *pgxpool.Pool, u *db.User) int64 {
	var b int64
	if err := pool.QueryRow(context.Background(), `SELECT balance FROM balances WHERE user_id = $1`, u.ID).Scan(&b); err != nil {
		t.Fatal(err)
	}
	return b
}

func uid(u *db.User) string {
	b := u.ID.Bytes
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func TestStudio_FullLoop(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	alice := newUser(t, e.pool, "alice@layerto.test", "alice", 50_000_000)
	bob := newUser(t, e.pool, "bob@layerto.test", "bob", 5_000_000)
	e.users["alice"], e.users["bob"] = alice, bob

	// project + public profile
	proj := e.ok("POST", "/api/studio/projects", "alice", map[string]any{"name": "Sea Turtles", "description": "Nesting survey"}, 200)
	projID := proj["id"].(string)
	e.ok("PATCH", "/api/studio/projects/"+projID, "alice", map[string]any{"is_public": true, "notes": "Results from the 2026 season"}, 200)
	e.ok("PUT", "/api/studio/profile", "alice", map[string]any{"headline": "Marine biologist", "bio": "", "affiliation": "Ruhuna", "website": "https://example.org", "is_public": true}, 200)

	// dataset: keeping data needs a paid plan
	code, _ := e.do("POST", "/api/studio/datasets", "alice", map[string]any{"name": "Beach A", "classes": []string{"turtle"}, "keep": true}, nil)
	if code != http.StatusForbidden {
		t.Fatalf("keep on free plan: want 403, got %d", code)
	}
	ds := e.ok("POST", "/api/studio/datasets", "alice", map[string]any{"name": "Beach A", "classes": []string{"turtle", "nest"}, "project_id": projID}, 201)
	dsID := ds["id"].(string)
	if ds["delete_after"] == nil {
		t.Fatal("untrained, not-kept dataset should have an idle delete date")
	}

	// upload 12 images (+1 non-image that must be rejected)
	mb := &multipartBody{}
	mw := multipart.NewWriter(&mb.buf)
	for i := 0; i < 12; i++ {
		fw, _ := mw.CreateFormFile("images", fmt.Sprintf("img%02d.png", i))
		_, _ = fw.Write(pngBytes(i))
	}
	fw, _ := mw.CreateFormFile("images", "notes.txt")
	_, _ = fw.Write([]byte("hello"))
	_ = mw.Close()
	mb.ctype = mw.FormDataContentType()
	up := e.ok("POST", "/api/studio/datasets/"+dsID+"/images", "alice", mb, 200)
	if up["added"].(float64) != 12 {
		t.Fatalf("added %v, want 12", up["added"])
	}

	// bob can't see alice's images
	if code, _ := e.do("GET", "/api/studio/datasets/"+dsID+"/images", "bob", nil, nil); code != 404 {
		t.Fatalf("other user listing images: %d", code)
	}

	// the stored file is encrypted at rest but served decrypted to the owner
	code, raw := e.do("GET", "/api/studio/datasets/"+dsID+"/images", "alice", nil, nil)
	if code != 200 {
		t.Fatal(code)
	}
	var imgs []map[string]any
	_ = json.Unmarshal(raw, &imgs)
	first := imgs[0]["id"].(string)
	code, file := e.do("GET", "/api/studio/datasets/"+dsID+"/images/"+first+"/file", "alice", nil, nil)
	if code != 200 || !bytes.HasPrefix(file, []byte("\x89PNG")) {
		t.Fatalf("image file: %d", code)
	}
	var key string
	_ = e.pool.QueryRow(ctx, `SELECT storage_key FROM dataset_images WHERE id = $1`, first).Scan(&key)

	// training needs labels
	code, raw = e.do("POST", "/api/studio/training", "alice", map[string]any{"dataset_id": dsID, "name": "Turtle finder", "preset": "fast", "runner": "notebook"}, nil)
	if code != 400 || !strings.Contains(string(raw), "label at least") {
		t.Fatalf("unlabeled training: %d %s", code, raw)
	}
	for i, im := range imgs {
		boxes := []map[string]any{{"c": 0, "x": 5, "y": 5, "w": 20, "h": 15}}
		if i%3 == 0 {
			boxes = append(boxes, map[string]any{"c": 1, "x": 40, "y": 30, "w": 30, "h": 30}) // clamped to 64x48
		}
		e.ok("PUT", "/api/studio/datasets/"+dsID+"/images/"+im["id"].(string)+"/boxes", "alice", map[string]any{"boxes": boxes}, 200)
	}
	if code, _ := e.do("PUT", "/api/studio/datasets/"+dsID+"/images/"+first+"/boxes", "alice", map[string]any{"boxes": []map[string]any{{"c": 5, "x": 1, "y": 1, "w": 5, "h": 5}}}, nil); code != 400 {
		t.Fatalf("unknown class should be rejected, got %d", code)
	}
	est := e.ok("POST", "/api/studio/training/estimate", "alice", map[string]any{"dataset_id": dsID, "preset": "balanced"}, 200)
	if est["ready"] != true || est["labeled_images"].(float64) != 12 {
		t.Fatalf("estimate: %v", est)
	}

	// notebook training: free, token-protected
	job := e.ok("POST", "/api/studio/training", "alice", map[string]any{"dataset_id": dsID, "name": "Turtle finder", "preset": "fast", "runner": "notebook"}, 201)
	jobID := job["job"].(map[string]any)["id"].(string)
	token := job["notebook_token"].(string)
	auth := map[string]string{"Authorization": "Bearer " + token}

	if code, _ := e.do("GET", "/v1/train/jobs/"+jobID+"/spec", "", nil, map[string]string{"Authorization": "Bearer ltj_wrong"}); code != 401 {
		t.Fatalf("bad token: %d", code)
	}
	code, raw = e.do("GET", "/v1/train/jobs/"+jobID+"/spec", "", nil, auth)
	if code != 200 || !strings.Contains(string(raw), `"size":"s"`) {
		t.Fatalf("spec: %d %s", code, raw)
	}
	code, raw = e.do("GET", "/v1/train/jobs/"+jobID+"/dataset.zip", "", nil, auth)
	if code != 200 {
		t.Fatalf("dataset zip: %d", code)
	}
	zr, err := zip.NewReader(bytes.NewReader(raw), int64(len(raw)))
	if err != nil {
		t.Fatal(err)
	}
	total := 0
	for _, f := range zr.File {
		if strings.HasSuffix(f.Name, "_annotations.coco.json") {
			rc, _ := f.Open()
			var coco struct {
				Images, Annotations []map[string]any
				Categories          []map[string]any
			}
			_ = json.NewDecoder(rc).Decode(&coco)
			rc.Close()
			total += len(coco.Images)
			if len(coco.Categories) != 2 || coco.Categories[0]["name"] != "turtle" {
				t.Fatalf("categories: %v", coco.Categories)
			}
		}
	}
	if total != 12 {
		t.Fatalf("train+valid images = %d, want 12", total)
	}
	e.ok("POST", "/v1/train/jobs/"+jobID+"/progress", "", nil, 401) // no token
	code, _ = e.do("POST", "/v1/train/jobs/"+jobID+"/progress", "", []byte(`{"status":"running","epoch":3,"epochs":60,"map50_95":0.31,"map50":0.55}`), auth)
	if code != 200 {
		t.Fatalf("progress: %d", code)
	}

	// the notebook download rotates the token: the old one stops working
	code, nb := e.do("GET", "/api/studio/training/"+jobID+"/notebook", "alice", nil, nil)
	if code != 200 || !strings.Contains(string(nb), "layerto_trainer.py job") {
		t.Fatalf("notebook: %d", code)
	}
	if code, _ := e.do("GET", "/v1/train/jobs/"+jobID+"/spec", "", nil, auth); code != 401 {
		t.Fatalf("old token should be revoked, got %d", code)
	}
	var nbJSON struct {
		Cells []struct {
			Source string `json:"source"`
		} `json:"cells"`
	}
	_ = json.Unmarshal(nb, &nbJSON)
	newTok := ""
	for _, c := range nbJSON.Cells {
		if i := strings.Index(c.Source, `TOKEN = "`); i >= 0 {
			newTok = strings.Split(c.Source[i+9:], `"`)[0]
		}
	}
	auth = map[string]string{"Authorization": "Bearer " + newTok}

	// upload weights -> private model
	mb = &multipartBody{}
	mw = multipart.NewWriter(&mb.buf)
	_ = mw.WriteField("metrics", `{"map50_95":0.62,"map50":0.91,"size":"s","epochs":60}`)
	fw, _ = mw.CreateFormFile("weights", "best.pt")
	_, _ = fw.Write(bytes.Repeat([]byte("W"), 4096))
	_ = mw.Close()
	mb.ctype = mw.FormDataContentType()
	code, raw = e.do("POST", "/v1/train/jobs/"+jobID+"/weights", "", mb, auth)
	if code != 200 {
		t.Fatalf("weights: %d %s", code, raw)
	}
	var wres map[string]string
	_ = json.Unmarshal(raw, &wres)
	slug := wres["model_slug"]
	if !strings.HasPrefix(slug, "alice-turtle-finder-") {
		t.Fatalf("slug %q", slug)
	}
	// token is single-use after success
	if code, _ := e.do("GET", "/v1/train/jobs/"+jobID+"/spec", "", nil, auth); code != 401 {
		t.Fatalf("token after success: %d", code)
	}
	// dataset now scheduled for deletion ~3 days after training
	var del time.Time
	_ = e.pool.QueryRow(ctx, `SELECT delete_after FROM datasets WHERE id = $1`, dsID).Scan(&del)
	if d := time.Until(del); d < 71*time.Hour || d > 73*time.Hour {
		t.Fatalf("delete_after in %v, want ~72h", d)
	}

	// private: only alice may call it; the worker gets the weights id
	call := func(u *db.User) (*gateway.ExecuteCallResult, error) {
		return e.gw.ExecuteBilledCall(ctx, gateway.ExecuteCallParams{RequestID: httpx.NewUUIDv4(), UserID: uid(u), ModelSlug: slug,
			ModelEndpoint: "ltvision-ep", Route: "direct", Source: "api", MatchedKeyword: "direct", ImageBytes: pngBytes(1)})
	}
	if _, err := call(bob); !errors.Is(err, billing.ErrModelNotFound) {
		t.Fatalf("bob calling a private model: %v", err)
	}
	if _, err := call(alice); err != nil {
		t.Fatalf("alice calling her model: %v", err)
	}
	if e.fake.lastParams["ltvision_weights"] == nil {
		t.Fatal("worker did not receive the weights id")
	}
	var wkey string
	_ = e.pool.QueryRow(ctx, `SELECT weights_key FROM model_ownership o JOIN models m ON m.id = o.model_id WHERE m.slug = $1`, slug).Scan(&wkey)
	code, wdata := e.do("GET", "/v1/internal/weights/"+strings.TrimPrefix(wkey, "weights/"), "", nil, map[string]string{"X-Worker-Token": "worker-secret-123"})
	if code != 200 || len(wdata) != 4096 {
		t.Fatalf("worker weights: %d %d", code, len(wdata))
	}
	if code, _ := e.do("GET", "/v1/internal/weights/"+strings.TrimPrefix(wkey, "weights/"), "", nil, nil); code != 401 {
		t.Fatalf("weights without worker token: %d", code)
	}

	// publish -> review -> public; bob's paid call earns alice 25%. Selling models needs a plan with sell_models.
	if code, body := e.do("POST", "/api/studio/models/"+slug+"/publish", "alice", nil, nil); code != 403 || !strings.Contains(string(body), "plan_feature") {
		t.Fatalf("publish on free plan: %d %s", code, body)
	}
	if _, err := e.pool.Exec(ctx, `INSERT INTO subscriptions (user_id, plan, period_end, auto_renew) VALUES ($1, 'solo', now() + interval '30 days', false)
		ON CONFLICT (user_id) DO UPDATE SET plan = 'solo', period_end = now() + interval '30 days'`, alice.ID); err != nil {
		t.Fatal(err)
	}
	code, _ = e.do("POST", "/api/studio/models/"+slug+"/publish", "alice", nil, nil)
	if code != 400 {
		t.Fatalf("publish without description: %d", code)
	}
	e.ok("PATCH", "/api/studio/models/"+slug, "alice", map[string]any{"description": "Finds sea turtles and nests on beach photos.", "price_usd": "0.004"}, 200)
	m := e.ok("POST", "/api/studio/models/"+slug+"/publish", "alice", nil, 200)
	if m["visibility"] != "pending" {
		t.Fatalf("visibility %v", m["visibility"])
	}
	if _, err := call(bob); !errors.Is(err, billing.ErrModelNotFound) {
		t.Fatal("pending models must stay private")
	}
	e.ok("POST", "/admin/studio/models/"+slug+"/review", "alice", map[string]any{"decision": "approve"}, 200)
	list, _ := db.New(e.pool).ListEnabledModels(ctx)
	found := false
	for _, lm := range list {
		if lm.Slug == slug {
			found = true
		}
	}
	if !found {
		t.Fatal("public model missing from the public catalog")
	}
	before := balance(t, e.pool, alice)
	bobBefore := balance(t, e.pool, bob)
	if _, err := call(bob); err != nil {
		t.Fatalf("bob calling public model: %v", err)
	}
	if got := bobBefore - balance(t, e.pool, bob); got != 4000 {
		t.Fatalf("bob charged %d, want 4000", got)
	}
	if got := balance(t, e.pool, alice) - before; got != 1000 {
		t.Fatalf("alice reward %d, want 1000 (25%% of 4000)", got)
	}
	earn := e.ok("GET", "/api/studio/earnings", "alice", nil, 200)
	if earn["total_usd"] != "0.001000" {
		t.Fatalf("earnings %v", earn)
	}
	mkt := e.ok("GET", "/api/studio/marketplace", "bob", nil, 200)
	_ = mkt

	// public profile + project page
	prof := e.ok("GET", "/v1/public/profiles/alice", "", nil, 200)
	if len(prof["models"].([]any)) != 1 || len(prof["projects"].([]any)) != 1 {
		t.Fatalf("profile: %v", prof)
	}
	e.ok("GET", "/v1/public/profiles/alice/projects/sea-turtles", "", nil, 200)
	e.ok("GET", "/v1/public/profiles/bob", "", nil, 404) // not public

	// model site: billed to alice with site_id, capped per month
	// create takes every field at once (button, cap, published); unsafe links are refused
	e.ok("POST", "/api/studio/sites", "alice", map[string]any{"model_slug": slug, "title": "X", "slug": "turtle-x", "cta_url": "javascript:alert(1)"}, 400)
	s := e.ok("POST", "/api/studio/sites", "alice", map[string]any{"model_slug": slug, "title": "Turtle Spotter", "slug": "turtle-spotter",
		"cta_label": "Buy", "cta_url": "https://example.com", "monthly_cap_usd": "2.50", "published": false}, 201)
	if s["cta_url"] != "https://example.com" || s["monthly_cap_usd"] != "2.500000" || s["published"] != false {
		t.Fatalf("create ignored fields: %v", s)
	}
	siteID := s["id"].(string)
	e.ok("GET", "/v1/sites/turtle-spotter", "", nil, 404) // unpublished
	e.ok("PATCH", "/api/studio/sites/"+siteID, "alice", map[string]any{"published": true, "theme": map[string]string{"primary": "#0F766E"}}, 200)
	run := func() int {
		mb := &multipartBody{}
		mw := multipart.NewWriter(&mb.buf)
		fw, _ := mw.CreateFormFile("image", "x.png")
		_, _ = fw.Write(pngBytes(3))
		_ = mw.Close()
		mb.ctype = mw.FormDataContentType()
		code, _ := e.do("POST", "/v1/sites/turtle-spotter/run", "", mb, nil)
		return code
	}
	before = balance(t, e.pool, alice)
	if c := run(); c != 200 {
		t.Fatalf("site run: %d", c)
	}
	if got := before - balance(t, e.pool, alice); got != 4000 {
		t.Fatalf("site owner charged %d, want 4000", got)
	}
	e.ok("PATCH", "/api/studio/sites/"+siteID, "alice", map[string]any{"monthly_cap_usd": "0.004"}, 200)
	if c := run(); c != 503 {
		t.Fatalf("site over cap: %d", c)
	}

	// retention: when the date passes, the janitor deletes the images
	_, _ = e.pool.Exec(ctx, `UPDATE datasets SET delete_after = now() - interval '1 minute' WHERE id = $1`, dsID)
	e.st.RunJanitor(ctx)
	var n int
	_ = e.pool.QueryRow(ctx, `SELECT count(*) FROM dataset_images WHERE dataset_id = $1`, dsID).Scan(&n)
	if n != 0 {
		t.Fatalf("images left after retention: %d", n)
	}
	if _, err := e.store.Get(key); !errors.Is(err, storage.ErrNotFound) {
		t.Fatalf("file still on disk: %v", err)
	}
	// ... but the trained model keeps working
	if _, err := call(alice); err != nil {
		t.Fatalf("model after dataset deletion: %v", err)
	}
}

func TestStudio_GPUJobsPlansAndRefunds(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	carol := newUser(t, e.pool, "carol@layerto.test", "carol", 2_000_000)
	e.users["carol"] = carol

	// plan: too expensive, then credit and buy
	if code, _ := e.do("POST", "/api/studio/plan", "carol", map[string]any{"plan": "solo"}, nil); code != http.StatusPaymentRequired {
		t.Fatalf("buy plan without balance: %d", code)
	}
	if _, err := billing.Adjust(ctx, e.pool, uid(carol), 20_000_000, "balance.credited", map[string]any{"note": "test"}); err != nil {
		t.Fatal(err)
	}
	plan := e.ok("POST", "/api/studio/plan", "carol", map[string]any{"plan": "solo"}, 200)
	if plan["current"] != "solo" || balance(t, e.pool, carol) != 13_000_000 {
		t.Fatalf("plan %v balance %d", plan["current"], balance(t, e.pool, carol))
	}
	// renewal: period ended + auto_renew -> charged again
	_, _ = e.pool.Exec(ctx, `UPDATE subscriptions SET period_end = now() - interval '1 hour' WHERE user_id = $1`, carol.ID)
	e.st.RunJanitor(ctx)
	if balance(t, e.pool, carol) != 4_000_000 {
		t.Fatalf("after renewal balance %d", balance(t, e.pool, carol))
	}
	// next renewal can't be paid -> back to free
	_, _ = e.pool.Exec(ctx, `UPDATE subscriptions SET period_end = now() - interval '1 hour' WHERE user_id = $1`, carol.ID)
	e.st.RunJanitor(ctx)
	if p := e.ok("GET", "/api/studio/plan", "carol", nil, 200); p["current"] != "free" {
		t.Fatalf("expected free after failed renewal, got %v", p["current"])
	}

	// Layerto GPU training is charged up front and refunded on failure
	ds := e.ok("POST", "/api/studio/datasets", "carol", map[string]any{"name": "Pills", "classes": []string{"pill"}}, 201)
	dsID := ds["id"].(string)
	mb := &multipartBody{}
	mw := multipart.NewWriter(&mb.buf)
	for i := 0; i < 10; i++ {
		fw, _ := mw.CreateFormFile("images", fmt.Sprintf("p%d.png", i))
		_, _ = fw.Write(pngBytes(i))
	}
	_ = mw.Close()
	mb.ctype = mw.FormDataContentType()
	e.ok("POST", "/api/studio/datasets/"+dsID+"/images", "carol", mb, 200)
	_, _ = e.pool.Exec(ctx, `UPDATE dataset_images SET boxes = '[{"c":0,"x":1,"y":1,"w":10,"h":10}]', labeled = true WHERE dataset_id = $1`, dsID)
	before := balance(t, e.pool, carol)
	job := e.ok("POST", "/api/studio/training", "carol", map[string]any{"dataset_id": dsID, "name": "Pill detector", "preset": "fast", "runner": "layerto"}, 201)
	jobID := job["job"].(map[string]any)["id"].(string)
	charged := before - balance(t, e.pool, carol)
	if charged < 100000 {
		t.Fatalf("GPU training charged %d", charged)
	}
	if _, ok := job["notebook_token"]; ok {
		t.Fatal("GPU jobs must not expose a notebook token")
	}
	if code, _ := e.do("POST", "/v1/train/next", "", nil, map[string]string{"X-Worker-Token": "nope-nope-nope-123"}); code != 401 {
		t.Fatalf("claim with bad worker token: %d", code)
	}
	code, raw := e.do("POST", "/v1/train/next", "", nil, map[string]string{"X-Worker-Token": "worker-secret-123"})
	if code != 200 {
		t.Fatalf("claim: %d %s", code, raw)
	}
	var claim map[string]string
	_ = json.Unmarshal(raw, &claim)
	if claim["job_id"] != jobID {
		t.Fatalf("claimed %v", claim)
	}
	if code, _ := e.do("POST", "/v1/train/next", "", nil, map[string]string{"X-Worker-Token": "worker-secret-123"}); code != 204 {
		t.Fatalf("second claim should find nothing: %d", code)
	}
	code, _ = e.do("POST", "/v1/train/jobs/"+jobID+"/fail", "", []byte(`{"error":"CUDA out of memory"}`), map[string]string{"Authorization": "Bearer " + claim["token"]})
	if code != 200 {
		t.Fatalf("fail: %d", code)
	}
	if balance(t, e.pool, carol) != before {
		t.Fatalf("not refunded: %d vs %d", balance(t, e.pool, carol), before)
	}
	var status, msg string
	_ = e.pool.QueryRow(ctx, `SELECT status, error FROM training_jobs WHERE id = $1`, jobID).Scan(&status, &msg)
	if status != "failed" || msg != "CUDA out of memory" {
		t.Fatalf("job %s %q", status, msg)
	}

	// settings validation
	if code, _ := e.do("PUT", "/admin/studio/settings", "carol", map[string]any{"creator_reward_bps": 95000}, nil); code != 400 {
		t.Fatalf("invalid reward share accepted: %d", code)
	}
	_ = os.Getenv
}
