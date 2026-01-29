-- ============================================================================
-- MIGRATION 066: Smart Task Evolution - Phase 5.1 (Registry & Data Foundation)
-- ============================================================================

-- 1. Insert New Tasks into pet_tasks
-- Using ON CONFLICT to ensure idempotency
INSERT INTO public.pet_tasks (task_key, title, description, task_type, points, display_order)
VALUES 
  ('generate_flashcards', 'Generate AI Flashcards', 'Create your first set of AI-generated study cards.', 'foundational', 3, 25),
  ('generate_quiz', 'Generate an AI Quiz', 'Create your first AI-generated assessment.', 'foundational', 3, 35),
  ('study_night_owl', 'Night Owl Study', 'Complete a study activity after 8:00 PM.', 'daily', 2, 85)
ON CONFLICT (task_key) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  points = EXCLUDED.points;

-- 2. Sync to task_config
INSERT INTO public.task_config (task_key, points, is_active)
SELECT task_key, points, true
FROM public.pet_tasks
WHERE task_key IN ('generate_flashcards', 'generate_quiz', 'study_night_owl')
ON CONFLICT (task_key) DO UPDATE SET
  points = EXCLUDED.points,
  is_active = true;

-- 3. Update process_activity_rewards to include new tasks
CREATE OR REPLACE FUNCTION public.process_activity_rewards(p_activity_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_activity_type TEXT;
  v_study_result JSONB;
  v_security_result JSONB;
BEGIN
  SELECT activity_type INTO v_activity_type FROM public.user_activity_log WHERE id = p_activity_id;

  -- Trigger Study Processor for study-related events
  -- Added generate_flashcards, generate_quiz, and study_night_owl
  IF v_activity_type IN (
    'quiz_5_questions', 
    'study_flashcards', 
    'podcast_3_min', 
    'chat_with_notebook', 
    'quiz_perfect_score',
    'generate_flashcards',
    'generate_quiz',
    'study_night_owl'
  ) THEN
    v_study_result := public.processor_study_rewards(p_activity_id);
    
    -- If study rewards were granted, trigger pet security
    IF (v_study_result->>'success')::boolean AND (v_study_result->>'reason' IS NULL OR v_study_result->>'reason' != 'Already rewarded') THEN
      v_security_result := public.processor_pet_security(p_activity_id);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'study_rewards', v_study_result,
    'pet_security', v_security_result
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update log_activity to handle study_night_owl validation
-- We'll add a check that 'study_night_owl' can only be logged if it's actually evening.
CREATE OR REPLACE FUNCTION public.log_activity(
  p_activity_type TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_activity_id UUID;
  v_reward_summary JSONB;
  v_current_hour INTEGER;
  v_timezone TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Custom Validation: Night Owl check
  IF p_activity_type = 'study_night_owl' THEN
    v_timezone := COALESCE(p_metadata->>'timezone', 'UTC');
    v_current_hour := EXTRACT(HOUR FROM (NOW() AT TIME ZONE v_timezone));
    
    IF v_current_hour < 20 THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Too early for Night Owl! Wait until after 8 PM.',
        'error_code', 'TOO_EARLY'
      );
    END IF;
  END IF;

  -- 2. Idempotency Check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_activity_id FROM public.user_activity_log 
    WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key;
    
    IF v_activity_id IS NOT NULL THEN
       RETURN jsonb_build_object('success', true, 'activity_id', v_activity_id, 'note', 'Already processed');
    END IF;
  END IF;

  -- 3. Insert Log
  INSERT INTO public.user_activity_log (user_id, activity_type, metadata, idempotency_key)
  VALUES (v_user_id, p_activity_type, p_metadata, p_idempotency_key)
  RETURNING id INTO v_activity_id;

  -- 4. Process Rewards
  v_reward_summary := public.process_activity_rewards(v_activity_id);

  RETURN jsonb_build_object(
    'success', true,
    'activity_id', v_activity_id,
    'rewards', v_reward_summary
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
