/**
 * useUpgrade Hook
 * Analytics and tracking for upgrade/subscription events
 * Integrates with Mixpanel for product analytics
 */

import { useCallback } from 'react';
import { track } from '@/lib/services/analyticsService';
import { useStore } from '@/lib/store';

export function useUpgrade() {
  // Get subscription state from store for event properties
  const getSubscriptionState = useCallback(() => {
    const { tier, isExpired } = useStore.getState();
    return { tier: tier || 'free', is_expired: isExpired };
  }, []);

  const trackUpgradeButtonClicked = useCallback((source: string) => {
    const { tier, is_expired } = getSubscriptionState();
    track('upgrade_button_clicked', {
      source,
      tier,
      is_expired,
    });
  }, [getSubscriptionState]);

  const trackLockedNotebookAccessed = useCallback((notebookId: string) => {
    const { tier, is_expired } = getSubscriptionState();
    track('locked_notebook_accessed', {
      notebook_id: notebookId,
      tier,
      is_expired,
    });
  }, [getSubscriptionState]);

  const trackCreateAttemptBlocked = useCallback((contentType: string) => {
    const { tier, is_expired } = getSubscriptionState();
    track('create_attempt_blocked', {
      content_type: contentType,
      tier,
      is_expired,
    });
  }, [getSubscriptionState]);

  const trackUpgradeModalShown = useCallback((source: string) => {
    const { tier, is_expired } = getSubscriptionState();
    track('upgrade_modal_shown', {
      source,
      tier,
      is_expired,
    });
  }, [getSubscriptionState]);

  const trackUpgradeModalDismissed = useCallback((source: string) => {
    track('upgrade_modal_dismissed', {
      source,
    });
  }, []);

  const trackLimitedAccessBannerShown = useCallback(() => {
    const { tier, is_expired } = getSubscriptionState();
    track('limited_access_banner_shown', {
      tier,
      is_expired,
    });
  }, [getSubscriptionState]);

  const trackUpgradeScreenViewed = useCallback(() => {
    const { tier, is_expired } = getSubscriptionState();
    track('upgrade_screen_viewed', {
      tier,
      is_expired,
    });
  }, [getSubscriptionState]);

  return {
    trackUpgradeButtonClicked,
    trackLockedNotebookAccessed,
    trackCreateAttemptBlocked,
    trackUpgradeModalShown,
    trackUpgradeModalDismissed,
    trackLimitedAccessBannerShown,
    trackUpgradeScreenViewed,
  };
}

