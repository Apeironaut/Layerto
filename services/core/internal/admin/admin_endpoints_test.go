package admin_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"layerto/services/core/internal/admin"
	"layerto/services/core/internal/auth"
	"layerto/services/core/internal/db"
	"layerto/services/core/internal/httpx"
	"layerto/services/core/internal/keys"
	"layerto/services/core/internal/ledger"
	"layerto/services/core/internal/router"
	"layerto/services/core/internal/testhelper"
)

func setupAdminEndpointsRouter(t *testing.T) (*chi.Mux, string, string, string) {
	t.Helper()
	pool := testhelper.GetTestPool(t)
	testhelper.ResetTestDB(t, pool)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	queries := db.New(pool)

	// Admin user
	adminID := httpx.NewUUIDv4()
	var adminUUID pgtype.UUID
	_ = adminUUID.Scan(adminID)
	_, err := queries.CreateUser(ctx, db.CreateUserParams{
		ID:           adminUUID,
		Email:        "admin-endpoints@layerto.test",
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

	// Regular user
	userID := httpx.NewUUIDv4()
	var userUUID pgtype.UUID
	_ = userUUID.Scan(userID)
	_, err = queries.CreateUser(ctx, db.CreateUserParams{
		ID:           userUUID,
		Email:        "user-endpoints@layerto.test",
		PasswordHash: "user_hash",
		Role:         "user",
		Status:       "active",
	})
	if err != nil {
		t.Fatalf("create user error: %v", err)
	}
	_ = queries.CreateBalance(ctx, db.CreateBalanceParams{
		UserID:   userUUID,
		Balance:  250000,
		FreeUsed: 5,
	})

	// Create an API key for the regular user
	_, _, err = keys.Create(ctx, pool, userID, "primary-key", nil)
	if err != nil {
		t.Fatalf("create key error: %v", err)
	}

	// Add ledger event for this user
	reqID := httpx.NewUUIDv4()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin tx error: %v", err)
	}
	_, err = ledger.Append(ctx, tx, ledger.EventInput{
		UserID:    &userID,
		RequestID: &reqID,
		Type:      "request.received",
		Payload: map[string]any{
			"model_slug": "turtle-id",
			"routed":     "direct",
		},
	})
	if err != nil {
		t.Fatalf("append request.received error: %v", err)
	}

	_, err = ledger.Append(ctx, tx, ledger.EventInput{
		UserID:    &userID,
		RequestID: &reqID,
		Type:      "request.executed",
		Payload: map[string]any{
			"model_slug": "turtle-id",
			"charge":     2000,
			"latency_ms": 150,
		},
	})
	if err != nil {
		t.Fatalf("append request.executed error: %v", err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatalf("commit tx error: %v", err)
	}

	memRouter := router.NewMemoryRouter(pool)
	_ = memRouter.Reload(ctx)
	handler := admin.NewHandler(pool, memRouter)

	r := chi.NewRouter()
	r.Use(httpx.RequestID)
	r.Route("/admin", func(adm chi.Router) {
		adm.Use(auth.AuthenticateSession(pool))
		adm.Use(auth.RequireRole("admin"))

		adm.Get("/stats", handler.HandleGetStats)
		adm.Get("/users", handler.HandleListUsers)
		adm.Get("/users/{id}", handler.HandleGetUser)
		adm.Get("/events", handler.HandleListEvents)
	})

	return r, rawToken, adminID, userID
}

func TestAdminStats_Endpoint(t *testing.T) {
	r, token, _, _ := setupAdminEndpointsRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/admin/stats", nil)
	req.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on /admin/stats, got %d: %s", rec.Code, rec.Body.String())
	}

	var stats admin.AdminStatsResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &stats); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if stats.Users.Active < 2 {
		t.Errorf("expected at least 2 active users, got %d", stats.Users.Active)
	}
	if stats.Models.Enabled < 1 {
		t.Errorf("expected at least 1 enabled model, got %d", stats.Models.Enabled)
	}
	if stats.Requests24h < 1 {
		t.Errorf("expected at least 1 request in 24h, got %d", stats.Requests24h)
	}
	if stats.Revenue30dMicroUSD < 2000 {
		t.Errorf("expected at least 2000 micro-usd revenue, got %d", stats.Revenue30dMicroUSD)
	}
	if stats.Revenue30dUSD != "0.002000" {
		t.Errorf("expected revenue_30d_usd '0.002000', got %q", stats.Revenue30dUSD)
	}
}

