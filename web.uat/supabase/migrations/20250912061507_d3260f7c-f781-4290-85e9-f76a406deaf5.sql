-- Add image field to event_markets table for market-specific images
ALTER TABLE public.event_markets 
ADD COLUMN IF NOT EXISTS image_url TEXT;