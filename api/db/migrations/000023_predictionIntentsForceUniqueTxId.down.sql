-- roll back the unique constraint on tx_id in prediction_intents table
ALTER TABLE prediction_intents
DROP CONSTRAINT unique_tx_id;
