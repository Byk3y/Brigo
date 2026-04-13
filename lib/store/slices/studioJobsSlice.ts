/**
 * Studio jobs slice - Tracks in-flight podcast / exam-prediction jobs
 * keyed by notebookId so consumers outside StudioTab (e.g. notebook cards
 * on the home screen) can show "generation in progress" indicators.
 *
 * Source of truth is the DB; this slice is a cache fed by:
 *   - hydration on app open (loadPendingStudioJobs)
 *   - optimistic kickoff inserts (addStudioJob)
 *   - polling + Realtime completion handlers (removeStudioJob)
 *
 * Not persisted — hydration authoritative on each launch.
 */

import type { StateCreator } from 'zustand';
import { podcastService } from '@/lib/services/podcastService';
import { examPredictionService } from '@/lib/services/examPredictionService';

export type StudioJobType = 'audio' | 'prediction';

export interface ActiveStudioJob {
    id: string;
    type: StudioJobType;
    startedAt: number;
}

export interface HydratedStudioJob {
    notebookId: string;
    job: ActiveStudioJob;
}

export interface StudioJobsSlice {
    activeStudioJobs: Record<string, ActiveStudioJob[]>;
    addStudioJob: (notebookId: string, job: ActiveStudioJob) => void;
    removeStudioJob: (notebookId: string, jobId: string) => void;
    hydrateStudioJobs: (jobs: HydratedStudioJob[]) => void;
    clearStudioJobs: () => void;
    loadPendingStudioJobs: (userId: string) => Promise<void>;
}

export const createStudioJobsSlice: StateCreator<StudioJobsSlice> = (set) => ({
    activeStudioJobs: {},

    addStudioJob: (notebookId, job) =>
        set((state) => {
            const existing = state.activeStudioJobs[notebookId] || [];
            if (existing.some((j) => j.id === job.id)) return state;
            return {
                activeStudioJobs: {
                    ...state.activeStudioJobs,
                    [notebookId]: [...existing, job],
                },
            };
        }),

    removeStudioJob: (notebookId, jobId) =>
        set((state) => {
            const existing = state.activeStudioJobs[notebookId];
            if (!existing) return state;
            const filtered = existing.filter((j) => j.id !== jobId);
            if (filtered.length === existing.length) return state;
            const next = { ...state.activeStudioJobs };
            if (filtered.length === 0) {
                delete next[notebookId];
            } else {
                next[notebookId] = filtered;
            }
            return { activeStudioJobs: next };
        }),

    hydrateStudioJobs: (jobs) =>
        set(() => {
            const next: Record<string, ActiveStudioJob[]> = {};
            for (const { notebookId, job } of jobs) {
                const existing = next[notebookId] || [];
                if (!existing.some((j) => j.id === job.id)) {
                    next[notebookId] = [...existing, job];
                }
            }
            return { activeStudioJobs: next };
        }),

    clearStudioJobs: () => set({ activeStudioJobs: {} }),

    loadPendingStudioJobs: async (userId: string) => {
        try {
            const [podcasts, predictions] = await Promise.all([
                podcastService.findAllPending(userId),
                examPredictionService.findAllPending(userId),
            ]);

            const jobs: HydratedStudioJob[] = [
                ...podcasts.map((p) => ({
                    notebookId: p.notebook_id,
                    job: {
                        id: p.id,
                        type: 'audio' as const,
                        startedAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
                    },
                })),
                ...predictions.map((p) => ({
                    notebookId: p.notebook_id,
                    job: {
                        id: p.id,
                        type: 'prediction' as const,
                        startedAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
                    },
                })),
            ];

            set(() => {
                const next: Record<string, ActiveStudioJob[]> = {};
                for (const { notebookId, job } of jobs) {
                    const existing = next[notebookId] || [];
                    if (!existing.some((j) => j.id === job.id)) {
                        next[notebookId] = [...existing, job];
                    }
                }
                return { activeStudioJobs: next };
            });
        } catch (error) {
            console.error('[studioJobs] Failed to hydrate pending jobs:', error);
        }
    },
});
