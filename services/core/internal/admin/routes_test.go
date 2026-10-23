package admin_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"layerto/services/core/internal/admin"
	"layerto/services/core/internal/auth"
	"layerto/services/core/internal/db"
	"layerto/services/core/internal/httpx"
	"layerto/services/core/internal/router"
	"layerto/services/core/internal/testhelper"
)

func setupAdminTestRouter(t *testing.T) (*chi.Mux, *router.MemoryRouter, string, string) {
	pool := testhelper.GetTestPool(t)
	testhelper.ResetTestDB(t, pool)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	queries := db.New(pool)

	// Create admin user
	adminID := httpx.NewUUIDv4()
	var adminUUID pgtype.UUID
	_ = adminUUID.Scan(adminID)

	_, err := queries.CreateUser(ctx, db.CreateUserParams{
		ID:           adminUUID,
		Email:        "admin-routes@layerto.test",
		PasswordHash: "admin_hash",
		Role:         "admin",
		Status:       "active",
	})
	if err != nil {
		t.Fatalf("create admin error: %v", err)
	}

	rawToken, _, err := auth.CreateSession(ctx, queries, adminUUID)
	if err != nil {
		t.Fatalf("create session error: %v", err)
	}

	memRouter := router.NewMemoryRouter(pool)
	if err := memRouter.Reload(ctx); err != nil {
		t.Fatalf("router reload error: %v", err)
	}

	adminHandler := admin.NewHandler(pool, memRouter)

	r := chi.NewRouter()
	r.Use(httpx.RequestID)
	r.Use(auth.CORS([]string{"http://localhost:5174"}))

	r.Route("/admin", func(adm chi.Router) {
		adm.Use(auth.AuthenticateSession(pool))
		adm.Use(auth.RequireRole("admin"))

		adm.Get("/routes", adminHandler.HandleListRoutes)
		adm.Post("/routes", adminHandler.HandleCreateRoute)
		adm.Delete("/routes/{id}", adminHandler.HandleDeleteRoute)
		adm.Patch("/models/{slug}", adminHandler.HandleUpdateModelPrice)
	})

	return r, memRouter, rawToken, adminID
}

