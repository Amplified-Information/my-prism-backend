-- Add trade fee tracking to clob_trades table

-- Add fee columns to track who pays what
ALTER TABLE clob_trades 
  ADD COLUMN IF NOT EXISTS buyer_fee BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_fee BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_fee BIGINT DEFAULT 0;

-- Add comment to document fee structure
COMMENT ON COLUMN clob_trades.buyer_fee IS 'Fee paid by buyer in smallest units (1% of trade value)';
COMMENT ON COLUMN clob_trades.seller_fee IS 'Fee paid by seller in smallest units (typically 0 for maker-taker model)';
COMMENT ON COLUMN clob_trades.total_fee IS 'Total platform fee collected from this trade';

-- Create platform_fees table to track revenue
CREATE TABLE IF NOT EXISTS platform_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID REFERENCES clob_trades(id) ON DELETE CASCADE,
  market_id UUID NOT NULL,
  fee_amount BIGINT NOT NULL,
  fee_currency TEXT DEFAULT 'HBAR',
  collected_from TEXT NOT NULL, -- 'buyer' or 'seller'
  collected_at TIMESTAMPTZ DEFAULT now(),
  settlement_status TEXT DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on platform_fees
ALTER TABLE platform_fees ENABLE ROW LEVEL SECURITY;

-- Public can read fees (for transparency)
CREATE POLICY "Public can view platform fees"
  ON platform_fees
  FOR SELECT
  USING (true);

-- Service role can manage fees
CREATE POLICY "Service role can manage platform fees"
  ON platform_fees
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_platform_fees_market 
  ON platform_fees(market_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_fees_settlement 
  ON platform_fees(settlement_status, created_at);