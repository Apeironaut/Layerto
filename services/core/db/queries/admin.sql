-- name: GetUserStats :many
SELECT status, count(*)::bigint AS count
FROM users
GROUP BY status;

-- name: GetModelStats :many
SELECT enabled, count(*)::bigint AS count
FROM models
GROUP BY enabled;

-- name: CountRoutes :one
SELECT count(*)::bigint AS count
FROM routes;

-- name: CountRequestsSince :one
SELECT count(*)::bigint AS count
FROM events
WHERE type = 'request.received'
  AND created_at >= $1;

-- name: GetRevenueSince :one
SELECT COALESCE(sum((payload->>'charge')::bigint), 0)::bigint AS revenue_micro_usd
FROM events
WHERE type = 'request.executed'
  AND created_at >= $1;

-- name: GetUserRequestsCountSince :one
SELECT count(*)::bigint AS count
FROM events
WHERE user_id = $1
  AND type = 'request.received'
  AND created_at >= $2;

-- name: GetUserSpendSince :one
SELECT COALESCE(sum((payload->>'charge')::bigint), 0)::bigint AS spend_micro_usd
FROM events
WHERE user_id = $1
  AND type = 'request.executed'
  AND created_at >= $2;

-- name: ListAdminEvents :many
SELECT
    e.seq,
    e.type,
    e.created_at,
    COALESCE(u.email, '')::text AS user_email,
    COALESCE(e.request_id::text, '')::text AS request_id,
    COALESCE(e.payload->>'model_slug', '')::text AS model_slug
FROM events e
LEFT JOIN users u ON u.id = e.user_id
WHERE ($1::bigint = 0 OR e.seq < $1)
  AND ($2::text = '' OR e.type = $2)
ORDER BY e.seq DESC
LIMIT $3;
