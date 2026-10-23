-- name: GetBalanceForUpdate :one
SELECT user_id, balance, free_used
FROM balances
WHERE user_id = $1
FOR UPDATE;

-- name: UpdateBalanceAndFreeUsed :exec
UPDATE balances
SET balance = $2, free_used = $3
WHERE user_id = $1;
