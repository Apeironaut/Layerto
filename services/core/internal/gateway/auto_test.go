package gateway_test

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"layerto/services/core/internal/auth"
	"layerto/services/core/internal/db"
	"layerto/services/core/internal/gateway"
	"layerto/services/core/internal/httpx"
	"layerto/services/core/internal/keys"
	"layerto/services/core/internal/router"
	"layerto/services/core/internal/testhelper"
)

func setupAutoGateway(t *testing.T) (*gateway.Handler, *router.MemoryRouter, string, string) {
	pool := testhelper.GetTestPool(t)
	testhelper.ResetTestDB(t, pool)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Create user
	userID := httpx.NewUUIDv4()
	var userUUID pgtype.UUID
	_ = userUUID.Scan(userID)
	queries := db.New(pool)
	_, err := queries.CreateUser(ctx, db.CreateUserParams{
		ID:           userUUID,
		Email:        "auto-user@layerto.test",
		PasswordHash: "hash123",
		Role:         "user",
		Status:       "active",
	})
	if err != nil {
		t.Fatalf("create user error: %v", err)
	}

	_ = queries.CreateBalance(ctx, db.CreateBalanceParams{
		UserID:   userUUID,
		Balance:  100000,
		FreeUsed: 0,
	})

	// Create API key
	fullKey, _, err := keys.Create(ctx, pool, userID, "auto-test-key", nil)
	if err != nil {
		t.Fatalf("create api key error: %v", err)
	}

	// Create session for playground
	rawToken, _, err := auth.CreateSession(ctx, queries, userUUID)
	if err != nil {
		t.Fatalf("create session error: %v", err)
	}

	memRouter := router.NewMemoryRouter(pool)
	if err := memRouter.Reload(ctx); err != nil {
		t.Fatalf("reload router error: %v", err)
	}

	client := &mockModelClient{}
	handler := gateway.NewHandler(pool, client, memRouter)

	return handler, memRouter, fullKey, rawToken
}

