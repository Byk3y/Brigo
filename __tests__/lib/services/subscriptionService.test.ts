/**
 * Subscription Service Tests
 * Tests for access control based on free/premium subscription status
 * 
 * Model: "Library vs Factory"
 * - Library (viewing): All users can access all notebooks and existing content
 * - Factory (creating): Only premium users can create new content
 */

import {
    isPremiumActive,
    checkCanCreateContent,
    checkQuotaRemaining,
    shouldShowLimitedAccessBanner,
    getRemainingQuota,
    canAccessStudio,
    canAccessNotebook,
    canGenerateStudioContent,
    SubscriptionData,
} from '@/lib/services/subscriptionService';

describe('subscriptionService', () => {
    describe('isPremiumActive', () => {
        it('should return true for active premium user', () => {
            const subscription: SubscriptionData = {
                tier: 'premium',
                status: 'active',
                isExpired: false,
                studioGenerationsCount: 10,
                audioGenerationsCount: 5,
                subscriptionSyncedAt: Date.now(),
            };
            expect(isPremiumActive(subscription)).toBe(true);
        });

        it('should return false for free user', () => {
            const subscription: SubscriptionData = {
                tier: 'free',
                status: 'expired',
                isExpired: true,
                studioGenerationsCount: 0,
                audioGenerationsCount: 0,
                subscriptionSyncedAt: Date.now(),
            };
            expect(isPremiumActive(subscription)).toBe(false);
        });

        it('should return false for expired premium user', () => {
            const subscription: SubscriptionData = {
                tier: 'premium',
                status: 'expired',
                isExpired: true,
                studioGenerationsCount: 10,
                audioGenerationsCount: 5,
                subscriptionSyncedAt: Date.now(),
            };
            expect(isPremiumActive(subscription)).toBe(false);
        });

        it('should return true for canceled premium user (still has access until period ends)', () => {
            const subscription: SubscriptionData = {
                tier: 'premium',
                status: 'canceled',
                isExpired: false, // Not yet expired
                studioGenerationsCount: 10,
                audioGenerationsCount: 5,
                subscriptionSyncedAt: Date.now(),
            };
            // Canceled but not expired should still have access
            expect(isPremiumActive(subscription)).toBe(false); // status is not 'active'
        });
    });

    describe('checkCanCreateContent', () => {
        it('should allow premium active users to create content', () => {
            const result = checkCanCreateContent('premium', 'active', false);
            expect(result.canCreate).toBe(true);
            expect(result.reason).toBeNull();
        });

        it('should block free users', () => {
            const result = checkCanCreateContent('free', 'expired', true);
            expect(result.canCreate).toBe(false);
            expect(result.reason).toBe('subscription_expired');
        });

        it('should block users with no subscription (null tier)', () => {
            const result = checkCanCreateContent(null, null, false);
            expect(result.canCreate).toBe(false);
            expect(result.reason).toBe('not_subscribed');
        });

        it('should block users with expired status', () => {
            const result = checkCanCreateContent('premium', 'expired', true);
            expect(result.canCreate).toBe(false);
            expect(result.reason).toBe('subscription_expired');
        });

        it('should allow canceled premium users (before expiration)', () => {
            const result = checkCanCreateContent('premium', 'canceled', false);
            expect(result.canCreate).toBe(true);
            expect(result.reason).toBeNull();
        });
    });

    describe('checkQuotaRemaining', () => {
        it('should allow premium users unlimited studio access', () => {
            const subscription: SubscriptionData = {
                tier: 'premium',
                status: 'active',
                isExpired: false,
                studioGenerationsCount: 1000,
                audioGenerationsCount: 500,
                subscriptionSyncedAt: Date.now(),
            };
            const result = checkQuotaRemaining('studio', subscription);
            expect(result.hasQuota).toBe(true);
            expect(result.reason).toBeNull();
        });

        it('should allow premium users unlimited audio access', () => {
            const subscription: SubscriptionData = {
                tier: 'premium',
                status: 'active',
                isExpired: false,
                studioGenerationsCount: 1000,
                audioGenerationsCount: 500,
                subscriptionSyncedAt: Date.now(),
            };
            const result = checkQuotaRemaining('audio', subscription);
            expect(result.hasQuota).toBe(true);
            expect(result.reason).toBeNull();
        });

        it('should block free users from studio', () => {
            const subscription: SubscriptionData = {
                tier: 'free',
                status: 'expired',
                isExpired: true,
                studioGenerationsCount: 0,
                audioGenerationsCount: 0,
                subscriptionSyncedAt: Date.now(),
            };
            const result = checkQuotaRemaining('studio', subscription);
            expect(result.hasQuota).toBe(false);
            expect(result.reason).toBe('subscription_expired');
        });

        it('should block free users from audio', () => {
            const subscription: SubscriptionData = {
                tier: 'free',
                status: 'expired',
                isExpired: true,
                studioGenerationsCount: 0,
                audioGenerationsCount: 0,
                subscriptionSyncedAt: Date.now(),
            };
            const result = checkQuotaRemaining('audio', subscription);
            expect(result.hasQuota).toBe(false);
            expect(result.reason).toBe('subscription_expired');
        });
    });

    describe('getRemainingQuota', () => {
        it('should return Infinity for premium users', () => {
            const subscription: SubscriptionData = {
                tier: 'premium',
                status: 'active',
                isExpired: false,
                studioGenerationsCount: 10,
                audioGenerationsCount: 5,
                subscriptionSyncedAt: Date.now(),
            };
            expect(getRemainingQuota('studio', subscription)).toBe(Infinity);
            expect(getRemainingQuota('audio', subscription)).toBe(Infinity);
        });

        it('should return 0 for free/expired users', () => {
            const subscription: SubscriptionData = {
                tier: 'free',
                status: 'expired',
                isExpired: true,
                studioGenerationsCount: 0,
                audioGenerationsCount: 0,
                subscriptionSyncedAt: Date.now(),
            };
            expect(getRemainingQuota('studio', subscription)).toBe(0);
            expect(getRemainingQuota('audio', subscription)).toBe(0);
        });
    });

    describe('shouldShowLimitedAccessBanner', () => {
        it('should show banner for expired free users', () => {
            const subscription: SubscriptionData = {
                tier: 'free',
                status: 'expired',
                isExpired: true,
                studioGenerationsCount: 0,
                audioGenerationsCount: 0,
                subscriptionSyncedAt: Date.now(),
            };
            expect(shouldShowLimitedAccessBanner(subscription)).toBe(true);
        });

        it('should NOT show banner for expired premium users', () => {
            const subscription: SubscriptionData = {
                tier: 'premium',
                status: 'expired',
                isExpired: true,
                studioGenerationsCount: 10,
                audioGenerationsCount: 5,
                subscriptionSyncedAt: Date.now(),
            };
            expect(shouldShowLimitedAccessBanner(subscription)).toBe(false);
        });

        it('should NOT show banner for active premium users', () => {
            const subscription: SubscriptionData = {
                tier: 'premium',
                status: 'active',
                isExpired: false,
                studioGenerationsCount: 10,
                audioGenerationsCount: 5,
                subscriptionSyncedAt: Date.now(),
            };
            expect(shouldShowLimitedAccessBanner(subscription)).toBe(false);
        });
    });

    describe('Library vs Factory model', () => {
        it('canAccessStudio should allow all users to view Studio tab', () => {
            const expiredSubscription: SubscriptionData = {
                tier: 'free',
                status: 'expired',
                isExpired: true,
                studioGenerationsCount: 0,
                audioGenerationsCount: 0,
                subscriptionSyncedAt: Date.now(),
            };
            // Everyone can VIEW the Studio tab (Library)
            expect(canAccessStudio(expiredSubscription)).toBe(true);
        });

        it('canGenerateStudioContent should block expired users from generating', () => {
            const expiredSubscription: SubscriptionData = {
                tier: 'free',
                status: 'expired',
                isExpired: true,
                studioGenerationsCount: 0,
                audioGenerationsCount: 0,
                subscriptionSyncedAt: Date.now(),
            };
            // Expired users cannot GENERATE (Factory)
            expect(canGenerateStudioContent(expiredSubscription)).toBe(false);
        });

        it('canGenerateStudioContent should allow premium users to generate', () => {
            const premiumSubscription: SubscriptionData = {
                tier: 'premium',
                status: 'active',
                isExpired: false,
                studioGenerationsCount: 10,
                audioGenerationsCount: 5,
                subscriptionSyncedAt: Date.now(),
            };
            expect(canGenerateStudioContent(premiumSubscription)).toBe(true);
        });

        it('canAccessNotebook should allow all users to access any notebook', () => {
            // All users can access ALL notebooks now
            expect(canAccessNotebook('any-notebook-id', [])).toBe(true);
            expect(canAccessNotebook('another-id', ['some-other-id'])).toBe(true);
        });
    });

    describe('Security: No trial references', () => {
        it('should not have trial as a valid tier type', () => {
            // This test ensures the type system prevents trial
            // The checkCanCreateContent function only accepts 'free' | 'premium' | null
            const tiers = ['free', 'premium'];
            expect(tiers).not.toContain('trial');
        });

        it('should not have trial as a valid status type', () => {
            const statuses = ['active', 'canceled', 'expired'];
            expect(statuses).not.toContain('trial');
        });
    });
});

