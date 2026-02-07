-- add uniqueness constraint on wallet_id and network in users table, if it doesn't already exist
-- simpler: ALTER TABLE users ADD CONSTRAINT users_wallet_network_unique UNIQUE (wallet_id, network);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_wallet_network_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_wallet_network_unique UNIQUE (wallet_id, network);
  END IF;
END$$;
