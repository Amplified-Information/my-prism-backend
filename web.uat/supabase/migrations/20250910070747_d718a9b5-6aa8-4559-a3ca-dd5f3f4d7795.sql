-- Set up real-time database triggers for topic job processing

-- Create trigger function to invoke process-topic-jobs worker
CREATE OR REPLACE FUNCTION public.trigger_process_topic_jobs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Trigger the process-topic-jobs worker via HTTP call in background
  PERFORM net.http_post(
    url := 'https://bfenuvdwsgzglhhjbrql.supabase.co/functions/v1/process-topic-jobs',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmZW51dmR3c2d6Z2xoaGpicnFsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDI4NjgxNSwiZXhwIjoyMDU1ODYyODE1fQ.O3ko3M3RrPpfFMywEqorjzXZhGGb4S8PIvDhOo7hMf0"}'::jsonb,
    body := '{"trigger": "new_job"}'::jsonb
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger function to invoke hedera-mirror-poller worker
CREATE OR REPLACE FUNCTION public.trigger_hedera_mirror_poller()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only trigger when status changes to 'submitted'
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN
    PERFORM net.http_post(
      url := 'https://bfenuvdwsgzglhhjbrql.supabase.co/functions/v1/hedera-mirror-poller',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmZW51dmR3c2d6Z2xoaGpicnFsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDI4NjgxNSwiZXhwIjoyMDU1ODYyODE1fQ.O3ko3M3RrPpfFMywEqorjzXZhGGb4S8PIvDhOo7hMf0"}'::jsonb,
      body := '{"trigger": "submitted_job", "job_id": "' || NEW.id || '"}'::jsonb
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS topic_job_inserted ON public.topic_creation_jobs;
DROP TRIGGER IF EXISTS topic_job_updated ON public.topic_creation_jobs;

-- Create trigger for new job insertions (real-time processing)
CREATE TRIGGER topic_job_inserted
  AFTER INSERT ON public.topic_creation_jobs
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION public.trigger_process_topic_jobs();

-- Create trigger for job updates to submitted status (real-time mirror polling)
CREATE TRIGGER topic_job_updated
  AFTER UPDATE ON public.topic_creation_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_hedera_mirror_poller();