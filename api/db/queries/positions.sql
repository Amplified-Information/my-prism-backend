-- CREATE

-- name: UpsertPositions :one
-- @param market_id UUID
-- @param evm_address TEXT
-- @param n_yes BIGINT
-- @param n_no BIGINT
-- @param price_usd DOUBLE PRECISION (fill price for the event; sign ignored for accounting, abs(price) is used)
-- Upsert is balance-delta based: EXCLUDED.n_yes/n_no are post-event balances.
-- Any delta is treated as buy (>0) or sell (<0) at abs(price_usd), with weighted-average
-- cost basis and realized PnL accumulated in this row.
INSERT INTO positions (
  market_id,
  evm_address,
  n_yes,
  n_no,
  cost_basis_price_yes_usd,
  cost_basis_price_no_usd,
  cost_accum_yes_usd,
  cost_accum_no_usd,
  realized_pnl_usd,
  updated_at
)
VALUES (
  $1, $2, $3, $4,
  CASE WHEN $3::bigint > 0 THEN ABS(@price_usd::double precision) ELSE 0.0 END,
  CASE WHEN $4::bigint > 0 THEN ABS(@price_usd::double precision) ELSE 0.0 END,
  CASE WHEN $3::bigint > 0 THEN ($3::bigint::double precision * ABS(@price_usd::double precision)) ELSE 0.0 END,
  CASE WHEN $4::bigint > 0 THEN ($4::bigint::double precision * ABS(@price_usd::double precision)) ELSE 0.0 END,
  0.0,
  CURRENT_TIMESTAMP
)
ON CONFLICT (market_id, evm_address)
DO UPDATE SET
  n_yes = EXCLUDED.n_yes,
  n_no = EXCLUDED.n_no,
  updated_at = CURRENT_TIMESTAMP,

  -- YES side cost accumulator
  cost_accum_yes_usd = CASE
    WHEN EXCLUDED.n_yes > positions.n_yes THEN
      positions.cost_accum_yes_usd + (EXCLUDED.n_yes - positions.n_yes)::double precision * ABS(@price_usd::double precision)
    WHEN EXCLUDED.n_yes < positions.n_yes AND positions.n_yes > 0 THEN
      GREATEST(
        positions.cost_accum_yes_usd
          - ((positions.cost_accum_yes_usd / positions.n_yes::double precision)
            * (positions.n_yes - EXCLUDED.n_yes)::double precision),
        0.0
      )
    ELSE positions.cost_accum_yes_usd
  END,

  -- NO side cost accumulator
  cost_accum_no_usd = CASE
    WHEN EXCLUDED.n_no > positions.n_no THEN
      positions.cost_accum_no_usd + (EXCLUDED.n_no - positions.n_no)::double precision * ABS(@price_usd::double precision)
    WHEN EXCLUDED.n_no < positions.n_no AND positions.n_no > 0 THEN
      GREATEST(
        positions.cost_accum_no_usd
          - ((positions.cost_accum_no_usd / positions.n_no::double precision)
            * (positions.n_no - EXCLUDED.n_no)::double precision),
        0.0
      )
    ELSE positions.cost_accum_no_usd
  END,

  -- Realized PnL increments only when shares are removed.
  realized_pnl_usd = positions.realized_pnl_usd
    + CASE
        WHEN EXCLUDED.n_yes < positions.n_yes AND positions.n_yes > 0 THEN
          ((positions.n_yes - EXCLUDED.n_yes)::double precision * ABS(@price_usd::double precision))
          - ((positions.cost_accum_yes_usd / positions.n_yes::double precision)
             * (positions.n_yes - EXCLUDED.n_yes)::double precision)
        ELSE 0.0
      END
    + CASE
        WHEN EXCLUDED.n_no < positions.n_no AND positions.n_no > 0 THEN
          ((positions.n_no - EXCLUDED.n_no)::double precision * ABS(@price_usd::double precision))
          - ((positions.cost_accum_no_usd / positions.n_no::double precision)
             * (positions.n_no - EXCLUDED.n_no)::double precision)
        ELSE 0.0
      END,

  -- Weighted-average prices are derived from accumulators after update.
  cost_basis_price_yes_usd = CASE
    WHEN EXCLUDED.n_yes > 0 THEN
      (
        CASE
          WHEN EXCLUDED.n_yes > positions.n_yes THEN
            positions.cost_accum_yes_usd + (EXCLUDED.n_yes - positions.n_yes)::double precision * ABS(@price_usd::double precision)
          WHEN EXCLUDED.n_yes < positions.n_yes AND positions.n_yes > 0 THEN
            GREATEST(
              positions.cost_accum_yes_usd
                - ((positions.cost_accum_yes_usd / positions.n_yes::double precision)
                  * (positions.n_yes - EXCLUDED.n_yes)::double precision),
              0.0
            )
          ELSE positions.cost_accum_yes_usd
        END
      ) / EXCLUDED.n_yes::double precision
    ELSE 0.0
  END,

  cost_basis_price_no_usd = CASE
    WHEN EXCLUDED.n_no > 0 THEN
      (
        CASE
          WHEN EXCLUDED.n_no > positions.n_no THEN
            positions.cost_accum_no_usd + (EXCLUDED.n_no - positions.n_no)::double precision * ABS(@price_usd::double precision)
          WHEN EXCLUDED.n_no < positions.n_no AND positions.n_no > 0 THEN
            GREATEST(
              positions.cost_accum_no_usd
                - ((positions.cost_accum_no_usd / positions.n_no::double precision)
                  * (positions.n_no - EXCLUDED.n_no)::double precision),
              0.0
            )
          ELSE positions.cost_accum_no_usd
        END
      ) / EXCLUDED.n_no::double precision
    ELSE 0.0
  END
