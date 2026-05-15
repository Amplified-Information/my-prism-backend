-- add a "redeemed_at" timestamp to prediction_intents table
ALTER TABLE prediction_intents
ADD COLUMN redeemed_at TIMESTAMPTZ;
