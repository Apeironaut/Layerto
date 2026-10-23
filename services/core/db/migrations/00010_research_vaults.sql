-- +goose Up
-- Pillar 1, 2, 3: Hard-isolated Research Areas, Specimen Vaults, Dataset Split Integrity,
-- Ablation Matrices, Visual Error Arena, Interdisciplinary Collaboration Contracts, Domain Insights, and Publications Monetization

ALTER TABLE research_areas ADD COLUMN IF NOT EXISTS discipline TEXT NOT NULL DEFAULT 'zoology';
ALTER TABLE research_areas ADD COLUMN IF NOT EXISTS hypothesis TEXT NOT NULL DEFAULT '';
ALTER TABLE research_areas ADD COLUMN IF NOT EXISTS reproducibility_lock BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE research_areas ADD COLUMN IF NOT EXISTS storage_bytes_used BIGINT NOT NULL DEFAULT 0;
ALTER TABLE research_areas ADD COLUMN IF NOT EXISTS gpu_seconds_used BIGINT NOT NULL DEFAULT 0;
ALTER TABLE research_areas ADD COLUMN IF NOT EXISTS custom_metrics JSONB NOT NULL DEFAULT '[]';
ALTER TABLE research_areas ADD COLUMN IF NOT EXISTS isolation_level TEXT NOT NULL DEFAULT 'air_gapped';

-- ---- Domain View: Specimen & Media Vault
CREATE TABLE IF NOT EXISTS research_specimens (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id          UUID NOT NULL REFERENCES research_areas(id) ON DELETE CASCADE,
  owner_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  taxonomy_species TEXT NOT NULL CHECK (char_length(taxonomy_species) BETWEEN 1 AND 200),
  common_name      TEXT NOT NULL DEFAULT '',
  media_url        TEXT NOT NULL DEFAULT '',
  media_type       TEXT NOT NULL DEFAULT 'photo' CHECK (media_type IN ('photo', 'video', 'audio')),
  gps_lat          DOUBLE PRECISION,
  gps_lng          DOUBLE PRECISION,
  habitat          TEXT NOT NULL DEFAULT '',
  morphometrics    JSONB NOT NULL DEFAULT '{}',
  observation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes            TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_specimens_area_idx ON research_specimens (area_id, created_at DESC);

-- ---- Tech Workbench: Dataset & Split Integrity Hub
CREATE TABLE IF NOT EXISTS research_dataset_splits (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id            UUID NOT NULL REFERENCES research_areas(id) ON DELETE CASCADE,
  owner_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version_tag        TEXT NOT NULL CHECK (char_length(version_tag) BETWEEN 1 AND 50),
  description        TEXT NOT NULL DEFAULT '',
  total_samples      INT NOT NULL DEFAULT 0,
  train_count        INT NOT NULL DEFAULT 0,
  val_count          INT NOT NULL DEFAULT 0,
  test_count         INT NOT NULL DEFAULT 0,
  class_distribution JSONB NOT NULL DEFAULT '{}',
  leakage_detected   BOOLEAN NOT NULL DEFAULT false,
  leakage_details    JSONB NOT NULL DEFAULT '[]',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_dataset_splits_area_idx ON research_dataset_splits (area_id, created_at DESC);

-- ---- Tech Workbench: Ablation & Experiment Matrix
CREATE TABLE IF NOT EXISTS research_ablation_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id         UUID NOT NULL REFERENCES research_areas(id) ON DELETE CASCADE,
  owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  run_name        TEXT NOT NULL CHECK (char_length(run_name) BETWEEN 1 AND 120),
  architecture    TEXT NOT NULL CHECK (char_length(architecture) BETWEEN 1 AND 100),
  is_baseline     BOOLEAN NOT NULL DEFAULT false,
  hyperparameters JSONB NOT NULL DEFAULT '{}',
  metrics         JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('planned', 'running', 'completed', 'failed')),
  notes           TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_ablation_runs_area_idx ON research_ablation_runs (area_id, created_at DESC);

-- ---- Tech Workbench: Visual Error Arena
CREATE TABLE IF NOT EXISTS research_arena_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id            UUID NOT NULL REFERENCES research_areas(id) ON DELETE CASCADE,
  owner_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  specimen_id        UUID REFERENCES research_specimens(id) ON DELETE SET NULL,
  image_url          TEXT NOT NULL,
  sample_name        TEXT NOT NULL,
  ground_truth       JSONB NOT NULL DEFAULT '{}',
  model_a_prediction JSONB NOT NULL DEFAULT '{}',
  model_b_prediction JSONB NOT NULL DEFAULT '{}',
  failure_category   TEXT NOT NULL DEFAULT 'agreement' CHECK (failure_category IN ('agreement', 'false_positive', 'disagreement', 'boundary_uncertainty')),
  difficulty         TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_arena_items_area_idx ON research_arena_items (area_id, created_at DESC);

-- ---- Pillar 2: Interdisciplinary Tech Collaboration Hub
CREATE TABLE IF NOT EXISTS research_collaboration_contracts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id                 UUID NOT NULL REFERENCES research_areas(id) ON DELETE CASCADE,
  owner_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collaborator_email      TEXT NOT NULL,
  collaborator_name       TEXT NOT NULL,
  team_name               TEXT NOT NULL DEFAULT '',
  collaboration_model     TEXT NOT NULL CHECK (collaboration_model IN ('voluntary_credit', 'royalty_split', 'paid_bounty')),
  credit_roles            JSONB NOT NULL DEFAULT '[]',
  royalty_percentage      DOUBLE PRECISION NOT NULL DEFAULT 0.0 CHECK (royalty_percentage >= 0 AND royalty_percentage <= 100),
  bounty_amount_cents     BIGINT NOT NULL DEFAULT 0 CHECK (bounty_amount_cents >= 0),
  bounty_status           TEXT NOT NULL DEFAULT 'pending' CHECK (bounty_status IN ('pending', 'escrow_funded', 'completed', 'paid')),
  data_sandbox_permission TEXT NOT NULL DEFAULT 'compute_only' CHECK (data_sandbox_permission IN ('compute_only', 'download_permitted')),
  status                  TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'completed')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_collab_area_idx ON research_collaboration_contracts (area_id, created_at DESC);

