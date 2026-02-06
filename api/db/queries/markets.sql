-- CREATE

-- name: CreateMarket :one
INSERT INTO markets (market_id, net, statement, image_url, smart_contract_id, closes_at, description, is_paused, created_at, resolved_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, CURRENT_TIMESTAMP, NULL)
RETURNING *;








-- READ

-- name: GetMarket :one
SELECT * FROM markets
WHERE market_id = $1 AND is_suspended = FALSE;

-- name: GetMarkets :many
SELECT * FROM markets
WHERE is_suspended = FALSE
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: GetAllUnresolvedMarkets :many
SELECT * FROM markets
WHERE resolved_at IS NULL AND closes_at > CURRENT_TIMESTAMP AND is_suspended = FALSE
ORDER BY created_at ASC;
-- LIMIT $1 OFFSET $2;

-- name: CountUnresolvedMarkets :one
SELECT COUNT(*) FROM markets
WHERE resolved_at IS NULL AND closes_at > CURRENT_TIMESTAMP AND is_suspended = FALSE;





-- UPDATE





-- DELETE



