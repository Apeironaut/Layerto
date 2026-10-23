package studio_test

import (
	"context"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"layerto/services/core/internal/auth"
	"layerto/services/core/internal/billing"
)

// setupHub adds the hub routes (plans/features, teams, community, dataset marketplace, research).
func setupHub(t *testing.T) *env {
	e := setup(t)
	st := e.st
	withUser := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if u, ok := e.users[r.Header.Get("X-Test-User")]; ok {
				r = r.WithContext(auth.WithUser(r.Context(), u))
			}
			next.ServeHTTP(w, r)
		})
	}
	r := chi.NewRouter()
	r.Post("/v1/train/jobs/{id}/progress", st.HandleJobProgress)
	r.Post("/v1/train/jobs/{id}/weights", st.HandleJobWeights)
	r.Get("/v1/train/jobs/{id}/spec", st.HandleJobSpec)
	r.Get("/v1/train/jobs/{id}/init.pt", st.HandleJobInitWeights)
	r.Get("/v1/public/papers", st.HandlePublicPapers)
	r.Get("/v1/public/papers/{id}", st.HandlePublicPaper)
	r.Get("/v1/public/portfolio/{subdomain}", st.HandlePublicPortfolio)
	r.Group(func(a chi.Router) {
		a.Use(withUser)
		a.Get("/api/studio/plan", st.HandleGetPlan)
		a.Post("/api/studio/plan", st.HandleBuyPlan)
		a.Post("/api/studio/addons", st.HandleBuyAddon)
		a.Post("/api/studio/gpu-bundles", st.HandleBuyGPUBundle)
		a.Put("/api/me/settings", st.HandlePutSettings)
		a.Post("/api/studio/projects", st.HandleCreateProject)
		a.Get("/api/studio/projects", st.HandleListProjects)
		a.Get("/api/studio/projects/{id}", st.HandleGetProject)
		a.Patch("/api/studio/projects/{id}", st.HandleUpdateProject)
		a.Post("/api/studio/datasets", st.HandleCreateDataset)
		a.Get("/api/studio/datasets", st.HandleListDatasets)
		a.Get("/api/studio/datasets/{id}", st.HandleGetDataset)
		a.Delete("/api/studio/datasets/{id}", st.HandleDeleteDataset)
		a.Post("/api/studio/datasets/{id}/images", st.HandleUploadImages)
		a.Get("/api/studio/datasets/{id}/images", st.HandleListImages)
		a.Put("/api/studio/datasets/{id}/images/{imageId}/boxes", st.HandleSaveBoxes)
		a.Post("/api/studio/training", st.HandleCreateJob)
		a.Post("/api/studio/training/{id}/cancel", st.HandleCancelJob)
		a.Get("/api/studio/models", st.HandleListMyModels)
		a.Patch("/api/studio/models/{slug}", st.HandleUpdateMyModel)
		a.Post("/api/studio/models/{slug}/publish", st.HandlePublish)
		a.Post("/api/studio/models/import", st.HandleImportModel)
		a.Get("/api/studio/earnings", st.HandleEarnings)
		a.Get("/api/teams", st.HandleListTeams)
		a.Post("/api/teams", st.HandleCreateTeam)
		a.Post("/api/teams/{id}/members", st.HandleInviteMember)
		a.Post("/api/teams/{id}/accept", st.HandleAcceptInvite)
		a.Delete("/api/teams/{id}/members/{userId}", st.HandleRemoveMember)
		a.Get("/api/community/posts", st.HandleListPosts)
		a.Post("/api/community/posts", st.HandleCreatePost)
		a.Get("/api/community/posts/{id}", st.HandleGetPost)
		a.Post("/api/community/posts/{id}/vote", st.HandleVotePost)
		a.Post("/api/community/posts/{id}/save", st.HandleSavePost)
		a.Post("/api/community/posts/{id}/comments", st.HandleCreateComment)
		a.Post("/api/community/report", st.HandleReport)
		a.Get("/api/community/meta", st.HandleCommunityMeta)
		a.Get("/admin/community/reports", st.HandleAdminReports)
		a.Post("/admin/community/posts/{id}/remove", st.HandleAdminRemovePost)
		a.Get("/api/market/datasets", st.HandleListListings)
		a.Get("/api/market/datasets/{id}", st.HandleGetListing)
		a.Get("/api/market/datasets/{id}/preview/{imageId}", st.HandleListingPreview)
		a.Post("/api/market/datasets/{id}/buy", st.HandleBuyListing)
		a.Get("/api/market/purchases", st.HandlePurchases)
		a.Post("/api/market/purchases/{id}/import", st.HandleImportPurchase)
		a.Get("/api/market/my-datasets", st.HandleMyListings)
		a.Post("/api/market/my-datasets", st.HandleCreateListing)
		a.Post("/api/market/my-datasets/{id}/submit", st.HandleSubmitListing)
		a.Post("/admin/market/datasets/{id}/review", st.HandleAdminReviewListing)
		a.Get("/api/research/overview", st.HandleResearchOverview)
		a.Get("/api/research/areas", st.HandleListAreas)
		a.Post("/api/research/areas", st.HandleCreateArea)
		a.Patch("/api/research/areas/{id}", st.HandleUpdateArea)
		for path, ent := range st.ResearchEntities() {
			a.Get("/api/research/"+path, st.ResearchList(ent))
			a.Post("/api/research/"+path, st.ResearchCreate(ent))
			a.Get("/api/research/"+path+"/{id}", st.ResearchGet(ent))
			a.Patch("/api/research/"+path+"/{id}", st.ResearchUpdate(ent))
			a.Delete("/api/research/"+path+"/{id}", st.ResearchDelete(ent))
		}
		a.Post("/api/research/papers/{id}/pdf", st.HandleUploadPaperPDF)
		a.Get("/api/research/papers/{id}/bibtex", st.HandlePaperBibtex)
		a.Post("/api/research/papers/{id}/publish", st.HandlePublishPaper)
		a.Post("/api/research/literature/import", st.HandleImportBibtex)
		a.Post("/api/research/files", st.HandleUploadFile)
		a.Get("/api/research/files/{id}", st.HandleDownloadFile)
		a.Get("/api/research/portfolio", st.HandleGetPortfolio)
		a.Put("/api/research/portfolio", st.HandlePutPortfolio)
		a.Get("/api/activity", st.HandleActivity)
	})
	e.router = r
	return e
}

