BEGIN;

-- We plan 2 tests for the auth user creation workflow
SELECT plan(2);

-- Run the tests in a transaction to roll back afterward
-- 1. Insert a mock user into auth.users 
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  '00000000-0000-0000-0000-000000000001', 
  'test_auth_trigger@example.com', 
  '{"first_name": "Test", "last_name": "User"}'::jsonb
);

-- 2. Verify that `handle_new_user` created a profile in public.profiles
SELECT results_eq(
  $$ SELECT email FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001' $$,
  $$ VALUES ('test_auth_trigger@example.com') $$,
  'Trigger should automatically create a profile for a new auth user'
);

-- 3. Verify that `handle_new_user_subscription` created a subscription
SELECT results_eq(
  $$ SELECT status FROM public.user_subscriptions WHERE user_id = '00000000-0000-0000-0000-000000000001' $$,
  $$ VALUES ('active'::text) $$,
  'Trigger should automatically create an active subscription for a new auth user'
);

-- Finish the tests and clean up
SELECT * FROM finish();

ROLLBACK;
