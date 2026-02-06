-- remove the updated_at trigger and function from markets table
-- then remove the updated_at column
DROP TRIGGER IF EXISTS update_markets_updated_at ON markets;

-- this updated_at function may still be used by other tables, so we do not drop it here
-- DROP FUNCTION IF EXISTS update_updated_at_column();

ALTER TABLE markets
  DROP COLUMN updated_at;





ALTER TABLE positions
  DROP COLUMN created_at;

