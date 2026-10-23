package main_test

import (
	"bytes"
	"context"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"layerto/services/core/internal/admin"
	"layerto/services/core/internal/auth"
	"layerto/services/core/internal/db"
	"layerto/services/core/internal/gateway"
	"layerto/services/core/internal/httpx"
	"layerto/services/core/internal/keys"
	"layerto/services/core/internal/ledger"
	"layerto/services/core/internal/models"
	"layerto/services/core/internal/router"
	"layerto/services/core/internal/testhelper"
)

type acceptanceModelClient struct{}

func (m *acceptanceModelClient) RunSync(ctx context.Context, endpoint, modelSlug, imageBase64, prompt string, params map[string]any) (*models.WorkerResponse, error) {
	return &models.WorkerResponse{
		ModelVersion: "2026.10.1",
		Predictions: []models.Prediction{
			{Label: "Test Label", Confidence: 0.95},
		},
	}, nil
}

func createAcceptancePNG() []byte {
	img := image.NewRGBA(image.Rect(0, 0, 50, 50))
	for x := 0; x < 50; x++ {
		for y := 0; y < 50; y++ {
			img.Set(x, y, color.RGBA{R: 100, G: 200, B: 100, A: 255})
		}
	}
	var buf bytes.Buffer
	_ = png.Encode(&buf, img)
	return buf.Bytes()
}

