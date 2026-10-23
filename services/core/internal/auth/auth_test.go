package auth_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"layerto/services/core/internal/admin"
	"layerto/services/core/internal/auth"
	"layerto/services/core/internal/db"
	"layerto/services/core/internal/httpx"
	"layerto/services/core/internal/keys"
	"layerto/services/core/internal/testhelper"
)

func setupTestApp(t *testing.T) (*chi.Mux, *auth.Handler, *admin.Handler, *auth.LoginRateLimiter, *db.Queries) {
	t.Helper()
	pool := testhelper.GetTestPool(t)
	testhelper.ResetTestDB(t, pool)

	queries := db.New(pool)
	rl := auth.NewLoginRateLimiter()
	authHandler := auth.NewHandler(pool, rl)
	adminHandler := admin.NewHandler(pool)
	allowedOrigins := []string{"http://localhost:5173", "http://localhost:5174", "http://localhost:5175"}

	r := chi.NewRouter()
	r.Use(httpx.RequestID)
	r.Use(auth.CORS(allowedOrigins))

	// Auth routes
	r.Route("/api/auth", func(r chi.Router) {
		r.Use(auth.CSRF(allowedOrigins))
		r.Post("/signup", authHandler.HandleSignup)
		r.Post("/login", authHandler.HandleLogin)
		r.Post("/logout", authHandler.HandleLogout)
	})

	// Protected user route
	r.Group(func(r chi.Router) {
		r.Use(auth.AuthenticateSession(pool))
		r.Get("/api/me", authHandler.HandleMe)

		r.Group(func(r chi.Router) {
			r.Use(auth.RequireActive)
			r.Get("/api/active-only", func(w http.ResponseWriter, r *http.Request) {
				httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
			})
		})
	})

	// Admin routes
	r.Route("/admin", func(r chi.Router) {
		r.Use(auth.AuthenticateSession(pool))
		r.Use(auth.RequireRole("admin"))
		r.Get("/users", adminHandler.HandleListUsers)
		r.Group(func(r chi.Router) {
			r.Use(auth.CSRF(allowedOrigins))
			r.Post("/users/{id}/approve", adminHandler.HandleApproveUser)
			r.Post("/users/{id}/suspend", adminHandler.HandleSuspendUser)
		})
	})

	return r, authHandler, adminHandler, rl, queries
}

// TestRequirement2_DummyHashExecutionOnUnknownEmail verifies that logging in with an unknown email
// executes an argon2id verification against DummyHash so response time matches wrong-password.
func TestRequirement2_DummyHashExecutionOnUnknownEmail(t *testing.T) {
	r, _, _, _, _ := setupTestApp(t)

	initialCount := atomic.LoadInt64(&auth.DummyHashRunCount)

	body, _ := json.Marshal(map[string]string{
		"email":    "nonexistent@layerto.test",
		"password": "wrongpassword123",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "http://localhost:5174")
	req.Header.Set("X-Requested-With", "XMLHttpRequest")

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401 unauthorized, got %d (body: %s)", rec.Code, rec.Body.String())
	}

	finalCount := atomic.LoadInt64(&auth.DummyHashRunCount)
	if finalCount <= initialCount {
		t.Fatalf("expected DummyHashRunCount to increment, was %d now %d", initialCount, finalCount)
	}
}

