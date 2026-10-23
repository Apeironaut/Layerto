package usage_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"layerto/services/core/internal/auth"
	"layerto/services/core/internal/billing"
	"layerto/services/core/internal/db"
	"layerto/services/core/internal/httpx"
	"layerto/services/core/internal/testhelper"
	"layerto/services/core/internal/usage"
)

func TestUsage_DateRangeValidation(t *testing.T) {
	pool := testhelper.GetTestPool(t)
	defer pool.Close()
	testhelper.ResetTestDB(t, pool)

	h := usage.NewHandler(pool)

	userUUID := pgtype.UUID{Bytes: [16]byte{1, 2, 3}, Valid: true}
	reqUser := &db.User{
		ID:     userUUID,
		Email:  "usage-test@layerto.test",
		Role:   "user",
		Status: "active",
	}

	// 1. Range > 366 days rejected with 400 invalid_range (Requirement 7)
	from := time.Now().UTC().AddDate(-2, 0, 0).Format(time.RFC3339)
	to := time.Now().UTC().Format(time.RFC3339)

	req := httptest.NewRequest(http.MethodGet, "/api/usage?from="+from+"&to="+to, nil)
	req = req.WithContext(auth.WithUser(req.Context(), reqUser))
	rr := httptest.NewRecorder()

	h.HandleGetUsage(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for > 366 days, got %d: %s", rr.Code, rr.Body.String())
	}

	var errResp map[string]map[string]any
	_ = json.Unmarshal(rr.Body.Bytes(), &errResp)
	if errResp["error"]["code"] != "invalid_range" {
		t.Fatalf("expected error code 'invalid_range', got %v", errResp)
	}

	// 2. 'from' after 'to' rejected with 400
	fromLate := time.Now().UTC().Format(time.RFC3339)
	toEarly := time.Now().UTC().AddDate(0, 0, -5).Format(time.RFC3339)

	req = httptest.NewRequest(http.MethodGet, "/api/usage?from="+fromLate+"&to="+toEarly, nil)
	req = req.WithContext(auth.WithUser(req.Context(), reqUser))
	rr = httptest.NewRecorder()

	h.HandleGetUsage(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for from > to, got %d", rr.Code)
	}
}

// Requirement 7:
// /api/requests returns one row per request_id (status: pending,
// executed, failed or abandoned), not raw events.
func TestRequests_OneRowPerRequest(t *testing.T) {
	pool := testhelper.GetTestPool(t)
	defer pool.Close()
	testhelper.ResetTestDB(t, pool)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	queries := db.New(pool)

	userID := httpx.NewUUIDv4()
	var userUUID pgtype.UUID
	_ = userUUID.Scan(userID)

	_, _ = queries.CreateUser(ctx, db.CreateUserParams{
		ID:           userUUID,
		Email:        "requests-test@layerto.test",
		PasswordHash: "test_hash",
		Role:         "user",
		Status:       "active",
	})
	_ = queries.CreateBalance(ctx, db.CreateBalanceParams{
		UserID:   userUUID,
		Balance:  100_000,
		FreeUsed: billing.FreeCallsLimit,
	})

	// 1. Executed request
	reqID1 := httpx.NewUUIDv4()
	res1, _ := billing.Reserve(ctx, pool, nil, billing.ReserveParams{
		UserID:    userID,
		ModelSlug: "turtle-id",
		RequestID: reqID1,
		Route:     "direct",
		Source:    "api",
	})
	_, _ = billing.SettleExecuted(ctx, pool, nil, reqID1, userID, nil, "turtle-id", "1.0", res1.Reserved, res1.Free, 150, "api")

	// 2. Failed request
	reqID2 := httpx.NewUUIDv4()
	res2, _ := billing.Reserve(ctx, pool, nil, billing.ReserveParams{
		UserID:    userID,
		ModelSlug: "bioclip",
		RequestID: reqID2,
		Route:     "direct",
		Source:    "api",
	})
	_ = billing.Refund(ctx, pool, nil, reqID2, userID, "bioclip", res2.Reserved, res2.Free, "model_error", 200)

	// 3. Abandoned request
	reqID3 := httpx.NewUUIDv4()
	_, _ = billing.Reserve(ctx, pool, nil, billing.ReserveParams{
		UserID:    userID,
		ModelSlug: "turtle-id",
		RequestID: reqID3,
		Route:     "direct",
		Source:    "api",
	})
	reconciler := billing.NewReconciler(pool)
	_ = reconciler.RunOnceWithCutoff(ctx, time.Now().UTC().Add(time.Second))

	// 4. Pending request (reserved, not yet settled or failed)
	reqID4 := httpx.NewUUIDv4()
	_, _ = billing.Reserve(ctx, pool, nil, billing.ReserveParams{
		UserID:    userID,
		ModelSlug: "turtle-id",
		RequestID: reqID4,
		Route:     "direct",
		Source:    "api",
	})

	h := usage.NewHandler(pool)
	reqUser := &db.User{
		ID:     userUUID,
		Email:  "requests-test@layerto.test",
		Role:   "user",
		Status: "active",
	}

	req := httptest.NewRequest(http.MethodGet, "/api/requests", nil)
	req = req.WithContext(auth.WithUser(req.Context(), reqUser))
	rr := httptest.NewRecorder()

	h.HandleGetRequests(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rr.Code, rr.Body.String())
	}

	var items []usage.RequestLogItem
	if err := json.Unmarshal(rr.Body.Bytes(), &items); err != nil {
		t.Fatalf("unmarshal requests error: %v", err)
	}

	if len(items) != 4 {
		t.Fatalf("expected exactly 4 requests (1 row per request_id), got %d", len(items))
	}

	statusMap := make(map[string]string)
	for _, item := range items {
		statusMap[item.RequestID] = item.Status
	}

	if statusMap[reqID1] != "executed" {
		t.Errorf("expected req1 to be 'executed', got %q", statusMap[reqID1])
	}
	if statusMap[reqID2] != "failed" {
		t.Errorf("expected req2 to be 'failed', got %q", statusMap[reqID2])
	}
	if statusMap[reqID3] != "abandoned" {
		t.Errorf("expected req3 to be 'abandoned', got %q", statusMap[reqID3])
	}
	if statusMap[reqID4] != "pending" {
		t.Errorf("expected req4 to be 'pending', got %q", statusMap[reqID4])
	}

	// Also check /api/usage matches executed totals
	uReq := httptest.NewRequest(http.MethodGet, "/api/usage", nil)
	uReq = uReq.WithContext(auth.WithUser(uReq.Context(), reqUser))
	uRR := httptest.NewRecorder()

	h.HandleGetUsage(uRR, uReq)
	if uRR.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for /api/usage, got %d: %s", uRR.Code, uRR.Body.String())
	}

	var uResp usage.UsageResponse
	_ = json.Unmarshal(uRR.Body.Bytes(), &uResp)

	if uResp.TotalRequests != 1 {
		t.Errorf("expected 1 executed request in usage totals, got %d", uResp.TotalRequests)
	}
	if uResp.TotalChargeMicroUSD != res1.Reserved {
		t.Errorf("expected %d charge, got %d", res1.Reserved, uResp.TotalChargeMicroUSD)
	}
}
