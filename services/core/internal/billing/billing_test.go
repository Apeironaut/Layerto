package billing_test

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"layerto/services/core/internal/billing"
	"layerto/services/core/internal/db"
	"layerto/services/core/internal/httpx"
	"layerto/services/core/internal/ledger"
	"layerto/services/core/internal/testhelper"
)

// Requirement 3:
// Lock order everywhere: balances row FOR UPDATE first, then ledger_head.
// Write it down in a comment in billing.go. The 20-goroutine test must
// pass 10 runs in a row (go test -count=10 on that test).
func TestBilling_20GoroutinesConcurrency(t *testing.T) {
	pool := testhelper.GetTestPool(t)
	defer pool.Close()
	testhelper.ResetTestDB(t, pool)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	queries := db.New(pool)

	// Create user with 50 free calls already used and balance for exactly 5 calls (5 * 2000 = 10,000 micro-USD)
	userID := httpx.NewUUIDv4()
	var userUUID pgtype.UUID
	_ = userUUID.Scan(userID)

	_, err := queries.CreateUser(ctx, db.CreateUserParams{
		ID:           userUUID,
		Email:        "concurrency-user@layerto.test",
		PasswordHash: "test_hash",
		Role:         "user",
		Status:       "active",
	})
	if err != nil {
		t.Fatalf("create user error: %v", err)
	}

	const callPrice = 2000 // turtle-id price per call
	const allowedCalls = 5
	const initialBalance = allowedCalls * callPrice

	err = queries.CreateBalance(ctx, db.CreateBalanceParams{
		UserID:   userUUID,
		Balance:  initialBalance,
		FreeUsed: billing.FreeCallsLimit, // exhaust free tier
	})
	if err != nil {
		t.Fatalf("create balance error: %v", err)
	}

	const numGoroutines = 20
	var successCount int32
	var failedCount int32

	var wg sync.WaitGroup
	startBarrier := make(chan struct{})

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-startBarrier

			reqID := httpx.NewUUIDv4()
			res, err := billing.Reserve(ctx, pool, nil, billing.ReserveParams{
				UserID:    userID,
				ModelSlug: "turtle-id",
				RequestID: reqID,
				Route:     "direct",
				Source:    "api",
			})
			if err != nil {
				if errors.Is(err, billing.ErrInsufficientBalance) {
					atomic.AddInt32(&failedCount, 1)
					return
				}
				t.Errorf("unexpected error on reserve: %v", err)
				return
			}

			atomic.AddInt32(&successCount, 1)

			// Simulate fast execution and settlement
			_, _ = billing.SettleExecuted(ctx, pool, nil, reqID, userID, nil, "turtle-id", "1.0", res.Reserved, res.Free, 50, "api")
		}()
	}

	close(startBarrier)
	wg.Wait()

	if successCount != allowedCalls {
		t.Fatalf("expected exactly %d successes, got %d (failed: %d)", allowedCalls, successCount, failedCount)
	}
	if failedCount != (numGoroutines - allowedCalls) {
		t.Fatalf("expected exactly %d failures, got %d", numGoroutines-allowedCalls, failedCount)
	}

	// Verify balance is exactly 0 and never went negative
	bal, err := queries.GetBalance(ctx, userUUID)
	if err != nil {
		t.Fatalf("get balance error: %v", err)
	}
	if bal.Balance != 0 {
		t.Fatalf("expected balance to be 0, got %d", bal.Balance)
	}

	// Verify cryptographic hash chain integrity
	vRes, err := ledger.Verify(ctx, pool)
	if err != nil || !vRes.Ok {
		t.Fatalf("ledger verification failed: %v, ok=%v", err, vRes.Ok)
	}
}

