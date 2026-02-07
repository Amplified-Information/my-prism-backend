-- Fix the function search path security issue
CREATE OR REPLACE FUNCTION public.claim_order_queue_jobs(limit_count integer, p_worker_id text DEFAULT NULL::text)
RETURNS SETOF order_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH cte AS (
    SELECT id FROM public.order_queue
    WHERE status = 'QUEUED' AND attempts < 3
    ORDER BY priority_score ASC
    LIMIT limit_count
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.order_queue q
  SET status = 'PROCESSING',
      processed_at = NOW(),
      attempts = attempts + 1
  FROM cte WHERE q.id = cte.id
  RETURNING q.*;
END;
$function$;