CREATE TABLE IF NOT EXISTS order_requests (
  tx_id UUID PRIMARY KEY NOT NULL,
  net TEXT NOT NULL DEFAULT 'testnet' CHECK (net IN ('testnet', 'mainnet', 'previewnet')),
  market_id UUID NOT NULL,
  account_id TEXT NOT NULL CHECK (LENGTH(account_id) >= 5),
  market_limit TEXT NOT NULL CHECK (market_limit IN ('market', 'limit')),
  price_usd DOUBLE PRECISION NOT NULL CHECK (price_usd BETWEEN -1.0 AND 1.0),
  qty DOUBLE PRECISION NOT NULL CHECK (qty > 0.0), -- Note: exactly 0.0 is not a valid qty
  sig TEXT NOT NULL CHECK (LENGTH(sig) > 10 AND LENGTH(sig) < 256),
  public_key_hex TEXT NOT NULL CHECK (LENGTH(public_key_hex) > 10 AND LENGTH(public_key_hex) <= 256),
  evmAddress TEXT NOT NULL CHECK (LENGTH(evmAddress) = 40),
  keyType INTEGER NOT NULL CHECK (keyType IN (1, 2, 3)), -- 1=secp256k1, 2=ed25519, 3=other
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  generated_at TIMESTAMP NOT NULL
)