// Requirement 1:
// Reconciler: on startup and every 60s, find request.received events
// older than 2 minutes with no request.executed or request.failed for
// the same request_id. For each one, append request.failed
// (error_code "abandoned") and refund in one transaction. It must be
// idempotent: check again under the lock that no terminal event exists.
// Test: reserve, simulate a crash before settle, run the reconciler →
// refunded once; run it again → nothing happens.
func TestReconciler_IdempotentRefund(t *testing.T) {
	pool := testhelper.GetTestPool(t)
	defer pool.Close()
	testhelper.ResetTestDB(t, pool)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	queries := db.New(pool)

	userID := httpx.NewUUIDv4()
	var userUUID pgtype.UUID
	_ = userUUID.Scan(userID)

	_, err := queries.CreateUser(ctx, db.CreateUserParams{
		ID:           userUUID,
		Email:        "reconciler-user@layerto.test",
		PasswordHash: "test_hash",
		Role:         "user",
		Status:       "active",
	})
	if err != nil {
		t.Fatalf("create user error: %v", err)
	}

	const initialBalance = 10_000 // micro-USD
	err = queries.CreateBalance(ctx, db.CreateBalanceParams{
		UserID:   userUUID,
		Balance:  initialBalance,
		FreeUsed: billing.FreeCallsLimit, // paid mode
	})
	if err != nil {
		t.Fatalf("create balance error: %v", err)
	}

	reqID := httpx.NewUUIDv4()
	res, err := billing.Reserve(ctx, pool, nil, billing.ReserveParams{
		UserID:    userID,
		ModelSlug: "turtle-id",
		RequestID: reqID,
		Route:     "direct",
		Source:    "api",
	})
	if err != nil {
		t.Fatalf("reserve error: %v", err)
	}

	// Balance should now be deducted by reserved amount
	balAfterReserve, err := queries.GetBalance(ctx, userUUID)
	if err != nil {
		t.Fatalf("get balance error: %v", err)
	}
	expectedAfterReserve := initialBalance - res.Reserved
	if balAfterReserve.Balance != expectedAfterReserve {
		t.Fatalf("expected balance %d, got %d", expectedAfterReserve, balAfterReserve.Balance)
	}

	// Simulate crash: DO NOT call SettleExecuted or Refund!
	// Reconciler checks events older than cutoff. Using cutoff in the near future matches events created now without violating the append-only trigger.
	var reqUUID pgtype.UUID
	_ = reqUUID.Scan(reqID)

	reconciler := billing.NewReconciler(pool)
	cutoff := time.Now().UTC().Add(time.Second)

	// First reconciler run -> refunded once
	if err := reconciler.RunOnceWithCutoff(ctx, cutoff); err != nil {
		t.Fatalf("reconciler RunOnce error: %v", err)
	}

	balAfterFirstRefund, err := queries.GetBalance(ctx, userUUID)
	if err != nil {
		t.Fatalf("get balance error: %v", err)
	}
	if balAfterFirstRefund.Balance != initialBalance {
		t.Fatalf("expected balance restored to %d, got %d", initialBalance, balAfterFirstRefund.Balance)
	}

	// Verify request.failed event with error_code "abandoned" was written
	var failedCount int
	var errorCode string
	err = pool.QueryRow(ctx, "SELECT count(*), COALESCE(max(payload->>'error_code'), '') FROM events WHERE request_id = $1 AND type = 'request.failed'", reqUUID).Scan(&failedCount, &errorCode)
	if err != nil {
		t.Fatalf("query failed event error: %v", err)
	}
	if failedCount != 1 {
		t.Fatalf("expected exactly 1 request.failed event, got %d", failedCount)
	}
	if errorCode != "abandoned" {
		t.Fatalf("expected error_code 'abandoned', got %q", errorCode)
	}

	// Second reconciler run -> idempotent, nothing happens
	if err := reconciler.RunOnceWithCutoff(ctx, cutoff); err != nil {
		t.Fatalf("second reconciler RunOnce error: %v", err)
	}

	balAfterSecondRun, err := queries.GetBalance(ctx, userUUID)
	if err != nil {
		t.Fatalf("get balance error: %v", err)
	}
	if balAfterSecondRun.Balance != initialBalance {
		t.Fatalf("idempotency violation: balance changed on second run: %d", balAfterSecondRun.Balance)
	}

	err = pool.QueryRow(ctx, "SELECT count(*) FROM events WHERE request_id = $1 AND type = 'request.failed'", reqUUID).Scan(&failedCount)
	if err != nil {
		t.Fatalf("query failed event count error: %v", err)
	}
	if failedCount != 1 {
		t.Fatalf("idempotency violation: additional failed event appended: %d", failedCount)
	}

	// Ledger hash chain must verify
	vRes, err := ledger.Verify(ctx, pool)
	if err != nil || !vRes.Ok {
		t.Fatalf("ledger chain should verify: %v", err)
	}
}

