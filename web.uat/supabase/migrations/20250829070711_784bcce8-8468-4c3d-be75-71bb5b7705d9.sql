-- Add relevance and why_it_matters columns to event_markets table
ALTER TABLE public.event_markets 
ADD COLUMN relevance TEXT,
ADD COLUMN why_it_matters TEXT;