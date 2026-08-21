-- do the opposite of 000052_lom_modify.up.sql
ALTER TABLE prism_lom
    ADD COLUMN prediction_intent_tx_id UUID,
    ADD COLUMN cron_ran_at TIMESTAMP,
    ADD COLUMN hedera_tx_hash VARCHAR(255),
    ADD COLUMN total_lom_score FLOAT,
    DROP COLUMN distance,
    DROP COLUMN dollar_value,
    DROP COLUMN duration,
    DROP COLUMN lom_score;