func grant(t *testing.T, e *env, user, plan string) {
	t.Helper()
	if _, err := e.pool.Exec(context.Background(), `INSERT INTO subscriptions (user_id, plan, period_end, auto_renew) VALUES ($1, $2, now() + interval '30 days', false)
		ON CONFLICT (user_id) DO UPDATE SET plan = $2, period_end = now() + interval '30 days'`, e.users[user].ID, plan); err != nil {
		t.Fatal(err)
	}
}

func uploadImages(t *testing.T, e *env, user, dsID string, n int) {
	t.Helper()
	mb := &multipartBody{}
	mw := multipart.NewWriter(&mb.buf)
	for i := 0; i < n; i++ {
		fw, _ := mw.CreateFormFile("images", fmt.Sprintf("img%d.png", i))
		_, _ = fw.Write(pngBytes(i))
	}
	_ = mw.Close()
	mb.ctype = mw.FormDataContentType()
	e.ok("POST", "/api/studio/datasets/"+dsID+"/images", user, mb, 200)
}

func list(t *testing.T, e *env, path, user string) []map[string]any {
	t.Helper()
	code, raw := e.do("GET", path, user, nil, nil)
	if code != 200 {
		t.Fatalf("GET %s: %d %s", path, code, raw)
	}
	var out []map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("GET %s: %v %s", path, err, raw)
	}
	return out
}

func TestHub_PlansGateFeatures(t *testing.T) {
	e := setupHub(t)
	ph := newUser(t, e.pool, "ph@layerto.test", "pia", 50_000_000)
	e.users["pia"] = ph

	// free plan: projects yes, research and selling images no
	e.ok("POST", "/api/studio/projects", "pia", map[string]any{"name": "Try"}, 200)
	if code, raw := e.do("GET", "/api/research/areas", "pia", nil, nil); code != 403 || !strings.Contains(string(raw), "plan_feature") {
		t.Fatalf("research on free: %d %s", code, raw)
	}
	if code, _ := e.do("POST", "/api/studio/datasets", "pia", map[string]any{"name": "Shots", "kind": "bundle"}, nil); code != 403 {
		t.Fatalf("bundle on free: %d", code)
	}
	// photographer: sells images but can't build models
	p := e.ok("POST", "/api/studio/plan", "pia", map[string]any{"plan": "photographer"}, 200)
	if p["current"] != "photographer" || p["track"] != "photographer" {
		t.Fatalf("plan %v track %v", p["current"], p["track"])
	}
	if code, raw := e.do("POST", "/api/studio/projects", "pia", map[string]any{"name": "Nope"}, nil); code != 403 || !strings.Contains(string(raw), "Photographer plan is for selling") {
		t.Fatalf("project as photographer: %d %s", code, raw)
	}
	e.ok("POST", "/api/studio/datasets", "pia", map[string]any{"name": "Beach shots", "kind": "bundle"}, 201)

	// research free keeps 1 GB, researcher pro falls back to research free when it lapses
	e.ok("POST", "/api/studio/plan", "pia", map[string]any{"plan": "research_free"}, 200)
	e.ok("GET", "/api/research/overview", "pia", nil, 200)
	e.ok("POST", "/api/studio/plan", "pia", map[string]any{"plan": "researcher"}, 200)
	_, _ = e.pool.Exec(context.Background(), `UPDATE subscriptions SET period_end = now() - interval '1 hour', auto_renew = false WHERE user_id = $1`, ph.ID)
	e.st.RunJanitor(context.Background())
	if p := e.ok("GET", "/api/studio/plan", "pia", nil, 200); p["current"] != "research_free" {
		t.Fatalf("lapsed researcher -> %v", p["current"])
	}

	// storage add-on raises the limit; portfolio add-on needs the research feature
	before := e.ok("GET", "/api/studio/plan", "pia", nil, 200)["limits"].(map[string]any)["storage_mb"].(float64)
	e.ok("POST", "/api/studio/addons", "pia", map[string]any{"addon": "storage_10gb", "quantity": 2}, 200)
	after := e.ok("GET", "/api/studio/plan", "pia", nil, 200)["limits"].(map[string]any)["storage_mb"].(float64)
	if after-before != 20480 {
		t.Fatalf("storage add-on: %v -> %v", before, after)
	}
	e.ok("POST", "/api/studio/plan", "pia", map[string]any{"plan": "free"}, 200)
	if code, _ := e.do("POST", "/api/studio/addons", "pia", map[string]any{"addon": "portfolio"}, nil); code != 403 {
		t.Fatalf("portfolio add-on on free: %d", code)
	}
	if code, _ := e.do("PUT", "/api/me/settings", "pia", map[string]any{"track": "astronaut"}, nil); code != 400 {
		t.Fatalf("bad track accepted: %d", code)
	}
}

