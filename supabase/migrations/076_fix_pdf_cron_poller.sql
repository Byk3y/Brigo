-- Migration 076: Harden the process-pending-pdf-jobs cron poller.
--
-- BEFORE this migration the job was:
--   - Scheduled every 5 minutes
--   - Had the Supabase anon key hardcoded inline inside cron.job.command
--   - Used the pg_net default 5000ms timeout (we saw real timeouts at exactly 5s)
--
-- AFTER:
--   - Runs every 15 minutes (it is now ONLY a safety-net re-dispatcher; the
--     real-time dispatch happens via trigger in a later Phase 3 migration)
--   - Reads project_url and supabase_anon_key from vault.decrypted_secrets
--   - 15000ms pg_net timeout so cold-start handshakes don't drop
--
-- ONE-TIME VAULT SEED (run once manually in SQL editor, NOT committed):
--   SELECT vault.create_secret('https://tunjjtfnvtscgmuxjkng.supabase.co', 'project_url');
--   SELECT vault.create_secret('<ANON_KEY_HERE>', 'supabase_anon_key');
-- After seeding, re-running this migration (or just calling the new function)
-- will start dispatching correctly.

BEGIN;

-- 1. Unschedule the old job if it exists. Idempotent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-pending-pdf-jobs') THEN
    PERFORM cron.unschedule('process-pending-pdf-jobs');
  END IF;
END
$$;

-- 2. Helper function: pulls auth/url from Vault and pings the worker.
--    Returns the pg_net request id for debugging.
CREATE OR REPLACE FUNCTION public.dispatch_pending_pdf_jobs()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url      text;
  v_anon_key text;
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets
   WHERE name = 'project_url';

  SELECT decrypted_secret INTO v_anon_key
    FROM vault.decrypted_secrets
   WHERE name = 'supabase_anon_key';

  IF v_url IS NULL OR v_anon_key IS NULL THEN
    RAISE NOTICE '[dispatch_pending_pdf_jobs] Vault secrets missing (project_url / supabase_anon_key). Skipping.';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url     := v_url || '/functions/v1/process-large-pdf',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body    := jsonb_build_object('max_jobs', 3),
    timeout_milliseconds := 15000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

COMMENT ON FUNCTION public.dispatch_pending_pdf_jobs() IS
  'Safety-net re-dispatcher for stalled PDF processing jobs. Called by pg_cron every 15 min. Reads auth from vault.decrypted_secrets.';

-- 3. Reschedule on a 15-minute cadence.
SELECT cron.schedule(
  'process-pending-pdf-jobs',
  '*/15 * * * *',
  $cron$SELECT public.dispatch_pending_pdf_jobs();$cron$
);

COMMIT;
