-- Clear stuck pending jobs that are likely dead
UPDATE topic_creation_jobs 
SET 
  status = 'failed',
  error = 'Cleared: Job was stuck in pending status',
  updated_at = NOW(),
  completed_at = NOW()
WHERE status IN ('pending', 'processing') 
  AND created_at < NOW() - INTERVAL '5 minutes';