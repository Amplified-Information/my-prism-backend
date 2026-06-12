-- modify outcome on markets table from BOOLEAN to INT (YES=1, NO=0, EmergClose5050=2)
-- any previous entries - map FALSE->0, TRUE->1, NULL->NULL.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns    WHERE table_schema = 'public'
      AND table_name = 'markets'
      AND column_name = 'outcome'
      AND data_type = 'boolean'
  ) THEN
    ALTER TABLE markets
    ALTER COLUMN outcome DROP NOT NULL;
    ALTER TABLE markets
    ALTER COLUMN outcome TYPE INT USING CASE WHEN outcome = TRUE THEN 1 WHEN outcome = FALSE THEN 0 ELSE NULL END;
  END IF;
END $$;
