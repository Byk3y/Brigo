-- ============================================================================
-- MIGRATION 084: Friend Streaks — Live Increment On Study
-- ============================================================================
-- Fixes a bug where friend streaks almost never incremented because the only
-- trigger was the daily cron at 01:00 UTC, at which point neither user had
-- typically studied on the new UTC day yet (profiles.last_streak_date still
-- lagged CURRENT_DATE by 1).
--
-- This migration:
--   1. Adds update_friend_streaks_for_user(UUID) — a per-user, inline variant
--      that re-evaluates only the <=5 active pairs involving the calling user.
--   2. Refactors update_friend_streaks() and the new function to resolve each
--      user's "today" from profiles.timezone, so cross-timezone pairs compare
--      apples to apples.
--   3. Hooks update_friend_streaks_for_user into processor_pet_security so a
--      user's friend-streaks advance the moment they complete today's study.
--   4. Runs update_friend_streaks() once at the end to backfill any pair
--      where both users already have last_streak_date = today.
-- ============================================================================

-- ============================================================================
-- 1. update_friend_streaks_for_user — fires from the activity chain
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_friend_streaks_for_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pair RECORD;
  v_a_today DATE;
  v_b_today DATE;
  v_pair_today DATE;
  v_updated INTEGER := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_id is null');
  END IF;

  FOR v_pair IN
    SELECT fs.id, fs.streak, fs.last_streak_date, fs.meta,
           fs.user_a, fs.user_b,
           pa.last_streak_date AS a_study_date,
           pb.last_streak_date AS b_study_date,
           COALESCE(NULLIF(pa.timezone, ''), 'UTC') AS a_tz,
           COALESCE(NULLIF(pb.timezone, ''), 'UTC') AS b_tz
    FROM public.friend_streaks fs
    JOIN public.profiles pa ON pa.id = fs.user_a
    JOIN public.profiles pb ON pb.id = fs.user_b
    WHERE (fs.user_a = p_user_id OR fs.user_b = p_user_id)
      AND fs.status = 'active'
    FOR UPDATE OF fs
  LOOP
    BEGIN
      v_a_today := (NOW() AT TIME ZONE v_pair.a_tz)::DATE;
    EXCEPTION WHEN OTHERS THEN
      v_a_today := CURRENT_DATE;
    END;
    BEGIN
      v_b_today := (NOW() AT TIME ZONE v_pair.b_tz)::DATE;
    EXCEPTION WHEN OTHERS THEN
      v_b_today := CURRENT_DATE;
    END;

    -- Use the later of the two locals so a pair's "today" is stable regardless
    -- of which side triggered the hook.
    v_pair_today := GREATEST(v_a_today, v_b_today);

    IF v_pair.a_study_date = v_a_today AND v_pair.b_study_date = v_b_today THEN
      IF v_pair.last_streak_date IS NULL OR v_pair.last_streak_date < v_pair_today THEN
        UPDATE public.friend_streaks
        SET streak = CASE
              WHEN last_streak_date = v_pair_today - 1 THEN streak + 1
              WHEN last_streak_date IS NULL THEN 1
              ELSE 1
            END,
            last_streak_date = v_pair_today,
            user_a_last_study = v_pair.a_study_date,
            user_b_last_study = v_pair.b_study_date,
            meta = COALESCE(meta, '{}'::jsonb) - 'last_lost_streak' - 'died_at',
            updated_at = NOW()
        WHERE id = v_pair.id;
        v_updated := v_updated + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated', v_updated
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_friend_streaks_for_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_friend_streaks_for_user(UUID) TO service_role;

-- ============================================================================
-- 2. update_friend_streaks — per-user timezone + unchanged death logic
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_friend_streaks()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pair RECORD;
  v_a_today DATE;
  v_b_today DATE;
  v_pair_today DATE;
  v_pair_yesterday DATE;
  v_updated INTEGER := 0;
  v_reset INTEGER := 0;
  v_deaths_notified INTEGER := 0;