RETURNING *;







-- READ

-- name: GetUserPositions :many
SELECT
  p.market_id,
  p.evm_address,
  p.n_yes,
  p.n_no,
  p.cost_basis_price_yes_usd,
  p.cost_basis_price_no_usd,
  p.realized_pnl_usd,
  p.updated_at,
  p.created_at
FROM positions p
JOIN markets m ON p.market_id = m.market_id
WHERE p.evm_address = $1
  AND m.deleted_at IS NULL; -- exclude soft-deleted markets

-- name: GetUserPositionsByMarketId :many
SELECT
  p.market_id,
  p.evm_address,
  p.n_yes,
  p.n_no,
  p.cost_basis_price_yes_usd,
  p.cost_basis_price_no_usd,
  p.realized_pnl_usd,
  p.updated_at,
  p.created_at
FROM positions p
JOIN markets m ON p.market_id = m.market_id
WHERE p.evm_address = $1
  AND p.market_id = $2
  AND m.deleted_at IS NULL; -- exclude soft-deleted markets


-- name: GetNumActiveTradersLast30days :one
SELECT COUNT(DISTINCT evm_address) 
FROM positions
WHERE updated_at >= NOW() - INTERVAL '30 days';


-- name: GetAllPositions :many
-- admin authenticated query to get all positions, ordered by updated_at descending, with pagination
SELECT *
FROM positions
ORDER BY updated_at DESC
LIMIT $1 OFFSET $2;

-- name: CountAllPositions :one
SELECT COUNT(*)
FROM positions;


-- name: GetPositionsByMarketIdNoPointsAwardedMarketNotResolved :many
SELECT positions.*
FROM positions
JOIN markets ON positions.market_id = markets.market_id
WHERE positions.market_id = $1
  AND positions.points_awarded_at IS NULL
  AND markets.deleted_at IS NULL
  AND markets.resolved_at IS NULL 
  AND markets.is_suspended = FALSE 
  AND markets.is_paused = FALSE;

-- name: GetCostBasisForUserOnMarket :one
SELECT p.cost_basis_price_yes_usd, p.cost_basis_price_no_usd
FROM positions p
JOIN markets m ON p.market_id = m.market_id
WHERE p.market_id = $1 AND p.evm_address = $2
  AND m.deleted_at IS NULL;




-- UPDATE

