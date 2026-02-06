-- Fix search path security issue for claim_topic_jobs function
CREATE OR REPLACE FUNCTION public.claim_topic_jobs(limit_count int)
RETURNS SETOF topic_creation_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH cte AS (
    SELECT id
    FROM public.topic_creation_jobs
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT limit_count
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.topic_creation_jobs j
  SET status = 'processing',
      claimed_at = NOW(),
      updated_at = NOW()
  FROM cte
  WHERE j.id = cte.id
  RETURNING j.*;
END;
$$;