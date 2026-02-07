-- Add max_retries column if it doesn't exist
ALTER TABLE public.topic_creation_jobs 
ADD COLUMN IF NOT EXISTS max_retries INTEGER NOT NULL DEFAULT 3;