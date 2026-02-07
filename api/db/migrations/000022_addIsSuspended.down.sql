-- remove the is_suspended column from the markets table
ALTER TABLE markets
DROP COLUMN is_suspended;