func TestGateway_AutoRoutingEndpointsAndLedger(t *testing.T) {
	handler, memRouter, apiKey, sessionToken := setupAutoGateway(t)
	ctx := context.Background()

	pngBytes := createTestPNG(100, 100)

	// 1. Prompt "sea turtle" matches seeded route -> turtle-id
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	part, _ := mw.CreateFormFile("image", "test.png")
	_, _ = part.Write(pngBytes)
	_ = mw.WriteField("prompt", "a swimming sea-turtle")
	_ = mw.Close()

	req := httptest.NewRequest(http.MethodPost, "/v1/vision/auto", &body)
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	rec := httptest.NewRecorder()

	handler.HandleVisionAuto(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 from auto routing, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if resp["routed"] != "auto" {
		t.Fatalf("expected routed='auto', got %v", resp["routed"])
	}
	if resp["model"] != "turtle-id" {
		t.Fatalf("expected model='turtle-id', got %v", resp["model"])
	}

	// 2. Check Ledger payload (Requirement 3: Never store raw prompt; record route, resolved slug, matched_keyword, prompt_chars)
	pool := testhelper.GetTestPool(t)
	var payloadBytes []byte
	err := pool.QueryRow(ctx, "SELECT payload FROM events WHERE type = 'request.received' ORDER BY seq DESC LIMIT 1").Scan(&payloadBytes)
	if err != nil {
		t.Fatalf("failed to query request.received event: %v", err)
	}
	var ledgerPayload map[string]any
	_ = json.Unmarshal(payloadBytes, &ledgerPayload)

	if _, hasPrompt := ledgerPayload["prompt"]; hasPrompt {
		t.Fatalf("CRITICAL SECURITY ERROR: raw prompt found in ledger payload! %v", ledgerPayload)
	}
	if ledgerPayload["route"] != "auto" {
		t.Fatalf("expected payload route 'auto', got %v", ledgerPayload["route"])
	}
	if ledgerPayload["model_slug"] != "turtle-id" {
		t.Fatalf("expected payload model_slug 'turtle-id', got %v", ledgerPayload["model_slug"])
	}
	if ledgerPayload["matched_keyword"] != "sea turtle" {
		t.Fatalf("expected payload matched_keyword 'sea turtle', got %v", ledgerPayload["matched_keyword"])
	}
	expectedChars := float64(len([]rune("a swimming sea-turtle")))
	if ledgerPayload["prompt_chars"] != expectedChars {
		t.Fatalf("expected prompt_chars %v, got %v", expectedChars, ledgerPayload["prompt_chars"])
	}

	// 3. Prompt "turtleneck" does NOT match "turtle" -> falls back to bioclip
	body.Reset()
	mw = multipart.NewWriter(&body)
	part, _ = mw.CreateFormFile("image", "test.png")
	_, _ = part.Write(pngBytes)
	_ = mw.WriteField("prompt", "a turtleneck sweater")
	_ = mw.Close()

	req = httptest.NewRequest(http.MethodPost, "/v1/vision/auto", &body)
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	rec = httptest.NewRecorder()

	handler.HandleVisionAuto(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if resp["model"] != "bioclip" || resp["routed"] != "auto" {
		t.Fatalf("expected fallback to bioclip, got %v", resp)
	}

	// Verify ledger for fallback
	err = pool.QueryRow(ctx, "SELECT payload FROM events WHERE type = 'request.received' ORDER BY seq DESC LIMIT 1").Scan(&payloadBytes)
	if err != nil {
		t.Fatalf("failed to query event: %v", err)
	}
	_ = json.Unmarshal(payloadBytes, &ledgerPayload)
	if ledgerPayload["matched_keyword"] != "fallback" {
		t.Fatalf("expected matched_keyword 'fallback', got %v", ledgerPayload["matched_keyword"])
	}

	// 4. Sinhala prompt: "සාගර කැස්බෑවා" with keyword "කැස්බෑවා"
	// Insert route for "කැස්බෑවා" directly and reload
	var turtleUUID pgtype.UUID
	err = pool.QueryRow(ctx, "SELECT id FROM models WHERE slug = 'turtle-id'").Scan(&turtleUUID)
	if err != nil {
		t.Fatalf("query turtle-id id error: %v", err)
	}
	queries := db.New(pool)
	_, err = queries.CreateRoute(ctx, db.CreateRouteParams{
		Keyword:  "කැස්බෑවා",
		ModelID:  turtleUUID,
		Priority: 100,
	})
	if err != nil {
		t.Fatalf("create sinhala route error: %v", err)
	}
	if err := memRouter.Reload(ctx); err != nil {
		t.Fatalf("reload error: %v", err)
	}

	body.Reset()
	mw = multipart.NewWriter(&body)
	part, _ = mw.CreateFormFile("image", "test.png")
	_, _ = part.Write(pngBytes)
	_ = mw.WriteField("prompt", "සාගර කැස්බෑවා")
	_ = mw.Close()

	req = httptest.NewRequest(http.MethodPost, "/v1/vision/auto", &body)
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	rec = httptest.NewRecorder()

	handler.HandleVisionAuto(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for Sinhala prompt, got %d: %s", rec.Code, rec.Body.String())
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if resp["model"] != "turtle-id" || resp["routed"] != "auto" {
		t.Fatalf("expected Sinhala match to 'turtle-id', got %v", resp)
	}

	// 5. Prompt > 1000 characters -> 400 invalid_request (Requirement 4)
	longPrompt := strings.Repeat("a", 1001)
	body.Reset()
	mw = multipart.NewWriter(&body)
	part, _ = mw.CreateFormFile("image", "test.png")
	_, _ = part.Write(pngBytes)
	_ = mw.WriteField("prompt", longPrompt)
	_ = mw.Close()

	req = httptest.NewRequest(http.MethodPost, "/v1/vision/auto", &body)
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	rec = httptest.NewRecorder()

	handler.HandleVisionAuto(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 invalid_request for prompt > 1000 characters, got %d: %s", rec.Code, rec.Body.String())
	}
	var errResp map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &errResp)
	errObj, _ := errResp["error"].(map[string]any)
	if errObj["code"] != "invalid_request" {
		t.Fatalf("expected error code 'invalid_request', got %v", errObj["code"])
	}

	// 6. Playground auto routing: POST /api/playground/auto
	body.Reset()
	mw = multipart.NewWriter(&body)
	part, _ = mw.CreateFormFile("image", "test.png")
	_, _ = part.Write(pngBytes)
	_ = mw.WriteField("prompt", "sea turtle in water")
	_ = mw.Close()

	req = httptest.NewRequest(http.MethodPost, "/api/playground/auto", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.AddCookie(&http.Cookie{Name: "lt_session", Value: sessionToken})

	// Wrap with AuthenticateSession
	routerWithAuth := auth.AuthenticateSession(pool)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handler.HandlePlayground(w, r, "auto", nil)
	}))

	rec = httptest.NewRecorder()
	routerWithAuth.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 from playground auto routing, got %d: %s", rec.Code, rec.Body.String())
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if resp["routed"] != "auto" || resp["model"] != "turtle-id" {
		t.Fatalf("expected playground auto match to turtle-id, got %v", resp)
	}
}
