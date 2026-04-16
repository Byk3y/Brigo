-- Fix: process_activity_rewards had a hardcoded whitelist of 8 task types,
-- silently dropping name_pet, create_notebook, first_notebook_chat,
-- add_material_daily, audio_feedback_given, and study_early_bird.
--
-- This migration:
-- 1. Removes the whitelist from process_activity_rewards — any activity_type
--    with a matching task_config row gets processed by processor_study_rewards.
-- 2. Restricts processor_pet_security (streak increment) to daily tasks only
--    so foundational milestones don't count as "studying."
-- 3. Fixes processor_study_rewards to use lifetime-scoped idempotency for
--    foundational tasks (any completion ever) vs date-scoped for daily tasks.
-- 4. Backfills missing completions for users who have qualifying data but
--    were silently dropped by the old whitelist.

-- ============================================================================
-- 1. process_activity_rewards — remove whitelist, gate pet_security on daily
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_activity_rewards(p_activity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_activity_type TEXT;
  v_task_type TEXT;
  v_study_result JSONB;
  v_security_result JSONB;
BEGIN
  SELECT activity_type INTO v_activity_type
  FROM public.user_activity_log WHERE id = p_activity_id;

  -- Look up task_type so we know daily vs foundational
  SELECT pt.task_type INTO v_task_type
  FROM public.task_config tc
  JOIN public.pet_tasks pt ON tc.task_key = pt.task_key
  WHERE tc.task_key = v_activity_type AND tc.is_active = true;

  -- Unknown activity type or inactive task — nothing to process
  IF v_task_type IS NULL THEN
    RETURN jsonb_build_object('study_rewards', null, 'pet_security', null);
  END IF;

  v_study_result := public.processor_study_rewards(p_activity_id);

  -- Pet security (streak + secure_pet bonus) only fires for daily tasks
  -- that actually awarded new points. Foundational milestones and the
  -- secure_pet task itself don't trigger streak increments.
  IF v_task_type = 'daily'
     AND v_activity_type != 'secure_pet'
     AND v_study_result IS NOT NULL
     AND (v_study_result->>'success')::boolean
     AND (v_study_result->>'reason' IS NULL OR v_study_result->>'reason' NOT IN ('Already rewarded', 'Already rewarded today'))
  THEN
    v_security_result := public.processor_pet_security(p_activity_id);
  END IF;

  RETURN jsonb_build_object(
    'study_rewards', v_study_result,
    'pet_security', v_security_result
  );
END;
$function$;

-- ============================================================================
-- 2. processor_study_rewards — foundational tasks use lifetime idempotency
-- ============================================================================
CREATE OR REPLACE FUNCTION public.processor_study_rewards(p_activity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_user_id UUID;
  v_activity_type TEXT;
  v_metadata JSONB;
  v_task_id UUID;
  v_task_type TEXT;
  v_points INTEGER;
  v_thresholds JSONB;
  v_completion_date DATE;
BEGIN
  SELECT user_id, activity_type, metadata, (created_at::DATE)
  INTO v_user_id, v_activity_type, v_metadata, v_completion_date
  FROM public.user_activity_log WHERE id = p_activity_id;

  SELECT pt.id, pt.task_type, tc.points, tc.threshold_rules
  INTO v_task_id, v_task_type, v_points, v_thresholds
  FROM public.task_config tc
  JOIN public.pet_tasks pt ON tc.task_key = pt.task_key
  WHERE tc.task_key = v_activity_type AND tc.is_active = true;

  IF v_task_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'No active task found for activity');
  END IF;

  IF NOT public.check_task_thresholds(v_metadata, v_thresholds) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Thresholds not met');
  END IF;

  -- Idempotency: foundational = lifetime (any completion ever), daily = today only
  IF v_task_type = 'foundational' THEN
    IF EXISTS (
      SELECT 1 FROM public.pet_task_completions
      WHERE user_id = v_user_id AND task_id = v_task_id
    ) THEN
      RETURN jsonb_build_object('success', true, 'reason', 'Already rewarded');
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.pet_task_completions
      WHERE user_id = v_user_id AND task_id = v_task_id AND completion_date = v_completion_date
    ) THEN
      RETURN jsonb_build_object('success', true, 'reason', 'Already rewarded today');
    END IF;
  END IF;

  INSERT INTO public.pet_task_completions (user_id, task_id, completion_date, points_awarded, ref_activity_id)
  VALUES (v_user_id, v_task_id, v_completion_date, v_points, p_activity_id);

  UPDATE public.pet_states SET current_points = current_points + v_points, updated_at = NOW() WHERE user_id = v_user_id;
  RETURN jsonb_build_object('success', true, 'points_awarded', v_points);
END;
$function$;

-- ============================================================================
-- 3. Backfill missing name_pet completions for users with custom names
-- ============================================================================
INSERT INTO public.pet_task_completions (user_id, task_id, completion_date, points_awarded, completed_at)
SELECT
  ps.user_id,
  pt.id,
  CURRENT_DATE,
  pt.points,
  NOW()
FROM public.pet_states ps
CROSS JOIN public.pet_tasks pt
WHERE pt.task_key = 'name_pet'
  AND ps.name IS NOT NULL
  AND ps.name NOT IN ('Nova', 'Pet', 'Sparky', 'Bridget', 'Brio', '')
  AND length(trim(ps.name)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.pet_task_completions ptc
    WHERE ptc.user_id = ps.user_id AND ptc.task_id = pt.id
  );

-- Award the missed point to their pet_states
UPDATE public.pet_states ps
SET current_points = current_points + (SELECT points FROM public.pet_tasks WHERE task_key = 'name_pet'),
    updated_at = NOW()
WHERE ps.user_id IN (
  SELECT ptc.user_id
  FROM public.pet_task_completions ptc
  JOIN public.pet_tasks pt ON ptc.task_id = pt.id
  WHERE pt.task_key = 'name_pet' AND ptc.completion_date = CURRENT_DATE
);
