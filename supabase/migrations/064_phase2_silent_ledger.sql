-- ============================================================================
-- MIGRATION 064: Silent Ledger (Phase 2)
-- ============================================================================
-- Purpose:
--   - Update award_task_points to log every attempt in user_activity_log.
--   - Link pet_task_completions to those logs via ref_activity_id.
--   - Maintain backward compatibility for existing app logic.
-- ============================================================================

CREATE OR REPLACE FUNCTION award_task_points(
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
  
  -- Phase 2: Activity Tracking
  v_activity_id UUID;
BEGIN
  -- 1. Determine time boundaries for validation
  IF p_timezone IS NULL OR p_timezone = '' THEN
    p_timezone := 'UTC';
  END IF;
  
  BEGIN
    v_start_of_day := (p_completion_date::TIMESTAMP AT TIME ZONE p_timezone);
    v_end_of_day := v_start_of_day + INTERVAL '1 day';
  EXCEPTION WHEN OTHERS THEN
    v_start_of_day := p_completion_date::TIMESTAMP;
    v_end_of_day := v_start_of_day + INTERVAL '1 day';
  END;

  -- 2. Phase 2: Record Activity Attempt (Silent Ledger)
  -- This provides an audit trail even if the reward logic fails or task exists.
  INSERT INTO public.user_activity_log (user_id, activity_type, metadata)
  VALUES (p_user_id, p_task_key, jsonb_build_object(
    'source', 'award_task_points_rpc',
    'completion_date', p_completion_date,
    'captured_at', NOW()
  ))
  RETURNING id INTO v_activity_id;

  -- 3. Get task details
  SELECT id, points, task_type INTO v_task_id, v_points, v_task_type
  FROM public.pet_tasks
  WHERE task_key = p_task_key;

  IF v_task_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Task not found',
      'error_code', 'TASK_NOT_FOUND',
      'activity_id', v_activity_id
    );
  END IF;

  v_is_daily_task := (v_task_type = 'daily');

  -- 4. Check for existing completion (Idempotency)
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

  -- 5. AUTO-SAVE RESILIENCE (Even if task exists)
  IF v_is_daily_task THEN
    SELECT id, points INTO v_secure_pet_id, v_secure_pet_points
    FROM public.pet_tasks WHERE task_key = 'secure_pet';
    
    SELECT EXISTS (
      SELECT 1 FROM public.pet_task_completions 
      WHERE user_id = p_user_id AND task_id = v_secure_pet_id AND completion_date = p_completion_date
    ) INTO v_secure_pet_exists;
    
    IF NOT v_secure_pet_exists THEN
      -- Link secure_pet back to the same parent activity
      INSERT INTO public.pet_task_completions (user_id, task_id, completion_date, points_awarded, completed_at, ref_activity_id)
      VALUES (p_user_id, v_secure_pet_id, p_completion_date, v_secure_pet_points, NOW(), v_activity_id);
      
      UPDATE public.pet_states SET current_points = current_points + v_secure_pet_points WHERE user_id = p_user_id;

      PERFORM public.increment_streak(p_user_id, p_timezone);
    END IF;
  END IF;

  -- 6. Return early if primary task already exists
  IF v_exists THEN
    SELECT current_points, current_stage INTO v_current_points, v_new_stage 
    FROM public.pet_states WHERE user_id = p_user_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'points_awarded', 0,
      'new_total_points', COALESCE(v_current_points, 0),
      'new_stage', COALESCE(v_new_stage, 1),
      'pet_secured', true,
      'activity_id', v_activity_id
    );
  END IF;

  -- ========================================================================
  -- 7. SERVER-SIDE VALIDATION: Check task-specific criteria
  -- ========================================================================
  CASE p_task_key
    WHEN 'secure_pet' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.pet_task_completions ptc
        JOIN public.pet_tasks pt ON ptc.task_id = pt.id
        WHERE ptc.user_id = p_user_id AND ptc.completion_date = p_completion_date AND pt.task_type = 'daily' AND pt.task_key != 'secure_pet'
      ) INTO v_criteria_met;
    WHEN 'quiz_5_questions' THEN
      IF NOT EXISTS(SELECT 1 FROM public.studio_quizzes sq JOIN public.notebooks n ON sq.notebook_id = n.id WHERE n.user_id = p_user_id) THEN v_criteria_met := false;
      ELSE SELECT COUNT(*) >= 5 INTO v_criteria_met FROM public.quiz_question_answers WHERE user_id = p_user_id AND completed_at = p_completion_date; END IF;
    WHEN 'study_flashcards' THEN
      IF NOT EXISTS(SELECT 1 FROM public.studio_flashcard_sets sfs JOIN public.notebooks n ON sfs.notebook_id = n.id WHERE n.user_id = p_user_id) THEN v_criteria_met := false;
      ELSE SELECT COUNT(*) >= 5 INTO v_criteria_met FROM public.flashcard_completions WHERE user_id = p_user_id AND created_at >= v_start_of_day AND created_at < v_end_of_day; END IF;
    WHEN 'podcast_3_min' THEN
      IF NOT EXISTS(SELECT 1 FROM public.audio_overviews WHERE user_id = p_user_id AND status = 'completed') THEN v_criteria_met := false;
      ELSE 
        SELECT COALESCE(SUM(playback_seconds), 0) >= 60 INTO v_criteria_met FROM public.audio_playback_sessions WHERE user_id = p_user_id AND started_at >= v_start_of_day AND started_at < v_end_of_day;
        IF NOT v_criteria_met THEN v_criteria_met := EXISTS(SELECT 1 FROM public.audio_overviews WHERE user_id = p_user_id AND status = 'completed'); END IF;
      END IF;
    WHEN 'chat_with_notebook' THEN SELECT EXISTS (SELECT 1 FROM public.notebooks WHERE user_id = p_user_id) INTO v_criteria_met;
    WHEN 'quiz_perfect_score' THEN SELECT EXISTS (SELECT 1 FROM public.quiz_completions WHERE user_id = p_user_id AND completed_at >= v_start_of_day AND completed_at < v_end_of_day AND score_percentage = 100) INTO v_criteria_met;
    WHEN 'add_material_daily' THEN SELECT EXISTS (SELECT 1 FROM public.materials WHERE user_id = p_user_id AND created_at >= v_start_of_day AND created_at < v_end_of_day) INTO v_criteria_met;
    WHEN 'audio_feedback_given' THEN SELECT EXISTS (SELECT 1 FROM public.audio_feedback WHERE user_id = p_user_id AND created_at >= v_start_of_day AND created_at < v_end_of_day) INTO v_criteria_met;
    WHEN 'study_early_bird' THEN 
      SELECT EXISTS (SELECT 1 FROM public.pet_task_completions ptc JOIN public.pet_tasks pt ON ptc.task_id = pt.id WHERE ptc.user_id = p_user_id AND ptc.completion_date = p_completion_date AND pt.task_key IN ('study_flashcards', 'quiz_5_questions', 'podcast_3_min', 'chat_with_notebook') AND EXTRACT(HOUR FROM ptc.completed_at AT TIME ZONE COALESCE(p_timezone, 'UTC')) < 9) INTO v_criteria_met;
    WHEN 'name_pet' THEN
      SELECT name IS NOT NULL AND name NOT IN ('Nova', 'Pet', 'Sparky', 'Bridget', '') AND length(trim(name)) > 0 INTO v_criteria_met FROM public.pet_states WHERE user_id = p_user_id;
    WHEN 'create_notebook' THEN SELECT EXISTS (SELECT 1 FROM public.notebooks n WHERE n.user_id = p_user_id AND EXISTS (SELECT 1 FROM public.materials m WHERE m.notebook_id = n.id)) INTO v_criteria_met;
    WHEN 'add_material' THEN SELECT EXISTS (SELECT 1 FROM public.materials m WHERE m.user_id = p_user_id LIMIT 1) INTO v_criteria_met;
    WHEN 'generate_audio_overview' THEN SELECT EXISTS (SELECT 1 FROM public.audio_overviews ao WHERE ao.user_id = p_user_id AND ao.status = 'completed') INTO v_criteria_met;
    WHEN 'first_notebook_chat' THEN SELECT EXISTS (SELECT 1 FROM public.notebooks WHERE user_id = p_user_id) INTO v_criteria_met;
    ELSE v_criteria_met := false;
  END CASE;

  -- 8. Return error if criteria not met
  IF NOT v_criteria_met THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task criteria not met', 'error_code', 'CRITERIA_NOT_MET', 'task_key', p_task_key, 'activity_id', v_activity_id);
  END IF;

  -- 9. Award primary task points
  INSERT INTO public.pet_states (user_id, current_points, current_stage) VALUES (p_user_id, 0, 1) ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.pet_states
  SET current_points = current_points + v_points, current_stage = floor((current_points + v_points) / 100) + 1, updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING current_points, current_stage INTO v_new_points, v_new_stage;

  -- 10. Record primary task completion (Linked to Activity)
  INSERT INTO public.pet_task_completions (user_id, task_id, completion_date, points_awarded, completed_at, ref_activity_id)
  VALUES (p_user_id, v_task_id, p_completion_date, v_points, NOW(), v_activity_id);

  -- 11. Return success
  RETURN jsonb_build_object('success', true, 'already_completed', false, 'points_awarded', v_points, 'new_total_points', v_new_points, 'new_stage', v_new_stage, 'pet_secured', true, 'activity_id', v_activity_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
