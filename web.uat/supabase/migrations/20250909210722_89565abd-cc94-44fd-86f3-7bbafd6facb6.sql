-- Test manual execution of the process-topic-jobs function
SELECT net.http_post(
  url := 'https://bfenuvdwsgzglhhjbrql.supabase.co/functions/v1/process-topic-jobs',
  headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmZW51dmR3c2d6Z2xoaGpicnFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAyODY4MTUsImV4cCI6MjA1NTg2MjgxNX0.85RJwwLQxQBySfTin2mu_KV71BVl0W0PbmdZD8R1ftQ"}'::jsonb,
  body := '{}'::jsonb
) as request_id;