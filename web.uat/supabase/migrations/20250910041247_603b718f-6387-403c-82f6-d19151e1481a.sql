-- Add retry_count and worker_id columns to topic_creation_jobs table
ALTER TABLE public.topic_creation_jobs
ADD COLUMN retry_count INT NOT NULL DEFAULT 0,
ADD COLUMN worker_id TEXT;

-- Update claim_topic_jobs function to accept and set worker_id
CREATE OR REPLACE FUNCTION public.claim_topic_jobs(limit_count int, p_worker_id text DEFAULT NULL)
RETURNS SETOF topic_creation_jobs AS $$
BEGIN
  RETURN QUERY
  WITH cte AS (
    SELECT id FROM public.topic_creation_jobs
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT limit_count
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.topic_creation_jobs j
  SET status = 'processing',
      claimed_at = NOW(),
      updated_at = NOW(),
      worker_id = COALESCE(p_worker_id, worker_id)
  FROM cte WHERE j.id = cte.id
  RETURNING j.*;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;