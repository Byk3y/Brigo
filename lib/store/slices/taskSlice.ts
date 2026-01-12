/**
 * Task slice - Task management and tracking
 * 
 * Enhanced to support:
 * - Foundational tasks (one-time onboarding tasks)
 * - Timezone from profiles table with device fallback
 * - Server-side validated task completion
 */

import type { StateCreator } from 'zustand';
import { taskService } from '@/lib/services/taskService';
import { userService } from '@/lib/services/userService';
import { track } from '@/lib/services/analyticsService';
import type { SupabaseUser, DailyTask, TaskProgress } from '../types';

// Type definition for award_task_points RPC response
interface AwardTaskPointsResponse {
    success: boolean;
    already_completed?: boolean;
    points_awarded?: number;
    new_total_points?: number;
    new_stage?: number;
    error?: string;
    error_code?: string;
    task_key?: string;
}

// Type guard for validating RPC response shape
function isValidAwardResponse(data: unknown): data is AwardTaskPointsResponse {
    return (
        typeof data === 'object' &&
        data !== null &&
        'success' in data &&
        typeof (data as AwardTaskPointsResponse).success === 'boolean'
    );
}

export interface TaskSlice {
    dailyTasks: DailyTask[];
    foundationalTasks: DailyTask[];
    taskProgress: Record<string, TaskProgress>;
    isLoadingTasks: boolean;
    userTimezone: string;

    // Actions
    loadDailyTasks: () => Promise<void>;
    loadFoundationalTasks: () => Promise<void>;
    refreshTaskProgress: (taskKey: string) => Promise<void>;
    checkAndAwardTask: (taskKey: string, suppressError?: boolean) => Promise<{ success: boolean; newPoints?: number; error?: string }>;
    getUserTimezone: () => Promise<string>;
}

export const createTaskSlice: StateCreator<
    TaskSlice & { authUser: SupabaseUser | null; addPetPoints: (amount: number) => void },
    [],
    [],
    TaskSlice
