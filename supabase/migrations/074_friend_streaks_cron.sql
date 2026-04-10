-- ============================================================================
-- MIGRATION 074: Friend Streaks — Cron Schedules
-- ============================================================================
-- pg_cron is already enabled on this project.
-- These were applied via execute_sql since CREATE EXTENSION fails on managed Supabase.
-- ============================================================================

-- Daily friend streak update at 01:00 UTC
SELECT cron.schedule(
  'update-friend-streaks-daily',
  '0 1 * * *',
  'SELECT public.update_friend_streaks()'
);

-- Expire pending invites older than 7 days at 02:00 UTC
SELECT cron.schedule(
  'expire-old-friend-invites',
  '0 2 * * *',
  $$UPDATE public.friend_invites SET status = 'expired' WHERE status = 'pending' AND expires_at < NOW()$$
);
