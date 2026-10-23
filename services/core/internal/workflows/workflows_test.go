package workflows_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"layerto/services/core/internal/auth"
	"layerto/services/core/internal/db"
	"layerto/services/core/internal/gateway"
	"layerto/services/core/internal/httpx"
	"layerto/services/core/internal/keys"
	"layerto/services/core/internal/models"
	"layerto/services/core/internal/testhelper"
	"layerto/services/core/internal/workflows"
)

type mockModelClient struct {
	callCount int32
	failModel string
}

func (m *mockModelClient) RunSync(ctx context.Context, endpoint, modelSlug, imageBase64, prompt string, params map[string]any) (*models.WorkerResponse, error) {
	atomic.AddInt32(&m.callCount, 1)

	if m.failModel != "" && modelSlug == m.failModel {
		return nil, errors.New("simulated worker failure")
	}

	bbox := [4]int{10, 20, 30, 40}
	if modelSlug == "turtle-id" {
		return &models.WorkerResponse{
			ModelVersion: "2026.10.1",
			Predictions: []models.Prediction{
				{Label: "Chelonia mydas", Confidence: 0.95, BBox: &bbox},
				{Label: "Caretta caretta", Confidence: 0.40, BBox: &bbox},
			},
		}, nil
	}

	return &models.WorkerResponse{
		ModelVersion: "2026.10.1",
		Predictions: []models.Prediction{
			{Label: "Chelonia mydas", Confidence: 0.88, BBox: &bbox},
			{Label: "Dermochelys coriacea", Confidence: 0.30, BBox: &bbox},
		},
	}, nil
}

func createTestPNG(width, height int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for x := 0; x < width; x++ {
		for y := 0; y < height; y++ {
			img.Set(x, y, color.RGBA{R: 200, G: 100, B: 50, A: 255})
		}
	}
	var buf bytes.Buffer
	_ = png.Encode(&buf, img)
	return buf.Bytes()
}

func buildWorkflowDef(models []string, mode string, maxImages int, outputConfig map[string]any) map[string]any {
	nodes := []any{
		map[string]any{
			"id":       "input",
			"type":     "input",
			"position": map[string]any{"x": 0.0, "y": 0.0},
			"config": map[string]any{
				"mode":       mode,
				"max_images": maxImages,
			},
		},
	}

	edges := []any{}
	for i, m := range models {
		mID := fmt.Sprintf("m_%d", i+1)
		nodes = append(nodes, map[string]any{
			"id":       mID,
			"type":     "model",
			"position": map[string]any{"x": float64(100 * (i + 1)), "y": 100.0},
			"config": map[string]any{
				"model_slug":     m,
				"min_confidence": 0.0,
			},
		})
		edges = append(edges,
			map[string]any{"id": fmt.Sprintf("e_in_%d", i+1), "source": "input", "target": mID},
			map[string]any{"id": fmt.Sprintf("e_out_%d", i+1), "source": mID, "target": "output"},
		)
	}

	nodes = append(nodes, map[string]any{
		"id":       "output",
		"type":     "output",
		"position": map[string]any{"x": 500.0, "y": 100.0},
		"config":   outputConfig,
	})

	return map[string]any{
		"version": 1,
		"nodes":   nodes,
		"edges":   edges,
	}
}

func defaultOutputConfig() map[string]any {
	return map[string]any{
		"fields":          []string{"label", "confidence", "bbox", "model", "charge_usd"},
		"min_confidence":  0.0,
		"labels_include":  []string{},
		"top_k":           nil,
		"bbox_format":     "xywh",
		"group_by":        "image",
		"merge_models":    true,
		"include_summary": true,
		"format":          "json",
	}
}

