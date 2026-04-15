-- Bubble increment_streak()'s return fields up through processor_pet_security()
-- so the client can tell "this call incremented the streak N-1 -> N" in the
-- log_activity RPC response. Used to drive the streak-variant banner.
-- process_activity_rewards already passes the pet_security JSONB through
-- unchanged, so no change is needed there.

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
    -- Pet already secured today; no insert, no streak increment, no points.
    -- Still report was_incremented=false so client banner logic behaves consistently.
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
