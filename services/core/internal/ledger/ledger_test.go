package ledger_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"layerto/services/core/internal/ledger"
	"layerto/services/core/internal/testhelper"
)

func TestLedger_ChainVerifies(t *testing.T) {
	pool := testhelper.GetTestPool(t)
	defer pool.Close()
	testhelper.ResetTestDB(t, pool)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 1. Genesis state verifies with checked = 0
	res, err := ledger.Verify(ctx, pool)
	if err != nil {
		t.Fatalf("verify genesis error: %v", err)
	}
	if !res.Ok || res.Checked != 0 {
		t.Fatalf("expected ok=true, checked=0; got ok=%v, checked=%d", res.Ok, res.Checked)
	}

	// 2. Append multiple events
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin tx error: %v", err)
	}

	ev1, err := ledger.Append(ctx, tx, ledger.EventInput{
		Type:    "user.signed_up",
		Payload: map[string]any{"email": "test@layerto.test"},
	})
	if err != nil {
		t.Fatalf("append ev1 error: %v", err)
	}
	if ev1.Seq != 1 || ev1.PrevHash != ledger.GenesisPrevHash {
		t.Fatalf("unexpected ev1: seq=%d, prev_hash=%s", ev1.Seq, ev1.PrevHash)
	}

	ev2, err := ledger.Append(ctx, tx, ledger.EventInput{
		Type:    "user.approved",
		Payload: map[string]any{"by_admin_id": "cli"},
	})
	if err != nil {
		t.Fatalf("append ev2 error: %v", err)
	}
	if ev2.Seq != 2 || ev2.PrevHash != ev1.Hash {
		t.Fatalf("unexpected ev2: seq=%d, prev_hash=%s, want=%s", ev2.Seq, ev2.PrevHash, ev1.Hash)
	}

	if err := tx.Commit(ctx); err != nil {
		t.Fatalf("commit tx error: %v", err)
	}

	// 3. Verify chain
	res, err = ledger.Verify(ctx, pool)
	if err != nil {
		t.Fatalf("verify chain error: %v", err)
	}
	if !res.Ok || res.Checked != 2 {
		t.Fatalf("expected ok=true, checked=2; got ok=%v, checked=%d", res.Ok, res.Checked)
	}
}

func TestLedger_TamperedPayloadDetected(t *testing.T) {
	pool := testhelper.GetTestPool(t)
	defer pool.Close()
	testhelper.ResetTestDB(t, pool)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Append valid first event
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin tx error: %v", err)
	}
	ev1, err := ledger.Append(ctx, tx, ledger.EventInput{
		Type:    "user.signed_up",
		Payload: map[string]any{"email": "original@layerto.test"},
	})
	if err != nil {
		t.Fatalf("append error: %v", err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatalf("commit error: %v", err)
	}

	// Insert event with mismatched hash (simulating a forged/tampered event inserted into the database)
	// Notice: no triggers are disabled, no updates or deletes are performed (SPEC §17 rule 3).
	forgedHash := "0000000000000000000000000000000000000000000000000000000000000001"
	_, err = pool.Exec(ctx, `
		INSERT INTO events (seq, type, payload, prev_hash, hash, created_at)
		VALUES (2, 'user.approved', '{"by_admin_id":"forged"}', $1, $2, now());
	`, ev1.Hash, forgedHash)
	if err != nil {
		t.Fatalf("insert forged event error: %v", err)
	}

	// Verify must detect the tampering and fail
	res, err := ledger.Verify(ctx, pool)
	if err != nil {
		t.Fatalf("verify error: %v", err)
	}
	if res.Ok {
		t.Fatalf("expected verify to fail on tampered hash, but got ok=true")
	}
	if res.FirstBadSeq == nil || *res.FirstBadSeq != 2 {
		t.Fatalf("expected FirstBadSeq=2, got %v", res.FirstBadSeq)
	}
}

func TestLedger_DirectUpdateRejectedByTrigger(t *testing.T) {
	pool := testhelper.GetTestPool(t)
	defer pool.Close()
	testhelper.ResetTestDB(t, pool)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin tx error: %v", err)
	}
	_, err = ledger.Append(ctx, tx, ledger.EventInput{
		Type:    "user.signed_up",
		Payload: map[string]any{"email": "immutable@layerto.test"},
	})
	if err != nil {
		t.Fatalf("append error: %v", err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatalf("commit error: %v", err)
	}

	// Attempt direct UPDATE on events table
	_, err = pool.Exec(ctx, "UPDATE events SET type = 'malicious' WHERE seq = 1")
	if err == nil {
		t.Fatalf("expected UPDATE on events to fail due to trigger, but it succeeded")
	}
	if !strings.Contains(err.Error(), "events table is append-only: updates and deletes are prohibited") {
		t.Fatalf("expected trigger error message, got: %v", err)
	}

	// Attempt direct DELETE on events table
	_, err = pool.Exec(ctx, "DELETE FROM events WHERE seq = 1")
	if err == nil {
		t.Fatalf("expected DELETE on events to fail due to trigger, but it succeeded")
	}
	if !strings.Contains(err.Error(), "events table is append-only: updates and deletes are prohibited") {
		t.Fatalf("expected trigger error message, got: %v", err)
	}

	// Attempt direct TRUNCATE on events table
	_, err = pool.Exec(ctx, "TRUNCATE events")
	if err == nil {
		t.Fatalf("expected TRUNCATE on events to fail due to trigger, but it succeeded")
	}
	if !strings.Contains(err.Error(), "events table is append-only: truncate is prohibited") {
		t.Fatalf("expected trigger error message, got: %v", err)
	}
}
