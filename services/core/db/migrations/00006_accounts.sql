-- +goose Up
-- Profile details collected at sign-up. Kept separate from users so existing
-- queries and the users row shape stay unchanged.
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 50),
    last_name  TEXT NOT NULL CHECK (char_length(last_name) BETWEEN 1 AND 50),
    -- 3-30 chars, lowercase letters, digits, dot and underscore; starts and ends with a letter or digit.
    username   CITEXT NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9][a-z0-9._]{1,28}[a-z0-9]$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One-time password reset tokens. Only a SHA-256 hash of the token is stored.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens (user_id, created_at);

GRANT SELECT, INSERT, UPDATE ON user_profiles TO layerto_app;
GRANT SELECT, INSERT, UPDATE ON password_reset_tokens TO layerto_app;

-- +goose Down
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS user_profiles;