func TestWorkflows_CRUD_Ownership_And_Conflict(t *testing.T) {
	pool := testhelper.GetTestPool(t)
	defer pool.Close()
	testhelper.ResetTestDB(t, pool)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	queries := db.New(pool)

	// Create User A
	userAID := httpx.NewUUIDv4()
	var userAUUID pgtype.UUID
	_ = userAUUID.Scan(userAID)
	userA, err := queries.CreateUser(ctx, db.CreateUserParams{
		ID:           userAUUID,
		Email:        "userA@layerto.test",
		PasswordHash: "hashA",
		Role:         "user",
		Status:       "active",
	})
	if err != nil {
		t.Fatalf("create user A error: %v", err)
	}

	// Create User B
	userBID := httpx.NewUUIDv4()
	var userBUUID pgtype.UUID
	_ = userBUUID.Scan(userBID)
	userB, err := queries.CreateUser(ctx, db.CreateUserParams{
		ID:           userBUUID,
		Email:        "userB@layerto.test",
		PasswordHash: "hashB",
		Role:         "user",
		Status:       "active",
	})
	if err != nil {
		t.Fatalf("create user B error: %v", err)
	}

	keyB, _, err := keys.Create(ctx, pool, userBID, "key-b", nil)
	if err != nil {
		t.Fatalf("create key B error: %v", err)
	}

	client := &mockModelClient{}
	gwHandler := gateway.NewHandler(pool, client)
	wfHandler := workflows.NewHandler(pool, gwHandler, nil)

	r := chi.NewRouter()
	r.Get("/api/workflows", wfHandler.HandleList)
	r.Post("/api/workflows", wfHandler.HandleCreate)
	r.Get("/api/workflows/{id}", wfHandler.HandleGet)
	r.Put("/api/workflows/{id}", wfHandler.HandleUpdate)
	r.Delete("/api/workflows/{id}", wfHandler.HandleDelete)
	r.Post("/api/workflows/validate", wfHandler.HandleValidate)
	r.Post("/v1/workflows/{id}/run", wfHandler.HandleRunAPI)

	// 1. User A creates a workflow
	def := buildWorkflowDef([]string{"turtle-id"}, "single", 1, defaultOutputConfig())
	defBytes, _ := json.Marshal(def)

	createBody, _ := json.Marshal(map[string]any{
		"name":        "Turtle Detector",
		"description": "Finds turtles in single images",
		"definition":  json.RawMessage(defBytes),
	})

	req := httptest.NewRequest(http.MethodPost, "/api/workflows", bytes.NewReader(createBody))
	req = req.WithContext(auth.WithUser(req.Context(), &userA))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", w.Code, w.Body.String())
	}

	var created workflows.WorkflowDetail
	if err := json.Unmarshal(w.Body.Bytes(), &created); err != nil {
		t.Fatalf("failed to decode created workflow: %v", err)
	}
	if created.Version != 1 || created.Name != "Turtle Detector" {
		t.Fatalf("unexpected created workflow: %+v", created)
	}
	wfID := created.ID

	// 2. Ownership checks: User B tries to access User A's workflow -> 404
	// GET User A's workflow as User B -> 404
	req = httptest.NewRequest(http.MethodGet, "/api/workflows/"+wfID, nil)
	req = req.WithContext(auth.WithUser(req.Context(), &userB))
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for User B GET, got %d: %s", w.Code, w.Body.String())
	}

	// PUT User A's workflow as User B -> 404
	updateBody, _ := json.Marshal(map[string]any{
		"name":        "Hacked Name",
		"description": "Desc",
		"definition":  json.RawMessage(defBytes),
		"version":     1,
	})
	req = httptest.NewRequest(http.MethodPut, "/api/workflows/"+wfID, bytes.NewReader(updateBody))
	req = req.WithContext(auth.WithUser(req.Context(), &userB))
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for User B PUT, got %d: %s", w.Code, w.Body.String())
	}

	// DELETE User A's workflow as User B -> 404
	req = httptest.NewRequest(http.MethodDelete, "/api/workflows/"+wfID, nil)
	req = req.WithContext(auth.WithUser(req.Context(), &userB))
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for User B DELETE, got %d: %s", w.Code, w.Body.String())
	}

	// API run with User B's key -> 404
	req = httptest.NewRequest(http.MethodPost, "/v1/workflows/"+wfID+"/run", nil)
	req.Header.Set("Authorization", "Bearer "+keyB)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for User B API run, got %d: %s", w.Code, w.Body.String())
	}

	// 3. Version conflict on update
	// User A updates workflow with version 1 -> success, version becomes 2
	updateBodyValid, _ := json.Marshal(map[string]any{
		"name":        "Turtle Detector Updated",
		"description": "Updated desc",
		"definition":  json.RawMessage(defBytes),
		"version":     1,
	})
	req = httptest.NewRequest(http.MethodPut, "/api/workflows/"+wfID, bytes.NewReader(updateBodyValid))
	req = req.WithContext(auth.WithUser(req.Context(), &userA))
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on update, got %d: %s", w.Code, w.Body.String())
	}

	var updated workflows.WorkflowDetail
	_ = json.Unmarshal(w.Body.Bytes(), &updated)
	if updated.Version != 2 {
		t.Fatalf("expected version 2, got %d", updated.Version)
	}

	// User A updates again with stale version 1 -> returns 409 version_conflict
	req = httptest.NewRequest(http.MethodPut, "/api/workflows/"+wfID, bytes.NewReader(updateBodyValid))
	req = req.WithContext(auth.WithUser(req.Context(), &userA))
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409 Conflict on stale version, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "version_conflict") {
		t.Fatalf("expected version_conflict code, got %s", w.Body.String())
	}

	// 4. Soft delete
	req = httptest.NewRequest(http.MethodDelete, "/api/workflows/"+wfID, nil)
	req = req.WithContext(auth.WithUser(req.Context(), &userA))
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 on delete, got %d: %s", w.Code, w.Body.String())
	}

	// Fetching deleted workflow -> 404
	req = httptest.NewRequest(http.MethodGet, "/api/workflows/"+wfID, nil)
	req = req.WithContext(auth.WithUser(req.Context(), &userA))
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 on deleted workflow, got %d: %s", w.Code, w.Body.String())
	}
}

