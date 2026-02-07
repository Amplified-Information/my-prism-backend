-- Fix search path security for trigger functions
CREATE OR REPLACE FUNCTION public.trigger_process_topic_jobs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Fix search path security for mirror poller trigger function
CREATE OR REPLACE FUNCTION public.trigger_hedera_mirror_poller()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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