// TestRequirement3_DuplicateEmailSignupReturns201AndCreatesNothing verifies that signing up with an
// already-registered email returns the identical 201 "account pending approval" response and creates nothing.
func TestRequirement3_DuplicateEmailSignupReturns201AndCreatesNothing(t *testing.T) {
	r, _, _, _, queries := setupTestApp(t)

	ctx := context.Background()

	// 1. Initial signup
	body, _ := json.Marshal(map[string]string{
		"email":      "alice@layerto.test",
		"password":   "secure#password123",
		"first_name": "Alice",
		"last_name":  "Silva",
		"username":   "alice",
	})
	req1 := httptest.NewRequest(http.MethodPost, "/api/auth/signup", bytes.NewReader(body))
	req1.Header.Set("Content-Type", "application/json")
	req1.Header.Set("Origin", "http://localhost:5174")
	req1.Header.Set("X-Requested-With", "XMLHttpRequest")

	rec1 := httptest.NewRecorder()
	r.ServeHTTP(rec1, req1)

	if rec1.Code != http.StatusCreated {
		t.Fatalf("expected initial signup 201, got %d: %s", rec1.Code, rec1.Body.String())
	}

	userBefore, err := queries.GetUserByEmail(ctx, "alice@layerto.test")
	if err != nil {
		t.Fatalf("expected user to exist in db: %v", err)
	}

	// 2. Duplicate signup with same email and different password
	dupBody, _ := json.Marshal(map[string]string{
		"email":      "alice@layerto.test",
		"password":   "different#password456",
		"first_name": "Alice",
		"last_name":  "Imposter",
		"username":   "alice_imposter",
	})
	req2 := httptest.NewRequest(http.MethodPost, "/api/auth/signup", bytes.NewReader(dupBody))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("Origin", "http://localhost:5174")
	req2.Header.Set("X-Requested-With", "XMLHttpRequest")

	rec2 := httptest.NewRecorder()
	r.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusCreated {
		t.Fatalf("expected duplicate signup 201, got %d: %s", rec2.Code, rec2.Body.String())
	}

	// Assert response body matches
	if rec1.Body.String() != rec2.Body.String() {
		t.Fatalf("expected duplicate signup response to match original.\nOrig: %s\nDup:  %s",
			rec1.Body.String(), rec2.Body.String())
	}

	// Assert database user was NOT altered or duplicated
	userAfter, err := queries.GetUserByEmail(ctx, "alice@layerto.test")
	if err != nil {
		t.Fatalf("expected user to still exist: %v", err)
	}
	if userBefore.PasswordHash != userAfter.PasswordHash {
		t.Fatalf("password hash was modified during duplicate signup!")
	}
	if userBefore.Name.String != userAfter.Name.String {
		t.Fatalf("user name was modified during duplicate signup!")
	}
}

// TestRequirement4_SessionsStoreSha256TokenOnly verifies that the cookie contains the random token,
// while the database sessions table stores only sha256(token).
func TestRequirement4_SessionsStoreSha256TokenOnly(t *testing.T) {
	r, _, _, _, queries := setupTestApp(t)
	ctx := context.Background()

	// 1. Sign up user
	body, _ := json.Marshal(map[string]string{
		"email":      "bob@layerto.test",
		"password":   "b0b-secret-pw",
		"first_name": "Bob",
		"last_name":  "Perera",
		"username":   "bobp",
	})
	reqSignup := httptest.NewRequest(http.MethodPost, "/api/auth/signup", bytes.NewReader(body))
	reqSignup.Header.Set("Content-Type", "application/json")
	reqSignup.Header.Set("Origin", "http://localhost:5174")
	reqSignup.Header.Set("X-Requested-With", "XMLHttpRequest")
	recSignup := httptest.NewRecorder()
	r.ServeHTTP(recSignup, reqSignup)
	if recSignup.Code != http.StatusCreated {
		t.Fatalf("signup failed: %d", recSignup.Code)
	}

	// 2. Login user
	loginBody, _ := json.Marshal(map[string]string{
		"email":    "bob@layerto.test",
		"password": "b0b-secret-pw",
	})
	reqLogin := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(loginBody))
	reqLogin.Header.Set("Content-Type", "application/json")
	reqLogin.Header.Set("Origin", "http://localhost:5174")
	reqLogin.Header.Set("X-Requested-With", "XMLHttpRequest")
	recLogin := httptest.NewRecorder()
	r.ServeHTTP(recLogin, reqLogin)
	if recLogin.Code != http.StatusOK {
		t.Fatalf("login failed: %d: %s", recLogin.Code, recLogin.Body.String())
	}

	// Check cookie
	cookies := recLogin.Result().Cookies()
	var sessionCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == auth.SessionCookieName {
			sessionCookie = c
			break
		}
	}
	if sessionCookie == nil || sessionCookie.Value == "" {
		t.Fatalf("expected lt_session cookie in login response")
	}

	rawToken := sessionCookie.Value
	tokenHash := auth.HashToken(rawToken)

	// Assert DB does NOT have rawToken
	_, err := queries.GetSessionByID(ctx, rawToken)
	if !errorsIsNoRows(err) {
		t.Fatalf("raw token was found in DB! Expected ErrNoRows, got %v", err)
	}

	// Assert DB DOES have tokenHash
	session, err := queries.GetSessionByID(ctx, tokenHash)
	if err != nil {
		t.Fatalf("failed to find session by sha256 hash in DB: %v", err)
	}
	if session.ID != tokenHash {
		t.Fatalf("expected session ID %s, got %s", tokenHash, session.ID)
	}
}