func TestWorkflows_Run_InsufficientBalance(t *testing.T) {
	pool := testhelper.GetTestPool(t)
	defer pool.Close()
	testhelper.ResetTestDB(t, pool)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	queries := db.New(pool)

	// Create User with 0 balance and 50 free calls already used
	userID := httpx.NewUUIDv4()
	var userUUID pgtype.UUID
	_ = userUUID.Scan(userID)
	user, err := queries.CreateUser(ctx, db.CreateUserParams{
		ID:           userUUID,
		Email:        "broke@layerto.test",
		PasswordHash: "hash",
		Role:         "user",
		Status:       "active",
	})
	if err != nil {
		t.Fatalf("create user error: %v", err)
	}

	_ = queries.CreateBalance(ctx, db.CreateBalanceParams{
		UserID:   userUUID,
		Balance:  0,
		FreeUsed: 50,
	})

	def := buildWorkflowDef([]string{"turtle-id"}, "single", 1, defaultOutputConfig())
	defBytes, _ := json.Marshal(def)

	wfRow, err := queries.CreateWorkflow(ctx, db.CreateWorkflowParams{
		UserID:      userUUID,
		Name:        "Test WF",
		Description: "Desc",
		Definition:  defBytes,
	})
	if err != nil {
		t.Fatalf("create workflow error: %v", err)
	}
	wfID := fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", wfRow.ID.Bytes[0:4], wfRow.ID.Bytes[4:6], wfRow.ID.Bytes[6:8], wfRow.ID.Bytes[8:10], wfRow.ID.Bytes[10:16])

	// Count events before
	var eventsBefore int
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM events").Scan(&eventsBefore); err != nil {
		t.Fatalf("count events error: %v", err)
	}

	client := &mockModelClient{}
	gwHandler := gateway.NewHandler(pool, client)
	wfHandler := workflows.NewHandler(pool, gwHandler, nil)

	// Prepare multipart request with 1 image
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	part, _ := mw.CreateFormFile("images", "turtle.png")
	_, _ = part.Write(createTestPNG(100, 100))
	_ = mw.Close()

	r := chi.NewRouter()
	r.Post("/api/workflows/{id}/run", wfHandler.HandleRunDashboard)

	req := httptest.NewRequest(http.MethodPost, "/api/workflows/"+wfID+"/run", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req = req.WithContext(auth.WithUser(req.Context(), &user))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusPaymentRequired {
		t.Fatalf("expected 402 Payment Required, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "insufficient_balance") {
		t.Fatalf("expected insufficient_balance error code, got %s", w.Body.String())
	}

	// Model client was NOT called
	if client.callCount != 0 {
		t.Fatalf("expected 0 model calls, got %d", client.callCount)
	}

	// No events recorded
	var eventsAfter int
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM events").Scan(&eventsAfter); err != nil {
		t.Fatalf("count events after error: %v", err)
	}
	if eventsAfter != eventsBefore {
		t.Fatalf("expected no new events, had %d, now %d", eventsBefore, eventsAfter)
	}
}

