-- CREATE

-- name: UpsertPositions :one
-- @param market_id UUID
-- @param evm_address TEXT
-- @param n_yes BIGINT
-- @param n_no BIGINT
-- @param price_usd DOUBLE PRECISION (not a column - used to derive cost basis fields; positive = YES side, negative = NO side)
-- using sqlc's named parameter syntax @price_usd instead of $5 — this gives the Go param a meaningful name (PriceUsd) without needing a matching column
INSERT INTO positions (market_id, evm_address, n_yes, n_no, cost_basis_price_yes_usd, cost_basis_price_no_usd, updated_at)
VALUES (
  $1, $2, $3, $4,
  CASE WHEN @price_usd::double precision > 0 THEN ABS(@price_usd::double precision) ELSE 0.0 END,
  CASE WHEN @price_usd::double precision < 0 THEN ABS(@price_usd::double precision) ELSE 0.0 END,
  CURRENT_TIMESTAMP
)
ON CONFLICT (market_id, evm_address)
DO UPDATE SET
  n_yes = EXCLUDED.n_yes,
  n_no = EXCLUDED.n_no,
  updated_at = CURRENT_TIMESTAMP,

  -- cost basis price calculation logic:
  -- price_usd > 0 means YES side, price_usd < 0 means NO side
  -- calculate weighted average cost basis against the relevant token count

  cost_basis_price_yes_usd = CASE
    -- YES side: positive price, new YES tokens added
    WHEN @price_usd::double precision > 0 AND EXCLUDED.n_yes > positions.n_yes THEN
      -- example:
      -- If you owned 100 YES at $0.50 and buy 50 more at $0.60:
      -- (100 × 0.50 + 50 × 0.60) / 150 = 80 / 150 = $0.533 per token
      (positions.n_yes::FLOAT * COALESCE(positions.cost_basis_price_yes_usd, ABS(@price_usd::double precision))
        + (EXCLUDED.n_yes - positions.n_yes)::FLOAT * ABS(@price_usd::double precision))
      / EXCLUDED.n_yes::FLOAT
    ELSE positions.cost_basis_price_yes_usd
  END,

  cost_basis_price_no_usd = CASE
    -- NO side: negative price, new NO tokens added
    WHEN @price_usd::double precision < 0 AND EXCLUDED.n_no > positions.n_no THEN
      -- example:
      -- If you owned 100 NO at $0.80 and buy 80 more at $0.85:
      -- (100 × 0.80 + 80 × 0.85) / 180 = 148 / 180 = $0.822 per token
      (positions.n_no::FLOAT * COALESCE(positions.cost_basis_price_no_usd, ABS(@price_usd::double precision))
        + (EXCLUDED.n_no - positions.n_no)::FLOAT * ABS(@price_usd::double precision))
      / EXCLUDED.n_no::FLOAT
    ELSE positions.cost_basis_price_no_usd
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


-- name: GetPositionsByMarketIdNoPointsAwardedMarketNotResolved :many
SELECT positions.*
FROM positions
JOIN markets ON positions.market_id = markets.market_id
WHERE positions.market_id = $1
  AND positions.points_awarded IS NULL
  AND markets.resolved_at IS NULL AND markets.is_suspended = FALSE AND markets.is_paused = FALSE;






-- UPDATE