func TestAdminRoutes_CRUDAndLedgerEvents(t *testing.T) {
	r, memRouter, sessionToken, adminID := setupAdminTestRouter(t)

	// 1. GET /admin/routes -> list seeded routes ("turtle", "sea turtle")
	req := httptest.NewRequest(http.MethodGet, "/admin/routes", nil)
	req.AddCookie(&http.Cookie{Name: "lt_session", Value: sessionToken})
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("list routes expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var routes []admin.RouteItem
	if err := json.NewDecoder(rec.Body).Decode(&routes); err != nil {
		t.Fatalf("decode routes error: %v", err)
	}
	if len(routes) < 2 {
		t.Fatalf("expected at least 2 seeded routes, got %d", len(routes))
	}

	// 2. Duplicate keyword returns 409 (Requirement 2)
	dupBody, _ := json.Marshal(map[string]any{
		"keyword":    "  SEA   TURTLE  ",
		"model_slug": "turtle-id",
		"priority":   100,
	})
	dupReq := httptest.NewRequest(http.MethodPost, "/admin/routes", bytes.NewReader(dupBody))
	dupReq.Header.Set("Content-Type", "application/json")
	dupReq.AddCookie(&http.Cookie{Name: "lt_session", Value: sessionToken})
	dupRec := httptest.NewRecorder()
	r.ServeHTTP(dupRec, dupReq)

	if dupRec.Code != http.StatusConflict {
		t.Fatalf("expected 409 conflict for duplicate keyword, got %d: %s", dupRec.Code, dupRec.Body.String())
	}

	// 3. Create route with Sinhala keyword "කැස්බෑවා"
	createBody, _ := json.Marshal(map[string]any{
		"keyword":    "  කැස්බෑවා  ",
		"model_slug": "turtle-id",
		"priority":   50,
	})
	createReq := httptest.NewRequest(http.MethodPost, "/admin/routes", bytes.NewReader(createBody))
	createReq.Header.Set("Content-Type", "application/json")
	createReq.AddCookie(&http.Cookie{Name: "lt_session", Value: sessionToken})
	createRec := httptest.NewRecorder()
	r.ServeHTTP(createRec, createReq)

	if createRec.Code != http.StatusCreated {
		t.Fatalf("expected 201 for route create, got %d: %s", createRec.Code, createRec.Body.String())
	}

	var createdRoute admin.RouteItem
	if err := json.NewDecoder(createRec.Body).Decode(&createdRoute); err != nil {
		t.Fatalf("decode created route error: %v", err)
	}
	if createdRoute.Keyword != "කැස්බෑවා" {
		t.Fatalf("expected normalized keyword 'කැස්බෑවා', got %q", createdRoute.Keyword)
	}

	// 4. Assert in-memory router was reloaded automatically (Requirement 6)
	ctx := context.Background()
	matchRes, err := memRouter.Route(ctx, "සාගර කැස්බෑවා")
	if err != nil {
		t.Fatalf("router route error: %v", err)
	}
	if matchRes.ModelSlug != "turtle-id" || matchRes.MatchedKeyword != "කැස්බෑවා" {
		t.Fatalf("expected router match to 'turtle-id', got %v", matchRes)
	}

	// 5. Verify ledger event route.created was emitted in the same transaction (Requirement 5)
	pool := testhelper.GetTestPool(t)
	var eventType string
	var payloadBytes []byte
	err = pool.QueryRow(ctx, "SELECT type, payload FROM events WHERE type = 'route.created' ORDER BY seq DESC LIMIT 1").Scan(&eventType, &payloadBytes)
	if err != nil {
		t.Fatalf("failed to query route.created event: %v", err)
	}
	var payload map[string]any
	_ = json.Unmarshal(payloadBytes, &payload)
	if payload["by_admin_id"] != adminID {
		t.Fatalf("expected by_admin_id %s, got %v", adminID, payload["by_admin_id"])
	}
	if payload["keyword"] != "කැස්බෑවා" {
		t.Fatalf("expected keyword 'කැස්බෑවා', got %v", payload["keyword"])
	}
	if payload["model_slug"] != "turtle-id" {
		t.Fatalf("expected model_slug 'turtle-id', got %v", payload["model_slug"])
	}

	// 6. DELETE /admin/routes/{id}
	delReq := httptest.NewRequest(http.MethodDelete, "/admin/routes/"+createdRoute.ID, nil)
	delReq.AddCookie(&http.Cookie{Name: "lt_session", Value: sessionToken})
	delRec := httptest.NewRecorder()
	r.ServeHTTP(delRec, delReq)

	if delRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for route delete, got %d: %s", delRec.Code, delRec.Body.String())
	}

	// 7. Verify ledger event route.deleted was emitted (Requirement 5)
	err = pool.QueryRow(ctx, "SELECT type, payload FROM events WHERE type = 'route.deleted' ORDER BY seq DESC LIMIT 1").Scan(&eventType, &payloadBytes)
	if err != nil {
		t.Fatalf("failed to query route.deleted event: %v", err)
	}
	_ = json.Unmarshal(payloadBytes, &payload)
	if payload["by_admin_id"] != adminID || payload["keyword"] != "කැස්බෑවා" || payload["model_slug"] != "turtle-id" {
		t.Fatalf("unexpected route.deleted payload: %v", payload)
	}

	// 8. In-memory router should no longer match "කැස්බෑවා"
	matchResAfter, err := memRouter.Route(ctx, "කැස්බෑවා")
	if err != nil {
		t.Fatalf("router route error: %v", err)
	}
	if matchResAfter.ModelSlug != "bioclip" || !matchResAfter.Fallback {
		t.Fatalf("expected fallback after deletion, got %v", matchResAfter)
	}

	// 9. Model disable reloads router cache (Requirement 6)
	disableBody, _ := json.Marshal(map[string]any{
		"enabled": false,
	})
	disReq := httptest.NewRequest(http.MethodPatch, "/admin/models/turtle-id", bytes.NewReader(disableBody))
	disReq.Header.Set("Content-Type", "application/json")
	disReq.AddCookie(&http.Cookie{Name: "lt_session", Value: sessionToken})
	disRec := httptest.NewRecorder()
	r.ServeHTTP(disRec, disReq)

	if disRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on model disable, got %d: %s", disRec.Code, disRec.Body.String())
	}

	// Verify model.disabled ledger event was emitted
	err = pool.QueryRow(ctx, "SELECT type, payload FROM events WHERE type = 'model.disabled' ORDER BY seq DESC LIMIT 1").Scan(&eventType, &payloadBytes)
	if err != nil {
		t.Fatalf("failed to query model.disabled event: %v", err)
	}
	_ = json.Unmarshal(payloadBytes, &payload)
	if payload["by_admin_id"] != adminID || payload["model_slug"] != "turtle-id" {
		t.Fatalf("unexpected model.disabled payload: %v", payload)
	}

	// Prompt "sea turtle" has a route, but turtle-id is disabled -> falls back to bioclip
	matchResDisabled, err := memRouter.Route(ctx, "sea turtle")
	if err != nil {
		t.Fatalf("router route error: %v", err)
	}
	if matchResDisabled.ModelSlug != "bioclip" || !matchResDisabled.Fallback {
		t.Fatalf("expected fallback to bioclip when turtle-id disabled, got %v", matchResDisabled)
	}

	// 10. Re-enable model and verify model.enabled ledger event
	enableBody, _ := json.Marshal(map[string]any{
		"enabled": true,
	})
	enReq := httptest.NewRequest(http.MethodPatch, "/admin/models/turtle-id", bytes.NewReader(enableBody))
	enReq.Header.Set("Content-Type", "application/json")
	enReq.AddCookie(&http.Cookie{Name: "lt_session", Value: sessionToken})
	enRec := httptest.NewRecorder()
	r.ServeHTTP(enRec, enReq)

	if enRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on model enable, got %d: %s", enRec.Code, enRec.Body.String())
	}

	err = pool.QueryRow(ctx, "SELECT type, payload FROM events WHERE type = 'model.enabled' ORDER BY seq DESC LIMIT 1").Scan(&eventType, &payloadBytes)
	if err != nil {
		t.Fatalf("failed to query model.enabled event: %v", err)
	}
	_ = json.Unmarshal(payloadBytes, &payload)
	if payload["by_admin_id"] != adminID || payload["model_slug"] != "turtle-id" {
		t.Fatalf("unexpected model.enabled payload: %v", payload)
	}
}
