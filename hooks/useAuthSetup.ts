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

export function useAuthSetup() {
  const {
    setAuthUser,
    setIsInitialized,
    loadNotebooks,
    loadPetState,
    setHasCompletedOnboarding,
    loadUserProfile,
    loadSubscription,
    resetPetState,
    resetUserProfile,
    resetNotebookState,
    resetSubscriptionState,
  } = useStore();

  useEffect(() => {
    // Single source of truth for auth state and initialization
    let mounted = true;

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

            // Cleanup/Hydration logic
            if (userIdChanged && currentAuthUser) {
              clearPetCache();
              resetPetState();
              resetUserProfile();
              resetNotebookState();
              resetSubscriptionState();
            } else if (userIdChanged || event === 'SIGNED_IN') {
              resetPetState();
              resetUserProfile();
              resetNotebookState();
              resetSubscriptionState();
            }

            hydratePetStateFromCache();
            hydrateUserProfileFromCache();

            // Fetch profile and other data in background
            const [profileResult] = await Promise.all([
              supabase.from('profiles').select('meta').eq('id', session.user.id).single(),
              loadUserProfile(),
              loadSubscription(session.user.id),
              loadNotebooks(session.user.id),
              loadPetState(),
            ]);

            if (mounted) {
              const meta = profileResult?.data?.meta as any;
              const hasCompleted = isOnboardingComplete(meta);
              setHasCompletedOnboarding(hasCompleted);

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

              // Initialization is definitely complete now that we have the newest onboarding flag
              setIsInitialized(true);
            }
          } catch (error) {
            if (__DEV__) console.warn('[Auth] Data fetch error:', error);
            if (mounted) setIsInitialized(true);
          }
        };

        fetchData();

        // If we already have a session, we can consider auth "initialized" 
        // for the sake of showing the UI, trusting the cached onboarding flag first.
        if (mounted) setIsInitialized(true);
      } else {
        // Logged out state - ATOMIC RESET
        if (mounted) {
          if (__DEV__) console.log('[Auth] Atomic Reset triggered on logout');
          resetPetState();
          resetUserProfile();
          resetNotebookState();
          resetSubscriptionState();
          clearUser();
          logoutPurchaser();
          setIsInitialized(true);
        }
      }
    });

    return () => {
      mounted = false;
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
    resetPetState,
    resetUserProfile,
    resetNotebookState,
    resetSubscriptionState,
  ]);
}