func TestAdminGetUser_Endpoint(t *testing.T) {
	r, token, _, userID := setupAdminEndpointsRouter(t)

	// 1. Success case
	req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/admin/users/%s", userID), nil)
	req.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on /admin/users/{id}, got %d: %s", rec.Code, rec.Body.String())
	}

	var u admin.AdminUserDetail
	if err := json.Unmarshal(rec.Body.Bytes(), &u); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if u.ID != userID {
		t.Errorf("expected ID %q, got %q", userID, u.ID)
	}
	if u.Email != "user-endpoints@layerto.test" {
		t.Errorf("expected email 'user-endpoints@layerto.test', got %q", u.Email)
	}
	if u.BalanceUSD != "0.250000" {
		t.Errorf("expected balance_usd '0.250000', got %q", u.BalanceUSD)
	}
	if u.FreeCallsUsed != 5 {
		t.Errorf("expected free_calls_used 5, got %d", u.FreeCallsUsed)
	}
	if len(u.Keys) != 1 || u.Keys[0].Prefix == "" {
		t.Errorf("expected the user's key in keys, got %+v", u.Keys)
	}
	if strings.Contains(rec.Body.String(), "key_hash") {
		t.Errorf("admin user detail must not expose key hashes")
	}
	if u.ActiveKeys != 1 {
		t.Errorf("expected 1 active key, got %d", u.ActiveKeys)
	}
	if u.Requests30d != 1 {
		t.Errorf("expected 1 request in 30d, got %d", u.Requests30d)
	}
	if u.Spend30dUSD != "0.002000" {
		t.Errorf("expected spend_30d_usd '0.002000', got %q", u.Spend30dUSD)
	}

	// 2. Non-existent UUID → 404
	fakeUUID := httpx.NewUUIDv4()
	req404 := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/admin/users/%s", fakeUUID), nil)
	req404.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})
	rec404 := httptest.NewRecorder()
	r.ServeHTTP(rec404, req404)

	if rec404.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for unknown user, got %d", rec404.Code)
	}

	// 3. Invalid UUID format → 404
	reqBad := httptest.NewRequest(http.MethodGet, "/admin/users/not-a-uuid", nil)
	reqBad.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})
	recBad := httptest.NewRecorder()
	r.ServeHTTP(recBad, reqBad)

	if recBad.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for invalid uuid, got %d", recBad.Code)
	}
}

func TestAdminEvents_Endpoint(t *testing.T) {
	r, token, _, _ := setupAdminEndpointsRouter(t)

	// 1. Fetch all events
	req := httptest.NewRequest(http.MethodGet, "/admin/events", nil)
	req.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 on /admin/events, got %d: %s", rec.Code, rec.Body.String())
	}

	var events []admin.AdminEventItem
	if err := json.Unmarshal(rec.Body.Bytes(), &events); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if len(events) == 0 {
		t.Fatalf("expected at least one event")
	}

	// Verify fields and that no raw payload hashes/secrets leaked
	foundRequestExecuted := false
	for _, ev := range events {
		if ev.Seq <= 0 {
			t.Errorf("invalid seq: %d", ev.Seq)
		}
		if ev.Type == "" {
			t.Errorf("missing type")
		}
		if ev.CreatedAt == "" {
			t.Errorf("missing created_at")
		}
		if ev.Type == "request.executed" {
			foundRequestExecuted = true
			if ev.ModelSlug != "turtle-id" {
				t.Errorf("expected model_slug 'turtle-id', got %q", ev.ModelSlug)
			}
			if ev.UserEmail != "user-endpoints@layerto.test" {
				t.Errorf("expected user_email 'user-endpoints@layerto.test', got %q", ev.UserEmail)
			}
		}
	}
	if !foundRequestExecuted {
		t.Errorf("expected to find request.executed event")
	}

	// 2. Type filter
	reqFilter := httptest.NewRequest(http.MethodGet, "/admin/events?type=request.executed", nil)
	reqFilter.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})
	recFilter := httptest.NewRecorder()
	r.ServeHTTP(recFilter, reqFilter)

	if recFilter.Code != http.StatusOK {
		t.Fatalf("expected 200 with type filter, got %d", recFilter.Code)
	}
	var filtered []admin.AdminEventItem
	_ = json.Unmarshal(recFilter.Body.Bytes(), &filtered)
	for _, ev := range filtered {
		if ev.Type != "request.executed" {
			t.Errorf("expected only request.executed, got %q", ev.Type)
		}
	}

	// 3. Limit and pagination
	reqLimit := httptest.NewRequest(http.MethodGet, "/admin/events?limit=1", nil)
	reqLimit.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})
	recLimit := httptest.NewRecorder()
	r.ServeHTTP(recLimit, reqLimit)

	var limited []admin.AdminEventItem
	_ = json.Unmarshal(recLimit.Body.Bytes(), &limited)
	if len(limited) != 1 {
		t.Errorf("expected 1 event with limit=1, got %d", len(limited))
	}

	// Paginate before_seq
	beforeSeq := limited[0].Seq
	reqBefore := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/admin/events?before_seq=%d", beforeSeq), nil)
	reqBefore.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})
	recBefore := httptest.NewRecorder()
	r.ServeHTTP(recBefore, reqBefore)

	var paginated []admin.AdminEventItem
	_ = json.Unmarshal(recBefore.Body.Bytes(), &paginated)
	for _, ev := range paginated {
		if ev.Seq >= beforeSeq {
			t.Errorf("expected seq < %d, got %d", beforeSeq, ev.Seq)
		}
	}
}