// TestRequirement5_RateLimiting verifies 5 failures per (IP, email) and 30 failures per IP.
func TestRequirement5_RateLimiting(t *testing.T) {
	r, _, _, rl, _ := setupTestApp(t)

	ip := "192.168.1.100"
	targetEmail := "victim@layerto.test"

	// 5 failed attempts for targetEmail
	for i := 0; i < 5; i++ {
		if !rl.Allow(ip, targetEmail) {
			t.Fatalf("expected attempt %d to be allowed", i+1)
		}
		body, _ := json.Marshal(map[string]string{
			"email":    targetEmail,
			"password": "wrongpassword123",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
		req.RemoteAddr = ip + ":12345"
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", "http://localhost:5174")
		req.Header.Set("X-Requested-With", "XMLHttpRequest")
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("attempt %d expected 401, got %d", i+1, rec.Code)
		}
	}

	// 6th attempt for targetEmail should be rate-limited (HTTP 429)
	body, _ := json.Marshal(map[string]string{
		"email":    targetEmail,
		"password": "wrongpassword123",
	})
	req6 := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	req6.RemoteAddr = ip + ":12345"
	req6.Header.Set("Content-Type", "application/json")
	req6.Header.Set("Origin", "http://localhost:5174")
	req6.Header.Set("X-Requested-With", "XMLHttpRequest")
	rec6 := httptest.NewRecorder()
	r.ServeHTTP(rec6, req6)
	if rec6.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 rate_limited, got %d: %s", rec6.Code, rec6.Body.String())
	}

	// A different email from the same IP should still be allowed until IP hits 30 failures
	anotherEmail := "other@layerto.test"
	reqOther := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	reqOther.RemoteAddr = ip + ":12345"
	reqOther.Header.Set("Content-Type", "application/json")
	reqOther.Header.Set("Origin", "http://localhost:5174")
	reqOther.Header.Set("X-Requested-With", "XMLHttpRequest")
	if !rl.Allow(ip, anotherEmail) {
		t.Fatalf("expected another email to be allowed under IP limit of 30")
	}

	// Now fail 25 more times across various emails from the same IP to hit 30 total IP failures
	for i := 0; i < 25; i++ {
		email := fmt.Sprintf("random%d@layerto.test", i)
		rl.RecordFailure(ip, email)
	}

	// 31st failure from that IP should be rejected even with a brand new email
	if rl.Allow(ip, "fresh@layerto.test") {
		t.Fatalf("expected IP rate limit of 30 to trigger and block fresh email")
	}
}

// TestCSRF_Protection verifies rejection of mutating requests without X-Requested-With or invalid Origin.
func TestCSRF_Protection(t *testing.T) {
	r, _, _, _, _ := setupTestApp(t)

	body, _ := json.Marshal(map[string]string{
		"email":    "test@layerto.test",
		"password": "password123",
	})

	// Missing X-Requested-With
	req1 := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	req1.Header.Set("Content-Type", "application/json")
	req1.Header.Set("Origin", "http://localhost:5174")
	rec1 := httptest.NewRecorder()
	r.ServeHTTP(rec1, req1)
	if rec1.Code != http.StatusForbidden {
		t.Fatalf("expected 403 on missing X-Requested-With, got %d", rec1.Code)
	}

	// Invalid Origin
	req2 := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("Origin", "http://evil-attacker.com")
	req2.Header.Set("X-Requested-With", "XMLHttpRequest")
	rec2 := httptest.NewRecorder()
	r.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusForbidden {
		t.Fatalf("expected 403 on untrusted Origin, got %d", rec2.Code)
	}
}

