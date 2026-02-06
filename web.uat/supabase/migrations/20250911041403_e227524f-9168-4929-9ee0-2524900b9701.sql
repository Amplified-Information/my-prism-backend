-- Create order_queue table for incoming orders awaiting matching
CREATE TABLE public.order_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  market_id UUID NOT NULL,
  maker_account_id TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  price_ticks INTEGER NOT NULL,
  quantity BIGINT NOT NULL,
  max_collateral BIGINT NOT NULL,
  time_in_force TEXT NOT NULL DEFAULT 'GTC',
  expiry_timestamp BIGINT,
  nonce BIGINT NOT NULL,
  order_signature TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'PROCESSING', 'MATCHED', 'FAILED')),
  priority_score BIGINT NOT NULL DEFAULT extract(epoch from now()) * 1000000, -- microsecond timestamp for ordering
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Create indexes for efficient processing
CREATE INDEX idx_order_queue_status_priority ON public.order_queue (status, priority_score);
CREATE INDEX idx_order_queue_market_side ON public.order_queue (market_id, side);
CREATE INDEX idx_order_queue_processing ON public.order_queue (status, attempts, created_at) WHERE status = 'PROCESSING';

-- Enable RLS
ALTER TABLE public.order_queue ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access to order_queue" 
ON public.order_queue FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage all order queue" 
ON public.order_queue FOR ALL 
USING (true) 
WITH CHECK (true);

-- Update sequencer_state table to include more matching state
ALTER TABLE public.sequencer_state 
ADD COLUMN IF NOT EXISTS bid_levels JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS ask_levels JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS last_matched_price INTEGER,
ADD COLUMN IF NOT EXISTS total_volume_24h BIGINT DEFAULT 0;

-- Create function to claim order queue jobs
CREATE OR REPLACE FUNCTION public.claim_order_queue_jobs(limit_count integer, p_worker_id text DEFAULT NULL::text)
RETURNS SETOF order_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH cte AS (
    SELECT id FROM public.order_queue
    WHERE status = 'QUEUED' AND attempts < 3
    ORDER BY priority_score ASC
    LIMIT limit_count
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.order_queue q
  SET status = 'PROCESSING',
      processed_at = NOW(),
      attempts = attempts + 1
  FROM cte WHERE q.id = cte.id
  RETURNING q.*;
END;
$function$;