func TestHub_DatasetMarketplace(t *testing.T) {
	e := setupHub(t)
	ctx := context.Background()
	seller := newUser(t, e.pool, "seller@layerto.test", "sam", 0)
	buyer := newUser(t, e.pool, "buyer@layerto.test", "bea", 30_000_000)
	e.users["sam"], e.users["bea"] = seller, buyer
	grant(t, e, "sam", "photographer")
	grant(t, e, "bea", "researcher")

	ds := e.ok("POST", "/api/studio/datasets", "sam", map[string]any{"name": "Tea leaves", "kind": "bundle", "classes": []string{"blight", "healthy"}}, 201)
	dsID := ds["id"].(string)
	uploadImages(t, e, "sam", dsID, 12)
	imgs := list(t, e, "/api/studio/datasets/"+dsID+"/images", "sam")
	e.ok("PUT", "/api/studio/datasets/"+dsID+"/images/"+imgs[0]["id"].(string)+"/boxes", "sam", map[string]any{"boxes": []map[string]any{{"c": 0, "x": 2, "y": 2, "w": 20, "h": 20}}}, 200)

	l := e.ok("POST", "/api/market/my-datasets", "sam", map[string]any{"dataset_id": dsID, "title": "Tea leaf close-ups", "license": "research_only",
		"price_usd": "10.00", "tags": []string{"Agriculture", "tea"}}, 201)
	lid := l["id"].(string)
	if code, raw := e.do("POST", "/api/market/my-datasets/"+lid+"/submit", "sam", nil, nil); code != 400 || !strings.Contains(string(raw), "description_needed") {
		t.Fatalf("submit without description: %d %s", code, raw)
	}
	_, _ = e.pool.Exec(ctx, `UPDATE dataset_listings SET description = 'Phone photos of tea leaves from estates in Nuwara Eliya, morning light.' WHERE id = $1`, lid)
	e.ok("POST", "/api/market/my-datasets/"+lid+"/submit", "sam", nil, 200)
	if len(list(t, e, "/api/market/datasets", "bea")) != 0 {
		t.Fatal("pending listing is public")
	}
	e.ok("POST", "/admin/market/datasets/"+lid+"/review", "sam", map[string]any{"decision": "approve"}, 200)
	pub := list(t, e, "/api/market/datasets?tag=tea", "bea")
	if len(pub) != 1 || pub[0]["dataset_id"] != nil && pub[0]["dataset_id"] != "" || len(pub[0]["previews"].([]any)) != 8 {
		t.Fatalf("public listing: %v", pub)
	}
	prev := pub[0]["previews"].([]any)[0].(string)
	if code, raw := e.do("GET", "/api/market/datasets/"+lid+"/preview/"+prev, "bea", nil, nil); code != 200 || len(raw) < 100 {
		t.Fatalf("preview: %d", code)
	}
	if code, _ := e.do("GET", "/api/market/datasets/"+lid+"/preview/"+imgs[11]["id"].(string), "bea", nil, nil); code != 404 {
		t.Fatalf("non-preview image served: %d", code)
	}

	// buy: license must be accepted; 80% to the seller as credit
	if code, _ := e.do("POST", "/api/market/datasets/"+lid+"/buy", "bea", map[string]any{"accept_license": false}, nil); code != 400 {
		t.Fatalf("buy without accepting: %d", code)
	}
	buy := e.ok("POST", "/api/market/datasets/"+lid+"/buy", "bea", map[string]any{"accept_license": true}, 200)
	if balance(t, e.pool, buyer) != 20_000_000 || balance(t, e.pool, seller) != 8_000_000 {
		t.Fatalf("balances buyer %d seller %d", balance(t, e.pool, buyer), balance(t, e.pool, seller))
	}
	if code, _ := e.do("POST", "/api/market/datasets/"+lid+"/buy", "bea", map[string]any{"accept_license": true}, nil); code != 409 {
		t.Fatalf("double buy: %d", code)
	}
	// seller can't delete what buyers can still import
	if code, _ := e.do("DELETE", "/api/studio/datasets/"+dsID, "sam", nil, nil); code != 409 {
		t.Fatalf("delete sold dataset: %d", code)
	}

	// import into a project: images and boxes copied, license travels with the data
	proj := e.ok("POST", "/api/studio/projects", "bea", map[string]any{"name": "Tea"}, 200)
	imp := e.ok("POST", "/api/market/purchases/"+buy["purchase_id"].(string)+"/import", "bea", map[string]any{"project_id": proj["id"]}, 201)
	copyDS := imp["dataset"].(map[string]any)
	if copyDS["images"].(float64) != 12 || copyDS["boxes"].(float64) != 1 || copyDS["license"] != "research_only" || copyDS["project_id"] != proj["id"] {
		t.Fatalf("imported dataset %v", copyDS)
	}
	purchases := list(t, e, "/api/market/purchases", "bea")
	if len(purchases) != 1 || len(purchases[0]["dataset_ids"].([]any)) != 1 {
		t.Fatalf("purchases %v", purchases)
	}
	// a model trained on research-only data can't be sold
	copyID := copyDS["id"].(string)
	_, _ = e.pool.Exec(ctx, `UPDATE dataset_images SET boxes = '[{"c":0,"x":1,"y":1,"w":10,"h":10}]', labeled = true WHERE dataset_id = $1`, copyID)
	job := e.ok("POST", "/api/studio/training", "bea", map[string]any{"dataset_id": copyID, "name": "Tea v1", "preset": "fast", "runner": "notebook"}, 201)
	tok := job["notebook_token"].(string)
	jobID := job["job"].(map[string]any)["id"].(string)
	mb := &multipartBody{}
	mw := multipart.NewWriter(&mb.buf)
	fw, _ := mw.CreateFormFile("weights", "best.pt")
	_, _ = fw.Write(make([]byte, 4096))
	_ = mw.WriteField("metrics", `{"map50_95":0.4,"map50":0.6,"size":"s","per_class_ap":{"blight":0.35,"healthy":0.45}}`)
	_ = mw.Close()
	mb.ctype = mw.FormDataContentType()
	code, raw := e.do("POST", "/v1/train/jobs/"+jobID+"/weights", "", mb, map[string]string{"Authorization": "Bearer " + tok})
	if code != 200 {
		t.Fatalf("weights: %d %s", code, raw)
	}
	var w map[string]any
	_ = json.Unmarshal(raw, &w)
	slug := w["model_slug"].(string)
	e.ok("PATCH", "/api/studio/models/"+slug, "bea", map[string]any{"description": "Finds blight on tea leaves in close-up photos."}, 200)
	if code, raw := e.do("POST", "/api/studio/models/"+slug+"/publish", "bea", nil, nil); code != 403 || !strings.Contains(string(raw), "license_restricted") {
		t.Fatalf("publish research-only model: %d %s", code, raw)
	}
	models := list(t, e, "/api/studio/models", "bea")
	pc := models[0]["metrics"].(map[string]any)["per_class_ap"].(map[string]any)
	if models[0]["data_license"] != "research_only" || pc["blight"].(float64) != 0.35 {
		t.Fatalf("model %v", models[0])
	}
	earn := e.ok("GET", "/api/studio/earnings", "sam", nil, 200)
	if earn["datasets_total_usd"] != "8.000000" || earn["dataset_sales"].(float64) != 1 {
		t.Fatalf("seller earnings %v", earn)
	}
}