// Test Refund workflow when model execution fails
func TestBilling_RefundOnFailure(t *testing.T) {
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
		Email:        "refund-test@layerto.test",
		PasswordHash: "test_hash",
		Role:         "user",
		Status:       "active",
	})

	const initialBalance = 5_000
	_ = queries.CreateBalance(ctx, db.CreateBalanceParams{
		UserID:   userUUID,
		Balance:  initialBalance,
		FreeUsed: billing.FreeCallsLimit,
	})

	reqID := httpx.NewUUIDv4()
	res, err := billing.Reserve(ctx, pool, nil, billing.ReserveParams{
		UserID:    userID,
		ModelSlug: "turtle-id",
		RequestID: reqID,
		Route:     "direct",
		Source:    "api",
	})
	if err != nil {
		t.Fatalf("reserve error: %v", err)
	}

	// Call Refund
	err = billing.Refund(ctx, pool, nil, reqID, userID, "turtle-id", res.Reserved, res.Free, "model_error", 120)
	if err != nil {
		t.Fatalf("refund error: %v", err)
	}

	bal, err := queries.GetBalance(ctx, userUUID)
	if err != nil {
		t.Fatalf("get balance error: %v", err)
	}
	if bal.Balance != initialBalance {
		t.Fatalf("expected balance %d after refund, got %d", initialBalance, bal.Balance)
	}

	vRes, err := ledger.Verify(ctx, pool)
	if err != nil || !vRes.Ok {
		t.Fatalf("ledger should verify: %v", err)
	}
}

// Test Free quota usage (calls 1 to 50 are free, 51 charges balance)
func TestBilling_FreeQuota(t *testing.T) {
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
		Email:        "free-quota@layerto.test",
		PasswordHash: "test_hash",
		Role:         "user",
		Status:       "active",
	})

	// User with 0 balance and 49 free calls used
	_ = queries.CreateBalance(ctx, db.CreateBalanceParams{
		UserID:   userUUID,
		Balance:  0,
		FreeUsed: 49,
	})

	// Call 50 should be free
	reqID50 := httpx.NewUUIDv4()
	res50, err := billing.Reserve(ctx, pool, nil, billing.ReserveParams{
		UserID:    userID,
		ModelSlug: "turtle-id",
		RequestID: reqID50,
		Route:     "direct",
		Source:    "api",
	})
	if err != nil {
		t.Fatalf("call 50 should succeed as free: %v", err)
	}
	if !res50.Free || res50.Reserved != 0 {
		t.Fatalf("call 50 should be free with 0 reserved, got free=%v reserved=%d", res50.Free, res50.Reserved)
	}

	// Call 51 with 0 balance should fail with ErrInsufficientBalance
	reqID51 := httpx.NewUUIDv4()
	_, err = billing.Reserve(ctx, pool, nil, billing.ReserveParams{
		UserID:    userID,
		ModelSlug: "turtle-id",
		RequestID: reqID51,
		Route:     "direct",
		Source:    "api",
	})
	if !errors.Is(err, billing.ErrInsufficientBalance) {
		t.Fatalf("call 51 with 0 balance should fail with ErrInsufficientBalance, got %v", err)
	}
}

