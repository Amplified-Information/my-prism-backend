-- Add accumulator columns for weighted-average cost basis and realized PnL.
ALTER TABLE positions
ADD COLUMN cost_accum_yes_usd DOUBLE PRECISION NOT NULL DEFAULT 0.0 CHECK (cost_accum_yes_usd >= 0.0),
ADD COLUMN cost_accum_no_usd DOUBLE PRECISION NOT NULL DEFAULT 0.0 CHECK (cost_accum_no_usd >= 0.0),
ADD COLUMN realized_pnl_usd DOUBLE PRECISION NOT NULL DEFAULT 0.0;

-- Backfill accumulators from current qty * avg-price snapshots.
UPDATE positions
SET
  cost_accum_yes_usd = n_yes::DOUBLE PRECISION * cost_basis_price_yes_usd,
  cost_accum_no_usd = n_no::DOUBLE PRECISION * cost_basis_price_no_usd
WHERE cost_accum_yes_usd = 0.0
   OR cost_accum_no_usd = 0.0;
