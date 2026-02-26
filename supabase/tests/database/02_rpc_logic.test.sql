BEGIN;
SELECT plan(1);

-- Insert a test user
INSERT INTO auth.users (id, email)
VALUES ('00000000-0000-0000-0000-000000000002', 'test_rpc@example.com');

-- For get_daily_tasks, it returns a set of tasks based on timezone.
-- Since it relies on the user's timezone from profiles, we just verify it executes without error.
SELECT lives_ok(
  $$ SELECT * FROM public.get_daily_tasks('00000000-0000-0000-0000-000000000002') $$,
  'get_daily_tasks RPC should execute for an existing valid user without error'
);

SELECT * FROM finish();
ROLLBACK;
