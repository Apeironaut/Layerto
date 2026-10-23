package billing

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"layerto/services/core/internal/db"
	"layerto/services/core/internal/ledger"
)

type Reconciler struct {
	pool   *pgxpool.Pool
	stopCh chan struct{}
}

func NewReconciler(pool *pgxpool.Pool) *Reconciler {
	return &Reconciler{
		pool:   pool,
		stopCh: make(chan struct{}),
	}
}

// Start launches the reconciler loop on a 60-second ticker and runs immediately once on startup.
func (r *Reconciler) Start(ctx context.Context) {
	// 1. Run once on startup
	go func() {
		if err := r.RunOnce(ctx); err != nil {
			log.Printf("[reconciler] startup run error: %v", err)
		}
	}()

	// 2. Run every 60 seconds
	go func() {
		ticker := time.NewTicker(60 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-r.stopCh:
				return
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := r.RunOnce(ctx); err != nil {
					log.Printf("[reconciler] periodic run error: %v", err)
				}
			}
		}
	}()
}

// Stop stops the background reconciler loop.
func (r *Reconciler) Stop() {
	close(r.stopCh)
}

// RunOnce finds abandoned requests older than 2 minutes and refunds them in idempotent transactions.
func (r *Reconciler) RunOnce(ctx context.Context) error {
	return r.RunOnceWithCutoff(ctx, time.Now().UTC().Add(-2*time.Minute))
}

// RunOnceWithCutoff finds abandoned requests older than the given cutoff time and refunds them in idempotent transactions.
func (r *Reconciler) RunOnceWithCutoff(ctx context.Context, cutoff time.Time) error {
	queries := db.New(r.pool)

	abandoned, err := queries.GetCandidateAbandonedRequests(ctx, pgtype.Timestamptz{Time: cutoff, Valid: true})
	if err != nil {
		return fmt.Errorf("query abandoned requests error: %w", err)
	}

	for _, cand := range abandoned {
		if !cand.RequestID.Valid || !cand.UserID.Valid {
			continue
		}
		if err := r.reconcileOne(ctx, cand); err != nil {
			log.Printf("[reconciler] failed to reconcile request %s: %v", fmtUUID(cand.RequestID), err)
		}
	}

	return nil
}

type receivedPayload struct {
	ModelSlug string `json:"model_slug"`
	Reserved  int64  `json:"reserved"`
	Free      bool   `json:"free"`
}

func (r *Reconciler) reconcileOne(ctx context.Context, cand db.GetCandidateAbandonedRequestsRow) error {
	reqIDStr := fmtUUID(cand.RequestID)
	userIDStr := fmtUUID(cand.UserID)

	var p receivedPayload
	if err := json.Unmarshal(cand.Payload, &p); err != nil {
		return fmt.Errorf("unmarshal payload error: %w", err)
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx error: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	txQueries := db.New(tx)

	// 1. LOCK ORDER: balances row FOR UPDATE first
	bal, err := txQueries.GetBalanceForUpdate(ctx, cand.UserID)
	if err != nil {
		return fmt.Errorf("get balance for update error: %w", err)
	}

	// 2. IDEMPOTENCY CHECK under lock: verify no terminal event exists
	terminalExists, err := txQueries.CheckRequestTerminalExists(ctx, cand.RequestID)
	if err != nil {
		return fmt.Errorf("check terminal exists error: %w", err)
	}
	if terminalExists {
		// Already settled or refunded; do nothing
		return nil
	}

	// 3. Refund balance or free quota
	newBalance := bal.Balance
	newFreeUsed := bal.FreeUsed

	if p.Free {
		if newFreeUsed > 0 {
			newFreeUsed--
		}
	} else if p.Reserved > 0 {
		newBalance += p.Reserved
	}

	err = txQueries.UpdateBalanceAndFreeUsed(ctx, db.UpdateBalanceAndFreeUsedParams{
		UserID:   cand.UserID,
		Balance:  newBalance,
		FreeUsed: newFreeUsed,
	})
	if err != nil {
		return fmt.Errorf("update balance error: %w", err)
	}

	// 4. LOCK ORDER: ledger_head locked SECOND in ledger.Append
	refundPayload := map[string]any{
		"error_code": "abandoned",
		"refund":     p.Reserved,
		"free":       p.Free,
		"model_slug": p.ModelSlug,
	}

	_, err = ledger.Append(ctx, tx, ledger.EventInput{
		RequestID: &reqIDStr,
		UserID:    &userIDStr,
		Type:      "request.failed",
		Payload:   refundPayload,
	})
	if err != nil {
		return fmt.Errorf("append request.failed abandoned error: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit refund error: %w", err)
	}

	log.Printf("[reconciler] refunded abandoned request %s for user %s (reserved: %d, free: %v)", reqIDStr, userIDStr, p.Reserved, p.Free)
	return nil
}

func fmtUUID(u pgtype.UUID) string {
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", u.Bytes[0:4], u.Bytes[4:6], u.Bytes[6:8], u.Bytes[8:10], u.Bytes[10:16])
}
