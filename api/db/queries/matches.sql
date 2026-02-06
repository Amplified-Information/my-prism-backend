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










-- UPDATE

-- name: UpdateMatchTxHash :exec
UPDATE matches
SET tx_hash = $4
WHERE (market_id = $1 AND tx_id1 = $2 AND tx_id2 = $3) OR (market_id = $1 AND tx_id1 = $3 AND tx_id2 = $2);