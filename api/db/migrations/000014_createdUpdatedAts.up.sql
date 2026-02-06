-- add updated_at column to markets table
ALTER TABLE markets
ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Create function to update updated_at column
-- this already exists in migration  000013_orderRequestMod.up.sql, so it's commented out here
--
-- CREATE OR REPLACE FUNCTION update_updated_at_column()
-- RETURNS TRIGGER AS $$
-- BEGIN
-- 	NEW.updated_at = CURRENT_TIMESTAMP;
-- 	RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- Create trigger to use the function
CREATE TRIGGER update_markets_updated_at
BEFORE UPDATE ON markets
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();





-- add a created_at column to positions table
ALTER TABLE positions
ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- backfill created_at for existing rows in positions table
UPDATE positions
SET created_at = updated_at AT TIME ZONE 'UTC'
WHERE created_at IS NULL;
