-- name: GetUserByID :one
SELECT id, email, password_hash, name, role, status, created_at
FROM users
WHERE id = $1;

-- name: GetUserByEmail :one
SELECT id, email, password_hash, name, role, status, created_at
FROM users
WHERE email = $1;

-- name: CreateUser :one
INSERT INTO users (id, email, password_hash, name, role, status)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, email, password_hash, name, role, status, created_at;

-- name: ApproveUser :one
UPDATE users
SET status = 'active'
WHERE id = $1 AND status = 'pending'
RETURNING id, email, password_hash, name, role, status, created_at;

-- name: UpdateUserStatus :one
UPDATE users
SET status = $2
WHERE id = $1
RETURNING id, email, password_hash, name, role, status, created_at;

-- name: ListUsersByStatus :many
SELECT id, email, password_hash, name, role, status, created_at
FROM users
WHERE ($1::text = '' OR status = $1)
ORDER BY created_at DESC;

-- name: CreateBalance :exec
INSERT INTO balances (user_id, balance, free_used)
VALUES ($1, $2, $3)
ON CONFLICT (user_id) DO NOTHING;

-- name: GetBalance :one
SELECT user_id, balance, free_used
FROM balances
WHERE user_id = $1;

-- name: UpdateUserPassword :exec
UPDATE users
SET password_hash = $2
WHERE id = $1;

-- name: UpdateUserName :exec
UPDATE users
SET name = $2
WHERE id = $1;
