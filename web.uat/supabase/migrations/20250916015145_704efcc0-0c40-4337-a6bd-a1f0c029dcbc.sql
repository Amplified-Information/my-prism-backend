-- Add resolution criteria and important notes fields to event_markets table
ALTER TABLE public.event_markets 
ADD COLUMN resolution_criteria TEXT,
ADD COLUMN important_notes TEXT;