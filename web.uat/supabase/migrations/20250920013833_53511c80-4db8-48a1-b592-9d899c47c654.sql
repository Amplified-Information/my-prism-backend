-- Create a function to trigger the cleanup monitor
CREATE OR REPLACE FUNCTION public.trigger_hcs_cleanup_monitor()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result json;
BEGIN
  -- Trigger the cleanup monitor via HTTP call
  PERFORM net.http_post(
    url := 'https://bfenuvdwsgzglhhjbrql.supabase.co/functions/v1/hcs-cleanup-monitor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmZW51dmR3c2d6Z2xoaGpicnFsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDI4NjgxNSwiZXhwIjoyMDU1ODYyODE1fQ.O3ko3M3RrPpfFMywEqorjzXZhGGb4S8PIvDhOo7hMf0"}'::jsonb,
    body := '{"trigger": "scheduled", "source": "pg_cron"}'::jsonb
  );
  
  result := json_build_object(
    'message', 'HCS cleanup monitor triggered',
    'timestamp', now()
  );
  RETURN result;
END;
$function$