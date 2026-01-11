-- ============================================================================
-- MIGRATION 054: Restore Streak Auto-Secure
-- ============================================================================
-- Purpose:
--   Ensures that when a user uses a "Streak Freeze", the pet is also 
--   marked as "Secured" for the current day. 
--
-- Logic:
--   1. Protects/Recovers the streak.
--   2. Detects the current date in the user's timezone.
--   3. Automatically awards the 'secure_pet' task and points if not already done.
--   4. Clears the "Caution" badge on the widget immediately.
-- ============================================================================

CREATE OR REPLACE FUNCTION apply_streak_freeze(
  p_user_id UUID,
  p_timezone TEXT DEFAULT 'UTC'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recoverable_streak INTEGER;
  v_freezes_left INTEGER;
  v_meta JSONB;
  v_today DATE;
  v_secure_pet_id UUID;
  v_secure_pet_points INTEGER;
  v_is_already_secured BOOLEAN;
  v_current_total_points INTEGER;
  v_new_stage INTEGER;
  v_current_streak INTEGER;
  v_last_streak_date DATE;
BEGIN
  -- 1. Determine local today
  BEGIN
    v_today := (NOW() AT TIME ZONE COALESCE(NULLIF(p_timezone, ''), 'UTC'))::DATE;
  EXCEPTION WHEN OTHERS THEN
    v_today := CURRENT_DATE;
  END;

  -- 2. Get current state with lock
  SELECT 
    streak_freezes,
    meta
  INTO 
    v_freezes_left,
    v_meta
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  -- 3. Validation
  IF COALESCE(v_freezes_left, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No freezes remaining this month', 'error_code', 'NO_FREEZES_LEFT');
  END IF;

  v_recoverable_streak := (v_meta->>'last_recoverable_streak')::INTEGER;

  IF v_recoverable_streak IS NULL OR v_recoverable_streak < 1 THEN
    -- Check if user is at risk (streak > 0 but last_streak_date older than today)
    SELECT streak, last_streak_date INTO v_current_streak, v_last_streak_date
    FROM profiles WHERE id = p_user_id;

    IF v_current_streak > 0 AND (v_last_streak_date IS NULL OR v_last_streak_date < v_today) THEN
      v_recoverable_streak := v_current_streak;
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'No recoverable streak found', 'error_code', 'NO_RECOVERABLE_STREAK');
    END IF;
  END IF;

  -- 4. PERFORM STREAK FREEZE
  -- We restore/protect the streak to [Recoverable + 1] since a freeze/restore counts as today's activity
  UPDATE profiles
  SET 
    streak = v_recoverable_streak + 1,
    last_streak_date = v_today, -- Essential for app UI consistency
    streak_freezes = v_freezes_left - 1,
    meta = meta - 'last_recoverable_streak', -- Remove once used
    updated_at = NOW()
  WHERE id = p_user_id;

  -- 5. AUTO-SECURE PET (The Widget Fix)
  -- Get secure_pet task info
  SELECT id, points INTO v_secure_pet_id, v_secure_pet_points
  FROM public.pet_tasks WHERE task_key = 'secure_pet';
  
  -- Check if already secured today (just in case)
  SELECT EXISTS (
    SELECT 1 FROM public.pet_task_completions 
    WHERE user_id = p_user_id 
      AND task_id = v_secure_pet_id 
      AND completion_date = v_today
  ) INTO v_is_already_secured;
  
  -- If not secured, award the task to clear the widget caution badge
  IF v_secure_pet_id IS NOT NULL AND NOT v_is_already_secured THEN
    -- Record completion
    INSERT INTO public.pet_task_completions (user_id, task_id, completion_date, points_awarded, completed_at)
    VALUES (p_user_id, v_secure_pet_id, v_today, v_secure_pet_points, NOW());
    
    -- Award points & Update Stage
    UPDATE public.pet_states
    SET 
      current_points = current_points + v_secure_pet_points,
      current_stage = floor((current_points + v_secure_pet_points) / 100) + 1,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'restored_streak', v_recoverable_streak + 1,
    'previous_streak', v_recoverable_streak,
    'freezes_left', v_freezes_left - 1,
    'pet_secured', true
  );
END;
$$;
