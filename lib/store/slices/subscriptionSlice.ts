/**
 * Subscription slice - Subscription and trial state management
 * Fetches subscription/trial data from user_subscriptions table
 */

import type { StateCreator } from 'zustand';
import { supabase } from '@/lib/supabase';
import { setUserProperties, setSuperProperties } from '@/lib/services/analyticsService';
import { getDaysUntilExpiration } from '@/lib/services/subscriptionService';
import { checkProEntitlement } from '@/lib/purchases';

export interface SubscriptionSlice {
  tier: 'trial' | 'premium' | null;
  status: 'active' | 'canceled' | 'expired' | null;
  trialEndsAt: string | null;  // ISO timestamp
  trialStartedAt: string | null;
  studioJobsUsed: number;
  audioJobsUsed: number;
  studioJobsLimit: number;  // 5 for trial, Infinity for premium
  audioJobsLimit: number;   // 3 for trial, Infinity for premium
  isExpired: boolean;
  subscriptionSyncedAt: number | null;

  loadSubscription: (userId: string) => Promise<void>;
  setSubscription: (data: Partial<SubscriptionSlice>) => void;
  resetSubscriptionState: () => void;
}

export const createSubscriptionSlice: StateCreator<
  SubscriptionSlice & { authUser: any },
  [],
  [],
  SubscriptionSlice
