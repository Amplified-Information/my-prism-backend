-- Modify hcs_topics table to support the new flow
-- Allow topic_id to be NULL initially (will be updated when mirror node confirms)
ALTER TABLE public.hcs_topics 
ALTER COLUMN topic_id DROP NOT NULL;

-- Add submitted_at timestamp to track when HCS submission happened
ALTER TABLE public.hcs_topics 
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE;

-- Add index for efficient mirror node polling queries
CREATE INDEX IF NOT EXISTS idx_hcs_topics_submitted_unconfirmed 
ON public.hcs_topics (submitted_at, is_active, topic_type) 
WHERE topic_id IS NULL AND submitted_at IS NOT NULL;