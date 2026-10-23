-- name: CreatePasswordResetToken :exec
INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
VALUES ($1, $2, $3);

-- name: GetPasswordResetTokenByHash :one
SELECT id, user_id, token_hash, expires_at, used_at, created_at
FROM password_reset_tokens
WHERE token_hash = $1;

-- name: MarkPasswordResetTokenUsed :execrows
UPDATE password_reset_tokens
SET used_at = now()
WHERE id = $1 AND used_at IS NULL AND expires_at > now();

-- name: InvalidatePasswordResetTokensForUser :exec
UPDATE password_reset_tokens
SET used_at = now()
WHERE user_id = $1 AND used_at IS NULL;

-- name: CountRecentPasswordResetTokens :one
SELECT count(*)
FROM password_reset_tokens
WHERE user_id = $1 AND created_at > $2;
