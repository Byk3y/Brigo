-- ============================================================================
-- MIGRATION 065: Logic Migration (Phase 3) - Modular Processors
-- ============================================================================
-- Purpose:
--   - Move validation and reward logic into discrete, reusable processors.
--   - Create the central 'log_activity' RPC as the new system entry point.
--   - Ensure 'log_activity' is backward compatible with the app's needs.
-- ============================================================================

-- 1. Helper function to check thresholds in task_config
CREATE OR REPLACE FUNCTION public.check_task_thresholds(
  p_metadata JSONB,
  p_thresholds JSONB
) RETURNS BOOLEAN AS $$
BEGIN
  -- If no thresholds, it's a pass
  IF p_thresholds IS NULL OR p_thresholds = '{}'::jsonb THEN
    RETURN true;
  END IF;

  -- Example: {"min_score": 0.8}
  IF p_thresholds ? 'min_score' AND (p_metadata->>'score')::numeric < (p_thresholds->>'min_score')::numeric THEN
    RETURN false;
  END IF;

  -- Example: {"min_questions": 5}
  IF p_thresholds ? 'min_questions' AND (p_metadata->>'questions')::numeric < (p_thresholds->>'min_questions')::numeric THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Processor: Study Rewards
-- Handles matching activities like 'quiz_completed', 'flashcard_set_studied', etc.
CREATE OR REPLACE FUNCTION public.processor_study_rewards(p_activity_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_activity_type TEXT;
  v_metadata JSONB;
  v_task_key TEXT;
  v_task_id UUID;
  v_points INTEGER;
  v_thresholds JSONB;
  v_points_awarded INTEGER := 0;
  v_completion_date DATE;
BEGIN
  -- Get activity details
  SELECT user_id, activity_type, metadata, (created_at::DATE) 
  INTO v_user_id, v_activity_type, v_metadata, v_completion_date
  FROM public.user_activity_log WHERE id = p_activity_id;

  -- Map activity type to task key (Standardizing naming)
  -- If activity_type is already a valid task_key, use it.
  SELECT id, points, threshold_rules INTO v_task_id, v_points, v_thresholds
  FROM public.task_config 
  WHERE task_key = v_activity_type AND is_active = true;

  IF v_task_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'No active task_config found for activity');
  END IF;

  -- Check Thresholds (Score, Questions, etc.)
  IF NOT public.check_task_thresholds(v_metadata, v_thresholds) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Thresholds not met');
  END IF;

  -- Idempotency Check: Already rewarded for this activity?
  IF EXISTS (SELECT 1 FROM public.pet_task_completions WHERE ref_activity_id = p_activity_id) THEN
    RETURN jsonb_build_object('success', true, 'reason', 'Already rewarded');
  END IF;

  -- Daily Limit Check (Optional: Could add to task_config later)
  -- For now, allow multiple completions if the app reports multiple distinct activities.

  -- Award Points
  INSERT INTO public.pet_task_completions (user_id, task_id, completion_date, points_awarded, ref_activity_id)
  VALUES (v_user_id, v_task_id, v_completion_date, v_points, p_activity_id);

  UPDATE public.pet_states 
  SET current_points = current_points + v_points, updated_at = NOW()
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object('success', true, 'points_awarded', v_points);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Processor: Pet Security & Streaks
-- This is a "Follower" processor - it runs whenever a Study reward is granted.
CREATE OR REPLACE FUNCTION public.processor_pet_security(p_activity_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_completion_date DATE;
  v_secure_task_id UUID;
  v_secure_points INTEGER;
  v_timezone TEXT;
BEGIN
  SELECT user_id, (created_at::DATE), COALESCE(metadata->>'timezone', 'UTC')
  INTO v_user_id, v_completion_date, v_timezone
  FROM public.user_activity_log WHERE id = p_activity_id;

  -- 1. Check if 'secure_pet' is already done today
  SELECT id, points INTO v_secure_task_id, v_secure_points
  FROM public.task_config WHERE task_key = 'secure_pet';

  IF EXISTS (SELECT 1 FROM public.pet_task_completions 
             WHERE user_id = v_user_id AND task_id = v_secure_task_id AND completion_date = v_completion_date) THEN
    RETURN jsonb_build_object('success', true, 'reason', 'Pet already secured today');
  END IF;

  -- 2. Secure the pet
  INSERT INTO public.pet_task_completions (user_id, task_id, completion_date, points_awarded, ref_activity_id)
  VALUES (v_user_id, v_secure_task_id, v_completion_date, v_secure_points, p_activity_id);

  UPDATE public.pet_states 
  SET current_points = current_points + v_secure_points, updated_at = NOW()
  WHERE user_id = v_user_id;

  -- 3. Increment Streak
  PERFORM public.increment_streak(v_user_id, v_timezone);

  RETURN jsonb_build_object('success', true, 'pet_secured', true, 'points_awarded', v_secure_points);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. The Coordinator (Hub)
CREATE OR REPLACE FUNCTION public.process_activity_rewards(p_activity_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_activity_type TEXT;
  v_study_result JSONB;
  v_security_result JSONB;
BEGIN
  SELECT activity_type INTO v_activity_type FROM public.user_activity_log WHERE id = p_activity_id;

  -- Trigger Study Processor for study-related events
  IF v_activity_type IN ('quiz_5_questions', 'study_flashcards', 'podcast_3_min', 'chat_with_notebook', 'quiz_perfect_score') THEN
    v_study_result := public.processor_study_rewards(p_activity_id);
    
    -- If study rewards were granted, trigger pet security
    IF (v_study_result->>'success')::boolean THEN
      v_security_result := public.processor_pet_security(p_activity_id);
    END IF;
  END IF;

  -- Add other processors here (Badges, Analytics, etc.)

  RETURN jsonb_build_object(
    'study_rewards', v_study_result,
    'pet_security', v_security_result
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. The New Entry Point (RPC)
CREATE OR REPLACE FUNCTION public.log_activity(
  p_activity_type TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_activity_id UUID;
  v_reward_summary JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Idempotency Check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_activity_id FROM public.user_activity_log 
    WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key;
    
    IF v_activity_id IS NOT NULL THEN
       RETURN jsonb_build_object('success', true, 'activity_id', v_activity_id, 'note', 'Already processed');
    END IF;
  END IF;

  -- 2. Insert Log
  INSERT INTO public.user_activity_log (user_id, activity_type, metadata, idempotency_key)
  VALUES (v_user_id, p_activity_type, p_metadata, p_idempotency_key)
  RETURNING id INTO v_activity_id;

  -- 3. Process Rewards
  v_reward_summary := public.process_activity_rewards(v_activity_id);

  RETURN jsonb_build_object(
    'success', true,
    'activity_id', v_activity_id,
    'rewards', v_reward_summary
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.log_activity TO authenticated;
