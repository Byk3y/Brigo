/**
 * Walkthrough Slice - Manages walkthrough/tutorial state for first-time users
 * Tracks which walkthroughs have been seen to show them only once
 */

import { StateCreator } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WALKTHROUGH_STORAGE_KEY = 'brigo_walkthrough_state';

export interface WalkthroughSlice {
    // State - tracks which walkthroughs have been completed
    hasSeenHomeWalkthrough: boolean;
    hasSeenNotebookWalkthrough: boolean;
    hasSeenStudioWalkthrough: boolean;

    // Actions
    setHomeWalkthroughSeen: () => void;
    setNotebookWalkthroughSeen: () => void;
    setStudioWalkthroughSeen: () => void;
    loadWalkthroughState: () => Promise<void>;
    resetAllWalkthroughs: () => void; // For testing
}

export const createWalkthroughSlice: StateCreator<
    WalkthroughSlice,
    [],
    [],
    WalkthroughSlice
> = (set, get) => ({
    // Initial state - all false, will be loaded from storage
    hasSeenHomeWalkthrough: false,
    hasSeenNotebookWalkthrough: false,
    hasSeenStudioWalkthrough: false,

    // Mark home walkthrough as seen and persist
    setHomeWalkthroughSeen: async () => {
        set({ hasSeenHomeWalkthrough: true });
        try {
            const current = await AsyncStorage.getItem(WALKTHROUGH_STORAGE_KEY);
            const state = current ? JSON.parse(current) : {};
            state.hasSeenHomeWalkthrough = true;
            await AsyncStorage.setItem(WALKTHROUGH_STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            console.error('Failed to persist home walkthrough state:', error);
        }
    },

    // Mark notebook walkthrough as seen and persist
    setNotebookWalkthroughSeen: async () => {
        set({ hasSeenNotebookWalkthrough: true });
        try {
            const current = await AsyncStorage.getItem(WALKTHROUGH_STORAGE_KEY);
            const state = current ? JSON.parse(current) : {};
            state.hasSeenNotebookWalkthrough = true;
            await AsyncStorage.setItem(WALKTHROUGH_STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            console.error('Failed to persist notebook walkthrough state:', error);
        }
    },

    // Mark studio walkthrough as seen and persist
    setStudioWalkthroughSeen: async () => {
        set({ hasSeenStudioWalkthrough: true });
        try {
            const current = await AsyncStorage.getItem(WALKTHROUGH_STORAGE_KEY);
            const state = current ? JSON.parse(current) : {};
            state.hasSeenStudioWalkthrough = true;
            await AsyncStorage.setItem(WALKTHROUGH_STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            console.error('Failed to persist studio walkthrough state:', error);
        }
    },

    // Load walkthrough state from storage on app start
    loadWalkthroughState: async () => {
        try {
            const stored = await AsyncStorage.getItem(WALKTHROUGH_STORAGE_KEY);
            if (stored) {
                const state = JSON.parse(stored);
                set({
                    hasSeenHomeWalkthrough: state.hasSeenHomeWalkthrough || false,
                    hasSeenNotebookWalkthrough: state.hasSeenNotebookWalkthrough || false,
                    hasSeenStudioWalkthrough: state.hasSeenStudioWalkthrough || false,
                });
            }
        } catch (error) {
            console.error('Failed to load walkthrough state:', error);
        }
    },

    // Reset for testing purposes
    resetAllWalkthroughs: async () => {
        set({
            hasSeenHomeWalkthrough: false,
            hasSeenNotebookWalkthrough: false,
            hasSeenStudioWalkthrough: false,
        });
        try {
            await AsyncStorage.removeItem(WALKTHROUGH_STORAGE_KEY);
        } catch (error) {
            console.error('Failed to reset walkthrough state:', error);
        }
    },
});
