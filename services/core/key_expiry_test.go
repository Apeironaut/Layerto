package main_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"layerto/services/core/internal/auth"
	"layerto/services/core/internal/db"
	"layerto/services/core/internal/gateway"
	"layerto/services/core/internal/httpx"
	"layerto/services/core/internal/keys"
	"layerto/services/core/internal/models"
	"layerto/services/core/internal/router"
	"layerto/services/core/internal/testhelper"
)

type expiryDummyModelClient struct{}

func (m *expiryDummyModelClient) RunSync(ctx context.Context, endpoint, modelSlug, imageBase64, prompt string, params map[string]any) (*models.WorkerResponse, error) {
	return &models.WorkerResponse{
		ModelVersion: "2026.10.1",
		Predictions: []models.Prediction{
			{Label: "Test", Confidence: 0.99},
		},
	}, nil
}

func setupKeyExpiryTestServer(t *testing.T) (*chi.Mux, *pgxpool.Pool, string, string) {
	t.Helper()
	pool := testhelper.GetTestPool(t)
	testhelper.ResetTestDB(t, pool)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	queries := db.New(pool)

	userID := httpx.NewUUIDv4()
	var userUUID pgtype.UUID
	_ = userUUID.Scan(userID)

	_, err := queries.CreateUser(ctx, db.CreateUserParams{
		ID:           userUUID,
		Email:        "user@expiry.test",
		PasswordHash: "dummyhash",
		Role:         "user",
		Status:       "active",
	})
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// Balance with free calls
	_ = queries.CreateBalance(ctx, db.CreateBalanceParams{
		UserID:   userUUID,
		Balance:  100000,
		FreeUsed: 0,
	})

	userSessionToken, _, err := auth.CreateSession(ctx, queries, userUUID)
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}

	memRouter := router.NewMemoryRouter(pool)
	_ = memRouter.Reload(ctx)
	gwHandler := gateway.NewHandler(pool, &expiryDummyModelClient{}, memRouter)
	keysHandler := keys.NewHandler(pool)

	r := chi.NewRouter()
	r.Use(httpx.RequestID)

	r.Post("/v1/vision/{model_slug}", func(w http.ResponseWriter, r *http.Request) {
		slug := chi.URLParam(r, "model_slug")
		gwHandler.HandleVisionDirect(w, r, slug)
	})

	r.Route("/api", func(api chi.Router) {
		api.Group(func(authed chi.Router) {
			authed.Use(auth.AuthenticateSession(pool))
			authed.Group(func(active chi.Router) {
				active.Use(auth.RequireActive)
				active.Use(auth.RequireRole("user"))

				active.Get("/keys", keysHandler.HandleListKeys)
				active.Post("/keys", keysHandler.HandleCreateKey)
			})
		})
	})

	return r, pool, userSessionToken, userID
}

