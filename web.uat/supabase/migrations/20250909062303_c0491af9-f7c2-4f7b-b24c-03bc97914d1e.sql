-- Create table for tracking async topic creation jobs
CREATE TABLE public.topic_creation_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  topic_type TEXT NOT NULL,
  market_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  topic_id TEXT,
  duration INTEGER,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.topic_creation_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access to topic creation jobs" 
ON public.topic_creation_jobs 
FOR SELECT 
USING (true);

-- Service role can manage all jobs
CREATE POLICY "Service role can manage all topic creation jobs" 
ON public.topic_creation_jobs 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create index for efficient querying
CREATE INDEX idx_topic_creation_jobs_status ON public.topic_creation_jobs(status);
CREATE INDEX idx_topic_creation_jobs_request_id ON public.topic_creation_jobs(request_id);

-- Add trigger for updated_at
CREATE TRIGGER update_topic_creation_jobs_updated_at
BEFORE UPDATE ON public.topic_creation_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();