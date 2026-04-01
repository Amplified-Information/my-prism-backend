-- CREATE




-- READ
-- name: GetPrismPointsByUser :many
SELECT * FROM prism_points
WHERE evm_address = $1
ORDER BY created_at DESC;




-- UPDATE
-- name: UpsertPrismPointsAddPoints :exec
INSERT INTO prism_points (points_awarded, created_at, market_id, evm_address)
VALUES ($1, NOW(), $2, $3)
ON CONFLICT (market_id, evm_address)
DO UPDATE SET points_awarded = prism_points.points_awarded + EXCLUDED.points_awarded;




-- DELETE