-- ---- Bridge: Domain Insight Widgets published by Tech Team
CREATE TABLE IF NOT EXISTS research_domain_insights (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id      UUID NOT NULL REFERENCES research_areas(id) ON DELETE CASCADE,
  owner_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 250),
  insight_type TEXT NOT NULL DEFAULT 'model_accuracy' CHECK (insight_type IN ('model_accuracy', 'population_trend', 'morphometric_distribution', 'detection_summary')),
  content      TEXT NOT NULL,
  chart_data   JSONB NOT NULL DEFAULT '{}',
  pinned       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_domain_insights_area_idx ON research_domain_insights (area_id, pinned DESC, created_at DESC);

-- ---- Pillar 3: Researcher Publication & Monetization Studio
CREATE TABLE IF NOT EXISTS research_publications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id             UUID NOT NULL REFERENCES research_areas(id) ON DELETE CASCADE,
  owner_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title               TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  doi                 TEXT NOT NULL DEFAULT '',
  abstract            TEXT NOT NULL DEFAULT '',
  pdf_url             TEXT NOT NULL DEFAULT '',
  pricing_model       TEXT NOT NULL DEFAULT 'tiered' CHECK (pricing_model IN ('open_access', 'tiered', 'commercial')),
  paper_price_cents   BIGINT NOT NULL DEFAULT 0 CHECK (paper_price_cents >= 0),
  dataset_price_cents BIGINT NOT NULL DEFAULT 0 CHECK (dataset_price_cents >= 0),
  model_price_cents   BIGINT NOT NULL DEFAULT 0 CHECK (model_price_cents >= 0),
  royalty_split_rules JSONB NOT NULL DEFAULT '[]',
  downloads_count     INT NOT NULL DEFAULT 0 CHECK (downloads_count >= 0),
  gross_revenue_cents BIGINT NOT NULL DEFAULT 0 CHECK (gross_revenue_cents >= 0),
  is_published        BOOLEAN NOT NULL DEFAULT true,
  badges              JSONB NOT NULL DEFAULT '[]',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_publications_area_idx ON research_publications (area_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON research_specimens, research_dataset_splits,
  research_ablation_runs, research_arena_items, research_collaboration_contracts,
  research_domain_insights, research_publications TO layerto_app;

-- +goose Down
DROP TABLE IF EXISTS research_publications, research_domain_insights, research_collaboration_contracts,
  research_arena_items, research_ablation_runs, research_dataset_splits, research_specimens;
ALTER TABLE research_areas
  DROP COLUMN IF EXISTS discipline,
  DROP COLUMN IF EXISTS hypothesis,
  DROP COLUMN IF EXISTS reproducibility_lock,
  DROP COLUMN IF EXISTS storage_bytes_used,
  DROP COLUMN IF EXISTS gpu_seconds_used,
  DROP COLUMN IF EXISTS custom_metrics,
  DROP COLUMN IF EXISTS isolation_level;
