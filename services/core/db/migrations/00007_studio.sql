-- +goose Up
-- Layerto Studio: datasets + annotation, training, custom models, marketplace, researcher
-- workspace (projects, public profiles), subscription plans and model sites.

-- Platform settings (admin-editable), one JSON value per key.
CREATE TABLE IF NOT EXISTS platform_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO platform_settings (key, value) VALUES
  ('creator_reward_bps', '2500'),            -- creators earn 25% of each paid call on their public models
  ('gpu_price_per_hour', '1500000'),         -- micro-USD per GPU hour for Layerto training (1.50 USD)
  ('dataset_retention_days', '3'),           -- days after training before a not-kept dataset is deleted
  ('ltvision_endpoint', '"ltvision-ep"'),     -- RunPod endpoint that serves every user-trained LTVision model
  ('plans', '{"free":{"name":"Free","price":0,"projects":2,"storage_mb":500,"keep_datasets":false,"sites":1,"private_models":2},
              "researcher":{"name":"Researcher","price":9000000,"projects":20,"storage_mb":10240,"keep_datasets":true,"sites":5,"private_models":20},
              "lab":{"name":"Lab","price":49000000,"projects":200,"storage_mb":102400,"keep_datasets":true,"sites":50,"private_models":200}}')
ON CONFLICT (key) DO NOTHING;

-- Researcher workspace
CREATE TABLE IF NOT EXISTS researcher_profiles (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  headline    TEXT NOT NULL DEFAULT '' CHECK (char_length(headline) <= 120),
  bio         TEXT NOT NULL DEFAULT '' CHECK (char_length(bio) <= 2000),
  affiliation TEXT NOT NULL DEFAULT '' CHECK (char_length(affiliation) <= 120),
  website     TEXT NOT NULL DEFAULT '' CHECK (char_length(website) <= 200),
  is_public   BOOLEAN NOT NULL DEFAULT false,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  slug        TEXT NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$'),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  notes       TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 20000),
  is_public   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);

-- Datasets: images are stored encrypted; `keep` = false means they are deleted
-- `dataset_retention_days` after the last training finishes (or when the user deletes them).
CREATE TABLE IF NOT EXISTS datasets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  name         TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  classes      JSONB NOT NULL DEFAULT '[]',
  keep         BOOLEAN NOT NULL DEFAULT false,
  delete_after TIMESTAMPTZ,
  purged_at    TIMESTAMPTZ,
  bytes        BIGINT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS datasets_user_idx ON datasets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS datasets_delete_after_idx ON datasets (delete_after) WHERE purged_at IS NULL;

CREATE TABLE IF NOT EXISTS dataset_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id  UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  mime        TEXT NOT NULL,
  width       INT NOT NULL,
  height      INT NOT NULL,
  bytes       BIGINT NOT NULL,
  boxes       JSONB NOT NULL DEFAULT '[]',  -- [{"c": classIndex, "x":..,"y":..,"w":..,"h":..}] in pixels
  labeled     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dataset_images_ds_idx ON dataset_images (dataset_id, created_at);

-- Training jobs. runner: 'layerto' (our GPUs, paid in credits) or 'notebook' (user's own Colab/Kaggle).
-- token_hash authorises the trainer (worker or notebook) for this one job.
CREATE TABLE IF NOT EXISTS training_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dataset_id    UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  name          TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  runner        TEXT NOT NULL CHECK (runner IN ('layerto', 'notebook')),
  preset        TEXT NOT NULL CHECK (preset IN ('fast', 'balanced', 'best', 'custom')),
  params        JSONB NOT NULL,
  status        TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  progress      JSONB NOT NULL DEFAULT '{}',
  token_hash    TEXT,
  token_expires TIMESTAMPTZ,
  charged       BIGINT NOT NULL DEFAULT 0,
  model_id      UUID REFERENCES models(id) ON DELETE SET NULL,
  error         TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS training_jobs_user_idx ON training_jobs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS training_jobs_queue_idx ON training_jobs (created_at) WHERE status = 'queued' AND runner = 'layerto';

-- Custom (user-trained) models live in `models` too, so pricing, billing and the gateway work
-- unchanged. This table adds ownership, visibility and the weights.
CREATE TABLE IF NOT EXISTS model_ownership (
  model_id      UUID PRIMARY KEY REFERENCES models(id) ON DELETE CASCADE,
  owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  job_id        UUID REFERENCES training_jobs(id) ON DELETE SET NULL,
  visibility    TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'pending', 'public', 'rejected')),
  review_note   TEXT NOT NULL DEFAULT '',
  weights_key   TEXT NOT NULL,
  classes       JSONB NOT NULL DEFAULT '[]',
  metrics       JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS model_ownership_owner_idx ON model_ownership (owner_id);

-- Subscription plans (paid from the prepaid balance; admins can grant plans).
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan        TEXT NOT NULL DEFAULT 'free',
  period_end  TIMESTAMPTZ,
  auto_renew  BOOLEAN NOT NULL DEFAULT true,
  granted_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Model sites: a hosted page for one model. Visitors' calls go through a server-side proxy
-- (no API key in the browser) and are billed to the site owner, up to a monthly cap.
CREATE TABLE IF NOT EXISTS model_sites (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  model_id         UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  slug             TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  title            TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  tagline          TEXT NOT NULL DEFAULT '' CHECK (char_length(tagline) <= 160),
  description      TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  template         TEXT NOT NULL DEFAULT 'demo' CHECK (template IN ('demo', 'product', 'research')),
  theme            JSONB NOT NULL DEFAULT '{}',
  cta_label        TEXT NOT NULL DEFAULT '' CHECK (char_length(cta_label) <= 40),
  cta_url          TEXT NOT NULL DEFAULT '' CHECK (char_length(cta_url) <= 300),
  monthly_cap      BIGINT NOT NULL DEFAULT 5000000 CHECK (monthly_cap >= 0),
  published        BOOLEAN NOT NULL DEFAULT false,
  disabled_by_admin BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS model_sites_user_idx ON model_sites (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON platform_settings, researcher_profiles, projects, datasets, dataset_images,
  training_jobs, model_ownership, subscriptions, model_sites TO layerto_app;
GRANT INSERT, UPDATE, DELETE ON models TO layerto_app;

-- +goose Down
DROP TABLE IF EXISTS model_sites;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS model_ownership;
DROP TABLE IF EXISTS training_jobs;
DROP TABLE IF EXISTS dataset_images;
DROP TABLE IF EXISTS datasets;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS researcher_profiles;
DROP TABLE IF EXISTS platform_settings;
