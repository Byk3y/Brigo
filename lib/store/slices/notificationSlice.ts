/**
 * Notification slice - Global in-app notification state management
 */

import type { StateCreator } from 'zustand';

export type NotificationType = 'flashcards' | 'quiz' | 'audio' | 'prediction' | 'success' | 'info' | 'warning' | 'offline';

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

export const createNotificationSlice: StateCreator<NotificationSlice> = (set) => ({
    notification: null,
    notify: (payload) => set({ notification: payload }),
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
