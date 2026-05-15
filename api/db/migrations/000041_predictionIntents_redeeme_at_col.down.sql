-- remove the redeemed_at column from prediction_intents table
ALTER TABLE prediction_intents
DROP COLUMN redeemed_at;