-- add a column called is_LOM_enabled to the markets table, defaulting to true
ALTER TABLE markets
ADD COLUMN is_LOM_enabled BOOLEAN NOT NULL DEFAULT TRUE;
