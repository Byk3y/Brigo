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
> = (set) => ({
    // Initial state
    hasSeenHomeWalkthrough: false,
    hasSeenNotebookWalkthrough: false,
    hasSeenStudioWalkthrough: false,

    // Actions - handled by persist middleware in root store
    setHomeWalkthroughSeen: () => set({ hasSeenHomeWalkthrough: true }),
    setNotebookWalkthroughSeen: () => set({ hasSeenNotebookWalkthrough: true }),
    setStudioWalkthroughSeen: () => set({ hasSeenStudioWalkthrough: true }),

    // Redundant - kept for type compatibility but does nothing manually now
    loadWalkthroughState: async () => { },

    // Reset for testing purposes
    resetAllWalkthroughs: () => {
        set({
            hasSeenHomeWalkthrough: false,
            hasSeenNotebookWalkthrough: false,
            hasSeenStudioWalkthrough: false,
        });
    },
});