func TestKeyExpiry_Validation(t *testing.T) {
	r, pool, sessionToken, _ := setupKeyExpiryTestServer(t)
	defer pool.Close()

	// 1. Create with past date -> 400 invalid_request
	pastExpiry := time.Now().UTC().Add(-2 * time.Hour).Format(time.RFC3339)
	body, _ := json.Marshal(map[string]any{
		"name":       "past-key",
		"expires_at": pastExpiry,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/keys", bytes.NewReader(body))
	req.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: sessionToken})
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for past expiry, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "invalid_request") {
		t.Fatalf("expected invalid_request code, got %s", rec.Body.String())
	}

	// 2. Create with expiry > 365 days -> 400 invalid_request
	tooFarExpiry := time.Now().UTC().Add(370 * 24 * time.Hour).Format(time.RFC3339)
	body, _ = json.Marshal(map[string]any{
		"name":       "far-key",
		"expires_at": tooFarExpiry,
	})
	req = httptest.NewRequest(http.MethodPost, "/api/keys", bytes.NewReader(body))
	req.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: sessionToken})
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for >365 days expiry, got %d: %s", rec.Code, rec.Body.String())
	}

	// 3. Create with null -> ok (201)
	body, _ = json.Marshal(map[string]any{
		"name":       "never-expires",
		"expires_at": nil,
	})
	req = httptest.NewRequest(http.MethodPost, "/api/keys", bytes.NewReader(body))
	req.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: sessionToken})
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 for null expiry, got %d: %s", rec.Code, rec.Body.String())
	}
	var createdNull keys.CreateKeyResponse
	if err := json.NewDecoder(rec.Body).Decode(&createdNull); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if createdNull.ExpiresAt != nil {
		t.Fatalf("expected null expires_at, got %v", *createdNull.ExpiresAt)
	}

	// 4. Create with future date (30 days) -> ok (201)
	futureExpiry := time.Now().UTC().Add(30 * 24 * time.Hour).Format(time.RFC3339)
	body, _ = json.Marshal(map[string]any{
		"name":       "future-key",
		"expires_at": futureExpiry,
	})
	req = httptest.NewRequest(http.MethodPost, "/api/keys", bytes.NewReader(body))
	req.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: sessionToken})
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 for future expiry, got %d: %s", rec.Code, rec.Body.String())
	}
	var createdFuture keys.CreateKeyResponse
	if err := json.NewDecoder(rec.Body).Decode(&createdFuture); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if createdFuture.ExpiresAt == nil {
		t.Fatalf("expected non-nil expires_at")
	}

	// 5. List keys returns expires_at for each key
	req = httptest.NewRequest(http.MethodGet, "/api/keys", nil)
	req.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: sessionToken})
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 listing keys, got %d", rec.Code)
	}
	var list []keys.KeySummary
	if err := json.NewDecoder(rec.Body).Decode(&list); err != nil {
		t.Fatalf("failed to decode list: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("expected 2 keys, got %d", len(list))
	}
}

func TestKeyExpiry_GatewayEnforcement(t *testing.T) {
	r, pool, _, userID := setupKeyExpiryTestServer(t)
	defer pool.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 1. Expired key directly created with past timestamp
	past := time.Now().UTC().Add(-1 * time.Hour)
	expiredKey, _, err := keys.Create(ctx, pool, userID, "expired-gw-key", &past)
	if err != nil {
		t.Fatalf("failed to create expired key: %v", err)
	}

	// 2. Future key directly created
	future := time.Now().UTC().Add(30 * 24 * time.Hour)
	futureKey, _, err := keys.Create(ctx, pool, userID, "future-gw-key", &future)
	if err != nil {
		t.Fatalf("failed to create future key: %v", err)
	}

	// 3. Call gateway with expired key -> 401 api_key_expired
	req := httptest.NewRequest(http.MethodPost, "/v1/vision/turtle-id", strings.NewReader("dummy"))
	req.Header.Set("Authorization", "Bearer "+expiredKey)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for expired key, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "api_key_expired") {
		t.Fatalf("expected api_key_expired error code, got %s", rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "This API key has expired.") {
		t.Fatalf("expected 'This API key has expired.' message, got %s", rec.Body.String())
	}

	// 4. Call gateway with future key -> not 401 api_key_expired
	req = httptest.NewRequest(http.MethodPost, "/v1/vision/turtle-id", strings.NewReader("dummy"))
	req.Header.Set("Authorization", "Bearer "+futureKey)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code == http.StatusUnauthorized && strings.Contains(rec.Body.String(), "api_key_expired") {
		t.Fatalf("future key must not be rejected as expired: %d %s", rec.Code, rec.Body.String())
	}
	// Future key verified successfully (fails at image parsing with 400 invalid_image, proving auth succeeded!)
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "invalid_image") {
		t.Fatalf("expected request to pass key verification and hit invalid_image, got %d: %s", rec.Code, rec.Body.String())
	}
}
