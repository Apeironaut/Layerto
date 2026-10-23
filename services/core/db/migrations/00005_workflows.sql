-- +goose Up
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
    description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
    definition JSONB NOT NULL,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows (user_id) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON workflows TO layerto_app;

-- +goose Down
DROP TABLE IF EXISTS workflows;