func TestHub_Community(t *testing.T) {
	e := setupHub(t)
	a := newUser(t, e.pool, "a@layerto.test", "ann", 0)
	b := newUser(t, e.pool, "b@layerto.test", "ben", 0)
	e.users["ann"], e.users["ben"] = a, b

	post := func(fields map[string]string) (int, map[string]any) {
		mb := &multipartBody{}
		mw := multipart.NewWriter(&mb.buf)
		for k, v := range fields {
			_ = mw.WriteField(k, v)
		}
		fw, _ := mw.CreateFormFile("image", "x.png")
		_, _ = fw.Write(pngBytes(1))
		_ = mw.Close()
		mb.ctype = mw.FormDataContentType()
		code, raw := e.do("POST", "/api/community/posts", "ann", mb, nil)
		out := map[string]any{}
		_ = json.Unmarshal(raw, &out)
		return code, out
	}
	if code, _ := post(map[string]string{"space": "nowhere", "title": "Hello"}); code != 400 {
		t.Fatalf("bad space: %d", code)
	}
	if code, _ := post(map[string]string{"space": "showcase", "title": "Link", "link_kind": "url", "link_ref": "javascript:x"}); code != 400 {
		t.Fatalf("bad link: %d", code)
	}
	code, p := post(map[string]string{"space": "computer-vision", "title": "My pothole detector hit 61% mAP", "body": "Trained on 900 photos."})
	if code != 201 || p["score"].(float64) != 1 || p["my_vote"].(float64) != 1 || !p["has_image"].(bool) {
		t.Fatalf("create post %d %v", code, p)
	}
	id := p["id"].(string)
	v := e.ok("POST", "/api/community/posts/"+id+"/vote", "ben", map[string]any{"value": 1}, 200)
	if v["score"].(float64) != 2 {
		t.Fatalf("score after upvote %v", v["score"])
	}
	v = e.ok("POST", "/api/community/posts/"+id+"/vote", "ben", map[string]any{"value": -1}, 200)
	if v["score"].(float64) != 0 {
		t.Fatalf("score after switching vote %v", v["score"])
	}
	e.ok("POST", "/api/community/posts/"+id+"/save", "ben", map[string]any{"saved": true}, 200)
	if len(list(t, e, "/api/community/posts?saved=1", "ben")) != 1 || len(list(t, e, "/api/community/posts?saved=1", "ann")) != 0 {
		t.Fatal("saved filter")
	}
	full := e.ok("POST", "/api/community/posts/"+id+"/comments", "ben", map[string]any{"body": "What image size?"}, 200)
	cid := full["comments"].([]any)[0].(map[string]any)["id"].(string)
	full = e.ok("POST", "/api/community/posts/"+id+"/comments", "ann", map[string]any{"body": "640 px", "parent_id": cid}, 200)
	if len(full["comments"].([]any)) != 2 || full["post"].(map[string]any)["comments"].(float64) != 2 {
		t.Fatalf("comments %v", full)
	}
	for _, sort := range []string{"hot", "new", "top"} {
		if len(list(t, e, "/api/community/posts?sort="+sort+"&space=computer-vision", "ben")) != 1 {
			t.Fatalf("sort %s", sort)
		}
	}
	e.ok("POST", "/api/community/report", "ben", map[string]any{"post_id": id, "reason": "spam"}, 200)
	if len(list(t, e, "/admin/community/reports", "ben")) != 1 {
		t.Fatal("report not listed")
	}
	e.ok("POST", "/admin/community/posts/"+id+"/remove", "ben", map[string]any{"removed": true}, 200)
	if len(list(t, e, "/api/community/posts", "ben")) != 0 || len(list(t, e, "/admin/community/reports", "ben")) != 0 {
		t.Fatal("removed post still listed / report not resolved")
	}
	meta := e.ok("GET", "/api/community/meta", "ben", nil, 200)
	if len(meta["spaces"].([]any)) != 8 {
		t.Fatalf("spaces %v", meta["spaces"])
	}
}

