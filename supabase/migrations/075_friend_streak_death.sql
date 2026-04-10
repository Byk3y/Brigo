-- ============================================================================
-- MIGRATION 075: Friend Streak Death Handling
-- ============================================================================
-- - Adds meta column to friend_streaks for tracking lost streaks
-- - Updates update_friend_streaks() to save last_lost_streak + died_at on reset
-- - Only triggers death notification for streaks >= 7 days (silent for < 7)
-- - Clears meta.died_at when users successfully restart
-- ============================================================================

-- Add meta column to friend_streaks
ALTER TABLE public.friend_streaks
  ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb;

-- ============================================================================
-- UPDATED update_friend_streaks() — handles death gracefully
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_friend_streaks()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pair RECORD;
  v_today DATE := CURRENT_DATE;
  v_yesterday DATE := CURRENT_DATE - 1;
  v_updated INTEGER := 0;
  v_reset INTEGER := 0;
  v_deaths_notified INTEGER := 0;
BEGIN
  FOR v_pair IN
    SELECT fs.id, fs.streak, fs.last_streak_date, fs.user_a, fs.user_b, fs.meta,
           pa.last_streak_date AS a_study_date,
           pb.last_streak_date AS b_study_date
    FROM public.friend_streaks fs
    JOIN public.profiles pa ON pa.id = fs.user_a
    JOIN public.profiles pb ON pb.id = fs.user_b
    WHERE fs.status = 'active'
    FOR UPDATE OF fs
  LOOP
    IF v_pair.a_study_date = v_today AND v_pair.b_study_date = v_today THEN
      -- Both studied today — check if we already incremented
      IF v_pair.last_streak_date IS NULL OR v_pair.last_streak_date < v_today THEN
        UPDATE public.friend_streaks
        SET streak = CASE
              WHEN last_streak_date = v_yesterday THEN streak + 1  -- consecutive
              WHEN last_streak_date IS NULL THEN 1                 -- first day
              ELSE 1                                               -- gap, restart
            END,
            last_streak_date = v_today,
            user_a_last_study = v_pair.a_study_date,
            user_b_last_study = v_pair.b_study_date,
            -- Clear death meta when they successfully restart
            meta = meta - 'last_lost_streak' - 'died_at',
            updated_at = NOW()
        WHERE id = v_pair.id;
        v_updated := v_updated + 1;
      END IF;
    ELSIF v_pair.last_streak_date IS NOT NULL
          AND v_pair.last_streak_date < v_yesterday
          AND v_pair.streak > 0 THEN
      -- STREAK DIED: Save the old streak to meta before resetting
      UPDATE public.friend_streaks
      SET streak = 0,
          meta = meta || jsonb_build_object(
            'last_lost_streak', v_pair.streak,
            'died_at', NOW()
          ),
          updated_at = NOW()
      WHERE id = v_pair.id;
      v_reset := v_reset + 1;

      -- Only notify if streak was >= 7 days (silent death for small streaks)
      IF v_pair.streak >= 7 THEN
        -- Log death event for BOTH users (edge function will pick these up)
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

GRANT EXECUTE ON FUNCTION public.update_friend_streaks() TO service_role;

-- ============================================================================
-- UPDATED get_friend_streaks() — include meta in response
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_friend_streaks()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id', fs.id,
      'streak', fs.streak,
      'last_streak_date', fs.last_streak_date,
      'created_at', fs.created_at,
      'meta', COALESCE(fs.meta, '{}'::jsonb),
      'friend', jsonb_build_object(
        'id', p.id,
        'first_name', p.first_name,
        'name', p.name,
        'avatar_url', p.avatar_url,
        'last_streak_date', p.last_streak_date,
        'streak', p.streak,
        'studied_today', (p.last_streak_date = CURRENT_DATE)
      )
    ) AS row_data
    FROM public.friend_streaks fs
    JOIN public.profiles p ON p.id = CASE
      WHEN fs.user_a = v_user_id THEN fs.user_b
      ELSE fs.user_a
    END
    WHERE (fs.user_a = v_user_id OR fs.user_b = v_user_id)
      AND fs.status = 'active'
    ORDER BY fs.streak DESC, fs.created_at ASC
  ) sub;

  RETURN jsonb_build_object(
    'success', true,
    'friends', v_result
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_friend_streaks() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friend_streaks() TO service_role;
