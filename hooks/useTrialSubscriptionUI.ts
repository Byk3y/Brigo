/**
 * Hook for managing subscription UI state
 * Handles subscription expired modals and limited access banners
 * 
 * NOTE: With the "Library vs Factory" model:
 * - All notebooks are accessible (no more 3-notebook limit)
 * - showLimitedAccess still shows a banner for expired users
 * - accessibleNotebookIds returns ALL notebook IDs
 */

import { useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '@/lib/store';
import { useUpgrade } from '@/lib/hooks/useUpgrade';
import { shouldShowLimitedAccessBanner } from '@/lib/services/subscriptionService';
import { SUBSCRIPTION_CONSTANTS } from '@/lib/constants';
import type { Notebook } from '@/lib/store';

/**
 * Hook to manage subscription UI state
 * 
 * With the "Library vs Factory" model:
 * - accessibleNotebookIds now returns ALL notebooks (no filtering)
 * - showLimitedAccess indicates expired status for showing upgrade banners
 * - Expired modal is shown once when subscription expires
 */
export function useSubscriptionUI(notebooks: Notebook[]) {
  const {
    authUser,
    isInitialized,
    tier,
    status,
    subscriptionSyncedAt,
    isExpired,
  } = useStore();

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const {
    trackUpgradeModalShown,
    trackLimitedAccessBannerShown,
  } = useUpgrade();

  // Create subscription object for service functions
  const subscription = useMemo(
    () => ({
      tier,
      status,
      studioGenerationsCount: 0,
      audioGenerationsCount: 0,
      isExpired,
      subscriptionSyncedAt,
    }),
    [tier, status, isExpired, subscriptionSyncedAt]
  );

  const showLimitedAccess = shouldShowLimitedAccessBanner(subscription);

  // All notebook IDs are accessible now (Library model)
  const accessibleIds = useMemo(
    () => notebooks.map((n) => n.id),
    [notebooks]
  );

  const accessibleCount = notebooks.length; // All are accessible
  const totalCount = notebooks.length;

  // Check if subscription expired modal should be shown on first app open after expiration
  useEffect(() => {
    const checkSubscriptionExpiredModal = async () => {
      // Only show if: expired, not premium, and not already shown
      if (isExpired && tier !== 'premium' && authUser && isInitialized) {
        const alreadyShown = await AsyncStorage.getItem(
          SUBSCRIPTION_CONSTANTS.SUBSCRIPTION_EXPIRED_MODAL_SHOWN_KEY
        );
        if (!alreadyShown) {
          setShowUpgradeModal(true);
          trackUpgradeModalShown('subscription_expired');
          // Mark as shown
          await AsyncStorage.setItem(
            SUBSCRIPTION_CONSTANTS.SUBSCRIPTION_EXPIRED_MODAL_SHOWN_KEY,
            'true'
          );
        }
      } else if (tier === 'premium' || !isExpired) {
        // Clear the flag if user upgrades or subscription becomes active again
        await AsyncStorage.removeItem(
          SUBSCRIPTION_CONSTANTS.SUBSCRIPTION_EXPIRED_MODAL_SHOWN_KEY
        );
      }
    };
    checkSubscriptionExpiredModal();
  }, [isExpired, tier, authUser, isInitialized, trackUpgradeModalShown]);

  // Track limited access banner shown
  useEffect(() => {
    if (showLimitedAccess) {
      trackLimitedAccessBannerShown();
    }
  }, [showLimitedAccess, trackLimitedAccessBannerShown]);

  return {
    showUpgradeModal,
    showLimitedAccess,
    accessibleNotebookIds: accessibleIds,
    accessibleCount,
    totalCount,
    setShowUpgradeModal,
  };
}

// Keep the old name as an alias for backward compatibility during migration
export { useSubscriptionUI as useTrialSubscriptionUI };
