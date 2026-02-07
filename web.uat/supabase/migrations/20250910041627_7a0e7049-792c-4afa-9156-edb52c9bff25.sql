-- Enable realtime for topic_creation_jobs table
ALTER TABLE public.topic_creation_jobs REPLICA IDENTITY FULL;

-- Add the table to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.topic_creation_jobs;