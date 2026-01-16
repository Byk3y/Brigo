/**
 * Subscription slice - Subscription state management
 * Fetches subscription data from user_subscriptions table
 * Uses free/premium tier model (no trial)
 */

import type { StateCreator } from 'zustand';
import { supabase } from '@/lib/supabase';
import { setUserProperties, setSuperProperties } from '@/lib/services/analyticsService';
import { checkProEntitlement } from '@/lib/purchases';

export interface SubscriptionSlice {
  tier: 'free' | 'premium' | null;
  status: 'active' | 'canceled' | 'expired' | null;
  studioGenerationsCount: number;  // For analytics tracking only
  audioGenerationsCount: number;   // For analytics tracking only
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
  studioGenerationsCount: 0,
  audioGenerationsCount: 0,
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
        .select('tier, status, studio_generations_count, audio_generations_count')
        .eq('user_id', userId)
        .single();

      if (error) {
        // Check if this is a "no rows" error (expected for new users) vs actual error
        if (error.code === 'PGRST116') {
          // No subscription record found - new user, default to free/expired
          set({
            tier: 'free',
            status: 'expired',
            studioGenerationsCount: 0,
            audioGenerationsCount: 0,
            isExpired: true,
            subscriptionSyncedAt: Date.now(),
          });

          setUserProperties({
            tier: 'free',
            subscription_status: 'expired',
            is_expired: true,
          });

          setSuperProperties({
            tier: 'free',
            is_expired: true,
          });
          return;
        }

        // Actual error (network, permission, etc.)
        console.error('Error loading subscription:', error);

        // Set restrictive default state on error (fail-secure)
        set({
          tier: 'free',
          status: 'expired',
          studioGenerationsCount: 0,
          audioGenerationsCount: 0,
          isExpired: true,
          subscriptionSyncedAt: Date.now(),
        });

        setUserProperties({
          tier: 'free',
          subscription_status: 'expired',
          is_expired: true,
        });

        setSuperProperties({
          tier: 'free',
          is_expired: true,
        });
        return;
      }

      if (data) {
        // Determine tier and expiration status
        const isPremium = data.tier === 'premium' && data.status === 'active';
        const tier: 'free' | 'premium' = isPremium ? 'premium' : 'free';
        const isExpiredNow = !isPremium;

        // Set state immediately
        set({
          tier,
          status: data.status as 'active' | 'canceled' | 'expired',
          studioGenerationsCount: data.studio_generations_count || 0,
          audioGenerationsCount: data.audio_generations_count || 0,
          isExpired: isExpiredNow,
          subscriptionSyncedAt: Date.now(),
        });

        // Update analytics
        setUserProperties({
          tier,
          subscription_status: data.status,
          is_expired: isExpiredNow,
          is_revenuecat_pro: false,
        });

        setSuperProperties({
          tier,
          is_expired: isExpiredNow,
        });

        // BACKGROUND: Check RevenueCat and update if different (non-blocking)
        checkProEntitlement().then(async (isProRC) => {
          if (isProRC && tier !== 'premium') {
            // RevenueCat says Pro but DB says free - update both
            if (__DEV__) console.log('Self-healing: Updating to premium based on RevenueCat');

            set({
              tier: 'premium',
              isExpired: false,
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
      set({
        tier: 'free',
        status: 'expired',
        studioGenerationsCount: 0,
        audioGenerationsCount: 0,
        isExpired: true,
        subscriptionSyncedAt: Date.now(),
      });

      setUserProperties({
        tier: 'free',
        subscription_status: 'expired',
        is_expired: true,
      });

      setSuperProperties({
        tier: 'free',
        is_expired: true,
      });
    }
  },

  resetSubscriptionState: () =>
    set({
      tier: null,
      status: null,
      studioGenerationsCount: 0,
      audioGenerationsCount: 0,
      isExpired: false,
      subscriptionSyncedAt: null,
    }),
});
