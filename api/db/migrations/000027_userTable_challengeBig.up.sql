-- challenge column is currently an int, but it needs to be a bigint to support more than 2^31-1 challenges
-- simpler: ALTER TABLE users ALTER COLUMN challenge TYPE BIGINT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name='users'
      AND column_name='challenge'
      AND data_type <> 'bigint'
  ) THEN
    ALTER TABLE users ALTER COLUMN challenge TYPE BIGINT;
  END IF;
END
$$;