func TestM4Acceptance(t *testing.T) {
	pool := testhelper.GetTestPool(t)
	defer pool.Close()
	testhelper.ResetTestDB(t, pool)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	queries := db.New(pool)

	// 1. Setup Admin user
	adminID := httpx.NewUUIDv4()
	var adminUUID pgtype.UUID
	_ = adminUUID.Scan(adminID)
	_, err := queries.CreateUser(ctx, db.CreateUserParams{
		ID:           adminUUID,
		Email:        "admin-m4@layerto.test",
		PasswordHash: "pass_hash",
		Role:         "admin",
		Status:       "active",
	})
	if err != nil {
		t.Fatalf("create admin error: %v", err)
	}

	rawAdminToken, _, err := auth.CreateSession(ctx, queries, adminUUID)
	if err != nil {
		t.Fatalf("create admin session error: %v", err)
	}

	// 2. Setup regular user with free calls
	userID := httpx.NewUUIDv4()
	var userUUID pgtype.UUID
	_ = userUUID.Scan(userID)
	_, err = queries.CreateUser(ctx, db.CreateUserParams{
		ID:           userUUID,
		Email:        "user-m4@layerto.test",
		PasswordHash: "pass_hash",
		Role:         "user",
		Status:       "active",
	})
	if err != nil {
		t.Fatalf("create user error: %v", err)
	}
	_ = queries.CreateBalance(ctx, db.CreateBalanceParams{
		UserID:   userUUID,
		Balance:  50000,
		FreeUsed: 0,
	})

	apiKey, _, err := keys.Create(ctx, pool, userID, "m4-api-key", nil)
	if err != nil {
		t.Fatalf("create api key error: %v", err)
	}

	// 3. Initialize in-memory router and handlers
	memRouter := router.NewMemoryRouter(pool)
	if err := memRouter.Reload(ctx); err != nil {
		t.Fatalf("router reload error: %v", err)
	}

	adminHandler := admin.NewHandler(pool, memRouter)
	client := &acceptanceModelClient{}
	gwHandler := gateway.NewHandler(pool, client, memRouter)

	// --- ACCEPTANCE ITEM 1: List Seeded Routes ---
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/admin/routes", nil)
	adminHandler.HandleListRoutes(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("list routes failed: %s", rec.Body.String())
	}
	var routes []admin.RouteItem
	_ = json.Unmarshal(rec.Body.Bytes(), &routes)
	t.Logf("Seeded routes count: %d", len(routes))
	hasTurtle := false
	hasSeaTurtle := false
	for _, rt := range routes {
		if rt.Keyword == "turtle" {
			hasTurtle = true
		}
		if rt.Keyword == "sea turtle" {
			hasSeaTurtle = true
		}
	}
	if !hasTurtle || !hasSeaTurtle {
		t.Fatalf("expected seeded 'turtle' and 'sea turtle' routes, found: %v", routes)
	}

	// --- ACCEPTANCE ITEM 2: Unique Constraint & Normalization on Create ---
	// "  SEA   TURTLE  " -> duplicate 409
	dupBody, _ := json.Marshal(map[string]any{
		"keyword":    "  SEA   TURTLE  ",
		"model_slug": "turtle-id",
	})
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/admin/routes", bytes.NewReader(dupBody))
	req = req.WithContext(auth.WithUser(req.Context(), &db.User{ID: adminUUID, Role: "admin"}))
	adminHandler.HandleCreateRoute(rec, req)
	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409 for duplicate keyword, got %d: %s", rec.Code, rec.Body.String())
	}
	t.Log("PASS: Duplicate keyword properly rejected with HTTP 409 Conflict")

	// Create Sinhala route "  කැස්බෑවා  "
	sinhalaBody, _ := json.Marshal(map[string]any{
		"keyword":    "  කැස්බෑවා  ",
		"model_slug": "turtle-id",
		"priority":   50,
	})
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/admin/routes", bytes.NewReader(sinhalaBody))
	req = req.WithContext(auth.WithUser(req.Context(), &db.User{ID: adminUUID, Role: "admin"}))
	adminHandler.HandleCreateRoute(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 for Sinhala route create, got %d: %s", rec.Code, rec.Body.String())
	}
	var createdRoute admin.RouteItem
	_ = json.Unmarshal(rec.Body.Bytes(), &createdRoute)
	if createdRoute.Keyword != "කැස්බෑවා" {
		t.Fatalf("expected normalized keyword 'කැස්බෑවා', got %q", createdRoute.Keyword)
	}
	t.Logf("PASS: Sinhala route created and normalized: %s -> %s", createdRoute.Keyword, createdRoute.ModelSlug)

	// Verify route.created in ledger
	var lastSeq int64
	var eventType string
	var payloadBytes []byte
	err = pool.QueryRow(ctx, "SELECT seq, type, payload FROM events WHERE type = 'route.created' ORDER BY seq DESC LIMIT 1").Scan(&lastSeq, &eventType, &payloadBytes)
	if err != nil {
		t.Fatalf("failed to query route.created event: %v", err)
	}
	var rcPayload map[string]any
	_ = json.Unmarshal(payloadBytes, &rcPayload)
	if rcPayload["keyword"] != "කැස්බෑවා" || rcPayload["model_slug"] != "turtle-id" {
		t.Fatalf("unexpected route.created payload: %v", rcPayload)
	}
	t.Logf("PASS: route.created event verified in ledger seq #%d", lastSeq)

	// --- ACCEPTANCE ITEM 3: Vision Auto Routing ---
	pngBytes := createAcceptancePNG()

	// 3a. Prompt "sea-turtle" -> matches "sea turtle" -> turtle-id
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	part, _ := mw.CreateFormFile("image", "test.png")
	_, _ = part.Write(pngBytes)
	_ = mw.WriteField("prompt", "a wild sea-turtle")
	_ = mw.Close()

	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/v1/vision/auto", &body)
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	gwHandler.HandleVisionAuto(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("auto routing 'sea-turtle' failed: %s", rec.Body.String())
	}
	var resp map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if resp["routed"] != "auto" || resp["model"] != "turtle-id" {
		t.Fatalf("expected auto route to 'turtle-id', got %v", resp)
	}
	t.Log("PASS: Prompt 'sea-turtle' correctly routed to 'turtle-id'")

	// 3b. Sinhala prompt "සාගර කැස්බෑවා" -> matches "කැස්බෑවා" -> turtle-id
	body.Reset()
	mw = multipart.NewWriter(&body)
	part, _ = mw.CreateFormFile("image", "test.png")
	_, _ = part.Write(pngBytes)
	_ = mw.WriteField("prompt", "සාගර කැස්බෑවා")
	_ = mw.Close()

	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/v1/vision/auto", &body)
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	gwHandler.HandleVisionAuto(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("auto routing Sinhala prompt failed: %s", rec.Body.String())
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if resp["routed"] != "auto" || resp["model"] != "turtle-id" {
		t.Fatalf("expected Sinhala auto route to 'turtle-id', got %v", resp)
	}
	t.Log("PASS: Sinhala prompt 'සාගර කැස්බෑවා' correctly routed to 'turtle-id'")

	// 3c. Prompt "turtleneck" does NOT match "turtle" -> falls back to bioclip
	body.Reset()
	mw = multipart.NewWriter(&body)
	part, _ = mw.CreateFormFile("image", "test.png")
	_, _ = part.Write(pngBytes)
	_ = mw.WriteField("prompt", "black turtleneck shirt")
	_ = mw.Close()

	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/v1/vision/auto", &body)
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	gwHandler.HandleVisionAuto(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("auto routing 'turtleneck' failed: %s", rec.Body.String())
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if resp["routed"] != "auto" || resp["model"] != "bioclip" {
		t.Fatalf("expected fallback to 'bioclip' for turtleneck, got %v", resp)
	}
	t.Log("PASS: Prompt 'turtleneck' does not match 'turtle', fell back to 'bioclip'")

	// --- ACCEPTANCE ITEM 4: Verify Raw Prompt Is NEVER In Ledger ---
	var receivedPayloadBytes []byte
	err = pool.QueryRow(ctx, "SELECT payload FROM events WHERE type = 'request.received' ORDER BY seq DESC LIMIT 1").Scan(&receivedPayloadBytes)
	if err != nil {
		t.Fatalf("query request.received error: %v", err)
	}
	var recvPayload map[string]any
	_ = json.Unmarshal(receivedPayloadBytes, &recvPayload)
	if _, exists := recvPayload["prompt"]; exists {
		t.Fatalf("SECURITY VIOLATION: raw prompt stored in ledger: %v", recvPayload)
	}
	if recvPayload["route"] != "auto" {
		t.Fatalf("expected payload route='auto', got %v", recvPayload["route"])
	}
	if recvPayload["matched_keyword"] != "fallback" {
		t.Fatalf("expected matched_keyword='fallback', got %v", recvPayload["matched_keyword"])
	}
	if recvPayload["prompt_chars"] != float64(len([]rune("black turtleneck shirt"))) {
		t.Fatalf("expected prompt_chars length, got %v", recvPayload["prompt_chars"])
	}
	t.Logf("PASS: Ledger payload confirmed safe: route=%v, matched_keyword=%v, prompt_chars=%v, raw prompt ABSENT",
		recvPayload["route"], recvPayload["matched_keyword"], recvPayload["prompt_chars"])

	// --- ACCEPTANCE ITEM 5: Prompt > 1000 Chars Rejected With 400 ---
	body.Reset()
	mw = multipart.NewWriter(&body)
	part, _ = mw.CreateFormFile("image", "test.png")
	_, _ = part.Write(pngBytes)
	_ = mw.WriteField("prompt", strings.Repeat("x", 1001))
	_ = mw.Close()

	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/v1/vision/auto", &body)
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	gwHandler.HandleVisionAuto(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for prompt > 1000 chars, got %d: %s", rec.Code, rec.Body.String())
	}
	t.Log("PASS: Prompts > 1000 characters rejected with HTTP 400 invalid_request")

	// --- ACCEPTANCE ITEM 6: Cryptographic Ledger Chain Integrity ---
	verifyResult, err := ledger.Verify(ctx, pool)
	if err != nil {
		t.Fatalf("ledger verify error: %v", err)
	}
	if !verifyResult.Ok {
		t.Fatalf("ledger verify FAILED: %v", verifyResult)
	}
	t.Logf("PASS: Cryptographic ledger verified: %d events intact, hash chain valid", verifyResult.Checked)

	_ = rawAdminToken
}
