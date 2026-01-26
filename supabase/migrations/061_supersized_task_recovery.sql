-- ============================================================================
-- MIGRATION 061: Supersized Task Recovery & Auto-Award
-- ============================================================================
-- Purpose:
--   - Restore Auto-Save (secure_pet) logic that was lost in regression
--   - Maintain 80% quiz threshold for 'quiz_perfect_score' (renamed to 'Ace a quiz')
--   - Automatically award 'study_early_bird' if requirements are met during ANY study task
--   - Ensure streak increment happens only once per day
-- ============================================================================

CREATE OR REPLACE FUNCTION public.award_task_points(
  p_user_id UUID,
  p_task_key TEXT,
  p_completion_date DATE,
  p_timezone TEXT DEFAULT 'UTC'
) RETURNS JSONB AS $$
DECLARE
  v_task_id UUID;
  v_points INTEGER;
  v_task_type TEXT;
  v_exists BOOLEAN;
  v_current_points INTEGER;
  v_new_points INTEGER;
  v_new_stage INTEGER;
  v_criteria_met BOOLEAN := false;
  v_start_of_day TIMESTAMPTZ;
  v_end_of_day TIMESTAMPTZ;
  
  -- Auto-save variables
  v_secure_pet_id UUID;
  v_secure_pet_points INTEGER;
  v_secure_pet_exists BOOLEAN := false;
  v_is_daily_task BOOLEAN := false;
  
  -- Early Bird variables
  v_early_bird_id UUID;
  v_early_bird_points INTEGER;
  v_early_bird_exists BOOLEAN := false;
  v_is_early_bird_window BOOLEAN := false;
  v_local_hour INTEGER;
  
  -- Streak variables
  v_user_streak INTEGER;
  v_user_last_streak_date DATE;
  v_is_new_user BOOLEAN := false;
