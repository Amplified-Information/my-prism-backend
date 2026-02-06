-- Add transaction tracking fields to topic_creation_jobs table
ALTER TABLE public.topic_creation_jobs 
ADD COLUMN transaction_id text,
ADD COLUMN submitted_at timestamp with time zone,
ADD COLUMN mirror_node_checked_at timestamp with time zone,
ADD COLUMN mirror_node_retry_count integer DEFAULT 0;

-- Update status enum to include new states
COMMENT ON COLUMN public.topic_creation_jobs.status IS 'Valid values: pending, processing, submitted, confirmed, failed';

-- Add index for efficient polling queries
CREATE INDEX idx_topic_creation_jobs_submitted_status 
ON public.topic_creation_jobs(status, submitted_at) 
WHERE status = 'submitted';