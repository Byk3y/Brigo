-- Migration 066: Sync Monthly Streak Refill
-- Purpose: Sync monthly freeze refill logic between check_streak_reset and increment_streak.
-- Returns current streak freezes in check_streak_reset.

CREATE OR REPLACE FUNCTION public.check_streak_reset(p_user_id UUID, p_timezone TEXT DEFAULT 'UTC')
RETURNS JSONB AS $$
DECLARE
  v_current_streak INTEGER;
  v_last_streak_date DATE;
  v_today DATE;
  v_tz TEXT;
  v_was_reset BOOLEAN := false;
  v_current_month TEXT;
  v_last_reset TEXT;
  v_freezes_left INTEGER;
BEGIN
  v_tz := COALESCE(NULLIF(p_timezone, ''), 'UTC');
  BEGIN
    v_today := (NOW() AT TIME ZONE v_tz)::DATE;
  EXCEPTION WHEN OTHERS THEN
    v_today := CURRENT_DATE;
  END;

  v_current_month := TO_CHAR(v_today, 'YYYYMM');

  -- Get current profile data with lock
  SELECT 
    COALESCE(streak, 0),
    last_streak_date,
    COALESCE(streak_freezes, 3),
    last_freeze_reset
  INTO 
    v_current_streak,
    v_last_streak_date,
    v_freezes_left,
    v_last_reset
  FROM profiles 
  WHERE id = p_user_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  -- Monthly freeze refill logic (Sync with increment_streak)
  IF v_last_reset IS NULL OR v_last_reset != v_current_month THEN
    v_freezes_left := 3;
    v_last_reset := v_current_month;
    
    UPDATE profiles
    SET 
      streak_freezes = v_freezes_left,
      last_freeze_reset = v_last_reset,
      updated_at = NOW()
    WHERE id = p_user_id;
  END IF;

  -- Reset detection: if last_streak_date < yesterday
  IF v_last_streak_date IS NOT NULL AND v_last_streak_date < v_today - INTERVAL '1 day' AND v_current_streak > 0 THEN
    v_was_reset := true;
    
    UPDATE profiles
    SET 
      streak = 0,
      meta = meta || jsonb_build_object('last_recoverable_streak', v_current_streak),
      updated_at = NOW()
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'was_reset', true,
      'previous_streak', v_current_streak,
      'new_streak', 0,
      'streak_freezes', v_freezes_left
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'was_reset', false,
    'current_streak', v_current_streak,
    'last_streak_date', v_last_streak_date,
    'streak_freezes', v_freezes_left
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
