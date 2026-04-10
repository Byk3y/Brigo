-- ============================================================================
-- MIGRATION 072: Friend Streaks — Tables, Indexes, RLS
-- ============================================================================
-- Purpose: Create the social layer for "Streak Pals" — users invite friends
-- and maintain a shared streak counter. Both must study each day to keep it.
-- ============================================================================

-- ============================================================================
-- 1. FRIEND INVITES TABLE
-- ============================================================================
CREATE TABLE public.friend_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired')),
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_friend_invites_code ON public.friend_invites(invite_code);
CREATE INDEX idx_friend_invites_created_by ON public.friend_invites(created_by);
CREATE INDEX idx_friend_invites_pending ON public.friend_invites(status) WHERE status = 'pending';

-- ============================================================================
-- 2. FRIEND STREAKS TABLE
-- ============================================================================
CREATE TABLE public.friend_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  initiated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  streak INTEGER NOT NULL DEFAULT 0,
  last_streak_date DATE,          -- last date the shared streak was incremented
  user_a_last_study DATE,         -- cached last_streak_date for user_a
  user_b_last_study DATE,         -- cached last_streak_date for user_b
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'ended')),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Canonical ordering: user_a < user_b prevents A-B / B-A duplicates
  CONSTRAINT friend_streaks_user_order CHECK (user_a < user_b),
  CONSTRAINT friend_streaks_no_self CHECK (user_a != user_b)
);

-- Only one active friendship per pair
CREATE UNIQUE INDEX idx_friend_streaks_active_pair
  ON public.friend_streaks(user_a, user_b) WHERE status = 'active';
CREATE INDEX idx_friend_streaks_user_a ON public.friend_streaks(user_a) WHERE status = 'active';
CREATE INDEX idx_friend_streaks_user_b ON public.friend_streaks(user_b) WHERE status = 'active';

-- ============================================================================
-- 3. RLS POLICIES
-- ============================================================================

-- friend_invites
ALTER TABLE public.friend_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invites"
  ON public.friend_invites FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create invites"
  ON public.friend_invites FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- friend_streaks
ALTER TABLE public.friend_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own friend streaks"
  ON public.friend_streaks FOR SELECT
  USING (auth.uid() = user_a OR auth.uid() = user_b);

-- profiles: allow reading friend's basic info when friendship exists
CREATE POLICY "Users can view friend profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.friend_streaks fs
      WHERE fs.status = 'active'
        AND (
          (fs.user_a = auth.uid() AND fs.user_b = profiles.id)
          OR (fs.user_b = auth.uid() AND fs.user_a = profiles.id)
        )
    )
  );