// Settle/refund race test:
// Reserve → reconciler abandons → late settle → exactly one terminal event and no double refund.
func TestBilling_ReconcilerAbandonsLateSettle(t *testing.T) {
	pool := testhelper.GetTestPool(t)
	defer pool.Close()
	testhelper.ResetTestDB(t, pool)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	queries := db.New(pool)

	userID := httpx.NewUUIDv4()
	var userUUID pgtype.UUID
	_ = userUUID.Scan(userID)

	_, err := queries.CreateUser(ctx, db.CreateUserParams{
		ID:           userUUID,
		Email:        "late-settle@layerto.test",
		PasswordHash: "test_hash",
		Role:         "user",
		Status:       "active",
	})
	if err != nil {
		t.Fatalf("create user error: %v", err)
	}

	const initialBalance = 10_000 // micro-USD
	err = queries.CreateBalance(ctx, db.CreateBalanceParams{
		UserID:   userUUID,
		Balance:  initialBalance,
		FreeUsed: billing.FreeCallsLimit, // paid mode
	})
	if err != nil {
		t.Fatalf("create balance error: %v", err)
	}

	reqID := httpx.NewUUIDv4()
	var reqUUID pgtype.UUID
	_ = reqUUID.Scan(reqID)

	// 1. Reserve call (turtle-id, 2000 micro-USD)
	res, err := billing.Reserve(ctx, pool, nil, billing.ReserveParams{
		UserID:    userID,
		ModelSlug: "turtle-id",
		RequestID: reqID,
		Route:     "direct",
		Source:    "api",
	})
	if err != nil {
		t.Fatalf("reserve error: %v", err)
	}
	if res.Reserved != 2000 {
		t.Fatalf("expected reserved 2000, got %d", res.Reserved)
	}

	balAfterReserve, err := queries.GetBalance(ctx, userUUID)
	if err != nil {
		t.Fatalf("get balance error: %v", err)
	}
	if balAfterReserve.Balance != initialBalance-res.Reserved {
		t.Fatalf("expected balance %d, got %d", initialBalance-res.Reserved, balAfterReserve.Balance)
	}

	// 2. Reconciler runs and abandons the request
	reconciler := billing.NewReconciler(pool)
	cutoff := time.Now().UTC().Add(time.Second)
	if err := reconciler.RunOnceWithCutoff(ctx, cutoff); err != nil {
		t.Fatalf("reconciler RunOnce error: %v", err)
	}

	balAfterReconcile, err := queries.GetBalance(ctx, userUUID)
	if err != nil {
		t.Fatalf("get balance error: %v", err)
	}
	if balAfterReconcile.Balance != initialBalance {
		t.Fatalf("expected balance restored to %d, got %d", initialBalance, balAfterReconcile.Balance)
	}

	// 3. Late settle runs
	charged, err := billing.SettleExecuted(ctx, pool, nil, reqID, userID, nil, "turtle-id", "1.0", res.Reserved, res.Free, 50, "api")
	if err != nil {
		t.Fatalf("late settle error: %v", err)
	}
	if charged != 0 {
		t.Fatalf("expected late execution charge to be 0, got %d", charged)
	}

	// 4. Assert no double refund and balance is still initialBalance
	balAfterLateSettle, err := queries.GetBalance(ctx, userUUID)
	if err != nil {
		t.Fatalf("get balance error: %v", err)
	}
	if balAfterLateSettle.Balance != initialBalance {
		t.Fatalf("expected balance unchanged at %d, got %d", initialBalance, balAfterLateSettle.Balance)
	}

	// 5. Also attempt late Refund to verify it is also protected
	err = billing.Refund(ctx, pool, nil, reqID, userID, "turtle-id", res.Reserved, res.Free, "model_error", 50)
	if err != nil {
		t.Fatalf("late refund error: %v", err)
	}

	balAfterLateRefund, err := queries.GetBalance(ctx, userUUID)
	if err != nil {
		t.Fatalf("get balance error: %v", err)
	}
	if balAfterLateRefund.Balance != initialBalance {
		t.Fatalf("expected balance unchanged at %d after late refund, got %d", initialBalance, balAfterLateRefund.Balance)
	}

	// 6. Assert exactly one terminal event exists for that request_id
	var terminalCount int
	err = pool.QueryRow(ctx, "SELECT count(*) FROM events WHERE request_id = $1 AND type IN ('request.executed', 'request.failed')", reqUUID).Scan(&terminalCount)
	if err != nil {
		t.Fatalf("query terminal events error: %v", err)
	}
	if terminalCount != 1 {
		t.Fatalf("expected exactly 1 terminal event, got %d", terminalCount)
	}

	// 7. Verify cryptographic ledger hash chain
	vRes, err := ledger.Verify(ctx, pool)
	if err != nil || !vRes.Ok {
		t.Fatalf("ledger chain should verify: %v", err)
	}
}
