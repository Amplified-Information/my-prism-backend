-- Enable pg_cron and pg_net extensions for automated job processing
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Set up cron job to process topic creation jobs every 30 seconds
SELECT cron.schedule(
  'process-topic-jobs',
  '*/30 * * * * *', -- every 30 seconds
  $$
  SELECT
    net.http_post(
        url:='https://bfenuvdwsgzglhhjbrql.supabase.co/functions/v1/process-topic-jobs',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmZW51dmR3c2d6Z2xoaGpicnFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAyODY4MTUsImV4cCI6MjA1NTg2MjgxNX0.85RJwwLQxQBySfTin2mu_KV71BVl0W0PbmdZD8R1ftQ"}'::jsonb,
        body:='{"timestamp": "'||now()||'"}'::jsonb
    ) AS request_id;
  $$
);

-- Set up cron job to poll Hedera Mirror Node for transaction status every minute  
SELECT cron.schedule(
  'hedera-mirror-poller',
  '0 * * * * *', -- every minute
  $$
  SELECT
    net.http_post(
        url:='https://bfenuvdwsgzglhhjbrql.supabase.co/functions/v1/hedera-mirror-poller',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmZW51dmR3c2d6Z2xoaGpicnFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAyODY4MTUsImV4cCI6MjA1NTg2MjgxNX0.85RJwwLQxQBySfTin2mu_KV71BVl0W0PbmdZD8R1ftQ"}'::jsonb,
        body:='{"timestamp": "'||now()||'"}'::jsonb  
    ) AS request_id;
  $$
);

-- Add realtime replication for topic_creation_jobs table
ALTER TABLE topic_creation_jobs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE topic_creation_jobs;