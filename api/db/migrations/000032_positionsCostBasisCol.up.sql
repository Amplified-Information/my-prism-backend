-- add a column to "positions" table to store the cost basis of the position (USD float - [0.00, 1.00])
-- need this column for allocating Prism points according to (see: https://docs.prism.market):
-- Points = (WinningShares − LosingShares) × AverageCostBasis

ALTER TABLE positions
ADD COLUMN cost_basis_price_yes_usd FLOAT NOT NULL DEFAULT 0.0 CHECK (
	cost_basis_price_yes_usd >= 0.00 AND cost_basis_price_yes_usd <= 1.00
);

ALTER TABLE positions
ADD COLUMN cost_basis_price_no_usd FLOAT NOT NULL DEFAULT 0.0 CHECK (
  cost_basis_price_no_usd >= 0.00 AND cost_basis_price_no_usd <= 1.00
);
