-- Create simplified hcs_requests table for the new queue approach
CREATE TABLE public.hcs_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  memo text,
  status text DEFAULT 'pending', -- pending | created | failed
  topic_id text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  error_message text,
  mirror_confirmed_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.hcs_requests ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access to hcs_requests" 
ON public.hcs_requests 
FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage all hcs_requests" 
ON public.hcs_requests 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_hcs_requests_updated_at
  BEFORE UPDATE ON public.hcs_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();