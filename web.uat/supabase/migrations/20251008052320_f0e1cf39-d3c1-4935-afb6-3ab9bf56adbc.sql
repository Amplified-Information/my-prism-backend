-- Phase 4: Database Schema Updates for Polymarket-Style CLOB

-- 4.1: Update clob_orders table
-- Remove smart contract columns (no longer needed)
ALTER TABLE clob_orders 
  DROP COLUMN IF EXISTS contract_tx_hash,
  DROP COLUMN IF EXISTS contract_confirmed,
  DROP COLUMN IF EXISTS contract_confirmed_at;

-- Add EIP-712 message hash column
ALTER TABLE clob_orders 
  ADD COLUMN IF NOT EXISTS msg_hash TEXT;

-- 4.2: Update clob_trades table for batch settlement
-- Add settlement tracking columns
ALTER TABLE clob_trades 
  ADD COLUMN IF NOT EXISTS settlement_status TEXT DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS settlement_tx_hash TEXT,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

-- Index for faster queries on unsettled trades
CREATE INDEX IF NOT EXISTS idx_clob_trades_settlement_status 
  ON clob_trades(settlement_status, created_at) 
  WHERE batch_id IS NULL;

-- 4.3: Update order_queue table
-- Add message hash for signature verification
ALTER TABLE order_queue 
  ADD COLUMN IF NOT EXISTS msg_hash TEXT;

-- 4.4: Create cron job for batch settlement (runs every 30 seconds)
SELECT cron.schedule(
  'batch-settlement-job',
  '*/30 * * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bfenuvdwsgzglhhjbrql.supabase.co/functions/v1/batch-settlement-worker',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmZW51dmR3c2d6Z2xoaGpicnFsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDI4NjgxNSwiZXhwIjoyMDU1ODYyODE1fQ.O3ko3M3RrPpfFMywEqorjzXZhGGb4S8PIvDhOo7hMf0"}'::jsonb,
    body := concat('{"trigger": "cron", "timestamp": ', extract(epoch from now()), '}')::jsonb
  ) as request_id;
  $$
);

-- Add comment to document the architecture
COMMENT ON TABLE clob_orders IS 'CLOB orders table - Polymarket-style off-chain order book with EIP-712 signatures';
COMMENT ON TABLE clob_trades IS 'CLOB trades table - Trades are matched off-chain and settled in batches on Hedera';
COMMENT ON TABLE clob_batches IS 'CLOB batches table - Groups of trades settled together via smart contract';