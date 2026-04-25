/**
 * Hook for setting up Supabase auth state subscription
 * Handles user authentication state changes and loads user data
 */

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { identify, clearUser, track, setUserProperties } from '@/lib/services/analyticsService';
import { identifyPurchaser, logoutPurchaser } from '@/lib/purchases';
import { isOnboardingComplete } from '@/lib/auth/onboardingStatus';
import { performAuthHousekeeping } from '@/lib/auth/housekeeping';

export function useAuthSetup() {
  const {
    setAuthUser,
    setIsInitialized,
    loadNotebooks,
    loadPetState,
    setHasCompletedOnboarding,
    loadUserProfile,
    loadSubscription,
    loadPendingStudioJobs,
    clearStudioJobs,
    resetPetState,
    resetUserProfile,
    resetNotebookState,
    resetSubscriptionState,
  } = useStore();

  useEffect(() => {
    // Single source of truth for auth state and initialization
    let mounted = true;

    // Safety net: Supabase's _initialize() awaits _callRefreshToken() when the
    // stored session is within EXPIRY_MARGIN_MS of expiry, and that refresh
    // retries for up to AUTO_REFRESH_TICK_DURATION_MS (30s). In flight mode,
    // iOS fetch waits for connectivity rather than failing fast, so
    // onAuthStateChange's INITIAL_SESSION event can be blocked for 30-60s.
    // Every path that flips isInitialized lives inside that callback, so
    // without this timer the splash appears "stuck". Force-unblock after 4s;
    // real auth state reconciles in the background once the listener fires.
    const splashSafetyTimer = setTimeout(() => {
      if (!mounted) return;
      const state = useStore.getState();
      if (state.isInitialized) return;

      // If a previous session left a persisted user.id, seed authUser so
      // routing goes home with cached data instead of flashing /auth. When
      // onAuthStateChange finally fires with the real session, userIdChanged
      // will be false and no reset happens. If the session was revoked
      // server-side, the listener will deliver null and the logged-out
      // branch will clean up.
      if (state._hasHydrated && state.user.id && !state.authUser) {
        setAuthUser({ id: state.user.id } as any);

        // Seed data-ready flags from cache so isDataReady in _layout can flip
        // true even before Supabase finishes initializing.
        const updates: Record<string, unknown> = {};
        if (!state.petStateReady) {
          updates.petStateReady = true;
          updates.petStateUserId = state.user.id;
        }
        if (!state.userProfileSyncedAt) {
          updates.userProfileSyncedAt = Date.now();
          updates.userProfileUserId = state.user.id;
        }
        if (Object.keys(updates).length > 0) {
          useStore.setState(updates);
        }
      }

      if (__DEV__) console.warn('[Auth] Splash safety timeout — forcing init');
      setIsInitialized(true);
    }, 4000);

    // CRITICAL: Check initial session state BEFORE setting up listener
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // No session - user is logged out, safe to initialize routing immediately
        if (mounted) {
          setAuthUser(null);
          setIsInitialized(true);
        }
      }
    };

    // Run initial session check immediately
    initializeAuth();

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      const currentAuthUser = useStore.getState().authUser;
      const newUserId = session?.user?.id;
      const userIdChanged = currentAuthUser?.id !== newUserId;

      // Update the user in the store immediately
      setAuthUser(session?.user ?? null);

      if (session?.user) {
        // Background data fetching process
        const fetchData = async () => {
          try {
            const {
              clearPetCache,
              hydratePetStateFromCache,
              hydrateUserProfileFromCache,
            } = useStore.getState();

            // Identify user in Mixpanel
            if (userIdChanged || event === 'SIGNED_IN') {
              identify(session.user.id);
              track('user_signed_in', { auth_event: event });
              identifyPurchaser(session.user.id).catch(() => { });
            }

            // Cleanup/Hydration logic - Only reset if the user has actually changed
            // This prevents the "flash" of empty state for returning users
            if (userIdChanged && currentAuthUser) {
              if (__DEV__) console.log('[Auth] User ID changed, performing clean-up');
              clearPetCache();
              resetPetState();
              resetUserProfile();
              resetNotebookState();
              resetSubscriptionState();
            } else if (userIdChanged) {
              // First time loading for this session, but check if we have matching cache
              const state = useStore.getState();
              // Safety: Only skip reset if both critical IDs match the incoming user
              if (state.notebooksUserId !== newUserId || state.userProfileUserId !== newUserId) {
                resetPetState();
                resetUserProfile();
                resetNotebookState();
                resetSubscriptionState();
              }
            }

            hydratePetStateFromCache();
            hydrateUserProfileFromCache();

            // Cache-first init: if we already have hydratable state for this user,
            // unblock the splash immediately and reconcile with the network in the
            // background. This prevents a long splash on flaky / offline networks.
            const postHydrate = useStore.getState();
            const hasUsableCache =
              postHydrate.user.id === session.user.id &&
              postHydrate.petStateReady &&
              !!postHydrate.userProfileSyncedAt;

            if (hasUsableCache && mounted) {
              setIsInitialized(true);
            }

            const syncWork = (async () => {
              await performAuthHousekeeping(session.user.id, session.user.user_metadata);

              const [profileResult] = await Promise.all([
                supabase.from('profiles').select('meta').eq('id', session.user.id).single(),
                loadUserProfile(),
                loadSubscription(session.user.id),
                loadNotebooks(session.user.id),
                loadPetState(),
                loadPendingStudioJobs(session.user.id),
              ]);

              if (!mounted) return;

              // Only update hasCompletedOnboarding when we actually got a
              // profile row back. In airplane mode the supabase query resolves
              // with { data: null, error } instead of throwing, so blindly
              // calling setHasCompletedOnboarding(isOnboardingComplete(null))
              // would clobber the persisted true value to false and bounce a
              // returning user back into the onboarding flow.
              if (profileResult?.data && !profileResult.error) {
                const meta = profileResult.data.meta as any;
                const hasCompleted = isOnboardingComplete(meta);
                setHasCompletedOnboarding(hasCompleted);
              }

              // Sync rich user properties for analytics
              const storeState = useStore.getState() as any;
              const { notebooks, petState, user, subscriptionData } = storeState;
              const createdAt = session.user.created_at;
              const daysSinceSignup = createdAt
                ? Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))
                : 0;

              setUserProperties({
                subscription_tier: subscriptionData?.tier || 'free',
                is_premium: subscriptionData?.tier === 'premium',
                streak: user?.streak || 0,
                total_notebooks: notebooks?.length || 0,
                pet_stage: petState?.stage || 1,
                days_since_signup: daysSinceSignup,
                onboarding_completed: hasCompleted,
                education_level: meta?.education_level,
                learning_style: meta?.learning_style,
              });
            })();

            if (hasUsableCache) {
              // UI is already unblocked — let reconciliation finish on its own schedule.
              syncWork.catch((err) => {
                if (__DEV__) console.warn('[Auth] Background sync error:', err);
              });
            } else {
              // Fresh sign-in with no usable cache. Race the sync against a 7s
              // timeout so the splash can never stall on a slow network.
              const timeoutGuard = new Promise<'timeout'>((resolve) =>
                setTimeout(() => resolve('timeout'), 7000)
              );
              const raceResult = await Promise.race([
                syncWork
                  .then(() => 'sync' as const)
                  .catch((err) => {
                    if (__DEV__) console.warn('[Auth] Sync work error:', err);
                    return 'sync' as const;
                  }),
                timeoutGuard,
              ]);

              if (!mounted) return;

              // If the timeout won (network requests still pending and not rejecting),
              // seed minimal ready state from the session so the splash can hide.
              // The still-running sync work will reconcile real data when it resolves.
              if (raceResult === 'timeout') {
                const s = useStore.getState();
                const updates: Record<string, unknown> = {};
                if (!s.user.id) {
                  updates.user = {
                    ...s.user,
                    id: session.user.id,
                    name: session.user.email || 'User',
                  };
                }
                if (!s.userProfileSyncedAt) {
                  updates.userProfileSyncedAt = Date.now();
                  updates.userProfileUserId = session.user.id;
                }
                if (!s.petStateReady) {
                  updates.petStateReady = true;
                  updates.petStateUserId = session.user.id;
                }
                if (Object.keys(updates).length > 0) {
                  useStore.setState(updates);
                }
              }

              setIsInitialized(true);
            }
          } catch (error) {
            if (__DEV__) console.warn('[Auth] Data fetch error:', error);
            if (mounted) setIsInitialized(true);
          }
        };

        fetchData();
      } else {
        // Logged out state - ATOMIC RESET
        if (mounted) {
          if (__DEV__) console.log('[Auth] Atomic Reset triggered on logout');
          resetPetState();
          resetUserProfile();
          resetNotebookState();
          resetSubscriptionState();
          clearStudioJobs();
          clearUser();
          logoutPurchaser();
          setIsInitialized(true);
        }
      }
    });

    return () => {
      mounted = false;
      clearTimeout(splashSafetyTimer);
      authSubscription.unsubscribe();
    };
  }, [
    setAuthUser,
    setIsInitialized,
    loadNotebooks,
    loadPetState,
    setHasCompletedOnboarding,
    loadUserProfile,
    loadSubscription,
    loadPendingStudioJobs,
    clearStudioJobs,
    resetPetState,
    resetUserProfile,
    resetNotebookState,
    resetSubscriptionState,
  ]);
}
