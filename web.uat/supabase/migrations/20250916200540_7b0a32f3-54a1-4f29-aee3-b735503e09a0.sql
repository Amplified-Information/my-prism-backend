-- Update the scheduled mirror poller to run every minute instead of every 3 minutes
SELECT cron.unschedule('trigger-mirror-poller-every-3-minutes');

SELECT cron.schedule(
  'trigger-mirror-poller-every-minute',
  '* * * * *', -- Every minute
  $$
    SELECT public.trigger_scheduled_mirror_poller();
  $$
);