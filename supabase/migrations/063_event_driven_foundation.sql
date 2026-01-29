-- ============================================================================
-- MIGRATION 063: Event-Driven Task System Foundation
-- ============================================================================
-- Purpose: 
--   1. Create user_activity_log for immutable activity tracking.
--   2. Create task_config for declarative reward rules.
--   3. Link rewards back to activities via ref_activity_id.
-- ============================================================================

-- 1. Create task_config table
CREATE TABLE IF NOT EXISTS public.task_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_key TEXT UNIQUE NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  threshold_rules JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create user_activity_log table
CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for user_activity_log
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON public.user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON public.user_activity_log(created_at DESC);
-- Unique constraint on user_id + idempotency_key to prevent double reports
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_activity_idempotency 
  ON public.user_activity_log(user_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- 3. Modify pet_task_completions
ALTER TABLE public.pet_task_completions 
ADD COLUMN IF NOT EXISTS ref_activity_id UUID REFERENCES public.user_activity_log(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pet_task_completions_ref_activity 
  ON public.pet_task_completions(ref_activity_id);

-- 4. Enable RLS
ALTER TABLE public.task_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

-- Policies for task_config (Read only for authenticated)
DROP POLICY IF EXISTS "Everyone can view active task configs" ON public.task_config;
CREATE POLICY "Everyone can view active task configs" 
ON public.task_config FOR SELECT 
TO authenticated 
USING (is_active = true);

-- Policies for user_activity_log (Insert and Select own)
DROP POLICY IF EXISTS "Users can insert their own activity logs" ON public.user_activity_log;
CREATE POLICY "Users can insert their own activity logs" 
ON public.user_activity_log FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own activity logs" ON public.user_activity_log;
CREATE POLICY "Users can view their own activity logs" 
ON public.user_activity_log FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- 5. Seed task_config from existing pet_tasks
INSERT INTO public.task_config (task_key, points, is_active)
SELECT task_key, points, true
FROM public.pet_tasks
ON CONFLICT (task_key) DO UPDATE 
SET points = EXCLUDED.points;

-- Grant permissions for authenticated users
GRANT SELECT ON public.task_config TO authenticated;
GRANT SELECT, INSERT ON public.user_activity_log TO authenticated;
