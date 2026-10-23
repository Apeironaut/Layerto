-- name: GetLedgerHeadForUpdate :one
SELECT id, last_seq, last_hash
FROM ledger_head
WHERE id = 1
FOR UPDATE;

-- name: UpdateLedgerHead :exec
UPDATE ledger_head
SET last_seq = $1, last_hash = $2
WHERE id = 1;

-- name: InsertEvent :exec
INSERT INTO events (seq, request_id, user_id, api_key_id, type, payload, prev_hash, hash, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);

-- name: ListEventsForVerify :many
SELECT seq, request_id, user_id, api_key_id, type, payload, prev_hash, hash, created_at
FROM events
ORDER BY seq ASC;

-- name: UpdateBalanceForCredit :exec
INSERT INTO balances (user_id, balance, free_used)
VALUES ($1, $2, 0)
ON CONFLICT (user_id) DO UPDATE
SET balance = balances.balance + EXCLUDED.balance;
