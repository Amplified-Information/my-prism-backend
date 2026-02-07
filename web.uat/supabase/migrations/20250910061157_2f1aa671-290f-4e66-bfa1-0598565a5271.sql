-- Remove existing cron jobs for topic processing
SELECT cron.unschedule('process-hcs-jobs');
SELECT cron.unschedule('hcs-topic-worker'); 
SELECT cron.unschedule('process-topic-jobs');

-- Create function to trigger worker via HTTP
CREATE OR REPLACE FUNCTION trigger_topic_worker()
RETURNS TRIGGER AS $$
BEGIN
  -- Trigger the worker function via HTTP call
  PERFORM net.http_post(
    url := 'https://bfenuvdwsgzglhhjbrql.supabase.co/functions/v1/process-topic-jobs',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmZW51dmR3c2d6Z2xoaGpicnFsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDI4NjgxNSwiZXhwIjoyMDU1ODYyODE1fQ.O3ko3M3RrPpfFMywEqorjzXZhGGb4S8PIvDhOo7hMf0"}'::jsonb,
    body := '{}'::jsonb
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically start worker when new jobs are created
DROP TRIGGER IF EXISTS trigger_topic_worker_on_insert ON public.topic_creation_jobs;

CREATE TRIGGER trigger_topic_worker_on_insert
  AFTER INSERT ON public.topic_creation_jobs
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION trigger_topic_worker();