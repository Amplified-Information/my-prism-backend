-- Enable required extensions for cron and HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the topic job processor to run every 30 seconds
SELECT cron.schedule(
  'process-hcs-jobs',
  '*/30 * * * * *', -- Every 30 seconds
  $$
  SELECT net.http_post(
    url := 'https://bfenuvdwsgzglhhjbrql.supabase.co/functions/v1/process-topic-jobs',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmZW51dmR3c2d6Z2xoaGpicnFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAyODY4MTUsImV4cCI6MjA1NTg2MjgxNX0.85RJwwLQxQBySfTin2mu_KV71BVl0W0PbmdZD8R1ftQ"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_topic_creation_jobs_status_created 
ON topic_creation_jobs(status, created_at) 
WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_topic_creation_jobs_market_type 
ON topic_creation_jobs(market_id, topic_type);

-- Add a function to create topic jobs easily
CREATE OR REPLACE FUNCTION public.create_topic_job(
  p_topic_type text,
  p_market_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  job_id uuid;
BEGIN
  INSERT INTO topic_creation_jobs (topic_type, market_id)
  VALUES (p_topic_type, p_market_id)
  RETURNING id INTO job_id;
  
  RETURN job_id;
END;
$$;