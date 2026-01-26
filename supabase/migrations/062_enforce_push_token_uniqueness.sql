-- ============================================================================
-- MIGRATION 062: Enforce Push Token Uniqueness
-- ============================================================================
-- Purpose:
--   - Ensure a push token is associated with only one profile at a time.
--   - If User B logs in with a token already held by User A, User A's token is set to NULL.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_push_token_uniqueness()
RETURNS TRIGGER AS $$
BEGIN
  -- If a new token is being set
  IF NEW.expo_push_token IS NOT NULL THEN
    -- Clear this token from any other profiles that might have it
    UPDATE public.profiles
    SET expo_push_token = NULL
    WHERE expo_push_token = NEW.expo_push_token
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists to ensure idempotency
DROP TRIGGER IF EXISTS on_token_update_ensure_uniqueness ON public.profiles;

CREATE TRIGGER on_token_update_ensure_uniqueness
  BEFORE INSERT OR UPDATE OF expo_push_token ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_push_token_uniqueness();
