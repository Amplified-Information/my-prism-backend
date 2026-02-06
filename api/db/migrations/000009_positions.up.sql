CREATE TABLE IF NOT EXISTS positions (
  id SERIAL PRIMARY KEY,
  market_id UUID NOT NULL, -- unique across nets
  account_id TEXT NOT NULL CHECK (LENGTH(account_id) >= 5),
  n_yes BIGINT NOT NULL CHECK (n_yes >= 0),
  n_no BIGINT NOT NULL CHECK (n_no >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(market_id, account_id)
);
