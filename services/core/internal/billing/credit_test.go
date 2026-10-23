package billing_test

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"

	"layerto/services/core/internal/billing"
	"layerto/services/core/internal/db"
	"layerto/services/core/internal/httpx"
	"layerto/services/core/internal/testhelper"
)

// TestCredit_AppliesExactlyOnce guards against the ledger and billing both adding a
// credit to the balance (which once credited every top-up twice).
func TestCredit_AppliesExactlyOnce(t *testing.T) {
	pool := testhelper.GetTestPool(t)
	defer pool.Close()
	testhelper.ResetTestDB(t, pool)
	ctx := context.Background()
	q := db.New(pool)

	userID := httpx.NewUUIDv4()
	var uid pgtype.UUID
	_ = uid.Scan(userID)
	if _, err := q.CreateUser(ctx, db.CreateUserParams{ID: uid, Email: "credit@layerto.test", PasswordHash: "h", Role: "user", Status: "active"}); err != nil {
		t.Fatal(err)
	}
	if err := q.CreateBalance(ctx, db.CreateBalanceParams{UserID: uid, Balance: 1_000, FreeUsed: 0}); err != nil {
		t.Fatal(err)
	}
	adminID := httpx.NewUUIDv4()

	newBal, err := billing.Credit(ctx, pool, adminID, userID, 5_000_000, "test")
	if err != nil {
		t.Fatal(err)
	}
	bal, _ := q.GetBalance(ctx, uid)
	if newBal != 5_001_000 || bal.Balance != 5_001_000 {
		t.Fatalf("after one $5 credit: returned %d, stored %d, want 5001000 for both", newBal, bal.Balance)
	}
	if _, err := billing.Credit(ctx, pool, adminID, userID, 250_000, ""); err != nil {
		t.Fatal(err)
	}
	bal, _ = q.GetBalance(ctx, uid)
	if bal.Balance != 5_251_000 {
		t.Fatalf("after second credit: stored %d, want 5251000", bal.Balance)
	}
}
