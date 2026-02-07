-- Fix search path for the new functions to address security warnings
CREATE OR REPLACE FUNCTION public.trigger_scheduled_mirror_poller()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Trigger the scheduled mirror poller via HTTP call
  PERFORM net.http_post(
    url := 'https://bfenuvdwsgzglhhjbrql.supabase.co/functions/v1/scheduled-mirror-poller',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmZW51dmR3c2d6Z2xoaGpicnFsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDI4NjgxNSwiZXhwIjoyMDU1ODYyODE1fQ.O3ko3M3RrPpfFMywEqorjzXZhGGb4S8PIvDhOo7hMf0"}'::jsonb,
    body := '{"trigger": "scheduled", "source": "pg_cron"}'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.manual_trigger_mirror_poller()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result json;
BEGIN
  PERFORM public.trigger_scheduled_mirror_poller();
  result := json_build_object(
    'message', 'Mirror node poller triggered manually',
    'timestamp', now()
  );
  RETURN result;
END;
$$;