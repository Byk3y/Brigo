/**
 * Subscription Service - Helper functions for subscription logic
 * Uses free/premium tier model (no trial)
 * 
 * ═══════════════════════════════════════════════════════════════════════
 * ACCESS MODEL: "Library vs Factory"
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Premium users: Full access to all features
 * 
 * Expired users (the "fair" model):
 * - LIBRARY (free): View ALL notebooks, use existing flashcards/quizzes/podcasts
 * - FACTORY (blocked): Cannot create new notebooks, add materials, or generate content
 * - CHAT (limited): 5 messages/day to maintain their streak
 * 
 * This respects the user's investment while creating natural upsell moments
 * when they need to add new study material or generate new content.
 * ═══════════════════════════════════════════════════════════════════════
 */

import type { SubscriptionSlice } from '@/lib/store/slices/subscriptionSlice';

// Daily chat limit for expired users (allows streak maintenance)
export const EXPIRED_USER_DAILY_CHAT_LIMIT = 5;

/**
 * Essential subscription data fields needed for checks
 * (excludes store methods like loadSubscription/setSubscription)
 */
export type SubscriptionData = Pick<SubscriptionSlice,
  'tier' | 'status' | 'isExpired' | 'studioGenerationsCount' | 'audioGenerationsCount' | 'subscriptionSyncedAt'
>;

/**
 * Check if user has premium access
 */
export function isPremiumActive(subscription: SubscriptionData): boolean {
  return (
    subscription.tier === 'premium' &&
    subscription.status === 'active' &&
    !subscription.isExpired
  );
}

/**
 * Limit reason types
 */
export type LimitReason =
  | 'subscription_expired'
  | 'not_subscribed'
  | 'daily_chat_limit_reached'
  | null;

/**
 * Result of checking if user can create content
 */
export interface ContentCreationCheck {
  canCreate: boolean;
  reason: LimitReason;
}

/**
 * Check if user can create NEW content (notebooks, materials, generations)
 * This is the "Factory" gate - only premium users can create.
 */
export function checkCanCreateContent(
  tier: 'free' | 'premium' | null,
  status: 'active' | 'canceled' | 'expired' | null,
  isExpired: boolean
): ContentCreationCheck {
  // Premium users can always create (even if status='canceled', until period ends)
  if (tier === 'premium' && status !== 'expired' && !isExpired) {
    return { canCreate: true, reason: null };
  }

  // If subscription expired
  if (status === 'expired' || isExpired) {
    return { canCreate: false, reason: 'subscription_expired' };
  }

  // Free users cannot create
  if (tier === 'free' || tier === null) {
    return { canCreate: false, reason: 'not_subscribed' };
  }

  // All other cases: cannot create
  return { canCreate: false, reason: 'subscription_expired' };
}

/**
 * Check if user can create notebooks/content (simple boolean version for backward compatibility)
 */
export function canCreateContent(
  tier: 'free' | 'premium' | null,
  status: 'active' | 'canceled' | 'expired' | null,
  isExpired: boolean
): boolean {
  return checkCanCreateContent(tier, status, isExpired).canCreate;
}

/**
 * Check if user can ACCESS the Studio tab
 * 
 * NEW MODEL: All users can VIEW the Studio tab to access their existing content.
 * The generation buttons will be blocked for expired users (checked separately).
 * This is part of the "Library" - they can study their existing flashcards/podcasts.
 */
export function canAccessStudio(subscription: SubscriptionData): boolean {
  // Everyone can access the Studio tab to view existing content
  return true;
}

/**
 * Check if user can GENERATE new content in Studio
 * (Flashcards, Quizzes, Audio, Predictions)
 * This is the "Factory" - only premium users can generate.
 */
export function canGenerateStudioContent(subscription: SubscriptionData): boolean {
  return isPremiumActive(subscription);
}

/**
 * Check if user can access Chat feature
 * Premium users: unlimited
 * Expired users: limited to EXPIRED_USER_DAILY_CHAT_LIMIT per day
 * 
 * Note: This just checks eligibility. The actual limit is enforced in useNotebookChat
 * via the check_and_increment_chat_usage database function.
 */
export function canAccessChat(subscription: SubscriptionData): boolean {
  // Everyone can access chat (expired users get 5 messages/day)
  return true;
}

/**
 * Check if user can access a specific notebook
 * 
 * NEW MODEL: All users can access ALL their notebooks (the "Library")
 * We no longer limit access to only the 3 most recent notebooks.
 */
export function canAccessNotebook(
  notebookId: string,
  accessibleIds: string[]
): boolean {
  // All notebooks are accessible now
  return true;
}

/**
 * Result of checking quota availability
 */
export interface QuotaCheck {
  hasQuota: boolean;
  reason: LimitReason;
}

/**
 * Check if quota is available for studio/audio jobs (the "Factory" check)
 * Premium users have unlimited access, free/expired users are blocked
 */
export function checkQuotaRemaining(
  jobType: 'studio' | 'audio',
  subscription: SubscriptionData
): QuotaCheck {
  // Premium users have unlimited quota (unless status is 'expired')
  if (subscription.tier === 'premium' && subscription.status !== 'expired' && !subscription.isExpired) {
    return { hasQuota: true, reason: null };
  }

  // If subscription expired
  if (subscription.status === 'expired' || subscription.isExpired) {
    return { hasQuota: false, reason: 'subscription_expired' };
  }

  // Free users have no quota
  return { hasQuota: false, reason: 'not_subscribed' };
}

/**
 * Check if quota is available for studio/audio jobs (simple boolean version)
 */
export function hasQuotaRemaining(
  jobType: 'studio' | 'audio',
  subscription: SubscriptionData
): boolean {
  return checkQuotaRemaining(jobType, subscription).hasQuota;
}

/**
 * Get remaining quota for a job type
 * Returns Infinity for premium users, 0 for free/expired users
 */
export function getRemainingQuota(
  jobType: 'studio' | 'audio',
  subscription: SubscriptionData
): number {
  // Premium users have unlimited quota
  if (subscription.tier === 'premium' && subscription.status !== 'expired' && !subscription.isExpired) {
    return Infinity;
  }

  // Free/expired users have no quota
  return 0;
}

/**
 * Check if user should see limited access banner
 * Shows when: subscription expired and not premium
 * This reminds expired users that they have limited functionality
 */
export function shouldShowLimitedAccessBanner(subscription: SubscriptionData): boolean {
  return subscription.isExpired && subscription.tier !== 'premium';
}

/**
 * Get accessible notebook IDs for limited access mode
 * 
 * NOTE: This function is now deprecated in favor of full notebook access.
 * Kept for backward compatibility but returns all notebook IDs.
 */
export function getAccessibleNotebookIds<T extends { id: string; createdAt: string }>(
  notebooks: T[],
  count: number
): string[] {
  // Return ALL notebook IDs now (no more limiting)
  return notebooks.map((n) => n.id);
}
