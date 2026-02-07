-- Add scheduled_for column to topic_creation_jobs for exponential backoff
ALTER TABLE public.topic_creation_jobs 
ADD COLUMN IF NOT EXISTS scheduled_for timestamp with time zone DEFAULT null;