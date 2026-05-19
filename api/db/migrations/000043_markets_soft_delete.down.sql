-- remove deleted_at column from markets for soft deletes
ALTER TABLE markets
DROP COLUMN deleted_at;
