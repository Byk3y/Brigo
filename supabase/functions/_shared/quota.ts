/**
 * Quota Management for Free/Premium Users
 * Premium users have unlimited access, free users are blocked
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

// Loosen generics so any Supabase client instance is accepted (service role or anon)
type AnySupabaseClient = SupabaseClient<any, any, any, any, any>;

export interface QuotaCheck {
  allowed: boolean;
  reason?: string;
  tier?: 'free' | 'premium';
}

/**
 * Check if user can perform a Studio or Audio job
 * Free users: blocked (subscription required)
 * Premium users: unlimited
 */
export async function checkQuota(
  supabase: AnySupabaseClient,
  userId: string,
  jobType: 'studio' | 'audio'
): Promise<QuotaCheck> {
  try {
    // Get user subscription
    const { data: sub, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !sub) {
      return {
        allowed: false,
        reason: 'Subscription not found. Please subscribe to continue.',
      };
    }

    // Premium users: unlimited access
    if (sub.tier === 'premium' && sub.status === 'active') {
      return {
        allowed: true,
        tier: 'premium',
      };
    }

    // Free users or expired: blocked
    return {
      allowed: false,
      reason: 'Please subscribe to Brigo Pro to use this feature!',
      tier: 'free',
    };
  } catch (error) {
    console.error('Quota check error:', error);
    return {
      allowed: false,
      reason: 'Error checking subscription. Please try again.',
    };
  }
}

/**
 * Increment generation count (for analytics tracking only)
 * Uses SQL function for atomic increment
 */
export async function incrementQuota(
  supabase: AnySupabaseClient,
  userId: string,
  jobType: 'studio' | 'audio'
): Promise<void> {
  try {
    // Call SQL function (uses new column names)
    const { error } = await supabase.rpc('increment_quota', {
      user_id_param: userId,
      quota_type: jobType,
    });

    if (error) {
      console.error('Error incrementing generation count:', error);
      // Don't throw - just log. Job already completed successfully.
    }
  } catch (error) {
    console.error('incrementQuota error:', error);
    // Don't throw - just log. Job already completed successfully.
  }
}

/**
 * Get user subscription info (for frontend display)
 */
export async function getUserQuota(
  supabase: AnySupabaseClient,
  userId: string
): Promise<{
  tier: 'free' | 'premium';
  isExpired: boolean;
  studioGenerationsCount: number;
  audioGenerationsCount: number;
}> {
  try {
    const { data: sub, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !sub) {
      throw new Error('Subscription not found');
    }

    const isPremium = sub.tier === 'premium' && sub.status === 'active';

    return {
      tier: isPremium ? 'premium' : 'free',
      isExpired: !isPremium,
      studioGenerationsCount: sub.studio_generations_count || 0,
      audioGenerationsCount: sub.audio_generations_count || 0,
    };
  } catch (error) {
    console.error('getUserQuota error:', error);
    throw error;
  }
}
