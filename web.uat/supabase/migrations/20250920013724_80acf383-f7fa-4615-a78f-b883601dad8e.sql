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

-- Add scheduled_for column to topic_creation_jobs for exponential backoff
ALTER TABLE public.topic_creation_jobs 
ADD COLUMN IF NOT EXISTS scheduled_for timestamp with time zone DEFAULT null;

-- Add health_status tracking table
CREATE TABLE IF NOT EXISTS public.hcs_system_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_timestamp timestamp with time zone NOT NULL DEFAULT now(),
  health_status text NOT NULL CHECK (health_status IN ('healthy', 'degraded', 'critical')),
  total_pending integer NOT NULL DEFAULT 0,
  total_failed_24h integer NOT NULL DEFAULT 0,
  success_rate_24h numeric NOT NULL DEFAULT 0,
  stuck_jobs_cleaned integer NOT NULL DEFAULT 0,
  recommendations jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on health table
ALTER TABLE public.hcs_system_health ENABLE ROW LEVEL SECURITY;

-- Allow public read access to health status
CREATE POLICY "Allow public read access to hcs_system_health" 
ON public.hcs_system_health 
FOR SELECT 
USING (true);

-- Service role can manage health records
CREATE POLICY "Service role can manage hcs_system_health" 
ON public.hcs_system_health 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Add index for faster queries on recent health checks
CREATE INDEX IF NOT EXISTS idx_hcs_health_timestamp ON public.hcs_system_health(check_timestamp DESC);