BEGIN
  FOR v_pair IN
    SELECT fs.id, fs.streak, fs.last_streak_date, fs.user_a, fs.user_b, fs.meta,
           pa.last_streak_date AS a_study_date,
           pb.last_streak_date AS b_study_date,
           COALESCE(NULLIF(pa.timezone, ''), 'UTC') AS a_tz,
           COALESCE(NULLIF(pb.timezone, ''), 'UTC') AS b_tz
    FROM public.friend_streaks fs
    JOIN public.profiles pa ON pa.id = fs.user_a
    JOIN public.profiles pb ON pb.id = fs.user_b
    WHERE fs.status = 'active'
    FOR UPDATE OF fs
  LOOP
    BEGIN
      v_a_today := (NOW() AT TIME ZONE v_pair.a_tz)::DATE;
    EXCEPTION WHEN OTHERS THEN
      v_a_today := CURRENT_DATE;
    END;
    BEGIN
      v_b_today := (NOW() AT TIME ZONE v_pair.b_tz)::DATE;
    EXCEPTION WHEN OTHERS THEN
      v_b_today := CURRENT_DATE;
    END;

    v_pair_today := GREATEST(v_a_today, v_b_today);
    v_pair_yesterday := v_pair_today - 1;

    IF v_pair.a_study_date = v_a_today AND v_pair.b_study_date = v_b_today THEN
      IF v_pair.last_streak_date IS NULL OR v_pair.last_streak_date < v_pair_today THEN
        UPDATE public.friend_streaks
        SET streak = CASE
              WHEN last_streak_date = v_pair_yesterday THEN streak + 1
              WHEN last_streak_date IS NULL THEN 1
              ELSE 1
            END,
            last_streak_date = v_pair_today,
            user_a_last_study = v_pair.a_study_date,
            user_b_last_study = v_pair.b_study_date,
            meta = COALESCE(meta, '{}'::jsonb) - 'last_lost_streak' - 'died_at',
            updated_at = NOW()
        WHERE id = v_pair.id;
        v_updated := v_updated + 1;
      END IF;
    ELSIF v_pair.last_streak_date IS NOT NULL
          AND v_pair.last_streak_date < v_pair_yesterday
          AND v_pair.streak > 0 THEN
      -- STREAK DIED
      UPDATE public.friend_streaks
      SET streak = 0,
          meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
            'last_lost_streak', v_pair.streak,
            'died_at', NOW()
          ),
          updated_at = NOW()
      WHERE id = v_pair.id;
      v_reset := v_reset + 1;

      IF v_pair.streak >= 7 THEN
        INSERT INTO public.user_activity_log (user_id, activity_type, metadata)
        VALUES
          (v_pair.user_a, 'friend_streak_died', jsonb_build_object(
            'friend_streak_id', v_pair.id,
            'friend_id', v_pair.user_b,
            'lost_streak', v_pair.streak,
            'notified', false
          )),
          (v_pair.user_b, 'friend_streak_died', jsonb_build_object(
            'friend_streak_id', v_pair.id,
            'friend_id', v_pair.user_a,
            'lost_streak', v_pair.streak,
            'notified', false
          ));
        v_deaths_notified := v_deaths_notified + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated', v_updated,
    'reset', v_reset,
    'deaths_notified', v_deaths_notified
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_friend_streaks() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_friend_streaks() TO service_role;

-- ============================================================================
-- 3. processor_pet_security — fire the friend-streak hook after increment
-- ============================================================================
CREATE OR REPLACE FUNCTION public.processor_pet_security(p_activity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_user_id UUID;
  v_completion_date DATE;
  v_secure_task_id UUID;
  v_secure_points INTEGER;
  v_timezone TEXT;
  v_streak_result JSONB;
BEGIN
  SELECT user_id, (created_at::DATE), COALESCE(metadata->>'timezone', 'UTC')
  INTO v_user_id, v_completion_date, v_timezone
  FROM public.user_activity_log WHERE id = p_activity_id;

  SELECT pt.id, tc.points INTO v_secure_task_id, v_secure_points
  FROM public.task_config tc
  JOIN public.pet_tasks pt ON tc.task_key = pt.task_key
  WHERE tc.task_key = 'secure_pet';

  IF EXISTS (SELECT 1 FROM public.pet_task_completions
             WHERE user_id = v_user_id AND task_id = v_secure_task_id AND completion_date = v_completion_date) THEN
    RETURN jsonb_build_object(
      'success', true,
      'reason', 'Already secured',
      'was_incremented', false
    );
  END IF;

  INSERT INTO public.pet_task_completions (user_id, task_id, completion_date, points_awarded, ref_activity_id)
  VALUES (v_user_id, v_secure_task_id, v_completion_date, v_secure_points, p_activity_id);

  UPDATE public.pet_states SET current_points = current_points + v_secure_points, updated_at = NOW() WHERE user_id = v_user_id;

  v_streak_result := public.increment_streak(v_user_id, v_timezone);

  -- Live friend-streak update: advance any active pair where the other side
  -- has already studied today. Errors are swallowed so personal streak logic
  -- can never be broken by a failure in the social layer.
  BEGIN
    PERFORM public.update_friend_streaks_for_user(v_user_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'update_friend_streaks_for_user failed for %: %', v_user_id, SQLERRM;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'pet_secured', true,
    'points_awarded', v_secure_points,
    'was_incremented', COALESCE((v_streak_result->>'was_incremented')::boolean, false),
    'new_streak', (v_streak_result->>'new_streak')::integer,
    'previous_streak', (v_streak_result->>'previous_streak')::integer,
    'auto_freeze_applied', COALESCE((v_streak_result->>'auto_freeze_applied')::boolean, false),
    'streak_freezes', (v_streak_result->>'streak_freezes')::integer
  );
END;
$function$;

-- ============================================================================
-- 4. One-time backfill for pairs already in a valid "both studied today" state
-- ============================================================================
SELECT public.update_friend_streaks();
