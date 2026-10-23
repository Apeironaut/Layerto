package billing

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"layerto/services/core/internal/db"
	"layerto/services/core/internal/ledger"
)

// Adjust changes a user's balance by delta micro-USD (negative = debit) and records one ledger
// event of eventType in the same transaction. Debits never take the balance below zero
// (ErrInsufficientBalance). Same lock order as every other billing path: balances row first,
// then ledger_head inside ledger.Append.
func Adjust(ctx context.Context, pool *pgxpool.Pool, userID string, delta int64, eventType string, payload map[string]any) (int64, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	bal, err := AdjustTx(ctx, tx, userID, delta, eventType, payload)
	if err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("commit: %w", err)
	}
	return bal, nil
}

// AdjustTx is Adjust inside a caller's transaction.
func AdjustTx(ctx context.Context, tx pgx.Tx, userID string, delta int64, eventType string, payload map[string]any) (int64, error) {
	if delta == 0 {
		return 0, fmt.Errorf("zero adjustment")
	}
	var uid pgtype.UUID
	if err := uid.Scan(userID); err != nil {
		return 0, fmt.Errorf("invalid user uuid: %w", err)
	}
	q := db.New(tx)
	bal, err := q.GetBalanceForUpdate(ctx, uid)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, ErrUserNotFound
		}
		return 0, fmt.Errorf("lock balance: %w", err)
	}
	newBal := bal.Balance + delta
	if newBal < 0 {
		return 0, ErrInsufficientBalance
	}
	if err := q.UpdateBalanceAndFreeUsed(ctx, db.UpdateBalanceAndFreeUsedParams{UserID: uid, Balance: newBal, FreeUsed: bal.FreeUsed}); err != nil {
		return 0, fmt.Errorf("update balance: %w", err)
	}
	p := map[string]any{"amount": delta}
	for k, v := range payload {
		p[k] = v
	}
	if _, err := ledger.Append(ctx, tx, ledger.EventInput{UserID: &userID, Type: eventType, Payload: p}); err != nil {
		return 0, fmt.Errorf("append %s: %w", eventType, err)
	}
	return newBal, nil
}
