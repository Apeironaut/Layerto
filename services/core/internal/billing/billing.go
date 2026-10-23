package billing

// LOCK ORDER: balances row FOR UPDATE first, then ledger_head FOR UPDATE (in ledger.Append). Never reverse this order to avoid deadlocks.

import (
	"context"
	"errors"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"layerto/services/core/internal/db"
	"layerto/services/core/internal/ledger"
)

const FreeCallsLimit = 50

var (
	ErrInsufficientBalance = errors.New("insufficient balance")
	ErrModelNotFound       = errors.New("model not found or disabled")
	ErrUserNotFound        = errors.New("user not found")
)

type Reservation struct {
	PricePerCall int64
	Reserved     int64
	Free         bool
	ModelSlug    string
}

type AppendFunc func(ctx context.Context, tx pgx.Tx, in ledger.EventInput) (*db.Event, error)

type ReserveParams struct {
	UserID         string
	ModelSlug      string
	RequestID      string
	APIKeyID       *string
	Route          string // "direct", "auto", or "workflow"
	Source         string // "api" or "playground"
	MatchedKeyword string // keyword, "direct", or "fallback"
	PromptChars    int    // rune count of prompt
	WorkflowID     *string
	RunID          *string
}

// Reserve performs atomic pre-check and deduction within a single transaction.
// Enforces LOCK ORDER: balances row FOR UPDATE first, then ledger_head FOR UPDATE in ledger.Append.
// Requirement 4: Reads price_per_call inside the reservation transaction (no price cache).
// Requirement 3: Never store the raw prompt. Ledger payloads record route, resolved slug,
// matched_keyword ("fallback" if none), and prompt_chars (length only).
func Reserve(
	ctx context.Context,
	pool *pgxpool.Pool,
	appendFn AppendFunc,
	p ReserveParams,
) (*Reservation, error) {
	if appendFn == nil {
		appendFn = ledger.Append
	}
	var userUUID pgtype.UUID
	if err := userUUID.Scan(p.UserID); err != nil {
		return nil, fmt.Errorf("invalid user uuid: %w", err)
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction error: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	txQueries := db.New(tx)

	// 1. Read price_per_call from models inside transaction (Requirement 4)
	price, err := txQueries.GetModelPriceForExecution(ctx, p.ModelSlug)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrModelNotFound
		}
		return nil, fmt.Errorf("lookup model price error: %w", err)
	}

	// 2. LOCK ORDER: balances row FOR UPDATE first
	bal, err := txQueries.GetBalanceForUpdate(ctx, userUUID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("get balance for update error: %w", err)
	}

	var reserved int64
	var isFree bool

	// 3. Quota & Balance logic
	if bal.FreeUsed < FreeCallsLimit {
		// Free promotional call
		isFree = true
		reserved = 0
		err = txQueries.UpdateBalanceAndFreeUsed(ctx, db.UpdateBalanceAndFreeUsedParams{
			UserID:   userUUID,
			Balance:  bal.Balance,
			FreeUsed: bal.FreeUsed + 1,
		})
	} else if bal.Balance >= price {
		// Paid call: deduct balance immediately upon reservation
		isFree = false
		reserved = price
		err = txQueries.UpdateBalanceAndFreeUsed(ctx, db.UpdateBalanceAndFreeUsedParams{
			UserID:   userUUID,
			Balance:  bal.Balance - price,
			FreeUsed: bal.FreeUsed,
		})
	} else {
		// Insufficient funds: 402, no event created, model not called
		return nil, ErrInsufficientBalance
	}

	if err != nil {
		return nil, fmt.Errorf("update balance reservation error: %w", err)
	}

	route := p.Route
	if route == "" {
		route = "direct"
	}
	matchedKw := p.MatchedKeyword
	if matchedKw == "" {
		matchedKw = "fallback"
	}

	// 4. LOCK ORDER: ledger_head locked SECOND inside ledger.Append
	// Requirement 3: Never store the raw prompt.
	payload := map[string]any{
		"route":           route,
		"routed":          route, // for backward compatibility
		"model_slug":      p.ModelSlug,
		"reserved":        reserved,
		"free":            isFree,
		"source":          p.Source,
		"matched_keyword": matchedKw,
		"prompt_chars":    p.PromptChars,
	}
	if p.WorkflowID != nil {
		payload["workflow_id"] = *p.WorkflowID
	}
	if p.RunID != nil {
		payload["run_id"] = *p.RunID
	}

	_, err = appendFn(ctx, tx, ledger.EventInput{
		RequestID: &p.RequestID,
		UserID:    &p.UserID,
		APIKeyID:  p.APIKeyID,
		Type:      "request.received",
		Payload:   payload,
	})
	if err != nil {
		return nil, fmt.Errorf("append request.received error: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit reservation error: %w", err)
	}

	return &Reservation{
		PricePerCall: price,
		Reserved:     reserved,
		Free:         isFree,
		ModelSlug:    p.ModelSlug,
	}, nil
}

