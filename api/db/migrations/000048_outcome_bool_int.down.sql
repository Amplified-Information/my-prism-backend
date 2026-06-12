-- revert the change from BOOLEAN to INT:
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'markets'
      AND column_name = 'outcome'
      AND data_type IN ('integer', 'bigint', 'smallint', 'numeric')
  ) THEN
    ALTER TABLE markets
    ALTER COLUMN outcome TYPE BOOLEAN USING CASE WHEN outcome = 0 THEN FALSE WHEN outcome = 1 THEN TRUE ELSE NULL END;
  END IF;
END $$;
