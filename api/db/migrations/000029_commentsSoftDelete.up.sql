-- I want to add a is_suspended boolean (default false) to comments table
ALTER TABLE comments
ADD COLUMN is_suspended BOOLEAN NOT NULL DEFAULT FALSE;
