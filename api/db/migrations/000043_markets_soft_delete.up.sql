-- add a deleted_at column to markets for soft deletes
ALTER TABLE markets
ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;
