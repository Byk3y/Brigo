import { useStore } from '@/lib/store';

/**
 * Returns true when the given notebook has at least one in-flight studio
 * generation job (podcast or exam prediction). Consumed by notebook cards
 * and the Studio tab label to drive the "generation in progress" dot.
 */
export const useIsNotebookGenerating = (notebookId: string | null | undefined): boolean =>
    useStore((state) => {
        if (!notebookId) return false;
        const jobs = state.activeStudioJobs[notebookId];
        return !!jobs && jobs.length > 0;
    });
