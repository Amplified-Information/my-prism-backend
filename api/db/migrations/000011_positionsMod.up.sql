ALTER TABLE positions
  RENAME COLUMN created_at TO updated_at;

ALTER TABLE positions
  DROP CONSTRAINT IF EXISTS unique_market_id_account_id;
ALTER TABLE positions
  RENAME COLUMN account_id TO evm_address;
ALTER TABLE positions
  ADD CONSTRAINT unique_market_id_evm_address UNIQUE (market_id, evm_address);