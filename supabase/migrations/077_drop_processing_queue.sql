-- Migration 077: Drop the processing_queue subsystem (Phase 3)
--
-- Context: Phase 2 replaced the chunked/queued PDF processing pipeline with a
-- single-call Gemini 2.5 Flash flow wrapped in EdgeRuntime.waitUntil(). The
-- queue table, its cron poller, and all job-management RPCs are now dead
-- weight — `processing_queue` has 1 historical row (not pending) and has
-- received 0 inserts since Phase 2 shipped.
--
-- This migration removes:
--   1. The pg_cron schedule `process-pending-pdf-jobs` (installed in 076)
--   2. All 7 job-management RPCs: enqueue_processing_job,
--      get_next_pending_job, update_job_progress, complete_job, fail_job,
--      cleanup_old_jobs, dispatch_pending_pdf_jobs
--   3. The public.processing_queue table itself
--
-- The edge function `process-large-pdf` is undeployed separately (it's a
-- Supabase platform object, not a DB object — dropped via CLI after this
-- migration applies).
--
-- The Vault secrets `project_url` and `supabase_anon_key` seeded for 076 are
-- left in place. They're not part of this plan and other future work may
-- legitimately reuse them.

-- 1. Unschedule the cron poller. Wrapped in DO block so the migration is
--    idempotent: re-running after the job's already gone is a no-op instead
--    of an error.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-pending-pdf-jobs') THEN
    PERFORM cron.unschedule('process-pending-pdf-jobs');
  END IF;
END $$;

-- 2. Drop all job-management RPCs. CASCADE handles any downstream
--    dependencies (grants, triggers) we might have missed.
DROP FUNCTION IF EXISTS public.dispatch_pending_pdf_jobs() CASCADE;
DROP FUNCTION IF EXISTS public.enqueue_processing_job(uuid, uuid, uuid, text, integer, bigint, integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_next_pending_job() CASCADE;
DROP FUNCTION IF EXISTS public.update_job_progress(uuid, integer, text, integer) CASCADE;
DROP FUNCTION IF EXISTS public.complete_job(uuid, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.fail_job(uuid, text, jsonb, boolean) CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_old_jobs() CASCADE;

-- 3. Drop the table itself.
DROP TABLE IF EXISTS public.processing_queue CASCADE;
