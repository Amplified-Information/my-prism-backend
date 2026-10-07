DROP INDEX IF EXISTS matches_reconciliation_idx;
ALTER TABLE matches
    DROP CONSTRAINT IF EXISTS matches_match_id_unique,
    DROP CONSTRAINT IF EXISTS matches_attempts_check,
    DROP CONSTRAINT IF EXISTS matches_status_check,
    DROP COLUMN IF EXISTS finalized_at,
    DROP COLUMN IF EXISTS submitted_at,
    DROP COLUMN IF EXISTS last_error,
    DROP COLUMN IF EXISTS attempts,
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS match_id;

DROP TABLE IF EXISTS order_outbox;

ALTER TABLE prediction_intents
	DROP CONSTRAINT IF EXISTS prediction_intents_v2_fields_check,
    DROP CONSTRAINT IF EXISTS prediction_intents_deadline_check,
    DROP CONSTRAINT IF EXISTS prediction_intents_collateral_cap_check,
    DROP CONSTRAINT IF EXISTS prediction_intents_qty_shares_check,
    DROP CONSTRAINT IF EXISTS prediction_intents_limit_yes_price_check,
    DROP CONSTRAINT IF EXISTS prediction_intents_action_check,
    DROP CONSTRAINT IF EXISTS prediction_intents_side_check,
    DROP CONSTRAINT IF EXISTS prediction_intents_protocol_version_check,
    DROP COLUMN IF EXISTS deadline,
    DROP COLUMN IF EXISTS collateral_cap,
    DROP COLUMN IF EXISTS qty_shares,
    DROP COLUMN IF EXISTS limit_yes_price,
    DROP COLUMN IF EXISTS action,
    DROP COLUMN IF EXISTS side,
    DROP COLUMN IF EXISTS protocol_version;
