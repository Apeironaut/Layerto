-- +goose Up
-- Resource Allocations, GPU Credits Budgeting, and Creator Immutable Ownership

ALTER TABLE research_areas
  ADD COLUMN IF NOT EXISTS storage_quota_bytes BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gpu_credits_budget BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gpu_credits_used BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES users(id) ON DELETE RESTRICT;

-- Backfill creator_id with owner_id for existing areas
UPDATE research_areas SET creator_id = owner_id WHERE creator_id IS NULL;
ALTER TABLE research_areas ALTER COLUMN creator_id SET NOT NULL;

-- Track role on collaboration contracts (owner/co-owner, editor, viewer)
ALTER TABLE research_collaboration_contracts
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'editor', 'viewer'));

-- +goose Down
ALTER TABLE research_collaboration_contracts
  DROP COLUMN IF EXISTS role;

ALTER TABLE research_areas
  DROP COLUMN IF EXISTS creator_id,
  DROP COLUMN IF EXISTS gpu_credits_used,
  DROP COLUMN IF EXISTS gpu_credits_budget,
  DROP COLUMN IF EXISTS storage_quota_bytes;
