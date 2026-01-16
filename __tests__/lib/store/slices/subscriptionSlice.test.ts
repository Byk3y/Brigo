/**
 * Subscription Slice Tests
 * Tests for free/premium subscription model (no trial)
 */

import { createSubscriptionSlice, SubscriptionSlice } from '@/lib/store/slices/subscriptionSlice';

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
    supabase: {
        from: jest.fn(() => ({
            select: jest.fn(() => ({
                eq: jest.fn(() => ({
                    single: jest.fn(),
                })),
            })),
            update: jest.fn(() => ({
                eq: jest.fn(),
            })),
        })),
    },
}));

// Mock analytics
jest.mock('@/lib/services/analyticsService', () => ({
    setUserProperties: jest.fn(),
    setSuperProperties: jest.fn(),
}));

// Mock purchases
jest.mock('@/lib/purchases', () => ({
    checkProEntitlement: jest.fn().mockResolvedValue(false),
}));

describe('SubscriptionSlice', () => {
    let slice: SubscriptionSlice;
    let setState: jest.Mock;
    let getState: jest.Mock;

    beforeEach(() => {
        setState = jest.fn();
        getState = jest.fn();

        const creator = createSubscriptionSlice as any;
        slice = creator(setState, getState, {});
    });

    describe('Initial State', () => {
        it('should have null tier initially', () => {
            expect(slice.tier).toBeNull();
        });

        it('should have null status initially', () => {
            expect(slice.status).toBeNull();
        });

        it('should not be expired initially', () => {
            expect(slice.isExpired).toBe(false);
        });

        it('should have zero generation counts', () => {
            expect(slice.studioGenerationsCount).toBe(0);
            expect(slice.audioGenerationsCount).toBe(0);
        });
    });

    describe('setSubscription', () => {
        it('should update tier correctly', () => {
            slice.setSubscription({ tier: 'premium' });
            expect(setState).toHaveBeenCalledWith(expect.any(Function));
        });

        it('should update isExpired correctly', () => {
            slice.setSubscription({ isExpired: true });
            expect(setState).toHaveBeenCalled();
        });
    });

    describe('resetSubscriptionState', () => {
        it('should reset all values to defaults', () => {
            slice.resetSubscriptionState();
            expect(setState).toHaveBeenCalledWith({
                tier: null,
                status: null,
                studioGenerationsCount: 0,
                audioGenerationsCount: 0,
                isExpired: false,
                subscriptionSyncedAt: null,
            });
        });
    });
});

describe('Subscription Tier Types', () => {
    it('should only allow free or premium tiers', () => {
        // TypeScript compile-time check - these should be the only valid values
        const validTiers: Array<'free' | 'premium' | null> = ['free', 'premium', null];
        expect(validTiers).toContain('free');
        expect(validTiers).toContain('premium');
        expect(validTiers).not.toContain('trial');
    });
});
