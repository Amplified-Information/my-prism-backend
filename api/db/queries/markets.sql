-- CREATE

-- name: CreateMarket :one
INSERT INTO markets (market_id, net, statement, image_url, smart_contract_id, closes_at, description, is_paused, created_at, resolved_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, CURRENT_TIMESTAMP, NULL)
RETURNING *;








-- READ

-- name: GetMarketById :one
SELECT * FROM markets
WHERE market_id = $1
AND ($2::bool OR (is_suspended = FALSE AND is_paused = FALSE));

-- name: GetMarkets :many
SELECT * FROM markets
WHERE ($3::bool OR (is_suspended = FALSE AND is_paused = FALSE))
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: GetAllUnresolvedMarkets :many
SELECT * FROM markets
WHERE resolved_at IS NULL AND closes_at > CURRENT_TIMESTAMP AND is_suspended = FALSE AND is_paused = FALSE
ORDER BY created_at ASC;

-- name: CountUnresolvedMarkets :one
SELECT COUNT(*) FROM markets
WHERE resolved_at IS NULL AND closes_at > CURRENT_TIMESTAMP AND is_suspended = FALSE AND is_paused = FALSE;





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




-- DELETE



