-- add a field smart_contract_id (keep track of which smart contract was used to create the market!)

ALTER TABLE markets
ADD COLUMN smart_contract_id VARCHAR(256) NOT NULL DEFAULT '0.0.0';

-- any existing rows must be filled in to avoid NOT NULL constraint violation
UPDATE markets
SET smart_contract_id = '0.0.0'
WHERE smart_contract_id IS NULL;

ALTER TABLE markets
ALTER COLUMN smart_contract_id SET NOT NULL;

ALTER TABLE markets
ADD CONSTRAINT smart_contract_id_check
CHECK (
  LENGTH(smart_contract_id) >= 5
  AND smart_contract_id LIKE '%.%.%'
);
