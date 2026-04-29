-- CREATE




-- READ
-- name: GetPrismPointsByUser :many
SELECT * FROM prism_points
WHERE evm_address = $1
ORDER BY created_at DESC;




-- UPDATE
-- name: UpsertPrismPointsAddPoints :exec
INSERT INTO prism_points (points_awarded, market_id, evm_address, points_awarded)
VALUES (NOW(), $1, $2, $3)
ON CONFLICT (market_id, evm_address)
DO UPDATE SET points_awarded = prism_points.points_awarded + EXCLUDED.points_awarded;




-- DELETE