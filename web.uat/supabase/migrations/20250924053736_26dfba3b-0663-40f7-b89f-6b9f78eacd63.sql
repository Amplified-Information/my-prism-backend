-- Create hcs_system_health table for tracking HCS system health metrics
CREATE TABLE public.hcs_system_health (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  check_timestamp timestamp with time zone NOT NULL DEFAULT now(),
  health_status text NOT NULL DEFAULT 'unknown',
  total_pending integer NOT NULL DEFAULT 0,
  total_failed_24h integer NOT NULL DEFAULT 0,
  success_rate_24h numeric NOT NULL DEFAULT 0,
  stuck_jobs_cleaned integer NOT NULL DEFAULT 0,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.hcs_system_health ENABLE ROW LEVEL SECURITY;

-- Create policies for HCS system health
CREATE POLICY "Allow public read access to hcs_system_health" 
ON public.hcs_system_health 
FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage hcs_system_health" 
ON public.hcs_system_health 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_hcs_system_health_timestamp ON public.hcs_system_health(check_timestamp DESC);

-- Add comment for documentation
COMMENT ON TABLE public.hcs_system_health IS 'Tracks HCS topic creation system health metrics and cleanup results';