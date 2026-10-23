-- name: GetCandidateAbandonedRequests :many
SELECT r.seq, r.request_id, r.user_id, r.payload, r.created_at
FROM events r
WHERE r.type = 'request.received'
  AND r.created_at < $1
  AND NOT EXISTS (
      SELECT 1 FROM events t
      WHERE t.request_id = r.request_id
        AND t.type IN ('request.executed', 'request.failed')
  )
ORDER BY r.seq ASC
LIMIT 50;

-- name: CheckRequestTerminalExists :one
SELECT EXISTS (
    SELECT 1 FROM events
    WHERE request_id = $1
      AND type IN ('request.executed', 'request.failed')
) AS terminal_exists;

-- name: GetUsageTotals :one
SELECT
    count(*)::bigint AS total_requests,
    COALESCE(sum((payload->>'charge')::bigint), 0)::bigint AS total_charge
FROM events
WHERE user_id = $1
  AND type = 'request.executed'
  AND created_at >= $2
  AND created_at <= $3;

-- name: GetUsageByModel :many
SELECT
    COALESCE(payload->>'model_slug', 'unknown')::text AS model_slug,
    count(*)::bigint AS requests_count,
    COALESCE(sum((payload->>'charge')::bigint), 0)::bigint AS total_charge
FROM events
WHERE user_id = $1
  AND type = 'request.executed'
  AND created_at >= $2
  AND created_at <= $3
GROUP BY payload->>'model_slug'
ORDER BY requests_count DESC;

-- name: GetRequestsList :many
SELECT
    r.seq,
    r.request_id,
    r.created_at,
    COALESCE(r.payload->>'model_slug', '')::text AS model_slug,
    COALESCE(r.payload->>'routed', 'direct')::text AS routed,
    COALESCE((e.payload->>'latency_ms')::bigint, (f.payload->>'latency_ms')::bigint, 0)::bigint AS latency_ms,
    COALESCE((e.payload->>'charge')::bigint, 0)::bigint AS charge_micro_usd,
    CASE
        WHEN f.payload->>'error_code' = 'abandoned' THEN 'abandoned'
        WHEN f.request_id IS NOT NULL THEN 'failed'
        WHEN e.request_id IS NOT NULL THEN 'executed'
        ELSE 'pending'
    END::text AS status
FROM events r
LEFT JOIN events e ON e.request_id = r.request_id AND e.type = 'request.executed'
LEFT JOIN events f ON f.request_id = r.request_id AND f.type = 'request.failed'
WHERE r.user_id = $1
  AND r.type = 'request.received'
  AND ($2::bigint = 0 OR r.seq < $2)
ORDER BY r.seq DESC
LIMIT 50;
