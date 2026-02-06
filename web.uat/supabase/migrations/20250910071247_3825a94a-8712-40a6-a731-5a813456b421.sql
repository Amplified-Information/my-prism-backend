-- Enable replica identity for real-time updates
ALTER TABLE public.topic_creation_jobs REPLICA IDENTITY FULL;