/**
 * User Service
 * Handles user profile operations
 */

import { supabase } from '@/lib/supabase';
import { handleError } from '@/lib/errors';
import type { User } from '@/lib/store/types';

export const userService = {
  /**
   * Load user profile from database
   * @param userId - The user's ID
   * @returns User profile or null if not found
   */
  loadUserProfile: async (userId: string): Promise<User | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, first_name, last_name, streak, last_streak_date, streak_freezes, last_freeze_reset, avatar_url, meta, expo_push_token, created_at')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned
        await handleError(error, {
          operation: 'load_user_profile',
          component: 'user-service',
          metadata: { userId },
        });
        return null;
      }

      if (data) {
        return {
          id: data.id,
          name: data.name || '',
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          streak: data.streak || 0,
          streak_freezes: data.streak_freezes ?? 3,
          last_freeze_reset: data.last_freeze_reset || '',
          last_streak_date: data.last_streak_date || undefined,
          coins: 0, // Not used in current system
          avatar: data.avatar_url || undefined,
          meta: (data.meta as any) || {},
          expo_push_token: data.expo_push_token || undefined,
          created_at: data.created_at || undefined,
        };
      }

      return null;
    } catch (error) {
      await handleError(error, {
        operation: 'load_user_profile',
        component: 'user-service',
        metadata: { userId },
      });
      return null;
    }
  },

  /**
   * Get user timezone from profiles table
   * @param userId - The user's ID
   * @returns Timezone string or null if not found
   */
  getUserTimezone: async (userId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('timezone')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        await handleError(error, {
          operation: 'get_user_timezone',
          component: 'user-service',
          metadata: { userId },
        });
        return null;
      }

      return data?.timezone || null;
    } catch (error) {
      await handleError(error, {
        operation: 'get_user_timezone',
        component: 'user-service',
        metadata: { userId },
      });
      return null;
    }
  },

  /**
   * Get profile meta field
   * @param userId - The user's ID
   * @returns Meta object or null
   */
  getProfileMeta: async (userId: string): Promise<Record<string, any> | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('meta')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        await handleError(error, {
          operation: 'get_profile_meta',
          component: 'user-service',
          metadata: { userId },
        });
        return null;
      }
      return (data?.meta as any) || null;
    } catch (error) {
      await handleError(error, {
        operation: 'get_profile_meta',
        component: 'user-service',
        metadata: { userId },
      });
      return null;
    }
  },

  /**
   * Get total flashcard completions count for a user
   * @param userId - The user's ID
   * @returns Total number of flashcards studied
   */
  getFlashcardsStudiedCount: async (userId: string): Promise<number> => {
    try {
      const { count, error } = await supabase
        .from('flashcard_completions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) {
        await handleError(error, {
          operation: 'get_flashcards_studied_count',
          component: 'user-service',
          metadata: { userId },
        });
        return 0;
      }

      return count || 0;
    } catch (error) {
      await handleError(error, {
        operation: 'get_flashcards_studied_count',
        component: 'user-service',
        metadata: { userId },
      });
      return 0;
    }
  },

  /**
   * Update user profile
   * @param userId - The user's ID
   * @param updates - Partial profile updates
   */
  updateProfile: async (userId: string, updates: Partial<User>): Promise<boolean> => {
    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.first_name !== undefined) dbUpdates.first_name = updates.first_name;
      if (updates.last_name !== undefined) dbUpdates.last_name = updates.last_name;
      if (updates.avatar !== undefined) dbUpdates.avatar_url = updates.avatar;

      const { error } = await supabase
        .from('profiles')
        .update(dbUpdates)
        .eq('id', userId);

      if (error) {
        await handleError(error, {
          operation: 'update_profile',
          component: 'user-service',
          metadata: { userId, updates },
        });
        return false;
      }

      return true;
    } catch (error) {
      await handleError(error, {
        operation: 'update_profile',
        component: 'user-service',
        metadata: { userId, updates },
      });
      return false;
    }
  },

  /**
   * Use a streak freeze to recover a lost streak
   * @param userId - The user's ID
   */
  applyStreakFreeze: async (userId: string, timezone: string = 'UTC'): Promise<{ success: boolean; restored_streak?: number; error?: string }> => {
    try {
      const { data, error } = await supabase.rpc('apply_streak_freeze', {
        p_user_id: userId,
        p_timezone: timezone
      });

      if (error) {
        await handleError(error, {
          operation: 'apply_streak_freeze',
          component: 'user-service',
          metadata: { userId },
        });
        return { success: false, error: error.message };
      }

      return data as any;
    } catch (error: any) {
      await handleError(error, {
        operation: 'apply_streak_freeze',
        component: 'user-service',
        metadata: { userId },
      });
      return { success: false, error: error?.message || 'Failed to apply streak freeze' };
    }
  },

  /**
   * Check for streak reset without incrementing
   */
  async checkStreakStatus(userId: string, timezone: string = 'UTC'): Promise<{
    success: boolean;
    was_reset?: boolean;
    previous_streak?: number;
    error?: string;
  }> {
    try {
      const { data, error } = await supabase.rpc('check_streak_reset', {
        p_user_id: userId,
        p_timezone: timezone
      });

      if (error) {
        console.error('Error calling check_streak_reset:', error);
        return { success: false, error: error.message };
      }

      return data as any;
    } catch (error: any) {
      await handleError(error, {
        operation: 'check_streak_status',
        component: 'user-service',
        metadata: { userId }
      });
      console.error('Error in checkStreakStatus:', error);
      return { success: false, error: error.message };
    }
  }
};











