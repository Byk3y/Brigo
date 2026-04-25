/**
 * Notification slice - Global in-app notification state management
 */

import type { StateCreator } from 'zustand';

export const GENERATION_NOTIFICATION_TYPES = ['flashcards', 'quiz', 'audio', 'prediction'] as const;
export type GenerationNotificationType = typeof GENERATION_NOTIFICATION_TYPES[number];

export type NotificationType = GenerationNotificationType | 'success' | 'info' | 'warning' | 'offline';

const GENERATION_TYPE_SET: ReadonlySet<string> = new Set(GENERATION_NOTIFICATION_TYPES);
export const isGenerationNotificationType = (t: unknown): t is GenerationNotificationType =>
    typeof t === 'string' && GENERATION_TYPE_SET.has(t);

export interface NotificationPayload {
    type: NotificationType;
    title: string;
    message: string;
    data?: any; // e.g., { notebookId: '...', setId: '...' }
}

export interface StreakBannerPayload {
    newStreak: number;
    autoFreezeApplied: boolean;
    shownAt: number;
}

type QueuedBanner =
    | { kind: 'notification'; payload: NotificationPayload }
    | { kind: 'streak'; payload: StreakBannerPayload };

export interface NotificationSlice {
    notification: NotificationPayload | null;
    notify: (payload: NotificationPayload) => void;
    dismissNotification: () => void;
    streakBanner: StreakBannerPayload | null;
    notifyStreak: (payload: Omit<StreakBannerPayload, 'shownAt'>) => void;
    dismissStreakBanner: () => void;
    bannerQueue: QueuedBanner[];
}

const CONTENT_ID_KEYS = ['overviewId', 'quizId', 'setId', 'predictionId', 'contentKey'] as const;

// Returns the first identifying content id from the data payload, for dedup.
const getContentKey = (payload: NotificationPayload): string | null => {
    const data = payload.data;
    if (!data) return null;
    for (const key of CONTENT_ID_KEYS) {
        if (data[key]) return `${payload.type}:${key}:${data[key]}`;
    }
    return null;
};

// Brief gap between one banner unmounting and the next mounting. Long enough
// for the dismiss animation to fully clear the screen and for the next banner's
// mount-time useEffect to fire fresh, short enough that the queue feels snappy.
const QUEUE_PROMOTION_DELAY_MS = 120;

export const createNotificationSlice: StateCreator<NotificationSlice> = (set, get) => {
    const promoteFromQueue = () => {
        set((state) => {
            if (state.bannerQueue.length === 0) return state;
            const [next, ...rest] = state.bannerQueue;
            if (next.kind === 'notification') {
                return { ...state, notification: next.payload, bannerQueue: rest };
            }
            return { ...state, streakBanner: next.payload, bannerQueue: rest };
        });
    };

    const scheduleDismissAdvance = () => {
        if (get().bannerQueue.length === 0) return;
        setTimeout(promoteFromQueue, QUEUE_PROMOTION_DELAY_MS);
    };

    return {
        notification: null,
        streakBanner: null,
        bannerQueue: [],

        notify: (payload) => {
            const state = get();
            const nextKey = getContentKey(payload);

            // Dedup against the currently-visible notification.
            if (state.notification && nextKey) {
                const currentKey = getContentKey(state.notification);
                if (currentKey && currentKey === nextKey) return;
            }
            // Dedup against anything already queued, so rapid duplicate fires
            // (e.g. retry loops) don't pile up multiple identical banners.
            if (nextKey && state.bannerQueue.some(
                (b) => b.kind === 'notification' && getContentKey(b.payload) === nextKey,
            )) return;

            // If any banner is currently visible, queue behind it. Otherwise
            // show immediately. This is the FIFO host that prevents the
            // streak-banner-on-top-of-task-banner stacking bug.
            if (state.notification || state.streakBanner) {
                set({ bannerQueue: [...state.bannerQueue, { kind: 'notification', payload }] });
            } else {
                set({ notification: payload });
            }
        },

        dismissNotification: () => {
            set({ notification: null });
            scheduleDismissAdvance();
        },

        notifyStreak: (payload) => {
            const state = get();
            const fullPayload: StreakBannerPayload = { ...payload, shownAt: Date.now() };

            // Dedup: same streak value already showing or queued — pet_security
            // can fire from multiple parallel task awards in one user action.
            if (state.streakBanner?.newStreak === payload.newStreak) return;
            if (state.bannerQueue.some(
                (b) => b.kind === 'streak' && b.payload.newStreak === payload.newStreak,
            )) return;

            if (state.notification || state.streakBanner) {
                set({ bannerQueue: [...state.bannerQueue, { kind: 'streak', payload: fullPayload }] });
            } else {
                set({ streakBanner: fullPayload });
            }
        },

        dismissStreakBanner: () => {
            set({ streakBanner: null });
            scheduleDismissAdvance();
        },
    };
};

/**
 * Utility function to trigger an in-app notification from anywhere in the app
 * Can be called from non-React contexts (services, utilities, etc.)
 */
export function triggerNotification(payload: NotificationPayload): void {
    // Import dynamically to avoid circular dependency
    const { useStore } = require('@/lib/store');
    useStore.getState().notify(payload);
}

export function triggerStreakBanner(payload: Omit<StreakBannerPayload, 'shownAt'>): void {
    const { useStore } = require('@/lib/store');
    useStore.getState().notifyStreak(payload);
}
