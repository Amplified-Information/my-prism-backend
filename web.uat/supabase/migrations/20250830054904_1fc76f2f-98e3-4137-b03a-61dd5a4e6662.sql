-- Create market_options table to support both binary and multiple-choice markets
CREATE TABLE public.market_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  market_id UUID NOT NULL REFERENCES public.event_markets(id) ON DELETE CASCADE,
  option_name TEXT NOT NULL,
  option_type TEXT NOT NULL CHECK (option_type IN ('yes', 'no', 'choice')),
  current_price NUMERIC(10,4) NOT NULL DEFAULT 0.5000,
  total_shares BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create index for efficient queries
CREATE INDEX idx_market_options_market_id ON public.market_options(market_id);
CREATE INDEX idx_market_options_active ON public.market_options(market_id, is_active);

-- Create market_price_history table for historical chart data
CREATE TABLE public.market_price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  market_id UUID NOT NULL REFERENCES public.event_markets(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.market_options(id) ON DELETE CASCADE,
  price NUMERIC(10,4) NOT NULL,
  volume NUMERIC(15,2) NOT NULL DEFAULT 0,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Create indexes for efficient time-series queries
CREATE INDEX idx_market_price_history_market_timestamp ON public.market_price_history(market_id, timestamp DESC);
CREATE INDEX idx_market_price_history_option_timestamp ON public.market_price_history(option_id, timestamp DESC);
CREATE INDEX idx_market_price_history_timestamp ON public.market_price_history(timestamp DESC);

-- Add market_type field to event_markets to distinguish binary vs multiple-choice
ALTER TABLE public.event_markets 
ADD COLUMN IF NOT EXISTS options_count INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS market_format TEXT DEFAULT 'binary' CHECK (market_format IN ('binary', 'multiple_choice'));

-- Enable RLS on new tables
ALTER TABLE public.market_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_price_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for market_options
CREATE POLICY "Allow public read access to active market_options"
ON public.market_options
FOR SELECT
USING (is_active = true);

CREATE POLICY "Allow service role full access to market_options"
ON public.market_options
FOR ALL
USING (true)
WITH CHECK (true);

-- Create RLS policies for market_price_history
CREATE POLICY "Allow public read access to market_price_history"
ON public.market_price_history
FOR SELECT
USING (true);

CREATE POLICY "Allow service role full access to market_price_history"
ON public.market_price_history
FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger to update updated_at timestamp for market_options
CREATE TRIGGER update_market_options_updated_at
  BEFORE UPDATE ON public.market_options
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create default binary options for existing markets
CREATE OR REPLACE FUNCTION public.create_default_binary_options()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert Yes/No options for existing binary markets that don't have options yet
  INSERT INTO public.market_options (market_id, option_name, option_type, current_price, sort_order)
  SELECT 
    em.id,
    'Yes',
    'yes',
    COALESCE(em.yes_price, 0.5000),
    1
  FROM public.event_markets em
  LEFT JOIN public.market_options mo ON em.id = mo.market_id
  WHERE mo.id IS NULL
    AND em.market_type = 'binary'
    AND em.is_active = true;

  INSERT INTO public.market_options (market_id, option_name, option_type, current_price, sort_order)
  SELECT 
    em.id,
    'No',
    'no',
    COALESCE(em.no_price, 0.5000),
    2
  FROM public.event_markets em
  LEFT JOIN public.market_options mo ON em.id = mo.market_id AND mo.option_type = 'no'
  WHERE mo.id IS NULL
    AND em.market_type = 'binary'
    AND em.is_active = true;
END;
$$;

-- Execute the function to create default options for existing markets
SELECT public.create_default_binary_options();