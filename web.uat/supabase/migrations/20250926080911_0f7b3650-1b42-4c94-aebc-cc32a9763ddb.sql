-- Create enum types for discussion board functionality
CREATE TYPE comment_position AS ENUM ('YES', 'NO');
CREATE TYPE reaction_type AS ENUM ('like', 'dislike');
CREATE TYPE report_status AS ENUM ('pending', 'reviewed', 'resolved');

-- Create market_comments table
CREATE TABLE public.market_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  market_id UUID NOT NULL REFERENCES public.event_markets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  wallet_id TEXT,
  content TEXT NOT NULL,
  position comment_position,
  parent_comment_id UUID REFERENCES public.market_comments(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT content_not_empty CHECK (length(trim(content)) > 0),
  CONSTRAINT author_present CHECK (user_id IS NOT NULL OR wallet_id IS NOT NULL)
);

-- Create comment_reactions table
CREATE TABLE public.comment_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES public.market_comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  wallet_id TEXT,
  reaction_type reaction_type NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT reactor_present CHECK (user_id IS NOT NULL OR wallet_id IS NOT NULL),
  CONSTRAINT unique_user_reaction UNIQUE (comment_id, user_id),
  CONSTRAINT unique_wallet_reaction UNIQUE (comment_id, wallet_id)
);

-- Create comment_reports table
CREATE TABLE public.comment_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES public.market_comments(id) ON DELETE CASCADE,
  reporter_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reporter_wallet_id TEXT,
  reason TEXT NOT NULL,
  status report_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT reporter_present CHECK (reporter_user_id IS NOT NULL OR reporter_wallet_id IS NOT NULL)
);

-- Enable Row Level Security
ALTER TABLE public.market_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for market_comments
CREATE POLICY "Public can view active comments" ON public.market_comments
FOR SELECT USING (is_active = true);

CREATE POLICY "Authenticated users can create comments" ON public.market_comments
FOR INSERT WITH CHECK (
  (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR 
  (wallet_id IS NOT NULL)
);

CREATE POLICY "Users can update their own comments" ON public.market_comments
FOR UPDATE USING (
  (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
  (wallet_id IS NOT NULL)
) WITH CHECK (is_active = true);

CREATE POLICY "Service role can manage all comments" ON public.market_comments
FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for comment_reactions
CREATE POLICY "Public can view reactions" ON public.comment_reactions
FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage reactions" ON public.comment_reactions
FOR ALL USING (
  (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
  (wallet_id IS NOT NULL)
) WITH CHECK (
  (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
  (wallet_id IS NOT NULL)
);

CREATE POLICY "Service role can manage all reactions" ON public.comment_reactions
FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for comment_reports
CREATE POLICY "Users can view their own reports" ON public.comment_reports
FOR SELECT USING (
  (auth.uid() IS NOT NULL AND reporter_user_id = auth.uid()) OR
  (reporter_wallet_id IS NOT NULL)
);

CREATE POLICY "Authenticated users can create reports" ON public.comment_reports
FOR INSERT WITH CHECK (
  (auth.uid() IS NOT NULL AND reporter_user_id = auth.uid()) OR
  (reporter_wallet_id IS NOT NULL)
);

CREATE POLICY "Service role can manage all reports" ON public.comment_reports
FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_market_comments_market_id ON public.market_comments(market_id);
CREATE INDEX idx_market_comments_parent_id ON public.market_comments(parent_comment_id);
CREATE INDEX idx_market_comments_created_at ON public.market_comments(created_at DESC);
CREATE INDEX idx_comment_reactions_comment_id ON public.comment_reactions(comment_id);
CREATE INDEX idx_comment_reports_status ON public.comment_reports(status);

-- Create triggers for updated_at
CREATE TRIGGER update_market_comments_updated_at
  BEFORE UPDATE ON public.market_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_reactions;