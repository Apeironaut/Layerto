-- +goose Up
-- Research Ecosystem Monorepo Persisted Schema:
-- Isolated research_areas, area_collaborators, tech_bounties, publications, and royalty_splits

CREATE TABLE IF NOT EXISTS research_areas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  name                TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  description         TEXT NOT NULL DEFAULT '',
  color               TEXT NOT NULL DEFAULT '#06b6d4',
  discipline          TEXT NOT NULL DEFAULT 'zoology',
  hypothesis          TEXT NOT NULL DEFAULT '',
  reproducibility_lock BOOLEAN NOT NULL DEFAULT false,
  storage_quota_bytes BIGINT NOT NULL DEFAULT 53687091200,
  storage_bytes_used  BIGINT NOT NULL DEFAULT 0,
  gpu_credits_budget  INT NOT NULL DEFAULT 1000,
  gpu_credits_used    INT NOT NULL DEFAULT 0,
  gpu_seconds_used    BIGINT NOT NULL DEFAULT 0,
  custom_metrics      JSONB NOT NULL DEFAULT '[]',
  isolation_level     TEXT NOT NULL DEFAULT 'air_gapped',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS area_collaborators (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id                 UUID NOT NULL REFERENCES research_areas(id) ON DELETE CASCADE,
  user_id                 UUID REFERENCES users(id) ON DELETE CASCADE,
  collaborator_email      TEXT NOT NULL,
  collaborator_name       TEXT NOT NULL,
  role                    TEXT NOT NULL DEFAULT 'editor', -- 'owner', 'editor', 'viewer'
  collaboration_model     TEXT NOT NULL DEFAULT 'voluntary_credit', -- 'voluntary_credit', 'royalty_split', 'paid_bounty'
  credit_roles            JSONB NOT NULL DEFAULT '[]', -- CRediT taxonomy roles
  royalty_percentage      DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  bounty_amount_cents     BIGINT NOT NULL DEFAULT 0,
  gpu_credit_cap          INT NOT NULL DEFAULT 500,
  gpu_credits_consumed    INT NOT NULL DEFAULT 0,
  grant_budget_cents      BIGINT NOT NULL DEFAULT 100000,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tech_bounties (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id             UUID NOT NULL REFERENCES research_areas(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  bounty_amount_cents BIGINT NOT NULL DEFAULT 0,
  escrow_funded       BOOLEAN NOT NULL DEFAULT false,
  status              TEXT NOT NULL DEFAULT 'open', -- 'open', 'claimed', 'submitted', 'awarded', 'cancelled'
  claimed_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  deliverable_url     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS publications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id             UUID NOT NULL REFERENCES research_areas(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  doi                 TEXT,
  abstract            TEXT NOT NULL DEFAULT '',
  pdf_url             TEXT,
  pricing_model       TEXT NOT NULL DEFAULT 'open_access', -- 'open_access', 'tiered', 'commercial'
  paper_price_cents   BIGINT NOT NULL DEFAULT 0,
  dataset_price_cents BIGINT NOT NULL DEFAULT 0,
  model_price_cents   BIGINT NOT NULL DEFAULT 0,
  is_published        BOOLEAN NOT NULL DEFAULT false,
  published_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS royalty_splits (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id      UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  beneficiary_email   TEXT NOT NULL,
  beneficiary_name    TEXT NOT NULL,
  split_percentage    DOUBLE PRECISION NOT NULL CHECK (split_percentage >= 0.0 AND split_percentage <= 100.0),
  credit_role         TEXT NOT NULL DEFAULT 'Formal Analysis',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE IF EXISTS royalty_splits CASCADE;
DROP TABLE IF EXISTS publications CASCADE;
DROP TABLE IF EXISTS tech_bounties CASCADE;
DROP TABLE IF EXISTS area_collaborators CASCADE;
