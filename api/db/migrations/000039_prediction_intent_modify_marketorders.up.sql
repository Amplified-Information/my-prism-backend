-- remove market_limit column
-- add a column called "primary_secondary"
ALTER TABLE prediction_intents
  DROP COLUMN market_limit,
  ADD COLUMN primary_secondary VARCHAR(1) NOT NULL DEFAULT 'p';