> = (set, get) => ({
    dailyTasks: [],
    foundationalTasks: [],
    taskProgress: {},
    isLoadingTasks: false,
    userTimezone: 'UTC',

    /**
     * Get user's timezone from profiles table, with device fallback
     * Per spec: Use profiles.timezone (IANA string), fallback to device timezone
     */
    getUserTimezone: async () => {
        const { authUser } = get();
        if (!authUser) {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        }

        try {
            // Try to get timezone from profiles table
            const timezone = await userService.getUserTimezone(authUser.id);

            if (timezone) {
                set({ userTimezone: timezone });
                return timezone;
            }
        } catch (e) {
            console.log('[TaskSlice] Could not fetch profile timezone, using device timezone');
        }

        // Fallback to device timezone
        const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        set({ userTimezone: deviceTimezone });
        return deviceTimezone;
    },

    loadDailyTasks: async () => {
        const { authUser, getUserTimezone, isLoadingTasks } = get();
        if (!authUser || isLoadingTasks) return;

        set({ isLoadingTasks: true });
        try {
            // Get timezone (from profile or device fallback)
            const timezone = await getUserTimezone();

            const tasks = await taskService.getDailyTasks(authUser.id, timezone);

            set({ dailyTasks: tasks });

            // After loading tasks, fetch progress for any incomplete progressive tasks
            const progressiveTasks = tasks.filter(
                (t: DailyTask) =>
                    !t.completed &&
                    [
                        'study_flashcards',
                        'quiz_5_questions',
                        'podcast_3_min',
                        'quiz_perfect_score',
                        'add_material_daily',
                        'audio_feedback_given',
                        'study_early_bird'
                    ].includes(t.task_key)
            );

            // Load progress in parallel
            await Promise.all(progressiveTasks.map((t: DailyTask) => get().refreshTaskProgress(t.task_key)));

        } catch (error) {
            console.error('Failed to load daily tasks:', error);
        } finally {
            set({ isLoadingTasks: false });
        }
    },

    /**
     * Load all foundational tasks (completed and incomplete)
     * These are one-time onboarding tasks that remain visible when completed (with checkmark)
     * This provides user validation and shows progress
     */
    loadFoundationalTasks: async () => {
        const { authUser } = get();
        if (!authUser) return;

        try {
            const tasks = await taskService.getFoundationalTasks(authUser.id);
            set({ foundationalTasks: tasks });

            // Recovery logic: Auto-award foundational tasks if user already has data
            // This handles cases where tasks weren't awarded during the initial action
            const anyIncomplete = tasks.some(t => !t.completed);
            if (!anyIncomplete) return;

            // Use 'any' cast to access other slices in the combined store
            const store = get() as any;
            const notebooks = store.notebooks || [];

            // 1. Create Notebook Recovery
            const createNotebookTask = tasks.find((t: any) => t.task_key === 'create_notebook');
            if (createNotebookTask && !createNotebookTask.completed && notebooks.length > 0) {
                get().checkAndAwardTask('create_notebook', true);
            }


            // 3. Generate Audio Recovery
            const generateAudioTask = tasks.find((t: any) => t.task_key === 'generate_audio_overview');
            // Check if any material has been processed into audio (usually stored in audio_overviews table or meta)
            // For now, simpler check: if task is incomplete, we just try to award it once if service allows
            if (generateAudioTask && !generateAudioTask.completed) {
                // The award_task_points RPC has server-side validation, so this is safe
                get().checkAndAwardTask('generate_audio_overview', true);
            }

            // 4. First Chat Recovery
            const firstChatTask = tasks.find((t: any) => t.task_key === 'first_notebook_chat');
            const hasChat = notebooks.some((n: any) => n.chat_messages && n.chat_messages.length > 0);
            if (firstChatTask && !firstChatTask.completed && hasChat) {
                get().checkAndAwardTask('first_notebook_chat', true);
            }

        } catch (error) {
            console.error('Failed to load foundational tasks:', error);
        }
    },

    refreshTaskProgress: async (taskKey: string) => {
        const { authUser, getUserTimezone } = get();
        if (!authUser) return;

        try {
            const timezone = await getUserTimezone();
            const progress = await taskService.getTaskProgress(authUser.id, taskKey, timezone);

            set((state) => ({
                taskProgress: {
                    ...state.taskProgress,
                    [taskKey]: progress
                }
            }));
        } catch (error) {
            console.error(`Failed to refresh progress for ${taskKey}:`, error);
        }
    },

    checkAndAwardTask: async (taskKey: string, suppressError = false) => {
        const { authUser, addPetPoints, loadDailyTasks, loadFoundationalTasks, getUserTimezone } = get();
        if (!authUser) return { success: false, error: 'Not authenticated' };

        try {
            // Get timezone for the RPC call
            const timezone = await getUserTimezone();

            // Get local completion date (YYYY-MM-DD)
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const completionDate = `${year}-${month}-${day}`;

            // Call award_task_points via service
            const data = await taskService.awardTaskPoints(
                authUser.id,
                taskKey,
                completionDate,
                timezone
            );

            // Handle response from server-side validated RPC
            if (data.success) {
                // Update local points/stage immediately if points were awarded > 0
                if (data.points_awarded && data.points_awarded > 0) {
                    addPetPoints(data.points_awarded);

                    // Track task completion
                    track('task_completed', {
                        task_key: taskKey,
                        points_awarded: data.points_awarded,
                        new_stage: data.new_stage,
                    });
                }

                // Auto-save Pet Logic:
                // This is now handled server-side in the award_task_points RPC for robustness.
                // When any daily study task is awarded, secure_pet is auto-awarded 
                // and the streak is incremented. data.points_awarded will include 
                // both sets of points, which we already added above.

                // Refresh both task lists and the user profile (to update streak and last_streak_date)
                await Promise.all([
                    loadDailyTasks(),
                    loadFoundationalTasks(),
                    (get() as any).loadUserProfile?.()
                ]);

                return {
                    success: true,
                    newPoints: data.points_awarded ?? 0
                };
            }

            // Handle server-side validation failure
            if (data.error_code === 'CRITERIA_NOT_MET') {
                if (!suppressError) console.log(`[TaskSlice] Task ${taskKey} criteria not met (server validation)`);
                return { success: false, error: 'Criteria not met' };
            }

            // Handle already completed (idempotent success)
            if (data.already_completed) {
                return { success: true, newPoints: 0 };
            }

            return { success: false, error: data.error || 'Unknown error' };
        } catch (error) {
            if (!suppressError) {
                console.error(`Failed to award task ${taskKey}:`, error);
            }
            return { success: false, error: 'Failed to award task' };
        }
    }
});
