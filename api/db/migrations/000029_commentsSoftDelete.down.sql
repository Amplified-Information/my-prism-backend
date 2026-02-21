-- remove is_suspended column from comments table
ALTER TABLE comments
DROP COLUMN is_suspended;