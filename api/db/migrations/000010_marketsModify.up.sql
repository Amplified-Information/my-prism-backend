-- rename is_open to is_paused (better naming)
-- set default value of resolved_at to NULL (want to return all unresolved markets)

ALTER TABLE markets
  RENAME COLUMN is_open TO is_paused;

ALTER TABLE markets
  ALTER COLUMN resolved_at SET DEFAULT NULL;
