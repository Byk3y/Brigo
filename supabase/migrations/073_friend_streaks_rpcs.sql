-- ============================================================================
-- MIGRATION 073: Friend Streaks — RPC Functions
-- ============================================================================
-- 6 functions: create invite, accept invite, get friends, update streaks,
-- remove friend, nudge friend
-- ============================================================================

-- ============================================================================
-- 1. CREATE FRIEND INVITE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_friend_invite()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_active_count INTEGER;
  v_invite_code TEXT;
  v_attempts INTEGER := 0;
  v_invite_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Check max 5 active friends
  SELECT COUNT(*) INTO v_active_count
  FROM public.friend_streaks
  WHERE (user_a = v_user_id OR user_b = v_user_id) AND status = 'active';

  IF v_active_count >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Maximum 5 active streak pals reached');
  END IF;

  -- Generate unique 8-char alphanumeric code with retry loop
  LOOP
    v_invite_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    v_attempts := v_attempts + 1;

    BEGIN
      INSERT INTO public.friend_invites (created_by, invite_code)
      VALUES (v_user_id, v_invite_code)
      RETURNING id INTO v_invite_id;
      EXIT; -- success
    EXCEPTION WHEN unique_violation THEN
      IF v_attempts >= 5 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Could not generate unique code');
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'invite_code', v_invite_code,
    'invite_id', v_invite_id,
    'expires_at', (NOW() + INTERVAL '7 days')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_friend_invite() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_friend_invite() TO service_role;

