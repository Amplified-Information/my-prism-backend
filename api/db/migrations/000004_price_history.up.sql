-- Create parent table
CREATE TABLE IF NOT EXISTS price_history (
    market_id UUID NOT NULL,
    tx_id UUID NOT NULL,
    price NUMERIC(18,10) NOT NULL,
    ts TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (market_id, ts)
)
PARTITION BY RANGE (ts);
CREATE INDEX ON price_history (market_id, ts DESC); -- for faster queries by market and time




-- Create pg_partman schema and extension
CREATE SCHEMA IF NOT EXISTS partman;
CREATE EXTENSION IF NOT EXISTS pg_partman SCHEMA partman;


-- Configure pg_partman (native partitions)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM partman.part_config
        WHERE parent_table = 'public.price_history'
    ) THEN
        PERFORM partman.create_parent(
            p_parent_table := 'public.price_history',
            p_control      := 'ts',
            p_interval     := '7 days',
            p_premake      := 6
        );
    END IF;
END $$;

-- Create default partition for out-of-range rows
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname='public' AND tablename='price_history_default'
    ) THEN
        EXECUTE 'CREATE TABLE price_history_default PARTITION OF price_history DEFAULT';
    END IF;
END $$;

-- Schedule automatic partition maintenance using pg_cron
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
        IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='price_history_maintenance') THEN
            PERFORM cron.schedule(
                'price_history_maintenance',
                '0 * * * *',  -- every hour
                'SELECT partman.run_maintenance();'
            );
        END IF;
    END IF;
END $$;
