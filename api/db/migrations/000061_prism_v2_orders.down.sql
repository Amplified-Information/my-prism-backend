-- Note: V1 orders evicted by the up migration are not reopened.
DROP TABLE IF EXISTS smart_contract_events_v2;

ALTER TABLE matches
    DROP CONSTRAINT IF EXISTS matches_v2_fields_check,
    DROP CONSTRAINT IF EXISTS matches_protocol_version_check,
    DROP COLUMN IF EXISTS no_collateral,
    DROP COLUMN IF EXISTS yes_collateral,
    DROP COLUMN IF EXISTS execution_yes_price,
    DROP COLUMN IF EXISTS fill_shares,
    DROP COLUMN IF EXISTS protocol_version;

ALTER TABLE prediction_intents
    DROP CONSTRAINT IF EXISTS prediction_intents_v2_domain_check,
    DROP CONSTRAINT IF EXISTS prediction_intents_collateral_filled_check,
    DROP CONSTRAINT IF EXISTS prediction_intents_shares_filled_check,
    DROP CONSTRAINT IF EXISTS prediction_intents_verifying_contract_check,
    DROP CONSTRAINT IF EXISTS prediction_intents_chain_id_check,
    ALTER COLUMN protocol_version SET DEFAULT 1,
    DROP COLUMN IF EXISTS collateral_filled,
    DROP COLUMN IF EXISTS shares_filled,
    DROP COLUMN IF EXISTS verifying_contract,
    DROP COLUMN IF EXISTS chain_id;
