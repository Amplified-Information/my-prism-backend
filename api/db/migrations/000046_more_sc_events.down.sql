-- drop table dao_updated_event
DROP TABLE IF EXISTS event_dao_updated;

-- drop table oracle_updated_event
DROP TABLE IF EXISTS event_oracle_updated;

-- drop table rake_updated_event
DROP TABLE IF EXISTS event_rake_updated;




-- revert event_market_resolved.outcome from INT back to BOOLEAN where applicable.
DO $$
BEGIN
  IF to_regclass('public.event_market_resolved') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'event_market_resolved'
         AND column_name = 'outcome'
         AND data_type IN ('integer', 'bigint', 'smallint', 'numeric')
     ) THEN
    ALTER TABLE event_market_resolved
    ALTER COLUMN outcome TYPE BOOLEAN
    USING CASE
      WHEN outcome = 0 THEN FALSE
      WHEN outcome = 1 THEN TRUE
      WHEN outcome = 2 THEN NULL
      ELSE NULL
    END;
  END IF;
END $$;