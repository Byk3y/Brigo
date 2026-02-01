import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';

export function useStreakCheck() {
    const authUser = useStore((state) => state.authUser);
    const checkAndAwardTask = useStore((state) => state.checkAndAwardTask);
    const loadUserProfile = useStore((state) => state.loadUserProfile);
    const getUserTimezone = useStore((state) => state.getUserTimezone);
    const setShowStreakRestoreModal = useStore((state) => state.setShowStreakRestoreModal);
    const setPreviousStreakForRestore = useStore((state) => state.setPreviousStreakForRestore);
    const checkStreakStatus = useStore((state) => state.checkStreakStatus);
    const hasCheckedTodayRef = useRef<string | null>(null);
    const appState = useRef(AppState.currentState);

    useEffect(() => {
        if (!authUser) return;

        const checkStreak = async () => {
            const today = new Date().toISOString().split('T')[0];

            // Only skip if we already successfully checked TODAY in this session
            if (hasCheckedTodayRef.current === today) return;

            try {
                // Step 1: Check if streak was reset (missed yesterday)
                // This RPC does NOT increment the streak for today
                const result = await checkStreakStatus();

                if (result?.success) {
                    // Mark as checked for today after success
                    hasCheckedTodayRef.current = today;

                    // Reload user profile to ensure store state is fresh
                    await loadUserProfile();
                }
            } catch (error) {
                console.error('[StreakCheck] Failed to check streak status:', error);
            }
        };

        // 1. Check on mount (initial load) - run immediately
        checkStreak();

        // 2. Check on AppState change (returns from background)
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (
                appState.current.match(/inactive|background/) &&
                nextAppState === 'active'
            ) {
                // Return to foreground - trigger check
                checkStreak();
            }
            appState.current = nextAppState;
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription.remove();
        };
    }, [authUser?.id, checkAndAwardTask, loadUserProfile, getUserTimezone]);
}

