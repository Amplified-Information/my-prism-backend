-- CREATE

-- name: CreateMarket :one
INSERT INTO markets (market_id, net, statement, image_url, smart_contract_id, closes_at, description, is_paused, created_at, resolved_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, CURRENT_TIMESTAMP, NULL)
RETURNING *;

-- name: AssociateMarketCategoriesBatch :exec
INSERT INTO market_categories (market_id, category_id)
SELECT $1, unnest($2::int[])
ON CONFLICT DO NOTHING;





-- READ

-- name: GetMarketById :one
SELECT * FROM markets
WHERE market_id = $1
AND deleted_at IS NULL
AND ($2::bool OR (is_suspended = FALSE AND is_paused = FALSE));
-- SELECT
--   m.*,
--   COALESCE(array_agg(mc.category_id)::int[], '{}') AS categories
-- FROM markets m
-- LEFT JOIN market_categories mc ON m.market_id = mc.market_id
-- WHERE m.market_id = $1
--   AND ($2::bool OR (m.is_suspended = FALSE AND m.is_paused = FALSE))
-- GROUP BY m.market_id;


-- name: GetMarkets :many
SELECT * FROM markets
WHERE deleted_at IS NULL
AND ($3::bool OR (is_suspended = FALSE AND is_paused = FALSE))
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;
-- SELECT
--   m.*,
--   COALESCE(array_agg(mc.category_id)::int[], '{}') AS categories
-- FROM markets m
-- LEFT JOIN market_categories mc ON m.market_id = mc.market_id
-- WHERE m.deleted_at IS NULL
--   AND ($3::bool OR (m.is_suspended = FALSE AND m.is_paused = FALSE))
-- GROUP BY m.market_id
-- ORDER BY m.created_at DESC
-- LIMIT $1 OFFSET $2;



-- name: GetAllUnresolvedMarkets :many
SELECT * FROM markets
WHERE deleted_at IS NULL
AND resolved_at IS NULL AND closes_at > CURRENT_TIMESTAMP AND is_suspended = FALSE AND is_paused = FALSE
ORDER BY created_at ASC;
-- SELECT
--   m.*,
--   COALESCE(array_agg(mc.category_id)::int[], '{}') AS categories
-- FROM markets m
-- LEFT JOIN market_categories mc ON m.market_id = mc.market_id
-- WHERE m.resolved_at IS NULL
--   AND m.closes_at > CURRENT_TIMESTAMP
--   AND m.is_suspended = FALSE
--   AND m.is_paused = FALSE
-- GROUP BY m.market_id
-- ORDER BY m.created_at ASC;



-- name: CountUnresolvedMarkets :one
SELECT COUNT(*) FROM markets
WHERE deleted_at IS NULL
AND resolved_at IS NULL AND closes_at > CURRENT_TIMESTAMP AND is_suspended = FALSE AND is_paused = FALSE;











-- UPDATE
-- name: ToggleMarketPause :one
UPDATE markets
SET is_paused = NOT is_paused
WHERE market_id = $1
RETURNING *;

-- name: ToggleMarketSuspend :one
UPDATE markets
SET is_suspended = NOT is_suspended
WHERE market_id = $1
RETURNING *;

-- name: ResolveMarket :exec
UPDATE markets
SET resolved_at = CURRENT_TIMESTAMP, outcome = $2
WHERE market_id = $1;


-- name: SoftDeleteMarket :exec
UPDATE markets -- cannot be toggled back on
SET deleted_at = CURRENT_TIMESTAMP
WHERE market_id = $1;









-- DELETE



