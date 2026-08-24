-- remove is_LOM_enabled column from markets table
ALTER TABLE markets
DROP COLUMN is_LOM_enabled;
