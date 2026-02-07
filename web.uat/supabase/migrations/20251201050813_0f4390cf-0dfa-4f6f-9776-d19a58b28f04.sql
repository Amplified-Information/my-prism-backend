-- Create user_favorite_markets table to store user favorite markets
CREATE TABLE public.user_favorite_markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id TEXT NOT NULL,
  market_id UUID NOT NULL REFERENCES public.event_markets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  UNIQUE(wallet_id, market_id)
);

-- Enable RLS
ALTER TABLE public.user_favorite_markets ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read favorites (needed for public category filtering)
CREATE POLICY "Public can view favorites"
  ON public.user_favorite_markets FOR SELECT USING (true);

-- Allow users to manage their own favorites
CREATE POLICY "Users can manage their own favorites"
  ON public.user_favorite_markets FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_user_favorite_markets_wallet_id ON public.user_favorite_markets(wallet_id);
CREATE INDEX idx_user_favorite_markets_market_id ON public.user_favorite_markets(market_id);