// TestRequirement8_ApproveAndSuspendInSingleTransactionWithLedgerEvents verifies:
// 1. Pending user cannot access active endpoints.
// 2. Admin approves user from pending in single tx with user.approved event.
// 3. User can now access active endpoints.
// 4. Admin suspends user from any state in single tx with user.suspended event and revokes sessions.
// 5. Suspended user's session is rejected with 403.
func TestRequirement8_ApproveAndSuspendInSingleTransactionWithLedgerEvents(t *testing.T) {
	r, _, _, _, queries := setupTestApp(t)
	pool := testhelper.GetTestPool(t)
	ctx := context.Background()

	// 1. Create admin user
	adminPasswordHash, _ := auth.HashPassword("adminpassword123")
	adminUUID := httpx.NewUUIDv4()
	var adminPgUUID pgtype.UUID
	_ = adminPgUUID.Scan(adminUUID)
	_, err := queries.CreateUser(ctx, db.CreateUserParams{
		ID:           adminPgUUID,
		Email:        "admin@layerto.test",
		PasswordHash: adminPasswordHash,
		Role:         "admin",
		Status:       "active",
	})
	if err != nil {
		t.Fatalf("failed to create admin: %v", err)
	}

	adminToken, _, err := auth.CreateSession(ctx, queries, adminPgUUID)
	if err != nil {
		t.Fatalf("failed to create admin session: %v", err)
	}

	// 2. Signup regular user (status = pending)
	body, _ := json.Marshal(map[string]string{
		"email":      "user@layerto.test",
		"password":   "regular#pass123",
		"first_name": "Regular",
		"last_name":  "User",
		"username":   "regular_user",
	})
	reqSignup := httptest.NewRequest(http.MethodPost, "/api/auth/signup", bytes.NewReader(body))
	reqSignup.Header.Set("Content-Type", "application/json")
	reqSignup.Header.Set("Origin", "http://localhost:5174")
	reqSignup.Header.Set("X-Requested-With", "XMLHttpRequest")
	recSignup := httptest.NewRecorder()
	r.ServeHTTP(recSignup, reqSignup)
	if recSignup.Code != http.StatusCreated {
		t.Fatalf("signup failed: %d", recSignup.Code)
	}

	user, err := queries.GetUserByEmail(ctx, "user@layerto.test")
	if err != nil {
		t.Fatalf("user not found: %v", err)
	}
	userIDStr := fmtUUID(user.ID)

	// Login regular user while pending
	loginBody, _ := json.Marshal(map[string]string{
		"email":    "user@layerto.test",
		"password": "regular#pass123",
	})
	reqLogin := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(loginBody))
	reqLogin.Header.Set("Content-Type", "application/json")
	reqLogin.Header.Set("Origin", "http://localhost:5174")
	reqLogin.Header.Set("X-Requested-With", "XMLHttpRequest")
	recLogin := httptest.NewRecorder()
	r.ServeHTTP(recLogin, reqLogin)
	if recLogin.Code != http.StatusOK {
		t.Fatalf("login failed: %d", recLogin.Code)
	}

	userCookie := getCookie(recLogin, auth.SessionCookieName)
	if userCookie == nil {
		t.Fatalf("expected user cookie")
	}

	// Accessing /api/active-only should fail with 403 (account_pending)
	reqActive := httptest.NewRequest(http.MethodGet, "/api/active-only", nil)
	reqActive.AddCookie(userCookie)
	recActive := httptest.NewRecorder()
	r.ServeHTTP(recActive, reqActive)
	if recActive.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for pending user, got %d", recActive.Code)
	}

	// 3. User cannot access /admin/users (403 forbidden)
	reqAdminUsers := httptest.NewRequest(http.MethodGet, "/admin/users", nil)
	reqAdminUsers.AddCookie(userCookie)
	recAdminUsers := httptest.NewRecorder()
	r.ServeHTTP(recAdminUsers, reqAdminUsers)
	if recAdminUsers.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for regular user on /admin/users, got %d", recAdminUsers.Code)
	}

	// 4. Admin approves user
	reqApprove := httptest.NewRequest(http.MethodPost, "/admin/users/"+userIDStr+"/approve", nil)
	reqApprove.Header.Set("Origin", "http://localhost:5175")
	reqApprove.Header.Set("X-Requested-With", "XMLHttpRequest")
	reqApprove.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: adminToken})
	recApprove := httptest.NewRecorder()
	r.ServeHTTP(recApprove, reqApprove)
	if recApprove.Code != http.StatusOK {
		t.Fatalf("admin approve failed: %d: %s", recApprove.Code, recApprove.Body.String())
	}

	// Check user is now active in DB
	userUpdated, _ := queries.GetUserByID(ctx, user.ID)
	if userUpdated.Status != "active" {
		t.Fatalf("expected status 'active', got %s", userUpdated.Status)
	}

	// Now user can access /api/active-only
	reqActive2 := httptest.NewRequest(http.MethodGet, "/api/active-only", nil)
	reqActive2.AddCookie(userCookie)
	recActive2 := httptest.NewRecorder()
	r.ServeHTTP(recActive2, reqActive2)
	if recActive2.Code != http.StatusOK {
		t.Fatalf("expected 200 for active user, got %d: %s", recActive2.Code, recActive2.Body.String())
	}

	// 5. Trying to approve user again should fail (Requirement 8: approve ONLY from pending)
	reqApproveAgain := httptest.NewRequest(http.MethodPost, "/admin/users/"+userIDStr+"/approve", nil)
	reqApproveAgain.Header.Set("Origin", "http://localhost:5175")
	reqApproveAgain.Header.Set("X-Requested-With", "XMLHttpRequest")
	reqApproveAgain.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: adminToken})
	recApproveAgain := httptest.NewRecorder()
	r.ServeHTTP(recApproveAgain, reqApproveAgain)
	if recApproveAgain.Code != http.StatusConflict {
		t.Fatalf("expected 409 conflict when approving already-active user, got %d: %s", recApproveAgain.Code, recApproveAgain.Body.String())
	}

	// 6. Admin suspends user
	reqSuspend := httptest.NewRequest(http.MethodPost, "/admin/users/"+userIDStr+"/suspend", nil)
	reqSuspend.Header.Set("Origin", "http://localhost:5175")
	reqSuspend.Header.Set("X-Requested-With", "XMLHttpRequest")
	reqSuspend.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: adminToken})
	recSuspend := httptest.NewRecorder()
	r.ServeHTTP(recSuspend, reqSuspend)
	if recSuspend.Code != http.StatusOK {
		t.Fatalf("admin suspend failed: %d: %s", recSuspend.Code, recSuspend.Body.String())
	}

	// User status in DB must be suspended
	userSuspended, _ := queries.GetUserByID(ctx, user.ID)
	if userSuspended.Status != "suspended" {
		t.Fatalf("expected status 'suspended', got %s", userSuspended.Status)
	}

	// User's session was revoked in DB, so accessing /api/me should return 401/403
	reqMe := httptest.NewRequest(http.MethodGet, "/api/me", nil)
	reqMe.AddCookie(userCookie)
	recMe := httptest.NewRecorder()
	r.ServeHTTP(recMe, reqMe)
	if recMe.Code != http.StatusUnauthorized && recMe.Code != http.StatusForbidden {
		t.Fatalf("expected 401 or 403 for suspended user session, got %d", recMe.Code)
	}

	// Verify events in ledger: user.signed_up, user.approved, user.suspended
	var eventTypes []string
	rows, err := pool.Query(ctx, "SELECT type FROM events ORDER BY seq ASC")
	if err != nil {
		t.Fatalf("failed to query events: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var et string
		_ = rows.Scan(&et)
		eventTypes = append(eventTypes, et)
	}

	expectedEvents := []string{"user.signed_up", "user.approved", "user.suspended"}
	for _, expected := range expectedEvents {
		found := false
		for _, actual := range eventTypes {
			if actual == expected {
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("expected ledger event '%s' was not found in %v", expected, eventTypes)
		}
	}
}

// TestSuspendedUserKeyRejected verifies suspended user's API keys are rejected.
func TestSuspendedUserKeyRejected(t *testing.T) {
	pool := testhelper.GetTestPool(t)
	testhelper.ResetTestDB(t, pool)
	ctx := context.Background()
	queries := db.New(pool)

	userUUID := httpx.NewUUIDv4()
	var userPgUUID pgtype.UUID
	_ = userPgUUID.Scan(userUUID)
	_, _ = queries.CreateUser(ctx, db.CreateUserParams{
		ID:           userPgUUID,
		Email:        "suspended-key@layerto.test",
		PasswordHash: "dummyhash",
		Role:         "user",
		Status:       "suspended",
	})

	fullKey, _, err := keys.Create(ctx, pool, userUUID, "test-key", nil)
	if err != nil {
		t.Fatalf("create key error: %v", err)
	}

	// Verify key check must fail with ErrAccountNotActive
	vk, err := keys.Verify(ctx, pool, fullKey)
	if err == nil || vk != nil {
		t.Fatalf("expected error for suspended user's key, got key: %v, err: %v", vk, err)
	}
	if err != keys.ErrAccountNotActive {
		t.Fatalf("expected ErrAccountNotActive, got %v", err)
	}
}

// TestApproveNonPendingUserReturns409 tests that attempting to approve a non-pending user returns HTTP 409 Conflict.
func TestApproveNonPendingUserReturns409(t *testing.T) {
	r, _, _, _, queries := setupTestApp(t)
	ctx := context.Background()

	// 1. Create admin user
	adminPasswordHash, _ := auth.HashPassword("adminpassword123")
	adminUUID := httpx.NewUUIDv4()
	var adminPgUUID pgtype.UUID
	_ = adminPgUUID.Scan(adminUUID)
	_, err := queries.CreateUser(ctx, db.CreateUserParams{
		ID:           adminPgUUID,
		Email:        "admin-approver@layerto.test",
		PasswordHash: adminPasswordHash,
		Role:         "admin",
		Status:       "active",
	})
	if err != nil {
		t.Fatalf("failed to create admin: %v", err)
	}

	adminToken, _, err := auth.CreateSession(ctx, queries, adminPgUUID)
	if err != nil {
		t.Fatalf("failed to create admin session: %v", err)
	}

	// 2. Create already-active user
	activeUserUUID := httpx.NewUUIDv4()
	var activePgUUID pgtype.UUID
	_ = activePgUUID.Scan(activeUserUUID)
	_, _ = queries.CreateUser(ctx, db.CreateUserParams{
		ID:           activePgUUID,
		Email:        "active-user@layerto.test",
		PasswordHash: "somehash",
		Role:         "user",
		Status:       "active",
	})

	// 3. Create suspended user
	suspendedUserUUID := httpx.NewUUIDv4()
	var suspendedPgUUID pgtype.UUID
	_ = suspendedPgUUID.Scan(suspendedUserUUID)
	_, _ = queries.CreateUser(ctx, db.CreateUserParams{
		ID:           suspendedPgUUID,
		Email:        "suspended-user@layerto.test",
		PasswordHash: "somehash",
		Role:         "user",
		Status:       "suspended",
	})

	// Approving active user must return 409 Conflict
	req1 := httptest.NewRequest(http.MethodPost, "/admin/users/"+activeUserUUID+"/approve", nil)
	req1.Header.Set("Origin", "http://localhost:5175")
	req1.Header.Set("X-Requested-With", "XMLHttpRequest")
	req1.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: adminToken})
	rec1 := httptest.NewRecorder()
	r.ServeHTTP(rec1, req1)
	if rec1.Code != http.StatusConflict {
		t.Fatalf("expected 409 conflict for active user, got %d: %s", rec1.Code, rec1.Body.String())
	}

	// Approving suspended user must return 409 Conflict
	req2 := httptest.NewRequest(http.MethodPost, "/admin/users/"+suspendedUserUUID+"/approve", nil)
	req2.Header.Set("Origin", "http://localhost:5175")
	req2.Header.Set("X-Requested-With", "XMLHttpRequest")
	req2.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: adminToken})
	rec2 := httptest.NewRecorder()
	r.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusConflict {
		t.Fatalf("expected 409 conflict for suspended user, got %d: %s", rec2.Code, rec2.Body.String())
	}
}

func getCookie(rec *httptest.ResponseRecorder, name string) *http.Cookie {
	for _, c := range rec.Result().Cookies() {
		if c.Name == name {
			return c
		}
	}
	return nil
}

func errorsIsNoRows(err error) bool {
	return err != nil && (err == pgx.ErrNoRows || err.Error() == "no rows in result set")
}

func fmtUUID(u pgtype.UUID) string {
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", u.Bytes[0:4], u.Bytes[4:6], u.Bytes[6:8], u.Bytes[8:10], u.Bytes[10:16])
}