BEGIN
  -- 1. Determine time boundaries for validation
  IF p_timezone IS NULL OR p_timezone = '' THEN
    p_timezone := 'UTC';
  END IF;
  
  BEGIN
    v_start_of_day := (p_completion_date::TIMESTAMP AT TIME ZONE p_timezone);
    v_end_of_day := v_start_of_day + INTERVAL '1 day';
    v_local_hour := EXTRACT(HOUR FROM (NOW() AT TIME ZONE p_timezone));
    v_is_early_bird_window := (v_local_hour >= 5 AND v_local_hour < 9);
  EXCEPTION WHEN OTHERS THEN
    v_start_of_day := p_completion_date::TIMESTAMP;
    v_end_of_day := v_start_of_day + INTERVAL '1 day';
    v_is_early_bird_window := false;
  END;

  -- 2. Get task details
  SELECT id, points, task_type INTO v_task_id, v_points, v_task_type
  FROM public.pet_tasks
  WHERE task_key = p_task_key;

  IF v_task_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task not found', 'error_code', 'TASK_NOT_FOUND');
  END IF;

  v_is_daily_task := (v_task_type = 'daily');

  -- 3. Check for existing completion (Idempotency)
  IF v_task_type = 'foundational' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.pet_task_completions 
      WHERE user_id = p_user_id AND task_id = v_task_id
    ) INTO v_exists;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.pet_task_completions 
      WHERE user_id = p_user_id AND task_id = v_task_id AND completion_date = p_completion_date
    ) INTO v_exists;
  END IF;

  -- ========================================================================
  -- 4. AUTO-AWARD SIDE EFFECTS (Even if primary task exists)
  -- ========================================================================
  IF v_is_daily_task AND p_task_key != 'secure_pet' AND p_task_key != 'study_early_bird' THEN
    
    -- A. SECURE PET (Auto-Save)
    SELECT id, points INTO v_secure_pet_id, v_secure_pet_points
    FROM public.pet_tasks WHERE task_key = 'secure_pet';
    
    SELECT EXISTS (
      SELECT 1 FROM public.pet_task_completions 
      WHERE user_id = p_user_id AND task_id = v_secure_pet_id AND completion_date = p_completion_date
    ) INTO v_secure_pet_exists;
    
    IF v_secure_pet_id IS NOT NULL AND NOT v_secure_pet_exists THEN
      INSERT INTO public.pet_task_completions (user_id, task_id, completion_date, points_awarded, completed_at)
      VALUES (p_user_id, v_secure_pet_id, p_completion_date, v_secure_pet_points, NOW());
      
      UPDATE public.pet_states SET current_points = current_points + v_secure_pet_points WHERE user_id = p_user_id;
      PERFORM public.increment_streak(p_user_id, p_timezone);
    END IF;

    -- B. EARLY BIRD (Auto-Award)
    IF v_is_early_bird_window THEN
      SELECT id, points INTO v_early_bird_id, v_early_bird_points
      FROM public.pet_tasks WHERE task_key = 'study_early_bird';
      
      SELECT EXISTS (
        SELECT 1 FROM public.pet_task_completions 
        WHERE user_id = p_user_id AND task_id = v_early_bird_id AND completion_date = p_completion_date
      ) INTO v_early_bird_exists;
      
      IF v_early_bird_id IS NOT NULL AND NOT v_early_bird_exists THEN
        INSERT INTO public.pet_task_completions (user_id, task_id, completion_date, points_awarded, completed_at)
        VALUES (p_user_id, v_early_bird_id, p_completion_date, v_early_bird_points, NOW());
        
        UPDATE public.pet_states SET current_points = current_points + v_early_bird_points WHERE user_id = p_user_id;
      END IF;
    END IF;
  END IF;

  -- 5. Return early if primary task already exists
  IF v_exists THEN
    SELECT current_points, current_stage INTO v_current_points, v_new_stage 
    FROM public.pet_states WHERE user_id = p_user_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'points_awarded', 0,
      'new_total_points', COALESCE(v_current_points, 0),
      'new_stage', COALESCE(v_new_stage, 1)
    );
  END IF;

  -- ========================================================================
  -- 6. SERVER-SIDE VALIDATION
  -- ========================================================================
  CASE p_task_key
    WHEN 'secure_pet' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.pet_task_completions ptc
        JOIN public.pet_tasks pt ON ptc.task_id = pt.id
        WHERE ptc.user_id = p_user_id AND ptc.completion_date = p_completion_date
          AND pt.task_type = 'daily' AND pt.task_key != 'secure_pet'
      ) INTO v_criteria_met;
      
    WHEN 'quiz_perfect_score' THEN -- Now Ace a quiz (80%+)
      SELECT EXISTS (
        SELECT 1 FROM public.quiz_completions 
        WHERE user_id = p_user_id AND completed_at >= v_start_of_day AND completed_at < v_end_of_day 
          AND score_percentage >= 80
      ) INTO v_criteria_met;
      
    WHEN 'quiz_5_questions' THEN
      SELECT COUNT(*) >= 5 INTO v_criteria_met FROM public.quiz_question_answers WHERE user_id = p_user_id AND completed_at = p_completion_date;
        
    WHEN 'study_flashcards' THEN
      SELECT COUNT(*) >= 5 INTO v_criteria_met FROM public.flashcard_completions WHERE user_id = p_user_id AND created_at >= v_start_of_day AND created_at < v_end_of_day;
        
    WHEN 'podcast_3_min' THEN
      SELECT COALESCE(SUM(playback_seconds), 0) >= 60 INTO v_criteria_met FROM public.audio_playback_sessions WHERE user_id = p_user_id AND started_at >= v_start_of_day AND started_at < v_end_of_day;
      
    WHEN 'chat_with_notebook' THEN
      SELECT EXISTS (SELECT 1 FROM public.notebooks WHERE user_id = p_user_id) INTO v_criteria_met;
      
    WHEN 'study_early_bird' THEN
      v_criteria_met := v_is_early_bird_window AND EXISTS (
        SELECT 1 FROM public.pet_task_completions ptc JOIN public.pet_tasks pt ON ptc.task_id = pt.id 
        WHERE ptc.user_id = p_user_id AND ptc.completion_date = p_completion_date 
          AND pt.task_type = 'daily' AND pt.task_key NOT IN ('secure_pet', 'study_early_bird')
      );
      
    WHEN 'name_pet' THEN
      SELECT name IS NOT NULL AND name NOT IN ('Nova', 'Pet', 'Sparky', 'Bridget', '') AND length(trim(name)) > 0 INTO v_criteria_met FROM public.pet_states WHERE user_id = p_user_id;
      
    WHEN 'create_notebook' THEN
      SELECT EXISTS (SELECT 1 FROM public.notebooks n WHERE n.user_id = p_user_id AND EXISTS (SELECT 1 FROM public.materials m WHERE m.notebook_id = n.id)) INTO v_criteria_met;
      
    ELSE
      v_criteria_met := true; -- Default allow for other tasks not explicitly validated here
  END CASE;

  IF NOT v_criteria_met THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task criteria not met', 'error_code', 'CRITERIA_NOT_MET', 'task_key', p_task_key);
  END IF;

  -- 7. Award primary task points
  INSERT INTO public.pet_states (user_id, current_points, current_stage) VALUES (p_user_id, 0, 1) ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.pet_states
  SET 
    current_points = current_points + v_points,
    current_stage = floor((current_points + v_points) / 100) + 1,
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING current_points, current_stage INTO v_new_points, v_new_stage;

  INSERT INTO public.pet_task_completions (user_id, task_id, completion_date, points_awarded, completed_at)
  VALUES (p_user_id, v_task_id, p_completion_date, v_points, NOW());

  -- FOUNDATIONAL WELCOME STREAK
  IF v_task_type = 'foundational' THEN
    SELECT COALESCE(streak, 0), last_streak_date INTO v_user_streak, v_user_last_streak_date FROM public.profiles WHERE id = p_user_id;
    v_is_new_user := (v_user_streak = 0 AND v_user_last_streak_date IS NULL);
    IF v_is_new_user THEN
      PERFORM public.increment_streak(p_user_id, p_timezone);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'points_awarded', v_points,
    'new_total_points', v_new_points,
    'new_stage', v_new_stage,
    'welcome_streak_awarded', COALESCE(v_is_new_user, false)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
