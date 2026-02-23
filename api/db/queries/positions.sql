-- CREATE

-- name: UpsertPositions :one
INSERT INTO positions (market_id, evm_address, n_yes, n_no, updated_at, cost_basis_yes_usd, cost_basis_no_usd)
VALUES (
  $1, $2, $3, $4, CURRENT_TIMESTAMP,
  CASE WHEN $5 > 0 THEN ABS($5) ELSE NULL END,
  CASE WHEN $5 < 0 THEN ABS($5) ELSE NULL END
)
ON CONFLICT (market_id, evm_address)
DO UPDATE SET
  n_yes = EXCLUDED.n_yes,
  n_no = EXCLUDED.n_no,
  updated_at = CURRENT_TIMESTAMP,

  -- cost basis price calculation logic:
  -- $5 > 0 means YES side, $5 < 0 means NO side
  -- calculate weighted average cost basis against the relevant token count

  cost_basis_yes_usd = CASE
    -- YES side: positive price, new YES tokens added
    WHEN $5 > 0 AND EXCLUDED.n_yes > positions.n_yes THEN
      -- example:
      -- If you owned 100 YES at $0.50 and buy 50 more at $0.60:
      -- (100 × 0.50 + 50 × 0.60) / 150 = 80 / 150 = $0.533 per token
      (positions.n_yes::FLOAT * COALESCE(positions.cost_basis_yes_usd, ABS($5))
       + (EXCLUDED.n_yes - positions.n_yes)::FLOAT * ABS($5))
      / EXCLUDED.n_yes::FLOAT
    ELSE positions.cost_basis_yes_usd
  END,
  cost_basis_no_usd = CASE
    -- NO side: negative price, new NO tokens added
    WHEN $5 < 0 AND EXCLUDED.n_no > positions.n_no THEN
      -- example:
      -- If you owned 100 NO at $0.80 and buy 80 more at $0.85:
      -- (100 × 0.80 + 80 × 0.85) / 180 = 148 / 180 = $0.822 per token
      (positions.n_no::FLOAT * COALESCE(positions.cost_basis_no_usd, ABS($5))
       + (EXCLUDED.n_no - positions.n_no)::FLOAT * ABS($5))
      / EXCLUDED.n_no::FLOAT
    ELSE positions.cost_basis_no_usd
  END
RETURNING *;







-- READ

-- name: GetUserPositions :many
SELECT
  market_id,
  evm_address,
  n_yes,
  n_no,
  updated_at,
  created_at
FROM positions
WHERE evm_address = $1;

-- name: GetUserPositionsByMarketId :many
SELECT
  market_id,
  evm_address,
  n_yes,
  n_no,
  updated_at,
  created_at
FROM positions
WHERE evm_address = $1 AND market_id = $2;


-- name: GetNumActiveTradersLast30days :one
SELECT COUNT(DISTINCT evm_address) 
FROM positions
WHERE updated_at >= NOW() - INTERVAL '30 days';


-- name: GetAllPositions :many
SELECT *
FROM positions
ORDER BY updated_at DESC
LIMIT $1 OFFSET $2;




-- UPDATE

