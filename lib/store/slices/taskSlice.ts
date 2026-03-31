/**
 * Task slice - Task management and tracking
 * 
 * Enhanced to support:
 * - Foundational tasks (one-time onboarding tasks)
 * - Timezone from profiles table with device fallback
 * - Event-driven activity logging and reward processing
 */

import type { StateCreator } from 'zustand';
import { taskService } from '@/lib/services/taskService';
import { podcastService } from '@/lib/services/podcastService';
import { chatService } from '@/lib/services/chatService';
import { studioService } from '@/lib/services/studioService';
import { userService } from '@/lib/services/userService';
import { track } from '@/lib/services/analyticsService';
import type { SupabaseUser, DailyTask, TaskProgress } from '../types';

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
     */
    getUserTimezone: async () => {
        const { authUser } = get();
        if (!authUser) {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        }

        try {
            const timezone = await userService.getUserTimezone(authUser.id);
            if (timezone) {
                set({ userTimezone: timezone });
                return timezone;
            }
        } catch (e) {
            console.log('[TaskSlice] Could not fetch profile timezone, using device timezone');
        }

        const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        set({ userTimezone: deviceTimezone });
        return deviceTimezone;
    },

    loadDailyTasks: async () => {
        const { authUser, getUserTimezone, isLoadingTasks } = get();
        if (!authUser || isLoadingTasks) return;

        set({ isLoadingTasks: true });
        try {
            const timezone = await getUserTimezone();
            const tasks = await taskService.getDailyTasks(authUser.id, timezone);
            set({ dailyTasks: tasks });

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

            await Promise.all(progressiveTasks.map((t: DailyTask) => get().refreshTaskProgress(t.task_key)));
        } catch (error) {
            console.error('Failed to load daily tasks:', error);
        } finally {
            set({ isLoadingTasks: false });
        }
    },

    loadFoundationalTasks: async () => {
        const { authUser } = get();
        if (!authUser) return;

        try {
            const tasks = await taskService.getFoundationalTasks(authUser.id);
            set({ foundationalTasks: tasks });

            // Recovery logic: Auto-award foundational tasks if user already has data
            const anyIncomplete = tasks.some(t => !t.completed);
            if (!anyIncomplete) return;

            const store = get() as any;
            const notebooks = store.notebooks || [];

            // 1. Create Notebook Recovery
            const createNotebookTask = tasks.find((t: any) => t.task_key === 'create_notebook');
            if (createNotebookTask && !createNotebookTask.completed && notebooks.length > 0) {
                get().checkAndAwardTask('create_notebook', true);
            }

            // 2-5: Run lightweight DB checks in parallel for remaining tasks
            const generateAudioTask = tasks.find((t: any) => t.task_key === 'generate_audio_overview');
            const firstChatTask = tasks.find((t: any) => t.task_key === 'first_notebook_chat');
            const studioFlashcardTask = tasks.find((t: any) => t.task_key === 'generate_flashcards');
            const studioQuizTask = tasks.find((t: any) => t.task_key === 'generate_quiz');

            const userId = authUser.id;
            const [hasAudio, hasChat, hasFlashcards, hasQuizzes] = await Promise.all([
                generateAudioTask && !generateAudioTask.completed ? podcastService.hasCompleted(userId) : Promise.resolve(false),
                firstChatTask && !firstChatTask.completed ? chatService.hasUserMessages(userId) : Promise.resolve(false),
                studioFlashcardTask && !studioFlashcardTask.completed ? studioService.hasUserFlashcards(userId) : Promise.resolve(false),
                studioQuizTask && !studioQuizTask.completed ? studioService.hasUserQuizzes(userId) : Promise.resolve(false),
            ]);

            // 2. Generate Audio Recovery
            if (generateAudioTask && !generateAudioTask.completed && hasAudio) {
                get().checkAndAwardTask('generate_audio_overview', true);
            }

            // 3. First Chat Recovery
            if (firstChatTask && !firstChatTask.completed && hasChat) {
                get().checkAndAwardTask('first_notebook_chat', true);
            }

            // 4. Studio Flashcard Recovery
            if (studioFlashcardTask && !studioFlashcardTask.completed && hasFlashcards) {
                get().checkAndAwardTask('generate_flashcards', true);
            }

            // 5. Studio Quiz Recovery
            if (studioQuizTask && !studioQuizTask.completed && hasQuizzes) {
                get().checkAndAwardTask('generate_quiz', true);
            }

            // 6. Name Pet Recovery (Safety check for existing users)
            const namePetTask = tasks.find((t: any) => t.task_key === 'name_pet');
            const petName = (get() as any).petState?.name;
            const hasCustomName = petName && !['Sparky', 'Nova', 'Pet', 'Brio'].includes(petName);
            if (namePetTask && !namePetTask.completed && hasCustomName) {
                get().checkAndAwardTask('name_pet', true);
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
            const timezone = await getUserTimezone();
            const now = new Date();
            const completionDate = now.toISOString().split('T')[0];

            // Use the new log_activity RPC which handles processors
            const response = await taskService.logActivity(
                taskKey,
                { timezone },
                `${taskKey}-${completionDate}-${authUser.id}`
            );

            if (response.success) {
                let totalAwarded = 0;

                // Sum up points from all triggered processors (e.g. Study + Pet Security)
                if (response.rewards?.study_rewards?.success) {
                    totalAwarded += response.rewards.study_rewards.points_awarded || 0;
                }

                if (response.rewards?.pet_security?.success) {
                    totalAwarded += response.rewards.pet_security.points_awarded || 0;
                }

                if (totalAwarded > 0) {
                    addPetPoints(totalAwarded);
                    track('task_item_completed', {
                        task_key: taskKey,
                        points_awarded: totalAwarded,
                        activity_id: response.activity_id
                    });

                    // Smart Dismissal: If a study task was completed (triggering pet security/streak),
                    // auto-dismiss the "Recover" banner as the user has now started a new streak.
                    if (response.rewards?.pet_security?.success) {
                        (get() as any).dismissStreakRestore?.();
                    }
                } else if (response.note === 'Already processed') {
                    return { success: true, newPoints: 0 };
                }

                // Sync UI with updated server state
                await Promise.all([
                    loadDailyTasks(),
                    loadFoundationalTasks(),
                    (get() as any).loadUserProfile?.()
                ]);

                return {
                    success: true,
                    newPoints: totalAwarded
                };
            }

            return { success: false, error: response.error || 'Unknown error' };
        } catch (error) {
            if (!suppressError) {
                console.error(`Failed to award task ${taskKey}:`, error);
            }
            return { success: false, error: 'Failed to award task' };
        }
    }
});
