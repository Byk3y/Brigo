import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useStore } from '@/lib/store';
import { WidgetBridge, buildWidgetData, shouldUpdateWidget } from '@/lib/widget';
import { getLocalDateString } from '@/lib/utils/time';

/**
 * Hook to automatically synchronize app state with the iOS Widget
 * Listens for changes in the store and updates the widget bridge
 */
export function useWidgetSync() {
    const isUpdating = useRef(false);

    // Select only what we need to minimize re-renders
    const user = useStore(state => state.user);
    const petState = useStore(state => state.petState);
    const dailyTasks = useStore(state => state.dailyTasks);
    const notebooks = useStore(state => state.notebooks);
    const playbackPositions = useStore(state => state.playbackPositions);
    const authUser = useStore(state => state.authUser);
    const _hasHydrated = useStore(state => state._hasHydrated);

    useEffect(() => {
        // Only run on iOS and once hydration is complete
        if (Platform.OS !== 'ios' || !_hasHydrated || !authUser) {
            return;
        }

        const performSync = async () => {
            // Prevent concurrent updates
            if (isUpdating.current) return;
            isUpdating.current = true;

            try {
                if (!WidgetBridge.isAvailable) {
                    if (__DEV__) console.log('[WidgetSync] Widget not available, skipping sync');
                    return;
                }

                const today = getLocalDateString();
                const secureTask = dailyTasks?.find(t => t.task_key === 'secure_pet');
                const isSecuredToday = !!secureTask?.completed;

                // 🧠 Smart Activity Selection
                // Rank notebooks by last studied
                const sortedNotebooks = [...notebooks].sort((a, b) => {
                    const dateA = a.lastStudied ? new Date(a.lastStudied).getTime() : 0;
                    const dateB = b.lastStudied ? new Date(b.lastStudied).getTime() : 0;
                    return dateB - dateA;
                });

                const activeNotebook = sortedNotebooks[0];
                let suggestedActivity: any = undefined;

                if (activeNotebook) {
                    // 1. Try to find an unfinished podcast
                    const unfinishedPodcast = activeNotebook.podcasts?.find(ao => {
                        const pos = playbackPositions[ao.id];
                        return pos && pos.percentComplete < 95;
                    });

                    if (unfinishedPodcast) {
                        suggestedActivity = {
                            type: 'podcast',
                            id: unfinishedPodcast.id,
                            notebookId: activeNotebook.id,
                            title: unfinishedPodcast.title,
                        };
                    }
                    // 2. Otherwise, check for quizzes
                    else if (activeNotebook.quizzes && activeNotebook.quizzes.length > 0) {
                        const latestQuiz = activeNotebook.quizzes[0];
                        suggestedActivity = {
                            type: 'quiz',
                            id: latestQuiz.id,
                            notebookId: activeNotebook.id,
                            title: latestQuiz.title,
                        };
                    }
                    // 3. Fallback to latest podcast
                    else if (activeNotebook.podcasts && activeNotebook.podcasts.length > 0) {
                        const latestPodcast = activeNotebook.podcasts[0];
                        suggestedActivity = {
                            type: 'podcast',
                            id: latestPodcast.id,
                            notebookId: activeNotebook.id,
                            title: latestPodcast.title,
                        };
                    }
                    // 4. Ultimate fallback: The notebook itself
                    else {
                        suggestedActivity = {
                            type: 'notebook',
                            id: activeNotebook.id,
                            notebookId: activeNotebook.id,
                            title: activeNotebook.title,
                        };
                    }
                }

                // Build new data packet
                const newDataPacket = buildWidgetData({
                    streak: user.streak || 0,
                    lastStreakDate: user.last_streak_date || today,
                    securedToday: isSecuredToday,
                    lastSecureDate: isSecuredToday ? today : (secureTask?.completed_at?.split('T')[0] || today),
                    sessionsToday: dailyTasks?.filter(t => t.completed).length || 0,
                    petName: petState.name || 'Nova',
                    petStage: (petState.stage || 1) as 1 | 2 | 3,
                    suggestedActivity,
                });

                // Get old data from local storage to check if we actually need to hit the bridge
                const oldData = await WidgetBridge.getWidgetData();

                if (shouldUpdateWidget(newDataPacket, oldData)) {
                    console.log(`[WidgetSync] Updating widget: Streak ${user.streak}, Secured: ${isSecuredToday}, Activity: ${suggestedActivity?.type}`);
                    await WidgetBridge.updateWidgetData(newDataPacket);
                }
            } catch (error) {
                console.warn('[WidgetSync] Failed to sync with widget:', error);
            } finally {
                isUpdating.current = false;
            }
        };

        performSync();
    }, [
        user.streak,
        user.last_streak_date,
        petState.stage,
        petState.name,
        dailyTasks,
        notebooks,
        playbackPositions,
        authUser?.id,
        _hasHydrated
    ]);
}
