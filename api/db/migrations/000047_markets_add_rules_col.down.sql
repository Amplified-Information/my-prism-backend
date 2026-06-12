-- drop rules column from markets table
ALTER TABLE markets
DROP COLUMN IF EXISTS rules;
