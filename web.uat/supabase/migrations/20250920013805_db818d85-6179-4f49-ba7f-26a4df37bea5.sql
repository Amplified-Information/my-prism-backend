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