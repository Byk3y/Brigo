import { useEffect, useRef } from 'react';
import { notificationService } from '@/lib/services/notificationService';
import { useStore } from '@/lib/store';
import { useRouter } from 'expo-router';

export const usePushNotifications = () => {
    const authUser = useStore((state) => state.authUser);
    const router = useRouter();
    const cleanupRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        // Initialize listeners
        cleanupRef.current = notificationService.initListeners((data) => {
            console.log('Notification opened with data:', data);

            // Handle deep linking/navigation here based on notification data
            if (data?.type === 'friend_nudge') {
                router.push('/friends');
            } else if (data?.type === 'audio' && data?.overviewId) {
                router.push(`/audio-player/${data.overviewId}`);
            } else if (data?.type === 'quiz' && data?.quizId) {
                router.push(`/quiz/${data.quizId}`);
            } else if (data?.type === 'flashcards' && data?.notebookId) {
                router.push({
                    pathname: '/flashcards/[id]',
                    params: { id: data.notebookId, setId: data.setId },
                });
            } else if (data?.type === 'prediction' && data?.predictionId) {
                router.push(`/predictions/${data.predictionId}`);
            } else if (data?.notebookId) {
                router.push(`/notebook/${data.notebookId}`);
            } else if (data?.screen) {
                router.push(data.screen);
            }
        });

        return () => {
            if (cleanupRef.current) {
                cleanupRef.current();
            }
        };
    }, []);

    useEffect(() => {
        // Only register if user is logged in
        if (authUser?.id) {
            registerAndSaveToken(authUser.id);
        }
    }, [authUser?.id]);

    const registerAndSaveToken = async (userId: string) => {
        try {
            const token = await notificationService.registerForPushNotificationsAsync();
            if (token) {
                await notificationService.saveTokenToProfile(userId, token);
                console.log('Push token saved successfully');
            }
        } catch (error) {
            console.error('Error in registerAndSaveToken:', error);
        }
    };

    return {
        // You can expose functions to manually request permissions if needed
    };
};
