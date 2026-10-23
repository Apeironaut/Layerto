-- name: GetModelBySlug :one
SELECT id, slug, name, description, license, is_open, runpod_endpoint, price_per_call, enabled, meta, created_at
FROM models
WHERE slug = $1 AND enabled = true;

-- name: ListEnabledModels :many
SELECT id, slug, name, description, license, is_open, runpod_endpoint, price_per_call, enabled, meta, created_at
FROM models
WHERE enabled = true
  AND NOT EXISTS (SELECT 1 FROM model_ownership o WHERE o.model_id = models.id AND o.visibility <> 'public')
ORDER BY slug ASC;

-- name: ListAllModels :many
SELECT id, slug, name, description, license, is_open, runpod_endpoint, price_per_call, enabled, meta, created_at
FROM models
ORDER BY slug ASC;

-- name: UpdateModelPrice :one
UPDATE models
SET price_per_call = $2
WHERE slug = $1
RETURNING id, slug, name, price_per_call;

-- name: GetModelPriceForExecution :one
SELECT price_per_call
FROM models
WHERE slug = $1 AND enabled = true;

-- name: GetModelBySlugAnyStatus :one
SELECT id, slug, name, description, license, is_open, runpod_endpoint, price_per_call, enabled, meta, created_at
FROM models
WHERE slug = $1;

-- name: UpdateModelEnabled :one
UPDATE models
SET enabled = $2
WHERE slug = $1
RETURNING id, slug, name, enabled;

