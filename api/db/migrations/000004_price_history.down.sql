-- Remove the pg_cron maintenance job if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
        PERFORM cron.unschedule('price_history_maintenance');
    END IF;
END $$;

-- Drop default partition if it exists
DROP TABLE IF EXISTS price_history_default;

-- Drop parent table (drops all partitions)
DROP TABLE IF EXISTS price_history CASCADE;

-- Drop pg_partman extension if installed
-- DO $$
-- BEGIN
--     IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_partman') THEN
--         EXECUTE 'DROP EXTENSION pg_partman CASCADE';
--     END IF;
-- END $$;

-- Drop pg_cron extension if installed
-- DO $$
-- BEGIN
--     IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
--         EXECUTE 'DROP EXTENSION pg_cron CASCADE';
--     END IF;
-- END $$;

-- Drop schema if it exists
-- DROP SCHEMA IF EXISTS partman;
