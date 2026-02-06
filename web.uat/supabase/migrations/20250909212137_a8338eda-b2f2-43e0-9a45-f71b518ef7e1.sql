-- Reset any stuck processing jobs to pending status (jobs stuck for more than 2 minutes)
UPDATE topic_creation_jobs 
SET status = 'pending', 
    claimed_at = NULL,
    updated_at = now()
WHERE status = 'processing' 
  AND claimed_at < now() - interval '2 minutes';