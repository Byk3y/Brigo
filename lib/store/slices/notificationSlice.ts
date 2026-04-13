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

export interface NotificationSlice {
    notification: NotificationPayload | null;
    notify: (payload: NotificationPayload) => void;
    dismissNotification: () => void;
}

const CONTENT_ID_KEYS = ['overviewId', 'quizId', 'setId', 'predictionId'] as const;

// Returns the first identifying content id from the data payload, for dedup.
const getContentKey = (payload: NotificationPayload): string | null => {
    const data = payload.data;
    if (!data) return null;
    for (const key of CONTENT_ID_KEYS) {
        if (data[key]) return `${payload.type}:${key}:${data[key]}`;
    }
    return null;
};

export const createNotificationSlice: StateCreator<NotificationSlice> = (set, get) => ({
    notification: null,
    notify: (payload) => {
        const current = get().notification;
        if (current) {
            const currentKey = getContentKey(current);
            const nextKey = getContentKey(payload);
            if (currentKey && nextKey && currentKey === nextKey) return;
        }
        set({ notification: payload });
    },
    dismissNotification: () => set({ notification: null }),
});

/**
 * Utility function to trigger an in-app notification from anywhere in the app
 * Can be called from non-React contexts (services, utilities, etc.)
 */
export function triggerNotification(payload: NotificationPayload): void {
    // Import dynamically to avoid circular dependency
    const { useStore } = require('@/lib/store');
    useStore.getState().notify(payload);
}
