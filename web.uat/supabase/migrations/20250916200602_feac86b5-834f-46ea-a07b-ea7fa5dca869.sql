-- Create the optimized mirror poller to run every minute
SELECT cron.schedule(
  'trigger-mirror-poller-optimized',
  '* * * * *', -- Every minute
  $$
    SELECT public.trigger_scheduled_mirror_poller();
  $$
);