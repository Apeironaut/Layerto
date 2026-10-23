-- name: CreateSession :one
INSERT INTO sessions (id, user_id, expires_at)
VALUES ($1, $2, $3)
RETURNING id, user_id, expires_at, created_at;

-- name: GetSessionByID :one
SELECT id, user_id, expires_at, created_at
FROM sessions
WHERE id = $1;

-- name: DeleteSession :exec
DELETE FROM sessions
WHERE id = $1;

-- name: DeleteSessionsForUser :exec
DELETE FROM sessions
WHERE user_id = $1;

-- name: DeleteOtherSessionsForUser :exec
DELETE FROM sessions
WHERE user_id = $1 AND id <> $2;
