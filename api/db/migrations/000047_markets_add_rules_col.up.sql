-- add a TEXT column named "rules" to the "markets" table
ALTER TABLE markets
ADD COLUMN IF NOT EXISTS rules TEXT;
