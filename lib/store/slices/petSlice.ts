/**
 * Pet slice - Pet state management with Supabase persistence
 */

import type { StateCreator } from 'zustand';
import { petService } from '@/lib/services/petService';
import type { PetState, SupabaseUser } from '../types';

// Type for cross-slice access to TaskSlice's checkAndAwardTask
interface TaskSliceAccessor {
  checkAndAwardTask?: (taskKey: string) => Promise<{ success: boolean; newPoints?: number; error?: string }>;
}

export interface PetSlice {
  petState: PetState;
  petStateReady: boolean;
  petStateSyncedAt: number | null;
  petStateUserId: string | null;
  cachedPetState?: PetState;
  cachedPetSyncedAt?: number | null;
  cachedPetUserId?: string | null;
  setPetState: (petState: Partial<PetState>) => Promise<void>;
  addPetPoints: (amount: number) => Promise<void>;
  loadPetState: () => Promise<void>;
  updatePetName: (newName: string) => Promise<void>;
  hydratePetStateFromCache: () => void;
  resetPetState: () => void;
  clearPetCache: () => void;
}

export const createPetSlice: StateCreator<
  PetSlice & { authUser: SupabaseUser | null },
  [],
  [],
  PetSlice
> = (set, get) => ({
  petState: {
    stage: 1,
    points: 0,
    name: 'Nova',
    mood: 'happy',
  },
  petStateReady: false,
  petStateSyncedAt: null,
  petStateUserId: null,
  cachedPetState: undefined,
  cachedPetSyncedAt: null,
  cachedPetUserId: null,

  setPetState: async (updates: Partial<PetState>) => {
    const { authUser } = get();
    if (!authUser) return;

    // Get current pet state to merge with updates
    const currentPetState = get().petState;

    // Merge current state with updates
    const mergedPetState = { ...currentPetState, ...updates };

    // Update local state
    set((state) => ({
      petState: mergedPetState,
      petStateReady: true,
      petStateSyncedAt: Date.now(),
      petStateUserId: authUser.id,
      cachedPetState: mergedPetState,
      cachedPetSyncedAt: Date.now(),
      cachedPetUserId: authUser.id,
    }));

    try {
      await petService.savePetState(authUser.id, mergedPetState);
    } catch (error) {
      console.error('Error persisting pet state:', error);
    }
  },

  updatePetName: async (newName: string) => {
    const { setPetState } = get();

    // 1. Update state locally and persist - this is the critical path
    await setPetState({ name: newName });

    // 2. Check for "Name your pet" task completion
    // We do this here as a convenient trigger point
    // MODIFIED: Fire and forget task points awarding to prevent blocking the UI
    // if the background task system is slow or under load.
    const state = get() as unknown as TaskSliceAccessor;
    if (newName !== 'Pet' && newName !== 'Nova' && typeof state.checkAndAwardTask === 'function') {
      state.checkAndAwardTask('name_pet').catch(err => {
        console.warn('[PetSlice] Failed to award points for naming pet:', err);
      });
    }
  },

  addPetPoints: async (amount: number) => {
    const { authUser } = get();
    const state = get();

    // Clamp to prevent negative points (per spec Section 9: Negative Points Protection)
    const newPoints = Math.max(0, state.petState.points + amount);

    // Calculate stage from total points (fixed 100 points per stage)
    // Stage 1: 0-100, Stage 2: 100-200, Stage 3: 200-300, etc.
    const newStage = Math.floor(newPoints / 100) + 1;
    const oldStage = Math.floor(state.petState.points / 100) + 1;

    const newPetState: PetState = {
      ...state.petState,
      points: newPoints,
      stage: newStage,
      // Set mood to happy if stage increased
      mood: newStage > oldStage ? 'happy' : state.petState.mood,
    };

    // Update local state
    set({ petState: newPetState });

    // Persist to database
    if (authUser) {
      try {
        await petService.savePetState(authUser.id, newPetState);
      } catch (error) {
        console.error('Error persisting pet points:', error);
      }
    }
  },

  loadPetState: async () => {
    const { authUser } = get();
    if (!authUser) return;

    try {
      const petState = await petService.loadPetState(authUser.id);

      if (petState) {
        set({
          petState,
          petStateReady: true,
          petStateSyncedAt: Date.now(),
          petStateUserId: authUser.id,
          cachedPetState: petState,
          cachedPetSyncedAt: Date.now(),
          cachedPetUserId: authUser.id,
        });
      } else {
        // No pet state exists, create default one
        const defaultPetState = {
          stage: 1,
          points: 0,
          name: 'Nova',
          mood: 'happy' as const,
        };

        try {
          await petService.savePetState(authUser.id, defaultPetState);
          set({
            petState: defaultPetState,
            petStateReady: true,
            petStateSyncedAt: Date.now(),
            petStateUserId: authUser.id,
            cachedPetState: defaultPetState,
            cachedPetSyncedAt: Date.now(),
            cachedPetUserId: authUser.id,
          });
        } catch (error) {
          console.error('Error creating initial pet state:', error);
          // Fallback: set default state even if save failed
          set({
            petState: defaultPetState,
            petStateReady: true,
            petStateSyncedAt: Date.now(),
            petStateUserId: authUser.id,
            cachedPetState: defaultPetState,
            cachedPetSyncedAt: Date.now(),
            cachedPetUserId: authUser.id,
          });
        }
      }
    } catch (error) {
      console.error('Error loading pet state:', error);
    }
  },

  hydratePetStateFromCache: () => {
    const { authUser, cachedPetState, cachedPetUserId, cachedPetSyncedAt } = get();
    if (!authUser) return;
    if (cachedPetState && cachedPetUserId === authUser.id) {
      set({
        petState: cachedPetState,
        petStateReady: true,
        petStateSyncedAt: cachedPetSyncedAt ?? null,
        petStateUserId: cachedPetUserId,
      });
    }
  },

  resetPetState: () => {
    // Reset active UI state to defaults
    // BUT preserve cache and cachedUserId so we can hydrate instantly on login
    // NOTE: This does NOT call savePetState to the database, so it won't overwrite 
    // unless a subsequent setPetState or addPetPoints is called before loading.
    set({
      petState: {
        stage: 1,
        points: 0,
        name: 'Nova',
        mood: 'happy',
      },
      petStateReady: false,
      petStateSyncedAt: null,
      petStateUserId: null,
      // We explicitly DO NOT clear cachedPetState here
      // It acts as a persistent cache for the last known state of this device's users
    });
  },

  clearPetCache: () => {
    set({
      cachedPetState: undefined,
      cachedPetSyncedAt: null,
      cachedPetUserId: null,
    });
  },
});
