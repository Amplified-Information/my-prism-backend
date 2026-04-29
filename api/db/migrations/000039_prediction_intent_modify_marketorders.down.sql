-- remove column primary_secondary from prediction_intents
ALTER TABLE prediction_intents
  DROP COLUMN primary_secondary,
  ADD COLUMN market_limit DOUBLE PRECISION;
