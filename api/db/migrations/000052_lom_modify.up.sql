-- modify prism_lom table
-- remove:
-- - prediction_intent_tx_id
-- - cron_ran_at
-- - hedera_tx_hash
-- - total_lom_score
-- add:
-- - distance (float)
-- - dollar_value (float)
-- - duration (float)
-- - lom_score (float)


ALTER TABLE prism_lom
    DROP COLUMN prediction_intent_tx_id,
    DROP COLUMN cron_ran_at,
    DROP COLUMN hedera_tx_hash,
    DROP COLUMN total_lom_score,
    ADD COLUMN distance FLOAT NOT NULL DEFAULT 0.0,
    ADD COLUMN dollar_value FLOAT NOT NULL DEFAULT 0.0,
    ADD COLUMN duration FLOAT NOT NULL DEFAULT 0.0,
    ADD COLUMN lom_score FLOAT NOT NULL DEFAULT 0.0;