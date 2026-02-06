-- Fix the create_topic_job function to generate request_id
CREATE OR REPLACE FUNCTION public.create_topic_job(p_topic_type text, p_market_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  job_id uuid;
  request_id_val text;
BEGIN
  -- Generate a unique request_id
  request_id_val := 'req_' || extract(epoch from now()) || '_' || gen_random_uuid()::text;
  
  INSERT INTO topic_creation_jobs (topic_type, market_id, request_id)
  VALUES (p_topic_type, p_market_id, request_id_val)
  RETURNING id INTO job_id;
  
  RETURN job_id;
END;
$function$