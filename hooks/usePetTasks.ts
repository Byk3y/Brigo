import { useEffect, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { shallow } from 'zustand/shallow';

/**
 * Hook for managing pet tasks - both daily and foundational
 * 
 * Foundational tasks: One-time onboarding tasks that remain visible when completed (with checkmark)
 * Daily tasks: Recurring tasks that reset at midnight
 */
export function usePetTasks() {
    const {
        dailyTasks,
        foundationalTasks,
        taskProgress,
        isLoadingTasks,
        loadDailyTasks,
        loadFoundationalTasks,
        checkAndAwardTask,
        refreshTaskProgress
    } = useStore(
        (state) => ({
            dailyTasks: state.dailyTasks,
            foundationalTasks: state.foundationalTasks,
            taskProgress: state.taskProgress,
            isLoadingTasks: state.isLoadingTasks,
            loadDailyTasks: state.loadDailyTasks,
            loadFoundationalTasks: state.loadFoundationalTasks,
            checkAndAwardTask: state.checkAndAwardTask,
            refreshTaskProgress: state.refreshTaskProgress
        }),
        shallow
    );

    const authUser = useStore((state) => state.authUser);

    // Load both task types when user is authenticated
    useEffect(() => {
        if (authUser) {
            loadDailyTasks();
            loadFoundationalTasks();
        }
    }, [authUser, loadDailyTasks, loadFoundationalTasks]);

    const foundationalCompleted = useMemo(
        () => foundationalTasks.length > 0 && foundationalTasks.every((t) => t.completed),
        [foundationalTasks]
    );

    // If foundational just finished, ensure daily tasks are loaded/shown
    useEffect(() => {
        if (authUser && foundationalCompleted && dailyTasks.length === 0) {
            loadDailyTasks();
        }
    }, [authUser, foundationalCompleted, dailyTasks.length, loadDailyTasks]);

    // Combined task list: Show all foundational tasks (completed and incomplete) + daily tasks
    // Foundational tasks remain visible until all are complete; once complete, we show only daily tasks
    // Priority while incomplete: foundational first (sorted by display_order), then daily tasks (if unlocked)
    // Combined task list: Strictly sequenced
    // 1. If any foundational tasks are incomplete: Show ONLY foundational tasks
    // 2. Once all foundational tasks are complete: Show ONLY daily tasks
    // Combined task list: Strictly sequenced and capped at 3
    // 1. Prioritize incomplete tasks first
    // 2. If space remains, show completed foundational tasks (for validation)
    // 3. Limit to exactly 3 tasks total
    const allTasks = useMemo(() => {
        // Sort foundational tasks: incomplete first, then by display_order
        const sortedFoundational = [...foundationalTasks].sort((a, b) => {
            if (a.completed !== b.completed) {
                return a.completed ? 1 : -1;
            }
            return (a.display_order || 999) - (b.display_order || 999);
        });

        // If foundational not yet complete, show up to 3 foundational tasks
        if (!foundationalCompleted) {
            return sortedFoundational.slice(0, 3);
        }

        // If foundational complete, show strictly up to 3 daily tasks
        return [...dailyTasks].slice(0, 3);

    }, [foundationalTasks, dailyTasks, foundationalCompleted]);

    // Derived state helper
    const getTaskStatus = (taskKey: string) => {
        // Check both daily and foundational tasks
        const task = dailyTasks.find(t => t.task_key === taskKey)
            || foundationalTasks.find(t => t.task_key === taskKey);
        const progress = taskProgress[taskKey];

        return {
            task: task,
            progress: progress,
            isCompleted: task?.completed ?? false,
            isFoundational: foundationalTasks.some(t => t.task_key === taskKey)
        };
    };

    return {
        dailyTasks,
        foundationalTasks,
        allTasks,
        taskProgress,
        isLoadingTasks,
        checkAndAwardTask,
        refreshTaskProgress,
        getTaskStatus,
        loadDailyTasks,
        loadFoundationalTasks
    };
}
