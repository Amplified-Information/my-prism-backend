-- make tx_id unique in prediction_intents table
ALTER TABLE prediction_intents
ADD CONSTRAINT unique_tx_id UNIQUE (tx_id);