-- ============================================================================
-- 2. ACCEPT FRIEND INVITE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.accept_friend_invite(p_invite_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_invite RECORD;
  v_user_a UUID;
  v_user_b UUID;
  v_active_count_self INTEGER;
  v_active_count_inviter INTEGER;
  v_existing INTEGER;
  v_streak_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Find the invite (lock row to prevent double-accept)
  SELECT * INTO v_invite
  FROM public.friend_invites
  WHERE invite_code = upper(trim(p_invite_code))
    AND status = 'pending'
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invite code');
  END IF;

  -- Prevent self-invite
  IF v_invite.created_by = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot accept your own invite');
  END IF;

  -- Canonical ordering: smaller UUID → user_a
  IF v_invite.created_by < v_user_id THEN
    v_user_a := v_invite.created_by;
    v_user_b := v_user_id;
  ELSE
    v_user_a := v_user_id;
    v_user_b := v_invite.created_by;
  END IF;

  -- Check for existing active friendship
  SELECT COUNT(*) INTO v_existing
  FROM public.friend_streaks
  WHERE user_a = v_user_a AND user_b = v_user_b AND status = 'active';

  IF v_existing > 0 THEN
    UPDATE public.friend_invites SET status = 'accepted', accepted_by = v_user_id, accepted_at = NOW()
    WHERE id = v_invite.id;
    RETURN jsonb_build_object('success', false, 'error', 'Already friends with this user');
  END IF;

  -- Check max 5 for BOTH users
  SELECT COUNT(*) INTO v_active_count_self
  FROM public.friend_streaks
  WHERE (user_a = v_user_id OR user_b = v_user_id) AND status = 'active';

  IF v_active_count_self >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have reached the maximum of 5 streak pals');
  END IF;

  SELECT COUNT(*) INTO v_active_count_inviter
  FROM public.friend_streaks
  WHERE (user_a = v_invite.created_by OR user_b = v_invite.created_by) AND status = 'active';

  IF v_active_count_inviter >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'This user has reached their maximum of 5 streak pals');
  END IF;

  -- Mark invite accepted
  UPDATE public.friend_invites
  SET status = 'accepted', accepted_by = v_user_id, accepted_at = NOW()
  WHERE id = v_invite.id;

  -- Create friendship
  INSERT INTO public.friend_streaks (user_a, user_b, initiated_by, streak, status)
  VALUES (v_user_a, v_user_b, v_invite.created_by, 0, 'active')
  RETURNING id INTO v_streak_id;

  RETURN jsonb_build_object(
    'success', true,
    'friend_streak_id', v_streak_id,
    'friend_id', v_invite.created_by
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_friend_invite(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_friend_invite(TEXT) TO service_role;

-- ============================================================================
-- 3. GET FRIEND STREAKS
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

-- ============================================================================
-- 4. UPDATE FRIEND STREAKS (idempotent daily check)
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
BEGIN
  FOR v_pair IN
    SELECT fs.id, fs.streak, fs.last_streak_date,
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
            updated_at = NOW()
        WHERE id = v_pair.id;
        v_updated := v_updated + 1;
      END IF;
    ELSIF v_pair.last_streak_date IS NOT NULL
          AND v_pair.last_streak_date < v_yesterday
          AND v_pair.streak > 0 THEN
      -- A day was missed, reset streak
      UPDATE public.friend_streaks
      SET streak = 0,
          updated_at = NOW()
      WHERE id = v_pair.id;
      v_reset := v_reset + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated', v_updated,
    'reset', v_reset
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_friend_streaks() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_friend_streaks() TO service_role;

-- ============================================================================
-- 5. REMOVE FRIEND
-- ============================================================================
CREATE OR REPLACE FUNCTION public.remove_friend(p_friend_streak_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  UPDATE public.friend_streaks
  SET status = 'ended', ended_at = NOW(), updated_at = NOW()
  WHERE id = p_friend_streak_id
    AND (user_a = v_user_id OR user_b = v_user_id)
    AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Friendship not found or already ended');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_friend(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_friend(UUID) TO service_role;

-- ============================================================================
-- 6. NUDGE FRIEND
-- ============================================================================
CREATE OR REPLACE FUNCTION public.nudge_friend(p_friend_streak_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_friend_id UUID;
  v_friend_name TEXT;
  v_user_name TEXT;
  v_already_nudged INTEGER;
  v_friend_studied_today BOOLEAN;
  v_streak INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get friend ID and streak from the friendship
  SELECT
    CASE WHEN user_a = v_user_id THEN user_b ELSE user_a END,
    streak
  INTO v_friend_id, v_streak
  FROM public.friend_streaks
  WHERE id = p_friend_streak_id
    AND (user_a = v_user_id OR user_b = v_user_id)
    AND status = 'active';

  IF v_friend_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Friendship not found');
  END IF;

  -- Check if friend already studied today
  SELECT (last_streak_date = CURRENT_DATE), COALESCE(first_name, name, 'Friend')
  INTO v_friend_studied_today, v_friend_name
  FROM public.profiles WHERE id = v_friend_id;

  IF v_friend_studied_today THEN
    RETURN jsonb_build_object('success', false, 'error', 'Friend already studied today');
  END IF;

  -- Global rate limit: only 1 nudge received per user per 24 hours
  -- (regardless of which friend sent it — anti-spam)
  SELECT 1 INTO v_already_nudged
  FROM public.user_activity_log
  WHERE activity_type = 'friend_nudge_sent'
    AND (metadata->>'recipient_id') = v_friend_id::text
    AND created_at > NOW() - INTERVAL '24 hours'
  LIMIT 1;

  IF v_already_nudged IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'This friend was already nudged today');
  END IF;

  -- Get nudger's name
  SELECT COALESCE(first_name, name, 'A friend') INTO v_user_name
  FROM public.profiles WHERE id = v_user_id;

  -- Log the nudge with recipient_id for the rate limit lookup
  INSERT INTO public.user_activity_log (user_id, activity_type, metadata)
  VALUES (v_user_id, 'friend_nudge_sent', jsonb_build_object(
    'friend_streak_id', p_friend_streak_id,
    'friend_id', v_friend_id,
    'recipient_id', v_friend_id,
    'nudger_name', v_user_name,
    'friend_name', v_friend_name,
    'streak', v_streak
  ));

  RETURN jsonb_build_object(
    'success', true,
    'nudger_name', v_user_name,
    'friend_name', v_friend_name,
    'streak', v_streak
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.nudge_friend(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nudge_friend(UUID) TO service_role;
