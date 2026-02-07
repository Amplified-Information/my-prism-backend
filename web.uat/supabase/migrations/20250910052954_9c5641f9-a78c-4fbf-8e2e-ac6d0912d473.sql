-- Move extensions from public schema to extensions schema (security best practice)
-- Note: These extensions are needed for automated job processing
ALTER EXTENSION pg_cron SET SCHEMA extensions;
ALTER EXTENSION pg_net SET SCHEMA extensions;