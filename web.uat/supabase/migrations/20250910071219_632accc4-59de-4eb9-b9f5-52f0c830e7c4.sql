-- Enable real-time for topic_creation_jobs table
ALTER TABLE public.topic_creation_jobs REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.topic_creation_jobs;