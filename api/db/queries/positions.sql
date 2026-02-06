-- CREATE

-- name: UpsertPositions :one
INSERT INTO positions (market_id, evm_address, n_yes, n_no, updated_at)
VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
ON CONFLICT (market_id, evm_address)
DO UPDATE SET
  n_yes = EXCLUDED.n_yes,
  n_no = EXCLUDED.n_no,
  updated_at = CURRENT_TIMESTAMP
RETURNING *;







-- READ

-- name: GetUserPositions :many
SELECT
  market_id,
  evm_address,
  n_yes,
  n_no,
  updated_at
FROM positions
WHERE evm_address = $1;

-- name: GetUserPositionsByMarketId :many
SELECT
  market_id,
  evm_address,
  n_yes,
  n_no,
  updated_at
FROM positions
WHERE evm_address = $1 AND market_id = $2;


-- name: GetNumActiveTradersLast30days :one
SELECT COUNT(DISTINCT evm_address) 
FROM positions
WHERE updated_at >= NOW() - INTERVAL '30 days';

-- UPDATE

