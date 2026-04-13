import { useStore } from '@/lib/store';

export type NotebookActivityState = 'generating' | 'unseen' | null;

/**
 * Returns the activity state for a notebook:
 *   - 'generating' — at least one job is in flight (pulsing dot UX)
 *   - 'unseen'     — a job completed and the user hasn't opened Studio yet
 *   - null         — nothing to show
 * Active always wins over unseen.
 */
export const useNotebookActivity = (notebookId: string | null | undefined): NotebookActivityState =>
    useStore((state) => {
        if (!notebookId) return null;
        const active = state.activeStudioJobs[notebookId];
        if (active && active.length > 0) return 'generating';
        const unseen = state.unseenStudioCompletions[notebookId];
        if (unseen && unseen.length > 0) return 'unseen';
        return null;
    });

/**
 * Backwards-compatible boolean — true iff there's an active job right now.
 * Prefer useNotebookActivity for UI decisions.
 */
export const useIsNotebookGenerating = (notebookId: string | null | undefined): boolean =>
    useNotebookActivity(notebookId) === 'generating';
