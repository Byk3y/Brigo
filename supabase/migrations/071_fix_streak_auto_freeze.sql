-- ============================================================================
-- MIGRATION 071: Auto-apply streak freeze on activity after missed day
-- ============================================================================
-- Bug: When a user misses a day and then performs any study activity,
-- increment_streak() sets their streak to 1 — ignoring the recoverable
-- streak saved by check_streak_reset(). This permanently destroys streaks.
--
-- Fix: When streak=0 and last_recoverable_streak exists in meta,
-- auto-apply a freeze (deduct 1 from streak_freezes, restore streak).
-- If no freezes remain, fall through to streak=1 as before.
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_streak(
  p_user_id UUID,
  p_timezone TEXT DEFAULT 'UTC'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_streak INTEGER;
  v_new_streak INTEGER;
  v_last_streak_date DATE;
  v_today DATE;
  v_tz TEXT;
  v_was_incremented BOOLEAN := false;
  v_was_reset BOOLEAN := false;
  v_auto_freeze_applied BOOLEAN := false;
  v_current_month TEXT;
  v_last_reset TEXT;
  v_freezes_left INTEGER;
  v_recoverable INTEGER;
  v_meta JSONB;
BEGIN
  -- Validate and set timezone
  v_tz := COALESCE(NULLIF(p_timezone, ''), 'UTC');

  -- Get user's timezone-aware "today"
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
    last_freeze_reset,
    meta
  INTO
    v_current_streak,
    v_last_streak_date,
    v_freezes_left,
    v_last_reset,
    v_meta
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  -- Profile check
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  -- Monthly freeze refill logic
  IF v_last_reset IS NULL OR v_last_reset != v_current_month THEN
    v_freezes_left := 3;
    v_last_reset := v_current_month;
  END IF;

  -- Calculate new streak
  IF v_last_streak_date = v_today THEN
    -- Already updated today
    v_new_streak := v_current_streak;
    v_was_incremented := false;
  ELSIF v_last_streak_date = v_today - INTERVAL '1 day' THEN
    -- Consecutive day
    v_new_streak := v_current_streak + 1;
    v_was_incremented := true;
  ELSIF v_current_streak = 0 AND (v_last_streak_date IS NULL OR v_last_streak_date < v_today) THEN
    -- Streak is 0: check if there's a recoverable streak to auto-restore
    v_recoverable := (v_meta->>'last_recoverable_streak')::INTEGER;

    IF v_recoverable IS NOT NULL AND v_recoverable > 0 AND v_freezes_left > 0 THEN
      -- Auto-apply freeze: restore streak and deduct a freeze
      v_new_streak := v_recoverable + 1;
      v_freezes_left := v_freezes_left - 1;
      v_auto_freeze_applied := true;
    ELSE
      -- No recoverable streak or no freezes left: fresh start
      v_new_streak := 1;
    END IF;
    v_was_incremented := true;
  ELSE
    -- MISSED DAY: Mark as reset but track what it WOULD have been for freeze
    v_new_streak := 1;
    v_was_incremented := false;
    v_was_reset := (v_current_streak > 0);
  END IF;

  -- Update profile
  UPDATE profiles
  SET
    streak = v_new_streak,
    last_streak_date = v_today,
    streak_freezes = v_freezes_left,
    last_freeze_reset = v_last_reset,
    updated_at = NOW(),
    meta = CASE
      WHEN v_was_reset THEN meta || jsonb_build_object('last_recoverable_streak', v_current_streak)
      WHEN v_auto_freeze_applied THEN meta - 'last_recoverable_streak'
      ELSE meta
    END
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'previous_streak', v_current_streak,
    'new_streak', v_new_streak,
    'was_incremented', v_was_incremented,
    'was_reset', v_was_reset,
    'auto_freeze_applied', v_auto_freeze_applied,
    'streak_freezes', v_freezes_left
  );
END;
$$;

GRANT EXECUTE ON FUNCTION increment_streak(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_streak(UUID, TEXT) TO service_role;