> = (set, get) => ({
  tier: null,
  status: null,
  trialEndsAt: null,
  trialStartedAt: null,
  studioJobsUsed: 0,
  audioJobsUsed: 0,
  studioJobsLimit: 5,  // Default to trial limits
  audioJobsLimit: 3,
  isExpired: false,
  subscriptionSyncedAt: null,

  setSubscription: (updates) =>
    set((state) => ({
      ...updates,
    })),

  loadSubscription: async (userId: string) => {
    try {
      // Fetch subscription data from user_subscriptions table
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('tier, status, trial_ends_at, trial_started_at, trial_studio_jobs_used, trial_audio_jobs_used')
        .eq('user_id', userId)
        .single();

      if (error) {
        // Check if this is a "no rows" error (expected for new users) vs actual error
        if (error.code === 'PGRST116') {
          // No subscription record found - this is expected for new users
          // The trigger should create one, but we'll set defaults until it does
          set({
            tier: 'trial',
            status: 'expired',
            trialEndsAt: null,
            trialStartedAt: null,
            studioJobsUsed: 0,
            audioJobsUsed: 0,
            studioJobsLimit: 5,
            audioJobsLimit: 3,
            isExpired: true,
            subscriptionSyncedAt: Date.now(),
          });

          // Set default Mixpanel user properties (omit null values)
          setUserProperties({
            tier: 'trial',
            subscription_status: 'expired',
            is_expired: true,
          });

          // Set super properties (included in all events)
          setSuperProperties({
            tier: 'trial',
            is_expired: true,
          });
          return;
        }

        // Actual error (network, permission, etc.)
        console.error('Error loading subscription:', error);

        // Set restrictive default state on error (fail-secure)
        // Default to expired trial to prevent unauthorized access if subscription check fails
        set({
          tier: 'trial',
          status: 'expired',
          trialEndsAt: null,
          trialStartedAt: null,
          studioJobsUsed: 0,
          audioJobsUsed: 0,
          studioJobsLimit: 5,
          audioJobsLimit: 3,
          isExpired: true,
          subscriptionSyncedAt: Date.now(),
        });

        // Set default Mixpanel user properties (omit null values)
        setUserProperties({
          tier: 'trial',
          subscription_status: 'expired',
          is_expired: true,
        });

        // Set super properties (included in all events)
        setSuperProperties({
          tier: 'trial',
          is_expired: true,
        });
        return;
      }

      if (data) {
        // Use Supabase data FIRST for quick initial render (non-blocking)
        // RevenueCat check will happen in background and update if needed
        const now = new Date();
        const trialEnds = data.trial_ends_at ? new Date(data.trial_ends_at) : null;

        // Initially use database tier (fast, non-blocking)
        const initialTier: 'trial' | 'premium' = data.tier === 'premium' ? 'premium' : 'trial';

        const isExpiredInitial: boolean =
          initialTier !== 'premium' && (
            data.status === 'expired' ||
            (initialTier === 'trial' && trialEnds !== null && now > trialEnds)
          );

        // Set quota limits based on tier
        const studioJobsLimit = initialTier === 'premium' ? Infinity : 5;
        const audioJobsLimit = initialTier === 'premium' ? Infinity : 3;

        // Set initial state immediately (allows auth flow to proceed)
        set({
          tier: initialTier,
          status: data.status as 'active' | 'canceled' | 'expired',
          trialEndsAt: data.trial_ends_at,
          trialStartedAt: data.trial_started_at,
          studioJobsUsed: data.trial_studio_jobs_used || 0,
          audioJobsUsed: data.trial_audio_jobs_used || 0,
          studioJobsLimit,
          audioJobsLimit,
          isExpired: isExpiredInitial,
          subscriptionSyncedAt: Date.now(),
        });

        // Update Mixpanel with initial state
        const trialDaysRemaining = initialTier === 'trial' && data.trial_ends_at
          ? getDaysUntilExpiration(data.trial_ends_at)
          : null;

        const userProps: Record<string, any> = {
          tier: initialTier,
          subscription_status: data.status,
          is_expired: isExpiredInitial,
          is_revenuecat_pro: false, // Will update in background
        };

        if (trialDaysRemaining !== null) {
          userProps.trial_days_remaining = trialDaysRemaining;
        }

        setUserProperties(userProps);
        setSuperProperties({
          tier: initialTier,
          is_expired: isExpiredInitial,
        });

        // BACKGROUND: Check RevenueCat and update if different (non-blocking)
        checkProEntitlement().then(async (isProRC) => {
          if (isProRC && initialTier !== 'premium') {
            // RevenueCat says Pro but DB says trial - update both
            if (__DEV__) console.log('Self-healing: Updating to premium based on RevenueCat');

            set({
              tier: 'premium',
              isExpired: false,
              studioJobsLimit: Infinity,
              audioJobsLimit: Infinity,
            });

            // Update database
            await supabase
              .from('user_subscriptions')
              .update({ tier: 'premium', status: 'active', updated_at: new Date().toISOString() })
              .eq('user_id', userId);

            // Update analytics
            setUserProperties({ tier: 'premium', is_revenuecat_pro: true, is_expired: false });
            setSuperProperties({ tier: 'premium', is_expired: false });
          } else if (isProRC) {
            // Already premium, just update the RC flag in analytics
            setUserProperties({ is_revenuecat_pro: true });
          }
        }).catch((err) => {
          if (__DEV__) console.warn('[Subscription] Background RevenueCat check failed:', err);
        });
      }
    } catch (error) {
      console.error('Error loading subscription:', error);

      // Set restrictive default state on error (fail-secure)
      // Default to expired trial to prevent unauthorized access if subscription check fails
      set({
        tier: 'trial',
        status: 'expired',
        trialEndsAt: null,
        trialStartedAt: null,
        studioJobsUsed: 0,
        audioJobsUsed: 0,
        studioJobsLimit: 5,
        audioJobsLimit: 3,
        isExpired: true,
        subscriptionSyncedAt: Date.now(),
      });

      // Set default Mixpanel user properties (omit null values)
      setUserProperties({
        tier: 'trial',
        subscription_status: 'expired',
        is_expired: true,
      });

      // Set super properties (included in all events)
      setSuperProperties({
        tier: 'trial',
        is_expired: true,
      });
    }
  },

  resetSubscriptionState: () =>
    set({
      tier: null,
      status: null,
      trialEndsAt: null,
      trialStartedAt: null,
      studioJobsUsed: 0,
      audioJobsUsed: 0,
      studioJobsLimit: 5,
      audioJobsLimit: 3,
      isExpired: false,
      subscriptionSyncedAt: null,
    }),
});
