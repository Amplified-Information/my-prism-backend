-- Add explicit original and remaining quantities for prediction intents.
-- invariants:
-- 1. qty_orig > 0.0
-- 2. qty_rem >= 0.0
-- 3. qty_rem <= qty_orig

ALTER TABLE prediction_intents
ADD COLUMN qty_orig DOUBLE PRECISION,
ADD COLUMN qty_rem DOUBLE PRECISION;

-- Backfill existing rows from the legacy qty value.
UPDATE prediction_intents
SET qty_orig = qty,
    qty_rem = qty
WHERE qty_orig IS NULL OR qty_rem IS NULL;

ALTER TABLE prediction_intents
ALTER COLUMN qty_orig SET NOT NULL,
ALTER COLUMN qty_rem SET NOT NULL;

ALTER TABLE prediction_intents
ADD CONSTRAINT order_requests_qty_orig_check CHECK (qty_orig > 0.0),
ADD CONSTRAINT order_requests_qty_rem_check CHECK (qty_rem >= 0.0),
ADD CONSTRAINT order_requests_qty_rem_lte_qty_orig_check CHECK (qty_rem <= qty_orig);

ALTER TABLE prediction_intents
DROP CONSTRAINT IF EXISTS order_requests_qty_check;

ALTER TABLE prediction_intents
DROP COLUMN IF EXISTS qty;

CREATE INDEX idx_prediction_intents_market_account_open
ON prediction_intents (market_id, account_id)
WHERE cancelled_at IS NULL AND fully_matched_at IS NULL AND evicted_at IS NULL;
