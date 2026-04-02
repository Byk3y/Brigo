-- ============================================================================
-- MIGRATION 070: Smart Foundational Visibility
-- ============================================================================
-- Purpose:
--   - Hides advanced tasks (audio, flashcards, etc.) until the user has content.
--   - Prevents the "Conversion Cliff" where new users try advanced features too early.
--   - Ensures completed tasks remain visible for progress validation.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_foundational_tasks(
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_tasks JSONB;
  v_has_notebooks BOOLEAN;
  v_has_materials BOOLEAN;
BEGIN
  -- 1. Check user content status
  SELECT EXISTS(SELECT 1 FROM public.notebooks WHERE user_id = p_user_id) INTO v_has_notebooks;
  
  -- Check if user has at least one material linked to their notebooks
  SELECT EXISTS(
    SELECT 1 FROM public.materials m 
    JOIN public.notebooks n ON m.notebook_id = n.id 
    WHERE n.user_id = p_user_id
  ) INTO v_has_materials;

  -- 2. Build task list based on tiers
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'task_key', t.task_key,
      'title', t.title,
      'description', t.description,
      'points', t.points,
      'task_type', t.task_type,
      'display_order', t.display_order,
      'completed', CASE WHEN c.id IS NOT NULL THEN true ELSE false END,
      'completed_at', c.completion_date,
      'points_awarded', COALESCE(c.points_awarded, 0)
    ) ORDER BY t.display_order
  ) INTO v_tasks
  FROM public.pet_tasks t
  LEFT JOIN public.pet_task_completions c 
    ON t.id = c.task_id 
    AND c.user_id = p_user_id
  WHERE t.task_type = 'foundational'
    AND (
      -- ALWAYS SHOW (Tier 1 & Completed Tasks)
      t.task_key IN ('name_pet', 'create_notebook')
      OR c.id IS NOT NULL -- Always show if already completed
      
      -- TIER 2: Show after 1st Notebook exists
      OR (v_has_notebooks AND t.task_key IN ('first_notebook_chat', 'add_material'))
      
      -- TIER 3: Show after 1st Material exists
      OR (v_has_materials AND t.task_key IN ('generate_audio_overview', 'generate_flashcards', 'generate_quiz'))
    );

  RETURN COALESCE(v_tasks, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_foundational_tasks(UUID) TO authenticated;
