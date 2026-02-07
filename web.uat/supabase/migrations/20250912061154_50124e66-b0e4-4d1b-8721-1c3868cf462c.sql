-- Add image field to markets table for market-specific images
ALTER TABLE public.markets 
ADD COLUMN image_url TEXT;