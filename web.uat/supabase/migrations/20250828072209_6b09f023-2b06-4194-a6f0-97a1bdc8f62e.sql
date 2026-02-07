-- Create market_subcategories table
CREATE TABLE public.market_subcategories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.market_categories(id) ON DELETE CASCADE,
  name CHARACTER VARYING NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 999,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security
ALTER TABLE public.market_subcategories ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access to market_subcategories" 
ON public.market_subcategories 
FOR SELECT 
USING (true);

-- Create policy for service role full access
CREATE POLICY "Allow service role full access to market_subcategories" 
ON public.market_subcategories 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_market_subcategories_updated_at
BEFORE UPDATE ON public.market_subcategories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance on category_id lookups
CREATE INDEX idx_market_subcategories_category_id ON public.market_subcategories(category_id);
CREATE INDEX idx_market_subcategories_active ON public.market_subcategories(is_active) WHERE is_active = true;