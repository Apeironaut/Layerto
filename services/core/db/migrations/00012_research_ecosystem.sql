-- +goose Up
-- Migration 00012: Research Ecosystem Extensions
-- Adds ethics permits, HITL active labeling queue, peer-review tokens, and collaborator budget guardrails

-- 1. Ethics & Permit Vault table
CREATE TABLE IF NOT EXISTS research_ethics_permits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id UUID NOT NULL REFERENCES research_areas(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permit_type TEXT NOT NULL, -- 'irb_approval', 'wildlife_permit', 'data_license', 'cites_permit', 'mta_agreement'
  permit_number TEXT NOT NULL,
  issuing_authority TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'pending_renewal', 'expired'
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_permits_area ON research_ethics_permits(area_id, created_at DESC);

-- 2. Human-in-the-Loop Active Labeling Queue table
CREATE TABLE IF NOT EXISTS research_active_labeling_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id UUID NOT NULL REFERENCES research_areas(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  specimen_id UUID REFERENCES research_specimens(id) ON DELETE CASCADE,
  specimen_name TEXT NOT NULL,
  media_url TEXT NOT NULL,
  predicted_label TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  alternative_label TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'corrected', 'ambiguous'
  resolved_label TEXT,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewer_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_labeling_queue_area ON research_active_labeling_queue(area_id, status);

-- 3. Anonymous Peer-Review Sandboxes
CREATE TABLE IF NOT EXISTS research_peer_review_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id UUID NOT NULL REFERENCES research_areas(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  manuscript_title TEXT NOT NULL,
  anonymized_label TEXT NOT NULL DEFAULT 'Anonymous Reviewer Copy',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_research_peer_review_token ON research_peer_review_tokens(token);

-- 4. Collaborator Compute & Grant Budget Guardrails
ALTER TABLE research_collaboration_contracts
  ADD COLUMN IF NOT EXISTS gpu_credit_cap INT NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS grant_budget_cents BIGINT NOT NULL DEFAULT 100000,
  ADD COLUMN IF NOT EXISTS gpu_credits_consumed INT NOT NULL DEFAULT 0;

-- 5. Permissions for layerto_app
GRANT SELECT, INSERT, UPDATE, DELETE ON research_ethics_permits TO layerto_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON research_active_labeling_queue TO layerto_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON research_peer_review_tokens TO layerto_app;

-- +goose Down
DROP TABLE IF EXISTS research_peer_review_tokens CASCADE;
DROP TABLE IF EXISTS research_active_labeling_queue CASCADE;
DROP TABLE IF EXISTS research_ethics_permits CASCADE;

ALTER TABLE research_collaboration_contracts
  DROP COLUMN IF EXISTS gpu_credit_cap,
  DROP COLUMN IF EXISTS grant_budget_cents,
  DROP COLUMN IF EXISTS gpu_credits_consumed;
