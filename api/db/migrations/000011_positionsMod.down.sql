ALTER TABLE positions
  DROP CONSTRAINT IF EXISTS unique_market_id_evm_address;
ALTER TABLE positions
  RENAME COLUMN evm_address TO account_id;
ALTER TABLE positions
  ADD CONSTRAINT unique_market_id_account_id UNIQUE (market_id, account_id);

ALTER TABLE positions
  RENAME COLUMN updated_at TO created_at;