-- Update the existing push-reminders cron job to run every 3 hours instead of once daily
-- This ensures better coverage across all timezones.

SELECT cron.unschedule('push-reminders-daily');

SELECT cron.schedule(
    'push-reminders-daily',
    '0 */3 * * *',
    'SELECT invoke_push_reminders()'
);
