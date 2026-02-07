ALTER TABLE markets
  RENAME COLUMN is_paused TO is_open;

ALTER TABLE markets
  ALTER COLUMN resolved_at DROP DEFAULT;
