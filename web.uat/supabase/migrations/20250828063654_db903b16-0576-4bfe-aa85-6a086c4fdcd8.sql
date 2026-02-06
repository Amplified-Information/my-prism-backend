-- Create market_categories table
CREATE TABLE public.market_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 999,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security
ALTER TABLE public.market_categories ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access
CREATE POLICY "Allow public read access to market_categories" 
ON public.market_categories 
FOR SELECT 
USING (true);

-- Create policy for service role full access
CREATE POLICY "Allow service role full access to market_categories" 
ON public.market_categories 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Insert the specified categories
INSERT INTO public.market_categories (name, sort_order) VALUES
  ('Politics', 1),
  ('Sports', 2),
  ('Culture', 3),
  ('Crypto', 4),
  ('Climate', 5),
  ('Economics', 6),
  ('Mentions', 7),
  ('Companies', 8),
  ('Financials', 9),
  ('Tech & Science', 10),
  ('Health', 11),
  ('World', 12);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_market_categories_updated_at
BEFORE UPDATE ON public.market_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();