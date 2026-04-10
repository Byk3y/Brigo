/**
 * Friend slice — Friend streaks state management
 */

import type { StateCreator } from 'zustand';
import { friendService, type FriendStreak } from '@/lib/services/friendService';
import type { SupabaseUser } from '../types';

export interface FriendSlice {
  friends: FriendStreak[];
  friendsLoading: boolean;
  friendsUserId: string | null;
  loadFriendStreaks: () => Promise<void>;
  createFriendInvite: () => Promise<{ success: boolean; invite_code?: string; error?: string }>;
  acceptFriendInvite: (code: string) => Promise<{ success: boolean; error?: string }>;
  removeFriend: (friendStreakId: string) => Promise<{ success: boolean; error?: string }>;
  nudgeFriend: (friendStreakId: string) => Promise<{ success: boolean; nudger_name?: string; friend_name?: string; streak?: number; error?: string }>;
  pendingInviteCode: string | null;
  pendingInviteSource: 'deeplink' | 'clipboard' | null;
  setPendingInviteCode: (code: string | null, source?: 'deeplink' | 'clipboard') => void;
}

export const createFriendSlice: StateCreator<
  FriendSlice & { authUser: SupabaseUser | null },
  [],
  [],
  FriendSlice
> = (set, get) => ({
  friends: [],
  friendsLoading: false,
  friendsUserId: null,

  loadFriendStreaks: async () => {
    const { authUser } = get();
    if (!authUser) return;

    set({ friendsLoading: true });
    try {
      const result = await friendService.getFriendStreaks();
      if (result.success) {
        set({ friends: result.friends, friendsUserId: authUser.id });
      }
    } catch (error) {
      console.error('Failed to load friend streaks:', error);
    } finally {
      set({ friendsLoading: false });
    }
  },

  createFriendInvite: async () => {
    const { authUser } = get();
    if (!authUser) return { success: false, error: 'Not authenticated' };

    const result = await friendService.createInvite();
    return result;
  },

  acceptFriendInvite: async (code: string) => {
    const { authUser } = get();
    if (!authUser) return { success: false, error: 'Not authenticated' };

    const result = await friendService.acceptInvite(code);
    if (result.success) {
      // Reload friend list to show new friend
      await get().loadFriendStreaks();
    }
    return result;
  },

  removeFriend: async (friendStreakId: string) => {
    const { authUser } = get();
    if (!authUser) return { success: false, error: 'Not authenticated' };

    const result = await friendService.removeFriend(friendStreakId);
    if (result.success) {
      // Remove from local state immediately
      set((state) => ({
        friends: state.friends.filter((f) => f.id !== friendStreakId),
      }));
    }
    return result;
  },

  nudgeFriend: async (friendStreakId: string) => {
    const { authUser } = get();
    if (!authUser) return { success: false, error: 'Not authenticated' };

    return await friendService.nudgeFriend(friendStreakId);
  },

  pendingInviteCode: null,
  pendingInviteSource: null,
  setPendingInviteCode: (code, source = 'deeplink') => set({
    pendingInviteCode: code,
    pendingInviteSource: code ? source : null,
  }),
});
