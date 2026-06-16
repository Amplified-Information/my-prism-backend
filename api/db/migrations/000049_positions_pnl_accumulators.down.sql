ALTER TABLE positions
DROP COLUMN IF EXISTS realized_pnl_usd,
DROP COLUMN IF EXISTS cost_accum_no_usd,
DROP COLUMN IF EXISTS cost_accum_yes_usd;
