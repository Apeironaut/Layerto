-- name: ListActiveRoutes :many
SELECT
    r.id,
    r.keyword,
    r.priority,
    m.id AS model_id,
    m.slug AS model_slug,
    m.name AS model_name,
    m.enabled AS model_enabled
FROM routes r
JOIN models m ON m.id = r.model_id
ORDER BY r.priority ASC, length(r.keyword) DESC;

-- name: ListAllRoutes :many
SELECT
    r.id,
    r.keyword,
    r.priority,
    m.id AS model_id,
    m.slug AS model_slug,
    m.name AS model_name,
    m.enabled AS model_enabled
FROM routes r
JOIN models m ON m.id = r.model_id
ORDER BY r.priority ASC, r.keyword ASC;

-- name: GetRouteByID :one
SELECT
    r.id,
    r.keyword,
    r.priority,
    m.id AS model_id,
    m.slug AS model_slug,
    m.name AS model_name
FROM routes r
JOIN models m ON m.id = r.model_id
WHERE r.id = $1;

-- name: GetRouteByKeyword :one
SELECT id, keyword, model_id, priority
FROM routes
WHERE keyword = $1;

-- name: CreateRoute :one
INSERT INTO routes (keyword, model_id, priority)
VALUES ($1, $2, $3)
RETURNING id, keyword, model_id, priority;

-- name: DeleteRoute :exec
DELETE FROM routes
WHERE id = $1;
