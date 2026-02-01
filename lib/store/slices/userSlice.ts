/**
 * User slice - User profile state management with Supabase persistence
 */

import type { StateCreator } from 'zustand';
import { userService } from '@/lib/services/userService';
import type { User, SupabaseUser } from '../types';

export interface UserSlice {
  user: User;
  userProfileSyncedAt: number | null;
  userProfileUserId: string | null;
  flashcardsStudied: number;
  setUser: (user: Partial<User>) => void;
  loadUserProfile: () => Promise<void>;
  hydrateUserProfileFromCache: () => void;
  applyStreakFreeze: () => Promise<{ success: boolean; restored_streak?: number; error?: string }>;
  checkStreakStatus: () => Promise<{ success: boolean; was_reset?: boolean; previous_streak?: number }>;
  resetUserProfile: () => void;
  hasCreatedNotebook: boolean;
  setHasCreatedNotebook: (value: boolean) => void;
  showStreakRestoreModal: boolean;
  setShowStreakRestoreModal: (show: boolean) => void;
  previousStreakForRestore: number;
  setPreviousStreakForRestore: (streak: number) => void;
  getUserTimezone?: () => Promise<string>; // Access from TaskSlice
}

export const createUserSlice: StateCreator<
  UserSlice & { authUser: SupabaseUser | null },
  [],
  [],
  UserSlice
> = (set, get) => ({
  user: {
    id: '',
    name: '',
    first_name: '',
    last_name: '',
    streak: 0,
    streak_freezes: 3,
    last_freeze_reset: '',
    last_streak_date: undefined,
    coins: 0,
  },
  userProfileSyncedAt: null,
  userProfileUserId: null,
  flashcardsStudied: 0,
  setUser: (updates) =>
    set((state) => ({
      user: { ...state.user, ...updates },
    })),
  loadUserProfile: async () => {
    const { authUser } = get();
    if (!authUser) return;

    try {
      const profile = await userService.loadUserProfile(authUser.id);

      // Calculate flashcard completions count
      const flashcardsStudied = await userService.getFlashcardsStudiedCount(authUser.id);

      if (profile) {
        set({
          user: {
            ...profile,
            name: profile.name || authUser.email || 'User',
          },
          userProfileSyncedAt: Date.now(),
          userProfileUserId: authUser.id,
          flashcardsStudied,
        });
      } else {
        // No profile exists, use auth user data as fallback
        set({
          user: {
            id: authUser.id,
            name: authUser.email || 'User',
            first_name: '',
            last_name: '',
            streak: 0,
            streak_freezes: 3,
            last_freeze_reset: '',
            last_streak_date: undefined,
            coins: 0,
            avatar: undefined,
          },
          userProfileSyncedAt: Date.now(),
          userProfileUserId: authUser.id,
          flashcardsStudied,
        });
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  },
  applyStreakFreeze: async () => {
    const { authUser, loadUserProfile, getUserTimezone } = get() as any;
    if (!authUser) return { success: false, error: 'Not authenticated' };

    const timezone = typeof getUserTimezone === 'function' ? await getUserTimezone() : 'UTC';
    const result = await userService.applyStreakFreeze(authUser.id, timezone);
    if (result.success) {
      set({ showStreakRestoreModal: false });
      // Fully refresh profile and pet state to reflect restored streak and awarded points
      await Promise.all([
        loadUserProfile(),
        (get() as any).loadPetState?.()
      ]);
    }
    return result;
  },
  checkStreakStatus: async () => {
    const { authUser, setUser, getUserTimezone } = get() as any;
    if (!authUser) return { success: false, error: 'Not authenticated' };

    const timezone = typeof getUserTimezone === 'function' ? await getUserTimezone() : 'UTC';
    const result = await userService.checkStreakStatus(authUser.id, timezone);

    if (result.success && result.was_reset) {
      // Update local streak to 0 and store previous streak for modal
      setUser({ streak: 0 });
      set({
        previousStreakForRestore: result.previous_streak || 0,
        showStreakRestoreModal: true
      });
    }

    return result;
  },
  hydrateUserProfileFromCache: () => {
    const { authUser, userProfileUserId, user } = get();
    if (authUser && userProfileUserId === authUser.id && user.id === '') {
      // Cache matches current user and local user is empty, restore it
      set({
        user: { ...user, id: authUser.id },
        userProfileSyncedAt: get().userProfileSyncedAt,
      });
    }
  },
  resetUserProfile: () => {
    set({
      user: {
        id: '',
        name: '',
        first_name: '',
        last_name: '',
        streak: 0,
        streak_freezes: 3,
        last_freeze_reset: '',
        last_streak_date: undefined,
        coins: 0,
      },
      userProfileSyncedAt: null,
      userProfileUserId: null,
      flashcardsStudied: 0,
    });
  },
  hasCreatedNotebook: false,
  setHasCreatedNotebook: (value) => set({ hasCreatedNotebook: value }),
  showStreakRestoreModal: false,
  setShowStreakRestoreModal: (show) => set({ showStreakRestoreModal: show }),
  previousStreakForRestore: 0,
  setPreviousStreakForRestore: (streak) => set({ previousStreakForRestore: streak }),
});
