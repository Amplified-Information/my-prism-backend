-- Create table for logging flagged/rejected comments
CREATE TABLE public.flagged_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES public.event_markets(id) ON DELETE CASCADE,
  wallet_id TEXT,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  moderation_reason TEXT NOT NULL,
  moderation_categories JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.flagged_comments ENABLE ROW LEVEL SECURITY;

-- Service role can manage all flagged comments (for moderation/admin)
CREATE POLICY "Service role can manage flagged comments"
ON public.flagged_comments
FOR ALL
USING (true)
WITH CHECK (true);

-- Users can view their own flagged comments (optional transparency)
CREATE POLICY "Users can view their own flagged comments"
ON public.flagged_comments
FOR SELECT
USING (
  (auth.uid() IS NOT NULL AND user_id = auth.uid()) 
  OR wallet_id IS NOT NULL
);

-- Create index for faster lookups
CREATE INDEX idx_flagged_comments_market_id ON public.flagged_comments(market_id);
CREATE INDEX idx_flagged_comments_wallet_id ON public.flagged_comments(wallet_id);
CREATE INDEX idx_flagged_comments_created_at ON public.flagged_comments(created_at DESC);