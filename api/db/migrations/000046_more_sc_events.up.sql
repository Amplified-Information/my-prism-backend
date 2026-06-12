-- modify event_market_resolved table to include outcome column (YES=1, NO=0, EmergClose5050=2)
-- any previous entries - map FALSE->0, TRUE->1, NULL->NULL.
-- Some environments may not have event_market_resolved yet, so guard this change.
DO $$
BEGIN
  IF to_regclass('public.event_market_resolved') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'event_market_resolved'
        AND column_name = 'outcome'
        AND data_type = 'boolean'
    ) THEN
      ALTER TABLE event_market_resolved
      ALTER COLUMN outcome DROP NOT NULL;

      ALTER TABLE event_market_resolved
      ALTER COLUMN outcome TYPE INT
      USING CASE
        WHEN outcome IS TRUE THEN 1
        WHEN outcome IS FALSE THEN 0
        ELSE NULL
      END;
    ELSIF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'event_market_resolved'
        AND column_name = 'outcome'
    ) THEN
      ALTER TABLE event_market_resolved ADD COLUMN outcome INT;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'markets'
        AND column_name = 'outcome'
    ) THEN
      UPDATE event_market_resolved emr
      SET outcome = CASE
        WHEN m.outcome IS TRUE THEN 1
        WHEN m.outcome IS FALSE THEN 0
        ELSE NULL -- if market outcome is NULL/unknown, keep event outcome NULL
      END
      FROM markets m
      WHERE m.market_id::text = emr.market_id
        AND emr.outcome IS NULL;
    END IF;
  END IF;
END $$;


-- new table dao_updated_event
CREATE TABLE event_dao_updated (
  id SERIAL PRIMARY KEY,
  net VARCHAR(20) NOT NULL CHECK (net IN ('previewnet', 'testnet', 'mainnet')),
  smart_contract_id VARCHAR(256) NOT NULL,
  timestamp_nano TIMESTAMP(9) NOT NULL,
  tx_hash VARCHAR(256) NOT NULL,
  hostname VARCHAR(256) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

    -- prevent duplicates!
  md5_uniq VARCHAR(32) NOT NULL UNIQUE,

  -- event DaoUpdated(address newDao);
  new_dao_address TEXT NOT NULL
);

-- new table oracle_updated_event
CREATE TABLE event_oracle_updated (
  id SERIAL PRIMARY KEY,
  net VARCHAR(20) NOT NULL CHECK (net IN ('previewnet', 'testnet', 'mainnet')),
  smart_contract_id VARCHAR(256) NOT NULL,
  timestamp_nano TIMESTAMP(9) NOT NULL,
  tx_hash VARCHAR(256) NOT NULL,
  hostname VARCHAR(256) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

    -- prevent duplicates!
  md5_uniq VARCHAR(32) NOT NULL UNIQUE,

  -- event OracleUpdated(address newOracle);
  new_oracle_address TEXT NOT NULL
);

-- new table rake_updated_event
CREATE TABLE event_rake_updated (
  id SERIAL PRIMARY KEY,
  net VARCHAR(20) NOT NULL CHECK (net IN ('previewnet', 'testnet', 'mainnet')),
  smart_contract_id VARCHAR(256) NOT NULL,
  timestamp_nano TIMESTAMP(9) NOT NULL,
  tx_hash VARCHAR(256) NOT NULL,
  hostname VARCHAR(256) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- prevent duplicates!
  md5_uniq VARCHAR(32) NOT NULL UNIQUE,

  -- event RakeUpdated(uint256 newRakePercentScaled100);
  new_rake_percent_scaled_100 NUMERIC NOT NULL
);
