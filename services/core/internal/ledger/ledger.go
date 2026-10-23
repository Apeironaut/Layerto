package ledger

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"layerto/services/core/internal/db"
)

const GenesisPrevHash = "0000000000000000000000000000000000000000000000000000000000000000"

// EventInput contains all parameters required to append a new event.
type EventInput struct {
	RequestID *string
	UserID    *string
	APIKeyID  *string
	Type      string
	Payload   any
}

// CanonicalEvent represents the deterministic structure used to compute hash.
type CanonicalEvent struct {
	APIKeyID  *string `json:"api_key_id"`
	CreatedAt string  `json:"created_at"`
	Payload   any     `json:"payload"`
	RequestID *string `json:"request_id"`
	Seq       int64   `json:"seq"`
	Type      string  `json:"type"`
	UserID    *string `json:"user_id"`
}

func uuidToString(u pgtype.UUID) *string {
	if !u.Valid {
		return nil
	}
	s := fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", u.Bytes[0:4], u.Bytes[4:6], u.Bytes[6:8], u.Bytes[8:10], u.Bytes[10:16])
	return &s
}

// ComputeHash computes sha256_hex( prev_hash + "\n" + canonical_json(...) ).
func ComputeHash(prevHash string, seq int64, reqID, userID, apiKeyID *string, eventType string, payload any, createdAt time.Time) (string, error) {
	// Canonicalize payload to ensure sorted keys and compact format
	var normalizedPayload any
	switch p := payload.(type) {
	case []byte:
		if err := json.Unmarshal(p, &normalizedPayload); err != nil {
			normalizedPayload = string(p)
		}
	default:
		b, err := json.Marshal(p)
		if err != nil {
			return "", fmt.Errorf("marshal payload error: %w", err)
		}
		if err := json.Unmarshal(b, &normalizedPayload); err != nil {
			normalizedPayload = p
		}
	}

	canon := CanonicalEvent{
		Seq:       seq,
		RequestID: reqID,
		UserID:    userID,
		APIKeyID:  apiKeyID,
		Type:      eventType,
		Payload:   normalizedPayload,
		CreatedAt: createdAt.UTC().Truncate(time.Microsecond).Format(time.RFC3339Nano),
	}

	canonJSON, err := json.Marshal(canon)
	if err != nil {
		return "", fmt.Errorf("canonical json marshal error: %w", err)
	}

	toHash := prevHash + "\n" + string(canonJSON)
	h := sha256.Sum256([]byte(toHash))
	return hex.EncodeToString(h[:]), nil
}

// Append adds a new event to the hash-chained append-only ledger in the given transaction.
func Append(ctx context.Context, tx pgx.Tx, in EventInput) (*db.Event, error) {
	queries := db.New(tx)

	// 1. SELECT last_seq, last_hash FROM ledger_head WHERE id=1 FOR UPDATE
	head, err := queries.GetLedgerHeadForUpdate(ctx)
	if err != nil {
		return nil, fmt.Errorf("get ledger head error: %w", err)
	}

	nextSeq := head.LastSeq + 1
	prevHash := head.LastHash
	createdAt := time.Now().UTC().Truncate(time.Microsecond)

	var reqID *string
	if in.RequestID != nil && *in.RequestID != "" {
		reqID = in.RequestID
	}
	var userID *string
	if in.UserID != nil && *in.UserID != "" {
		userID = in.UserID
	}
	var apiKeyID *string
	if in.APIKeyID != nil && *in.APIKeyID != "" {
		apiKeyID = in.APIKeyID
	}

	// Compute canonical hash
	eventHash, err := ComputeHash(prevHash, nextSeq, reqID, userID, apiKeyID, in.Type, in.Payload, createdAt)
	if err != nil {
		return nil, fmt.Errorf("compute event hash error: %w", err)
	}

	payloadBytes, err := json.Marshal(in.Payload)
	if err != nil {
		return nil, fmt.Errorf("marshal payload error: %w", err)
	}

	var reqUUID pgtype.UUID
	if reqID != nil {
		_ = reqUUID.Scan(*reqID)
	}

	var userUUID pgtype.UUID
	if userID != nil {
		_ = userUUID.Scan(*userID)
	}

	var keyUUID pgtype.UUID
	if apiKeyID != nil {
		_ = keyUUID.Scan(*apiKeyID)
	}

	// 2. INSERT INTO events
	err = queries.InsertEvent(ctx, db.InsertEventParams{
		Seq:       nextSeq,
		RequestID: reqUUID,
		UserID:    userUUID,
		ApiKeyID:  keyUUID,
		Type:      in.Type,
		Payload:   payloadBytes,
		PrevHash:  prevHash,
		Hash:      eventHash,
		CreatedAt: pgtype.Timestamptz{Time: createdAt, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("insert event error: %w", err)
	}

	// Balances are changed only by the billing package, inside the same transaction and
	// under its lock order. The ledger records events; it must not move money itself
	// (doing both credited every admin top-up twice).

	// TODO(spec M3): record charge on request.executed and deduct from balance/free_used

	// 4. UPDATE ledger_head
	err = queries.UpdateLedgerHead(ctx, db.UpdateLedgerHeadParams{
		LastSeq:  nextSeq,
		LastHash: eventHash,
	})
	if err != nil {
		return nil, fmt.Errorf("update ledger head error: %w", err)
	}

	return &db.Event{
		Seq:       nextSeq,
		RequestID: reqUUID,
		UserID:    userUUID,
		ApiKeyID:  keyUUID,
		Type:      in.Type,
		Payload:   payloadBytes,
		PrevHash:  prevHash,
		Hash:      eventHash,
		CreatedAt: pgtype.Timestamptz{Time: createdAt, Valid: true},
	}, nil
}

// VerifyResult contains the verification summary.
type VerifyResult struct {
	Ok          bool   `json:"ok"`
	Checked     int64  `json:"checked"`
	FirstBadSeq *int64 `json:"first_bad_seq,omitempty"`
}

// Verify recomputes the hash chain from genesis across all events.
func Verify(ctx context.Context, pool *pgxpool.Pool) (*VerifyResult, error) {
	queries := db.New(pool)
	events, err := queries.ListEventsForVerify(ctx)
	if err != nil {
		return nil, fmt.Errorf("list events error: %w", err)
	}

	expectedPrevHash := GenesisPrevHash
	expectedSeq := int64(1)
	var checked int64

	for _, ev := range events {
		if ev.Seq != expectedSeq {
			badSeq := ev.Seq
			return &VerifyResult{
				Ok:          false,
				Checked:     checked,
				FirstBadSeq: &badSeq,
			}, nil
		}

		if strings.ToLower(ev.PrevHash) != strings.ToLower(expectedPrevHash) {
			badSeq := ev.Seq
			return &VerifyResult{
				Ok:          false,
				Checked:     checked,
				FirstBadSeq: &badSeq,
			}, nil
		}

		reqID := uuidToString(ev.RequestID)
		userID := uuidToString(ev.UserID)
		apiKeyID := uuidToString(ev.ApiKeyID)

		computed, err := ComputeHash(ev.PrevHash, ev.Seq, reqID, userID, apiKeyID, ev.Type, ev.Payload, ev.CreatedAt.Time)
		if err != nil || strings.ToLower(computed) != strings.ToLower(ev.Hash) {
			badSeq := ev.Seq
			return &VerifyResult{
				Ok:          false,
				Checked:     checked,
				FirstBadSeq: &badSeq,
			}, nil
		}

		expectedPrevHash = ev.Hash
		expectedSeq++
		checked++
	}

	return &VerifyResult{
		Ok:      true,
		Checked: checked,
	}, nil
}
