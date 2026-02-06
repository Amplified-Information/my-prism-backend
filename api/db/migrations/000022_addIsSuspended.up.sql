-- add an is_suspended column to the markets table
ALTER TABLE markets
ADD COLUMN is_suspended BOOLEAN DEFAULT FALSE NOT NULL;