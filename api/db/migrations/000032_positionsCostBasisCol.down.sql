-- remove the column "cost_basis_price_usd" from the "positions" table
ALTER TABLE positions
DROP COLUMN cost_basis_price_yes_usd,
DROP COLUMN cost_basis_price_no_usd;