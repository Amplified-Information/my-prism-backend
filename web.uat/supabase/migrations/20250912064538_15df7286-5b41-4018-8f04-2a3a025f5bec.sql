-- Drop the redundant market_type column from event_markets table
ALTER TABLE public.event_markets DROP COLUMN market_type;

-- Ensure market_structure is NOT NULL with proper constraint
ALTER TABLE public.event_markets 
ALTER COLUMN market_structure SET NOT NULL,
ALTER COLUMN market_structure SET DEFAULT 'binary';