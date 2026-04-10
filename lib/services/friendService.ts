/**
 * Friend Service — RPC calls for friend streaks system
 */

import { supabase } from '@/lib/supabase';
import { handleError } from '@/lib/errors';

// Cast to any for new RPCs not yet in generated database types
const rpc = (name: string, params?: Record<string, any>) =>
  (supabase.rpc as any)(name, params);

export interface FriendInfo {
  id: string;
  first_name: string | null;
  name: string | null;
  avatar_url: string | null;
  last_streak_date: string | null;
  streak: number;
  studied_today: boolean;
}

export interface FriendStreak {
  id: string;
  streak: number;
  last_streak_date: string | null;
  created_at: string;
  meta?: {
    last_lost_streak?: number;
    died_at?: string;
  };
  friend: FriendInfo;
}

export const friendService = {
  /**
   * Generate a new invite code (8-char alphanumeric)
   * Enforces max 5 active friends
   */
  createInvite: async (): Promise<{ success: boolean; invite_code?: string; invite_id?: string; expires_at?: string; error?: string }> => {
    try {
      const { data, error } = await rpc('create_friend_invite');

      if (error) {
        await handleError(error, {
          operation: 'create_friend_invite',
          component: 'friend-service',
        });
        return { success: false, error: error.message };
      }

      return data as any;
    } catch (error) {
      await handleError(error, {
        operation: 'create_friend_invite',
        component: 'friend-service',
      });
      return { success: false, error: 'Failed to create invite' };
    }
  },

  /**
   * Accept a friend invite by code
   * Validates code, prevents self-invite and duplicates, enforces max 5 for both users
   */
  acceptInvite: async (code: string): Promise<{ success: boolean; friend_streak_id?: string; friend_id?: string; error?: string }> => {
    try {
      const { data, error } = await rpc('accept_friend_invite', {
        p_invite_code: code,
      });

      if (error) {
        await handleError(error, {
          operation: 'accept_friend_invite',
          component: 'friend-service',
          metadata: { code },
        });
        return { success: false, error: error.message };
      }

      return data as any;
    } catch (error) {
      await handleError(error, {
        operation: 'accept_friend_invite',
        component: 'friend-service',
      });
      return { success: false, error: 'Failed to accept invite' };
    }
  },

  /**
   * Get all active friend streaks with friend info
   */
  getFriendStreaks: async (): Promise<{ success: boolean; friends: FriendStreak[]; error?: string }> => {
    try {
      const { data, error } = await rpc('get_friend_streaks');

      if (error) {
        await handleError(error, {
          operation: 'get_friend_streaks',
          component: 'friend-service',
        });
        return { success: false, friends: [], error: error.message };
      }

      return data as any;
    } catch (error) {
      await handleError(error, {
        operation: 'get_friend_streaks',
        component: 'friend-service',
      });
      return { success: false, friends: [], error: 'Failed to load friends' };
    }
  },

  /**
   * Run the daily friend streak update (idempotent)
   * Increments streaks where both users studied, resets missed ones
   */
  updateFriendStreaks: async (): Promise<{ success: boolean; updated?: number; reset?: number }> => {
    try {
      const { data, error } = await rpc('update_friend_streaks');

      if (error) {
        await handleError(error, {
          operation: 'update_friend_streaks',
          component: 'friend-service',
        });
        return { success: false };
      }

      return data as any;
    } catch (error) {
      await handleError(error, {
        operation: 'update_friend_streaks',
        component: 'friend-service',
      });
      return { success: false };
    }
  },

  /**
   * Remove a friend (soft-delete, sets status to 'ended')
   */
  removeFriend: async (friendStreakId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await rpc('remove_friend', {
        p_friend_streak_id: friendStreakId,
      });

      if (error) {
        await handleError(error, {
          operation: 'remove_friend',
          component: 'friend-service',
          metadata: { friendStreakId },
        });
        return { success: false, error: error.message };
      }

      return data as any;
    } catch (error) {
      await handleError(error, {
        operation: 'remove_friend',
        component: 'friend-service',
      });
      return { success: false, error: 'Failed to remove friend' };
    }
  },

  /**
   * Nudge a friend who hasn't studied today
   * 1. Calls nudge_friend RPC — validates, rate limits, logs to activity log
   * 2. Calls send-friend-nudge edge function — sends actual push notification
   * Rate limited: 1 nudge per friendship per 4 hours
   */
  nudgeFriend: async (friendStreakId: string): Promise<{
    success: boolean;
    nudger_name?: string;
    friend_name?: string;
    streak?: number;
    error?: string;
  }> => {
    try {
      // Step 1: Validate + log via RPC (handles rate limiting)
      const { data, error } = await rpc('nudge_friend', {
        p_friend_streak_id: friendStreakId,
      });

      if (error) {
        await handleError(error, {
          operation: 'nudge_friend',
          component: 'friend-service',
          metadata: { friendStreakId },
        });
        return { success: false, error: error.message };
      }

      const result = data as any;

      // Step 2: If RPC succeeded, fire the edge function to send the push
      // Don't block the UI on the push send — the RPC already logged it
      if (result?.success) {
        supabase.functions.invoke('send-friend-nudge', {
          body: { friend_streak_id: friendStreakId },
        }).catch((e) => {
          console.warn('Failed to send nudge push:', e);
        });
      }

      return result;
    } catch (error) {
      await handleError(error, {
        operation: 'nudge_friend',
        component: 'friend-service',
      });
      return { success: false, error: 'Failed to nudge friend' };
    }
  },
};
