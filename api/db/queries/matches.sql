-- CREATE


-- name: CreateMatch :one
INSERT INTO matches (market_id, tx_id1, tx_id2, qty1, qty2, tx_hash)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;





-- READ

-- name: GetAllMatchesForMarketIdTxId :many
SELECT *
FROM matches
WHERE market_id = $1 AND (tx_id1 = $2 OR tx_id2 = $2)
ORDER BY created_at DESC;

-- name: GetAllMatches :many
SELECT *
FROM matches
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: GetTotalVolumeUsdInTimePeriod :one
SELECT COALESCE(SUM(m.qty1 * pi1.price_usd), 0)::numeric AS total_volume_usd
FROM matches m
JOIN prediction_intents pi1 ON m.tx_id1 = pi1.tx_id
WHERE m.created_at >= $1 AND m.created_at <= $2;





-- UPDATE

-- name: UpdateMatchTxHash :exec
UPDATE matches
SET tx_hash = $4
WHERE (market_id = $1 AND tx_id1 = $2 AND tx_id2 = $3) OR (market_id = $1 AND tx_id1 = $3 AND tx_id2 = $2);