// ReserveLegacy wraps Reserve with the older flat parameter list.
func ReserveLegacy(
	ctx context.Context,
	pool *pgxpool.Pool,
	appendFn AppendFunc,
	userID string,
	modelSlug string,
	requestID string,
	apiKeyID *string,
	routed string,
	source string,
) (*Reservation, error) {
	return Reserve(ctx, pool, appendFn, ReserveParams{
		UserID:         userID,
		ModelSlug:      modelSlug,
		RequestID:      requestID,
		APIKeyID:       apiKeyID,
		Route:          routed,
		Source:         source,
		MatchedKeyword: "fallback",
		PromptChars:    0,
	})
}

// Refund refunds a reserved amount or restores free quota upon worker failure in a single transaction.
// Enforces LOCK ORDER: balances row FOR UPDATE first, then ledger_head FOR UPDATE in ledger.Append.
// Under the lock, checks that no terminal event exists for that request_id to prevent double refund.
func Refund(
	ctx context.Context,
	pool *pgxpool.Pool,
	appendFn AppendFunc,
	requestID string,
	userID string,
	modelSlug string,
	reserved int64,
	wasFree bool,
	errorCode string,
	latencyMs int64,
	extraPayload ...map[string]any,
) error {
	if appendFn == nil {
		appendFn = ledger.Append
	}

	var userUUID pgtype.UUID
	if err := userUUID.Scan(userID); err != nil {
		return fmt.Errorf("invalid user uuid: %w", err)
	}
	var reqUUID pgtype.UUID
	if err := reqUUID.Scan(requestID); err != nil {
		return fmt.Errorf("invalid request uuid: %w", err)
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction error: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	txQueries := db.New(tx)

	// 1. LOCK ORDER: balances row FOR UPDATE first
	bal, err := txQueries.GetBalanceForUpdate(ctx, userUUID)
	if err != nil {
		return fmt.Errorf("get balance for update error: %w", err)
	}

	// 2. CHECK under lock: verify no terminal event exists for that request_id
	terminalExists, err := txQueries.CheckRequestTerminalExists(ctx, reqUUID)
	if err != nil {
		return fmt.Errorf("check terminal exists error: %w", err)
	}
	if terminalExists {
		log.Printf("[billing] warning: request %s already has terminal event; skipping refund to prevent double refund", requestID)
		return nil
	}

	newBalance := bal.Balance
	newFreeUsed := bal.FreeUsed

	if wasFree {
		if newFreeUsed > 0 {
			newFreeUsed--
		}
	} else if reserved > 0 {
		newBalance += reserved
	}

	err = txQueries.UpdateBalanceAndFreeUsed(ctx, db.UpdateBalanceAndFreeUsedParams{
		UserID:   userUUID,
		Balance:  newBalance,
		FreeUsed: newFreeUsed,
	})
	if err != nil {
		return fmt.Errorf("update balance for refund error: %w", err)
	}

	// 3. LOCK ORDER: ledger_head locked SECOND inside ledger.Append
	payload := map[string]any{
		"model_slug": modelSlug,
		"refund":     reserved,
		"free":       wasFree,
		"error_code": errorCode,
		"latency_ms": latencyMs,
	}
	for _, extra := range extraPayload {
		for k, v := range extra {
			payload[k] = v
		}
	}

	_, err = appendFn(ctx, tx, ledger.EventInput{
		RequestID: &requestID,
		UserID:    &userID,
		Type:      "request.failed",
		Payload:   payload,
	})
	if err != nil {
		return fmt.Errorf("append request.failed error: %w", err)
	}

	return tx.Commit(ctx)
}

// SettleExecuted records request.executed.
// Enforces LOCK ORDER: balances row FOR UPDATE first, then ledger_head FOR UPDATE in ledger.Append.
// If a terminal event already exists (e.g. reconciler abandoned the request), the late execution
// is NOT charged, logs a warning, and returns charge 0.
func SettleExecuted(
	ctx context.Context,
	pool *pgxpool.Pool,
	appendFn AppendFunc,
	requestID string,
	userID string,
	apiKeyID *string,
	modelSlug string,
	modelVersion string,
	reserved int64,
	wasFree bool,
	latencyMs int64,
	source string,
	extraPayload ...map[string]any,
) (int64, error) {
	if appendFn == nil {
		appendFn = ledger.Append
	}

	var userUUID pgtype.UUID
	if err := userUUID.Scan(userID); err != nil {
		return 0, fmt.Errorf("invalid user uuid: %w", err)
	}
	var reqUUID pgtype.UUID
	if err := reqUUID.Scan(requestID); err != nil {
		return 0, fmt.Errorf("invalid request uuid: %w", err)
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("begin transaction error: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	txQueries := db.New(tx)

	// 1. LOCK ORDER: balances row FOR UPDATE first
	_, err = txQueries.GetBalanceForUpdate(ctx, userUUID)
	if err != nil {
		return 0, fmt.Errorf("get balance for update error: %w", err)
	}

	// 2. CHECK under lock: verify no terminal event exists for that request_id
	terminalExists, err := txQueries.CheckRequestTerminalExists(ctx, reqUUID)
	if err != nil {
		return 0, fmt.Errorf("check terminal exists error: %w", err)
	}
	if terminalExists {
		// Reconciler already abandoned or another terminal event exists.
		// The late execution is NOT charged; log a warning and return 0 charge.
		log.Printf("[billing] warning: request %s already has terminal event (reconciler abandoned); late execution not charged", requestID)
		return 0, nil
	}

	// 3. LOCK ORDER: ledger_head locked SECOND inside ledger.Append
	payload := map[string]any{
		"charge":        reserved,
		"free":          wasFree,
		"latency_ms":    latencyMs,
		"model_slug":    modelSlug,
		"model_version": modelVersion,
		"source":        source,
	}
	for _, extra := range extraPayload {
		for k, v := range extra {
			payload[k] = v
		}
	}

	_, err = appendFn(ctx, tx, ledger.EventInput{
		RequestID: &requestID,
		UserID:    &userID,
		APIKeyID:  apiKeyID,
		Type:      "request.executed",
		Payload:   payload,
	})
	if err != nil {
		return 0, fmt.Errorf("append request.executed error: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("commit settle error: %w", err)
	}

	return reserved, nil
}

// Credit adds balance to a user account in a single transaction with a balance.credited ledger event.
// Enforces LOCK ORDER: balances row FOR UPDATE first, then ledger_head FOR UPDATE in ledger.Append.
func Credit(
	ctx context.Context,
	pool *pgxpool.Pool,
	adminID string,
	targetUserID string,
	amountMicro int64,
	note string,
) (int64, error) {
	var userUUID pgtype.UUID
	if err := userUUID.Scan(targetUserID); err != nil {
		return 0, fmt.Errorf("invalid user uuid: %w", err)
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("begin transaction error: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	txQueries := db.New(tx)

	// 1. LOCK ORDER: balances row FOR UPDATE first
	bal, err := txQueries.GetBalanceForUpdate(ctx, userUUID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, ErrUserNotFound
		}
		return 0, fmt.Errorf("get balance for update error: %w", err)
	}

	newBalance := bal.Balance + amountMicro

	err = txQueries.UpdateBalanceAndFreeUsed(ctx, db.UpdateBalanceAndFreeUsedParams{
		UserID:   userUUID,
		Balance:  newBalance,
		FreeUsed: bal.FreeUsed,
	})
	if err != nil {
		return 0, fmt.Errorf("update balance error: %w", err)
	}

	// 2. LOCK ORDER: ledger_head locked SECOND inside ledger.Append
	payload := map[string]any{
		"amount":      amountMicro,
		"by_admin_id": adminID,
		"note":        note,
	}

	_, err = ledger.Append(ctx, tx, ledger.EventInput{
		UserID:  &targetUserID,
		Type:    "balance.credited",
		Payload: payload,
	})
	if err != nil {
		return 0, fmt.Errorf("append balance.credited error: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("commit credit error: %w", err)
	}

	return newBalance, nil
}