func TestWorkflows_Run_Batch2ImagesX2Models(t *testing.T) {
	pool := testhelper.GetTestPool(t)
	defer pool.Close()
	testhelper.ResetTestDB(t, pool)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	queries := db.New(pool)

	userID := httpx.NewUUIDv4()
	var userUUID pgtype.UUID
	_ = userUUID.Scan(userID)
	user, err := queries.CreateUser(ctx, db.CreateUserParams{
		ID:           userUUID,
		Email:        "runner@layerto.test",
		PasswordHash: "hash",
		Role:         "user",
		Status:       "active",
	})
	_ = user
	if err != nil {
		t.Fatalf("create user error: %v", err)
	}

	// Give enough balance ($10 = 10,000,000 micro-USD)
	_ = queries.CreateBalance(ctx, db.CreateBalanceParams{
		UserID:   userUUID,
		Balance:  10000000,
		FreeUsed: 50, // force balance deduction
	})

	fullKey, _, err := keys.Create(ctx, pool, userID, "api-key", nil)
	if err != nil {
		t.Fatalf("create key error: %v", err)
	}

	// Workflow with 2 models: turtle-id (2000 micro) + bioclip (1000 micro) = 3000 micro per image
	// For 2 images, total cost = 2 * 3000 = 6000 micro-USD ($0.006000)
	def := buildWorkflowDef([]string{"turtle-id", "bioclip"}, "batch", 5, defaultOutputConfig())
	defBytes, _ := json.Marshal(def)

	wfRow, err := queries.CreateWorkflow(ctx, db.CreateWorkflowParams{
		UserID:      userUUID,
		Name:        "Batch Multi-Model",
		Description: "2 models",
		Definition:  defBytes,
	})
	if err != nil {
		t.Fatalf("create workflow error: %v", err)
	}
	wfID := fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", wfRow.ID.Bytes[0:4], wfRow.ID.Bytes[4:6], wfRow.ID.Bytes[6:8], wfRow.ID.Bytes[8:10], wfRow.ID.Bytes[10:16])

	client := &mockModelClient{}
	gwHandler := gateway.NewHandler(pool, client)
	wfHandler := workflows.NewHandler(pool, gwHandler, nil)

	r := chi.NewRouter()
	r.Post("/v1/workflows/{id}/run", wfHandler.HandleRunAPI)

	// Upload 2 images
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	p1, _ := mw.CreateFormFile("images", "img1.png")
	_, _ = p1.Write(createTestPNG(200, 150))
	p2, _ := mw.CreateFormFile("images", "img2.png")
	_, _ = p2.Write(createTestPNG(300, 200))
	_ = mw.Close()

	req := httptest.NewRequest(http.MethodPost, "/v1/workflows/"+wfID+"/run", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+fullKey)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}

	// 2 images * 2 models = 4 executed calls
	if client.callCount != 4 {
		t.Fatalf("expected 4 model calls, got %d", client.callCount)
	}

	var resp struct {
		WorkflowID     string `json:"workflow_id"`
		RunID          string `json:"run_id"`
		TotalChargeUSD string `json:"total_charge_usd"`
		Images         []struct {
			Index   int              `json:"index"`
			Width   int              `json:"width"`
			Height  int              `json:"height"`
			Results []map[string]any `json:"results"`
			Errors  []map[string]any `json:"errors"`
		} `json:"images"`
		Summary map[string]any `json:"summary"`
	}

	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode json error: %v", err)
	}

	if resp.TotalChargeUSD != "0.006000" {
		t.Fatalf("expected total charge '0.006000', got '%s'", resp.TotalChargeUSD)
	}
	if len(resp.Images) != 2 {
		t.Fatalf("expected 2 images, got %d", len(resp.Images))
	}
	if resp.Images[0].Width != 200 || resp.Images[0].Height != 150 {
		t.Fatalf("unexpected dimensions for image 0: %dx%d", resp.Images[0].Width, resp.Images[0].Height)
	}
	if resp.Images[1].Width != 300 || resp.Images[1].Height != 200 {
		t.Fatalf("unexpected dimensions for image 1: %dx%d", resp.Images[1].Width, resp.Images[1].Height)
	}

	// Each image ran 2 models: turtle-id (2 preds) + bioclip (2 preds) = 4 preds
	if len(resp.Images[0].Results) != 4 {
		t.Fatalf("expected 4 results in image 0, got %d", len(resp.Images[0].Results))
	}
	if resp.Summary == nil {
		t.Fatalf("expected summary object to be included")
	}
}

