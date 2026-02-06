-- Add image_url field to market_proposals table
ALTER TABLE public.market_proposals 
ADD COLUMN image_url text;

-- Add comment for documentation
COMMENT ON COLUMN public.market_proposals.image_url IS 'URL of the main market image uploaded during proposal creation';