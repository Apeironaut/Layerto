-- name: CountWorkflowsForUser :one
SELECT count(*)
FROM workflows
WHERE user_id = $1 AND deleted_at IS NULL;

-- name: ListWorkflowsByUserID :many
SELECT id, user_id, name, description, definition, version, created_at, updated_at
FROM workflows
WHERE user_id = $1 AND deleted_at IS NULL
ORDER BY updated_at DESC;

-- name: GetWorkflowByIDAndUserID :one
SELECT id, user_id, name, description, definition, version, created_at, updated_at
FROM workflows
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;

-- name: CreateWorkflow :one
INSERT INTO workflows (user_id, name, description, definition, version)
VALUES ($1, $2, $3, $4, 1)
RETURNING id, user_id, name, description, definition, version, created_at, updated_at;

-- name: UpdateWorkflow :one
UPDATE workflows
SET name = $3,
    description = $4,
    definition = $5,
    version = version + 1,
    updated_at = now()
WHERE id = $1 AND user_id = $2 AND version = $6 AND deleted_at IS NULL
RETURNING id, user_id, name, description, definition, version, created_at, updated_at;

-- name: SoftDeleteWorkflow :execrows
UPDATE workflows
SET deleted_at = now()
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;
