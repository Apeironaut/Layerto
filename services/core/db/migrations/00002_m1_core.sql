-- +goose Up

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  prefix       TEXT UNIQUE NOT NULL,
  key_hash     TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Models table
CREATE TABLE IF NOT EXISTS models (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL,
  license         TEXT NOT NULL,
  is_open         BOOLEAN NOT NULL,
  runpod_endpoint TEXT NOT NULL,
  price_per_call  BIGINT NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  meta            JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Routes table (Auto router rules)
CREATE TABLE IF NOT EXISTS routes (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword   TEXT NOT NULL,
  model_id  UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  priority  INT NOT NULL DEFAULT 100
);

-- 6. Events table (Append-only ledger)
CREATE TABLE IF NOT EXISTS events (
  seq         BIGINT PRIMARY KEY,
  request_id  UUID,
  user_id     UUID,
  api_key_id  UUID,
  type        TEXT NOT NULL,
  payload     JSONB NOT NULL,
  prev_hash   TEXT NOT NULL,
  hash        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS events_user_idx ON events(user_id, seq);
CREATE INDEX IF NOT EXISTS events_request_idx ON events(request_id);

-- Prevent any UPDATE or DELETE on events
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION prevent_events_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'events table is append-only: updates and deletes are prohibited';
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

DROP TRIGGER IF EXISTS trg_events_prevent_mutation ON events;
CREATE TRIGGER trg_events_prevent_mutation
BEFORE UPDATE OR DELETE ON events
FOR EACH ROW
EXECUTE FUNCTION prevent_events_mutation();

-- Prevent any TRUNCATE on events
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION prevent_events_truncate()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'events table is append-only: truncate is prohibited';
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

DROP TRIGGER IF EXISTS trg_events_prevent_truncate ON events;
CREATE TRIGGER trg_events_prevent_truncate
BEFORE TRUNCATE ON events
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_events_truncate();

-- 7. Ledger head table (Serialization anchor)
CREATE TABLE IF NOT EXISTS ledger_head (
  id        INT PRIMARY KEY CHECK (id = 1),
  last_seq  BIGINT NOT NULL,
  last_hash TEXT NOT NULL
);

-- Seed ledger_head genesis row (seq = 0, 64 zeros)
INSERT INTO ledger_head (id, last_seq, last_hash)
VALUES (1, 0, '0000000000000000000000000000000000000000000000000000000000000000')
ON CONFLICT (id) DO NOTHING;

-- 8. Balances table (Read model)
CREATE TABLE IF NOT EXISTS balances (
  user_id   UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance   BIGINT NOT NULL DEFAULT 0,
  free_used INT NOT NULL DEFAULT 0
);

-- Seed initial models
INSERT INTO models (slug, name, description, license, is_open, runpod_endpoint, price_per_call, meta)
VALUES
  ('turtle-id', 'Turtle ID', 'Closed specialist vision model for sea turtle species identification', 'proprietary', false, 'turtle-id-ep', 2000, '{}'),
  ('bioclip', 'BioCLIP', 'Open general biological taxonomic classification model', 'see model card', true, 'bioclip-ep', 1000, '{}')
ON CONFLICT (slug) DO UPDATE
SET price_per_call = EXCLUDED.price_per_call,
    runpod_endpoint = EXCLUDED.runpod_endpoint,
    license = EXCLUDED.license,
    meta = EXCLUDED.meta;

-- 9. Database roles per DESIGN §5.3
-- +goose StatementBegin
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'layerto_migrator') THEN
    CREATE ROLE layerto_migrator WITH NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'layerto_app') THEN
    CREATE ROLE layerto_app WITH NOLOGIN;
  END IF;
END
$$;
-- +goose StatementEnd

-- Grant permissions to layerto_migrator
GRANT USAGE, CREATE ON SCHEMA public TO layerto_migrator;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO layerto_migrator;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO layerto_migrator;

-- Grant permissions to layerto_app
GRANT USAGE ON SCHEMA public TO layerto_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON users, sessions, api_keys, models, routes, balances, ledger_head TO layerto_app;
GRANT SELECT, INSERT ON events TO layerto_app;
REVOKE UPDATE, DELETE, TRUNCATE ON events FROM layerto_app;
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM layerto_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO layerto_app;

-- +goose Down
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM layerto_app;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM layerto_app;
REVOKE USAGE ON SCHEMA public FROM layerto_app;

REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM layerto_migrator;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM layerto_migrator;

DROP TABLE IF EXISTS balances;
DROP TABLE IF EXISTS ledger_head;
DROP TRIGGER IF EXISTS trg_events_prevent_truncate ON events;
DROP FUNCTION IF EXISTS prevent_events_truncate();
DROP TRIGGER IF EXISTS trg_events_prevent_mutation ON events;
DROP FUNCTION IF EXISTS prevent_events_mutation();
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS routes;
DROP TABLE IF EXISTS models;
DROP TABLE IF EXISTS api_keys;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;