func TestHub_ResearchTeamsAndExperiments(t *testing.T) {
	e := setupHub(t)
	ctx := context.Background()
	r1 := newUser(t, e.pool, "r1@layerto.test", "rina", 100_000_000)
	r2 := newUser(t, e.pool, "r2@layerto.test", "ravi", 0)
	r3 := newUser(t, e.pool, "r3@layerto.test", "rob", 0)
	e.users["rina"], e.users["ravi"], e.users["rob"] = r1, r2, r3
	grant(t, e, "rina", "researcher")
	grant(t, e, "ravi", "research_free")
	grant(t, e, "rob", "research_free")

	// team: invite, accept; viewer vs editor
	team := e.ok("POST", "/api/teams", "rina", map[string]any{"name": "Marine CV Lab"}, 201)
	tid := team["id"].(string)
	e.ok("POST", "/api/teams/"+tid+"/members", "rina", map[string]any{"username": "@ravi", "role": "editor"}, 200)
	e.ok("POST", "/api/teams/"+tid+"/members", "rina", map[string]any{"username": "rob", "role": "viewer"}, 200)
	if code, _ := e.do("POST", "/api/teams/"+tid+"/members", "rina", map[string]any{"username": "nobody", "role": "viewer"}, nil); code != 404 {
		t.Fatalf("invite unknown user: %d", code)
	}
	e.ok("POST", "/api/teams/"+tid+"/accept", "ravi", nil, 200)
	e.ok("POST", "/api/teams/"+tid+"/accept", "rob", nil, 200)
	if code, _ := e.do("POST", "/api/teams", "ravi", map[string]any{"name": "Mine"}, nil); code != 403 {
		t.Fatalf("team on research free: %d", code)
	}

	area := e.ok("POST", "/api/research/areas", "rina", map[string]any{"name": "Turtle re-identification", "team_id": tid, "color": "#0F766E"}, 201)
	aid := area["id"].(string)
	// editor writes, viewer reads only, outsiders see nothing
	f := e.ok("POST", "/api/research/findings", "ravi", map[string]any{"area_id": aid, "title": "Scute patterns are stable across years", "confidence": "high"}, 201)
	if code, _ := e.do("POST", "/api/research/findings", "rob", map[string]any{"area_id": aid, "title": "Viewer can't write"}, nil); code != 403 {
		t.Fatalf("viewer wrote: %d", code)
	}
	if code, _ := e.do("PATCH", "/api/research/findings/"+f["id"].(string), "rob", map[string]any{"title": "x"}, nil); code != 404 {
		t.Fatalf("viewer edited: %d", code)
	}
	if got := list(t, e, "/api/research/findings?area="+aid, "rob"); len(got) != 1 || got[0]["owner"] != "ravi" {
		t.Fatalf("viewer list %v", got)
	}
	if code, _ := e.do("GET", "/api/research/findings/"+f["id"].(string), "rina", nil, nil); code != 200 {
		t.Fatalf("owner read teammate finding: %d", code)
	}
	if code, _ := e.do("POST", "/api/research/findings", "rina", map[string]any{"title": "bad", "confidence": "absolute"}, nil); code != 400 {
		t.Fatalf("bad enum: %d", code)
	}
	// tasks with deadlines show up on the overview
	e.ok("POST", "/api/research/tasks", "rina", map[string]any{"area_id": aid, "title": "CVPR deadline", "kind": "deadline", "due_date": "2099-11-14"}, 201)
	e.ok("POST", "/api/research/tasks", "rina", map[string]any{"title": "Soon", "due_date": "2000-01-01"}, 201)
	ov := e.ok("GET", "/api/research/overview", "rina", nil, 200)
	if ov["open_tasks"].(float64) != 2 || ov["areas"].(float64) != 1 || ov["findings"].(float64) != 1 {
		t.Fatalf("overview %v", ov)
	}

	// papers: PDF, BibTeX, publish on Layerto -> public
	paper := e.ok("POST", "/api/research/papers", "rina", map[string]any{"area_id": aid, "title": "Photo-ID of Green Turtles with Scute Graphs",
		"authors": []string{"Rina Silva", "Ravi Perera"}, "venue": "Marine Biology Letters", "year": 2026, "status": "accepted"}, 201)
	pid := paper["id"].(string)
	mb := &multipartBody{}
	mw := multipart.NewWriter(&mb.buf)
	fw, _ := mw.CreateFormFile("file", "paper.pdf")
	_, _ = fw.Write([]byte("%PDF-1.4\n% test\n"))
	_ = mw.Close()
	mb.ctype = mw.FormDataContentType()
	if p := e.ok("POST", "/api/research/papers/"+pid+"/pdf", "rina", mb, 200); p["pdf_bytes"].(float64) == 0 {
		t.Fatalf("pdf not stored %v", p)
	}
	_, bib := e.do("GET", "/api/research/papers/"+pid+"/bibtex", "rina", nil, nil)
	if !strings.Contains(string(bib), "@article{silva2026photo") || !strings.Contains(string(bib), "Rina Silva and Ravi Perera") {
		t.Fatalf("bibtex %s", bib)
	}
	if code, _ := e.do("POST", "/api/research/papers/"+pid+"/publish", "rina", map[string]any{"on_layerto": true}, nil); code != 400 {
		t.Fatalf("publish without abstract: %d", code)
	}
	e.ok("PATCH", "/api/research/papers/"+pid, "rina", map[string]any{"abstract": strings.Repeat("We identify individual green turtles from photos. ", 3)}, 200)
	e.ok("POST", "/api/research/papers/"+pid+"/publish", "rina", map[string]any{"on_layerto": true}, 200)
	pubs := list(t, e, "/v1/public/papers?q=turtles", "")
	if len(pubs) != 1 || pubs[0]["has_pdf"] != true || pubs[0]["owner"] != "rina" {
		t.Fatalf("public papers %v", pubs)
	}

	// literature from BibTeX
	imp := e.ok("POST", "/api/research/literature/import", "rina", map[string]any{"area_id": aid, "bibtex": `@inproceedings{he2016deep,
  title={Deep Residual Learning for Image Recognition},
  author={He, Kaiming and Zhang, Xiangyu},
  booktitle={CVPR},
  year={2016}
}
@article{x, title = "Second paper", year = 2020}
`}, 200)
	if imp["added"].(float64) != 2 {
		t.Fatalf("bibtex import %v", imp)
	}
	refs := list(t, e, "/api/research/literature?area="+aid, "ravi")
	if len(refs) != 2 {
		t.Fatalf("refs %v", refs)
	}

	// training runs become experiments automatically, with an auto note comparing runs
	proj := e.ok("POST", "/api/studio/projects", "rina", map[string]any{"name": "Turtles", "team_id": tid, "area_id": aid}, 200)
	if list(t, e, "/api/studio/projects", "ravi")[0]["role"] != "editor" {
		t.Fatal("teammate can't see shared project")
	}
	ds := e.ok("POST", "/api/studio/datasets", "ravi", map[string]any{"name": "Shared", "classes": []string{"turtle"}, "project_id": proj["id"]}, 201)
	dsID := ds["id"].(string)
	uploadImages(t, e, "ravi", dsID, 10)
	_, _ = e.pool.Exec(ctx, `UPDATE dataset_images SET boxes = '[{"c":0,"x":1,"y":1,"w":10,"h":10}]', labeled = true WHERE dataset_id = $1`, dsID)
	if code, _ := e.do("GET", "/api/studio/datasets/"+dsID, "rob", nil, nil); code != 200 {
		t.Fatalf("viewer can't see shared dataset: %d", code)
	}
	if code, _ := e.do("POST", "/api/studio/datasets/"+dsID+"/images", "rob", &multipartBody{}, nil); code != 404 {
		t.Fatalf("viewer uploaded: %d", code)
	}
	runs := []float64{0.30, 0.36}
	for i, m := range runs {
		job := e.ok("POST", "/api/studio/training", "rina", map[string]any{"dataset_id": dsID, "name": fmt.Sprintf("run %d", i+1), "preset": "fast", "runner": "notebook",
			"augment": map[string]any{"flip": 0.5, "degrees": 10, "hsv": 1.2}}, 201)
		jid := job["job"].(map[string]any)["id"].(string)
		tok := job["notebook_token"].(string)
		code, raw := e.do("GET", "/v1/train/jobs/"+jid+"/spec", "", nil, map[string]string{"Authorization": "Bearer " + tok})
		if code != 200 || !strings.Contains(string(raw), `"degrees":10`) {
			t.Fatalf("spec %d %s", code, raw)
		}
		for ep := 1; ep <= 3; ep++ {
			e.do("POST", "/v1/train/jobs/"+jid+"/progress", "", map[string]any{"epoch": ep, "epochs": 60, "map50_95": m * float64(ep) / 3}, map[string]string{"Authorization": "Bearer " + tok})
		}
		mb := &multipartBody{}
		mw := multipart.NewWriter(&mb.buf)
		fw, _ := mw.CreateFormFile("weights", "best.pt")
		_, _ = fw.Write(make([]byte, 4096))
		_ = mw.WriteField("metrics", fmt.Sprintf(`{"map50_95":%v,"map50":0.6,"map75":0.3,"ar100":0.5,"size":"s","epochs":60}`, m))
		_ = mw.Close()
		mb.ctype = mw.FormDataContentType()
		if code, raw := e.do("POST", "/v1/train/jobs/"+jid+"/weights", "", mb, map[string]string{"Authorization": "Bearer " + tok}); code != 200 {
			t.Fatalf("weights %d %s", code, raw)
		}
	}
	exps := list(t, e, "/api/research/experiments?area="+aid, "ravi")
	if len(exps) != 2 || exps[0]["status"] != "done" || len(exps[0]["history"].([]any)) != 3 {
		t.Fatalf("experiments %v", exps)
	}
	if code, _ := e.do("PATCH", "/api/research/experiments/"+exps[0]["id"].(string), "rina", map[string]any{"metrics": map[string]any{"map50_95": 0.99}}, nil); code != 400 {
		t.Fatalf("edited recorded metrics: %d", code)
	}
	e.ok("PATCH", "/api/research/experiments/"+exps[0]["id"].(string), "rina", map[string]any{"conclusion": "Rotation helps."}, 200)
	notes := list(t, e, "/api/research/notes?area="+aid, "rina")
	found := false
	for _, n := range notes {
		if n["auto"] == true && strings.Contains(n["body"].(string), "+6.0 points mAP50-95") {
			found = true
		}
	}
	if !found {
		t.Fatalf("no comparison note: %v", notes)
	}
	act := list(t, e, "/api/activity?area="+aid, "rob")
	if len(act) < 3 {
		t.Fatalf("activity %v", act)
	}

	// fine-tune from an own model (any runner); someone else's published model only on Layerto GPUs
	ms := list(t, e, "/api/studio/models?project_id="+proj["id"].(string), "ravi")
	if len(ms) != 2 {
		t.Fatalf("project models %v", ms)
	}
	base := ms[0]["slug"].(string)
	job := e.ok("POST", "/api/studio/training", "rina", map[string]any{"dataset_id": dsID, "name": "finetune", "preset": "balanced", "runner": "notebook", "base_model": base}, 201)
	jj := job["job"].(map[string]any)
	if jj["params"].(map[string]any)["size"] != "s" {
		t.Fatalf("fine-tune kept size? %v", jj["params"])
	}
	code, raw := e.do("GET", "/v1/train/jobs/"+jj["id"].(string)+"/init.pt", "", nil, map[string]string{"Authorization": "Bearer " + job["notebook_token"].(string)})
	if code != 200 || len(raw) != 4096 {
		t.Fatalf("init weights %d %d", code, len(raw))
	}
	if code, raw := e.do("POST", "/api/studio/training", "ravi", map[string]any{"dataset_id": dsID, "name": "steal", "preset": "fast", "runner": "notebook", "base_model": base}, nil); code != 400 || !strings.Contains(string(raw), "base model not found") {
		t.Fatalf("fine-tune private model of someone else: %d %s", code, raw)
	}

	// GPU bundle hours are used before the balance and returned on cancel
	before := balance(t, e.pool, r1)
	e.ok("POST", "/api/studio/gpu-bundles", "rina", map[string]any{"id": "gpu10"}, 200)
	if balance(t, e.pool, r1) != before-12_000_000 {
		t.Fatalf("bundle not charged")
	}
	gj := e.ok("POST", "/api/studio/training", "rina", map[string]any{"dataset_id": dsID, "name": "gpu", "preset": "fast", "runner": "layerto"}, 201)
	gjob := gj["job"].(map[string]any)
	if gjob["charged_usd"] != "0.000000" || gjob["gpu_hours_used"].(float64) <= 0 || balance(t, e.pool, r1) != before-12_000_000 {
		t.Fatalf("gpu hours not used: %v", gjob)
	}
	e.ok("POST", "/api/studio/training/"+gjob["id"].(string)+"/cancel", "rina", nil, 200)
	plan := e.ok("GET", "/api/studio/plan", "rina", nil, 200)
	if plan["gpu_hours"].(float64) != 10 {
		t.Fatalf("gpu hours after refund %v", plan["gpu_hours"])
	}

	// portfolio site needs the add-on; then it is public at the subdomain
	if code, _ := e.do("PUT", "/api/research/portfolio", "rina", map[string]any{"subdomain": "rina", "enabled": true}, nil); code != http.StatusPaymentRequired {
		t.Fatalf("portfolio without add-on: %d", code)
	}
	e.ok("POST", "/api/studio/addons", "rina", map[string]any{"addon": "portfolio"}, 200)
	if code, _ := e.do("PUT", "/api/research/portfolio", "rina", map[string]any{"subdomain": "www", "enabled": true}, nil); code != 400 {
		t.Fatalf("reserved subdomain: %d", code)
	}
	e.ok("PUT", "/api/research/portfolio", "rina", map[string]any{"subdomain": "rina", "enabled": true, "about": "Marine CV", "sections": []string{"about", "papers"}}, 200)
	pf := e.ok("GET", "/v1/public/portfolio/rina", "", nil, 200)
	if len(pf["papers"].([]any)) != 1 || pf["about"] != "Marine CV" {
		t.Fatalf("portfolio %v", pf)
	}
	// research storage counts files; leaving the team removes access
	mb = &multipartBody{}
	mw = multipart.NewWriter(&mb.buf)
	fw, _ = mw.CreateFormFile("file", "results.csv")
	_, _ = fw.Write([]byte("epoch,map\n1,0.3\n"))
	_ = mw.WriteField("area_id", aid)
	_ = mw.Close()
	mb.ctype = mw.FormDataContentType()
	file := e.ok("POST", "/api/research/files", "ravi", mb, 201)
	if code, raw := e.do("GET", "/api/research/files/"+file["id"].(string), "rob", nil, nil); code != 200 || string(raw) != "epoch,map\n1,0.3\n" {
		t.Fatalf("teammate download %d %s", code, raw)
	}
	e.ok("DELETE", "/api/teams/"+tid+"/members/"+uid(r3), "rob", nil, 204)
	if code, _ := e.do("GET", "/api/research/files/"+file["id"].(string), "rob", nil, nil); code != 404 {
		t.Fatalf("ex-member still downloads: %d", code)
	}
	_ = billing.ErrInsufficientBalance
}

func TestHub_ImportModel(t *testing.T) {
	e := setupHub(t)
	u := newUser(t, e.pool, "imp@layerto.test", "ivan", 0)
	e.users["ivan"] = u
	mb := &multipartBody{}
	mw := multipart.NewWriter(&mb.buf)
	fw, _ := mw.CreateFormFile("weights", "best.pt")
	_, _ = fw.Write(append([]byte("PK"), make([]byte, 4096)...))
	_ = mw.WriteField("name", "My YOLO-free detector")
	_ = mw.WriteField("classes", `["car","bus"]`)
	_ = mw.WriteField("size", "m")
	_ = mw.WriteField("metrics", `{"map50_95":0.5,"latency_ms":12}`)
	_ = mw.Close()
	mb.ctype = mw.FormDataContentType()
	m := e.ok("POST", "/api/studio/models/import", "ivan", mb, 200)
	met := m["metrics"].(map[string]any)
	if m["source"] != "imported" || met["self_reported"] != true || met["latency_ms"].(float64) != 12 || m["size"] != "m" {
		t.Fatalf("imported %v", m)
	}
}
