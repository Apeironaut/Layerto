-- +goose Up
ALTER TABLE api_keys ADD COLUMN expires_at TIMESTAMPTZ NULL;

-- +goose Down
ALTER TABLE api_keys DROP COLUMN IF EXISTS expires_at;