func TestWorkflows_Run_OneModelFailingRefunded(t *testing.T) {
	pool := testhelper.GetTestPool(t)
	defer pool.Close()
	testhelper.ResetTestDB(t, pool)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	queries := db.New(pool)

	userID := httpx.NewUUIDv4()
	var userUUID pgtype.UUID
	_ = userUUID.Scan(userID)
	user, _ := queries.CreateUser(ctx, db.CreateUserParams{
		ID:           userUUID,
		Email:        "failtest@layerto.test",
		PasswordHash: "hash",
		Role:         "user",
		Status:       "active",
	})
	_ = queries.CreateBalance(ctx, db.CreateBalanceParams{
		UserID:   userUUID,
		Balance:  10000000,
		FreeUsed: 50,
	})

	def := buildWorkflowDef([]string{"turtle-id", "bioclip"}, "single", 1, defaultOutputConfig())
	defBytes, _ := json.Marshal(def)

	wfRow, _ := queries.CreateWorkflow(ctx, db.CreateWorkflowParams{
		UserID:      userUUID,
		Name:        "Partial Failure WF",
		Description: "One model fails",
		Definition:  defBytes,
	})
	wfID := fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", wfRow.ID.Bytes[0:4], wfRow.ID.Bytes[4:6], wfRow.ID.Bytes[6:8], wfRow.ID.Bytes[8:10], wfRow.ID.Bytes[10:16])

	// turtle-id succeeds, bioclip fails
	client := &mockModelClient{failModel: "bioclip"}
	gwHandler := gateway.NewHandler(pool, client)
	wfHandler := workflows.NewHandler(pool, gwHandler, nil)

	r := chi.NewRouter()
	r.Post("/api/workflows/{id}/run", wfHandler.HandleRunDashboard)

	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	p, _ := mw.CreateFormFile("images", "one.png")
	_, _ = p.Write(createTestPNG(100, 100))
	_ = mw.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/workflows/"+wfID+"/run", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req = req.WithContext(auth.WithUser(req.Context(), &user))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK despite 1 model failing, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		TotalChargeUSD string `json:"total_charge_usd"`
		Images         []struct {
			Index   int                 `json:"index"`
			Results []map[string]any    `json:"results"`
			Errors  []map[string]string `json:"errors"`
		} `json:"images"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)

	// turtle-id was 2000 micro-USD ($0.002000); bioclip failed and was refunded -> charge is only turtle-id!
	if resp.TotalChargeUSD != "0.002000" {
		t.Fatalf("expected total charge '0.002000', got '%s'", resp.TotalChargeUSD)
	}

	if len(resp.Images) != 1 {
		t.Fatalf("expected 1 image, got %d", len(resp.Images))
	}
	if len(resp.Images[0].Errors) != 1 {
		t.Fatalf("expected 1 error reported, got %d", len(resp.Images[0].Errors))
	}
	if resp.Images[0].Errors[0]["model"] != "bioclip" || resp.Images[0].Errors[0]["code"] != "model_error" {
		t.Fatalf("unexpected error report: %+v", resp.Images[0].Errors)
	}

	// Successful model predictions still returned
	if len(resp.Images[0].Results) != 2 {
		t.Fatalf("expected 2 predictions from turtle-id, got %d", len(resp.Images[0].Results))
	}
}

// TestWorkflows_Run_ForEachLoopBillsEachCrop runs input → turtle-id → for each (conf ≥ 0.5) → bioclip
// through the API and checks every call is billed exactly once.
func TestWorkflows_Run_ForEachLoopBillsEachCrop(t *testing.T) {
	pool := testhelper.GetTestPool(t)
	defer pool.Close()
	testhelper.ResetTestDB(t, pool)
	ctx := context.Background()
	queries := db.New(pool)

	userID := httpx.NewUUIDv4()
	var userUUID pgtype.UUID
	_ = userUUID.Scan(userID)
	if _, err := queries.CreateUser(ctx, db.CreateUserParams{ID: userUUID, Email: "loop@layerto.test", PasswordHash: "h", Role: "user", Status: "active"}); err != nil {
		t.Fatal(err)
	}
	_ = queries.CreateBalance(ctx, db.CreateBalanceParams{UserID: userUUID, Balance: 1_000_000, FreeUsed: 50})
	fullKey, _, err := keys.Create(ctx, pool, userID, "k", nil)
	if err != nil {
		t.Fatal(err)
	}

	out := map[string]any{
		"fields": []string{"label", "step", "parent"}, "rename": map[string]string{}, "min_confidence": 0,
		"labels_include": []string{}, "labels_exclude": []string{}, "top_k": nil, "sort": "step",
		"confidence_format": "decimal", "decimals": 2, "bbox_format": "xywh", "layout": "flat",
		"include_summary": true, "include_errors": true, "include_image_info": false, "include_empty": true, "format": "json",
	}
	def := map[string]any{
		"version": 2,
		"nodes": []any{
			map[string]any{"id": "input", "type": "input", "position": map[string]any{"x": 0, "y": 0}, "config": map[string]any{"mode": "single", "max_images": 1}},
			map[string]any{"id": "det", "type": "model", "position": map[string]any{"x": 1, "y": 0}, "config": map[string]any{"model_slug": "turtle-id", "min_confidence": 0, "label": "Detect"}},
			map[string]any{"id": "each", "type": "for_each", "position": map[string]any{"x": 2, "y": 0}, "config": map[string]any{"labels": []string{}, "min_confidence": 0.5, "max_items": 5, "padding_pct": 10}},
			map[string]any{"id": "cls", "type": "model", "position": map[string]any{"x": 3, "y": 0}, "config": map[string]any{"model_slug": "bioclip", "min_confidence": 0, "label": "Classify"}},
			map[string]any{"id": "output", "type": "output", "position": map[string]any{"x": 4, "y": 0}, "config": out},
		},
		"edges": []any{
			map[string]any{"id": "e1", "source": "input", "target": "det"},
			map[string]any{"id": "e2", "source": "det", "target": "each"},
			map[string]any{"id": "e3", "source": "each", "target": "cls"},
			map[string]any{"id": "e4", "source": "cls", "target": "output"},
		},
	}
	defBytes, _ := json.Marshal(def)
	wfRow, err := queries.CreateWorkflow(ctx, db.CreateWorkflowParams{UserID: userUUID, Name: "Loop", Description: "", Definition: defBytes})
	if err != nil {
		t.Fatal(err)
	}
	wfID := fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", wfRow.ID.Bytes[0:4], wfRow.ID.Bytes[4:6], wfRow.ID.Bytes[6:8], wfRow.ID.Bytes[8:10], wfRow.ID.Bytes[10:16])

	client := &mockModelClient{}
	wfHandler := workflows.NewHandler(pool, gateway.NewHandler(pool, client), nil)
	r := chi.NewRouter()
	r.Post("/v1/workflows/{id}/run", wfHandler.HandleRunAPI)

	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	p, _ := mw.CreateFormFile("images", "x.png")
	_, _ = p.Write(createTestPNG(120, 120))
	_ = mw.Close()
	req := httptest.NewRequest(http.MethodPost, "/v1/workflows/"+wfID+"/run", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+fullKey)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("run: %d %s", w.Code, w.Body.String())
	}

	// turtle-id returns 2 detections (0.95 and 0.40); only one passes 0.5 → 1 crop → 1 bioclip call.
	if client.callCount != 2 {
		t.Fatalf("model calls = %d, want 2", client.callCount)
	}
	var resp struct {
		Results []map[string]any `json:"results"`
		Total   string           `json:"total_charge_usd"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Total != "0.003000" { // 2000 + 1000 micro-USD
		t.Fatalf("total = %s, want 0.003000", resp.Total)
	}
	if len(resp.Results) != 2 || resp.Results[0]["step"] != "Classify" {
		t.Fatalf("results = %v", resp.Results)
	}
	parent, _ := resp.Results[0]["parent"].(map[string]any)
	if parent["label"] != "Chelonia mydas" || parent["step"] != "Detect" {
		t.Fatalf("parent = %v", parent)
	}
	bal, _ := queries.GetBalance(ctx, userUUID)
	if bal.Balance != 1_000_000-3000 {
		t.Fatalf("balance = %d, want %d", bal.Balance, 1_000_000-3000)
	}
}
