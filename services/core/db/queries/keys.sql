-- name: CreateAPIKey :one
INSERT INTO api_keys (id, user_id, name, prefix, key_hash, expires_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, user_id, name, prefix, key_hash, last_used_at, revoked_at, expires_at, created_at;

-- name: GetAPIKeyByPrefix :one
SELECT id, user_id, name, prefix, key_hash, last_used_at, revoked_at, expires_at, created_at
FROM api_keys
WHERE prefix = $1;

-- name: RevokeAPIKey :exec
UPDATE api_keys
SET revoked_at = now()
WHERE id = $1 AND user_id = $2;

-- name: UpdateAPIKeyLastUsed :exec
UPDATE api_keys
SET last_used_at = now()
WHERE id = $1;

-- name: CountActiveKeysForUser :one
SELECT count(*)
FROM api_keys
WHERE user_id = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now());

-- name: ListAPIKeysByUserID :many
SELECT id, user_id, name, prefix, key_hash, last_used_at, revoked_at, expires_at, created_at
FROM api_keys
WHERE user_id = $1
ORDER BY created_at DESC;


