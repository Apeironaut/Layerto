-- name: CreateUserProfile :one
INSERT INTO user_profiles (user_id, first_name, last_name, username)
VALUES ($1, $2, $3, $4)
RETURNING user_id, first_name, last_name, username, created_at, updated_at;

-- name: GetUserProfile :one
SELECT user_id, first_name, last_name, username, created_at, updated_at
FROM user_profiles
WHERE user_id = $1;

-- name: GetUserProfileByUsername :one
SELECT user_id, first_name, last_name, username, created_at, updated_at
FROM user_profiles
WHERE username = $1;

-- name: UpdateUserProfileNames :one
UPDATE user_profiles
SET first_name = $2, last_name = $3, updated_at = now()
WHERE user_id = $1
RETURNING user_id, first_name, last_name, username, created_at, updated_at;

-- name: ListUserProfilesByIDs :many
SELECT user_id, first_name, last_name, username, created_at, updated_at
FROM user_profiles
WHERE user_id = ANY($1::uuid[]);
