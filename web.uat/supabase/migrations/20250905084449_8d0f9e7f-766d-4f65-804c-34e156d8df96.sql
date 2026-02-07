-- Create CLOB Orders table
CREATE TABLE public.clob_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT UNIQUE NOT NULL,
  market_id UUID REFERENCES public.event_markets(id) ON DELETE CASCADE,
  maker_account_id TEXT NOT NULL,
  side TEXT CHECK (side IN ('BUY', 'SELL')) NOT NULL,
  price_ticks INTEGER NOT NULL,
  quantity BIGINT NOT NULL,
  filled_quantity BIGINT DEFAULT 0,
  time_in_force TEXT CHECK (time_in_force IN ('GTC', 'IOC', 'FOK', 'GTD')) DEFAULT 'GTC',
  expiry_timestamp BIGINT,
  nonce BIGINT NOT NULL,
  max_collateral BIGINT NOT NULL,
  order_signature TEXT NOT NULL,
  hcs_message_id TEXT,
  hcs_sequence_number BIGINT,
  status TEXT CHECK (status IN ('PENDING', 'PUBLISHED', 'PARTIAL_FILL', 'FILLED', 'CANCELLED', 'EXPIRED')) DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create CLOB Batches table  
CREATE TABLE public.clob_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id BIGINT NOT NULL,
  market_id UUID REFERENCES public.event_markets(id) ON DELETE CASCADE,
  window_start BIGINT NOT NULL,
  window_end BIGINT NOT NULL,
  input_order_root TEXT NOT NULL,
  book_snapshot_root TEXT NOT NULL,
  trades_count INTEGER DEFAULT 0,
  cancels_count INTEGER DEFAULT 0,
  sequencer_signature TEXT NOT NULL,
  hcs_batch_message_id TEXT,
  settlement_tx_hash TEXT,
  settlement_status TEXT CHECK (settlement_status IN ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'DISPUTED')) DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create CLOB Trades table
CREATE TABLE public.clob_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id TEXT UNIQUE NOT NULL,
  batch_id UUID REFERENCES public.clob_batches(id) ON DELETE CASCADE,
  market_id UUID REFERENCES public.event_markets(id) ON DELETE CASCADE,
  buy_order_id TEXT NOT NULL,
  sell_order_id TEXT NOT NULL,
  price_ticks INTEGER NOT NULL,
  quantity BIGINT NOT NULL,
  buyer_account_id TEXT NOT NULL,
  seller_account_id TEXT NOT NULL,
  trade_timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create CLOB Positions table
CREATE TABLE public.clob_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID REFERENCES public.event_markets(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  position_type TEXT CHECK (position_type IN ('YES', 'NO')) NOT NULL,
  quantity BIGINT DEFAULT 0,
  avg_entry_price NUMERIC(16,8) DEFAULT 0,
  realized_pnl NUMERIC(18,8) DEFAULT 0,
  unrealized_pnl NUMERIC(18,8) DEFAULT 0,
  collateral_locked BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(market_id, account_id, position_type)
);

-- Create HCS Topics table
CREATE TABLE public.hcs_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id TEXT UNIQUE NOT NULL,
  topic_type TEXT CHECK (topic_type IN ('orders', 'batches', 'oracle', 'disputes')) NOT NULL,
  market_id UUID REFERENCES public.event_markets(id) ON DELETE CASCADE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Sequencer State table
CREATE TABLE public.sequencer_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID REFERENCES public.event_markets(id) ON DELETE CASCADE UNIQUE,
  last_processed_sequence BIGINT DEFAULT 0,
  last_batch_id BIGINT DEFAULT 0,
  order_book_snapshot JSONB DEFAULT '{}',
  last_processed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Settlement Transactions table
CREATE TABLE public.settlement_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES public.clob_batches(id) ON DELETE CASCADE,
  transaction_id TEXT UNIQUE NOT NULL,
  transaction_hash TEXT,
  gas_used BIGINT,
  gas_price BIGINT,
  transaction_fee BIGINT,
  status TEXT CHECK (status IN ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED')) DEFAULT 'PENDING',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_clob_orders_market_status ON public.clob_orders(market_id, status);
CREATE INDEX idx_clob_orders_maker_account ON public.clob_orders(maker_account_id);
CREATE INDEX idx_clob_orders_hcs_sequence ON public.clob_orders(hcs_sequence_number);
CREATE INDEX idx_clob_batches_market_id ON public.clob_batches(market_id);
CREATE INDEX idx_clob_batches_settlement_status ON public.clob_batches(settlement_status);
CREATE INDEX idx_clob_trades_batch_id ON public.clob_trades(batch_id);
CREATE INDEX idx_clob_trades_market_id ON public.clob_trades(market_id);
CREATE INDEX idx_clob_positions_account_market ON public.clob_positions(account_id, market_id);

-- Enable RLS for all CLOB tables
ALTER TABLE public.clob_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clob_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clob_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clob_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hcs_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequencer_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for CLOB Orders
CREATE POLICY "Allow public read access to clob_orders" 
ON public.clob_orders FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own orders" 
ON public.clob_orders FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Service role can manage all orders" 
ON public.clob_orders FOR ALL 
USING (true)
WITH CHECK (true);

-- RLS Policies for CLOB Batches
CREATE POLICY "Allow public read access to clob_batches" 
ON public.clob_batches FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage all batches" 
ON public.clob_batches FOR ALL 
USING (true)
WITH CHECK (true);

-- RLS Policies for CLOB Trades
CREATE POLICY "Allow public read access to clob_trades" 
ON public.clob_trades FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage all trades" 
ON public.clob_trades FOR ALL 
USING (true)
WITH CHECK (true);

-- RLS Policies for CLOB Positions
CREATE POLICY "Users can view positions for their accounts" 
ON public.clob_positions FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage all positions" 
ON public.clob_positions FOR ALL 
USING (true)
WITH CHECK (true);

-- RLS Policies for HCS Topics
CREATE POLICY "Allow public read access to hcs_topics" 
ON public.hcs_topics FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage all topics" 
ON public.hcs_topics FOR ALL 
USING (true)
WITH CHECK (true);

-- RLS Policies for Sequencer State
CREATE POLICY "Allow public read access to sequencer_state" 
ON public.sequencer_state FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage sequencer state" 
ON public.sequencer_state FOR ALL 
USING (true)
WITH CHECK (true);

-- RLS Policies for Settlement Transactions
CREATE POLICY "Allow public read access to settlement_transactions" 
ON public.settlement_transactions FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage settlement transactions" 
ON public.settlement_transactions FOR ALL 
USING (true)
WITH CHECK (true);

-- Create triggers for updated_at columns
CREATE TRIGGER update_clob_orders_updated_at
  BEFORE UPDATE ON public.clob_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clob_batches_updated_at
  BEFORE UPDATE ON public.clob_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clob_positions_updated_at
  BEFORE UPDATE ON public.clob_positions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hcs_topics_updated_at
  BEFORE UPDATE ON public.hcs_topics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sequencer_state_updated_at
  BEFORE UPDATE ON public.sequencer_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_settlement_transactions_updated_at
  BEFORE UPDATE ON public.settlement_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();