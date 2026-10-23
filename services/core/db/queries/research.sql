-- name: ListResearchAreasForUser :many
SELECT id, owner_id, creator_id, name, description, color, discipline, hypothesis,
       storage_quota_bytes, gpu_credits_budget, gpu_credits_used,
       custom_metrics, custom_fields, data_types, privacy_shield_config, compliance_vault_type,
       created_at, updated_at
FROM research_areas
WHERE owner_id = $1
ORDER BY created_at DESC;

-- name: GetResearchAreaByID :one
SELECT id, owner_id, creator_id, name, description, color, discipline, hypothesis,
       storage_quota_bytes, gpu_credits_budget, gpu_credits_used,
       custom_metrics, custom_fields, data_types, privacy_shield_config, compliance_vault_type,
       created_at, updated_at
FROM research_areas
WHERE id = $1;

-- name: CreateResearchArea :one
INSERT INTO research_areas (
  owner_id, creator_id, name, description, color, discipline, hypothesis,
  storage_quota_bytes, gpu_credits_budget, custom_metrics, custom_fields, data_types, privacy_shield_config, compliance_vault_type
)
VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
RETURNING id, owner_id, creator_id, name, description, color, discipline, hypothesis,
          storage_quota_bytes, gpu_credits_budget, gpu_credits_used,
          custom_metrics, custom_fields, data_types, privacy_shield_config, compliance_vault_type,
          created_at, updated_at;

-- name: UpdateResearchAreaAllocations :exec
UPDATE research_areas
SET storage_quota_bytes = $2,
    gpu_credits_budget = $3,
    updated_at = NOW()
WHERE id = $1;

-- name: ListCollaborationContracts :many
SELECT id, owner_id, area_id, collaborator_email, collaborator_name, team_name,
       collaboration_model, credit_roles, royalty_percentage, bounty_amount_cents,
       bounty_status, data_sandbox_permission, role, gpu_credit_cap, grant_budget_cents,
       gpu_credits_consumed, status, created_at
FROM research_collaboration_contracts
WHERE area_id = $1
ORDER BY created_at DESC;

-- name: CreateCollaborationContract :one
INSERT INTO research_collaboration_contracts (
  owner_id, area_id, collaborator_email, collaborator_name, team_name,
  collaboration_model, credit_roles, royalty_percentage, bounty_amount_cents,
  bounty_status, data_sandbox_permission, role, gpu_credit_cap, grant_budget_cents, status
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
RETURNING id, owner_id, area_id, collaborator_email, collaborator_name, team_name,
          collaboration_model, credit_roles, royalty_percentage, bounty_amount_cents,
          bounty_status, data_sandbox_permission, role, gpu_credit_cap, grant_budget_cents,
          gpu_credits_consumed, status, created_at;

-- name: UpdateCollaboratorGuardrails :exec
UPDATE research_collaboration_contracts
SET gpu_credit_cap = $2,
    grant_budget_cents = $3
WHERE id = $1 AND area_id = $2;

-- name: ListEthicsPermits :many
SELECT id, area_id, permit_type, permit_number, issuing_authority, title,
       status, valid_from, valid_until, metadata, created_at
FROM research_ethics_permits
WHERE area_id = $1
ORDER BY created_at DESC;

-- name: CreateEthicsPermit :one
INSERT INTO research_ethics_permits (
  area_id, permit_type, permit_number, issuing_authority, title, status, valid_from, valid_until, metadata
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id, area_id, permit_type, permit_number, issuing_authority, title,
          status, valid_from, valid_until, metadata, created_at;

-- name: ListActiveLabelingQueue :many
SELECT id, area_id, specimen_id, specimen_name, media_url, predicted_label,
       confidence, alternative_label, status, resolved_label, resolved_by,
       reviewer_notes, resolved_at, created_at
FROM research_active_labeling_queue
WHERE area_id = $1 AND status = 'pending'
ORDER BY confidence ASC, created_at ASC;

-- name: ResolveActiveLabelingQueueItem :exec
UPDATE research_active_labeling_queue
SET status = $2,
    resolved_label = $3,
    resolved_by = $4,
    reviewer_notes = $5,
    resolved_at = NOW()
WHERE id = $1 AND area_id = $6;

-- name: CreatePeerReviewToken :one
INSERT INTO research_peer_review_tokens (area_id, token, manuscript_title, anonymized_label, expires_at)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, area_id, token, manuscript_title, anonymized_label, expires_at, created_at;

-- name: GetPeerReviewByToken :one
SELECT id, area_id, token, manuscript_title, anonymized_label, expires_at, created_at
FROM research_peer_review_tokens
WHERE token = $1 AND expires_at > NOW();

-- name: ListPublicResearchStorefront :many
SELECT rp.id, rp.area_id, ra.name AS area_name, ra.discipline, rp.title, rp.abstract,
       rp.doi, rp.pdf_url, rp.dataset_url, rp.model_card_url, rp.dataset_price_cents,
       rp.status, rp.published_at
FROM research_publications rp
JOIN research_areas ra ON ra.id = rp.area_id
WHERE rp.status = 'published'
ORDER BY rp.published_at DESC;

-- name: ListOpenTechBounties :many
SELECT c.id, c.area_id, ra.name AS area_name, ra.discipline, c.collaborator_name,
       c.team_name, c.collaboration_model, c.credit_roles, c.bounty_amount_cents,
       c.bounty_status, c.status, c.created_at
FROM research_collaboration_contracts c
JOIN research_areas ra ON ra.id = c.area_id
WHERE c.collaboration_model = 'paid_bounty'
ORDER BY c.created_at DESC;
