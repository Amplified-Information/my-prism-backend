DROP INDEX IF EXISTS idx_prediction_intents_market_account_open;

ALTER TABLE prediction_intents
DROP CONSTRAINT IF EXISTS order_requests_qty_rem_check,
DROP CONSTRAINT IF EXISTS order_requests_qty_orig_check;

ALTER TABLE prediction_intents
ADD COLUMN IF NOT EXISTS qty DOUBLE PRECISION;

UPDATE prediction_intents
SET qty = qty_orig
WHERE qty IS NULL;

ALTER TABLE prediction_intents
ALTER COLUMN qty SET NOT NULL;

ALTER TABLE prediction_intents
ADD CONSTRAINT order_requests_qty_check CHECK (qty > 0.0);

ALTER TABLE prediction_intents
DROP COLUMN IF EXISTS qty_rem,
DROP COLUMN IF EXISTS qty_orig;
