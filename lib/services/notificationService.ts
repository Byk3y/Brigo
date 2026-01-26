import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { handleError } from '@/lib/errors';
import * as Localization from 'expo-localization';
import Constants from 'expo-constants';

/**
 * Configure how notifications are handled when the app is foregrounded
 */
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export const notificationService = {
    /**
     * Register for push notifications and get the token
     */
    registerForPushNotificationsAsync: async (forceRequest: boolean = false): Promise<string | null> => {
        let token: string | null = null;

        if (!Device.isDevice) {
            console.log('Must use physical device for Push Notifications');
            return null;
        }

        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            // Only request if forced (e.g. from Soft Prompt)
            if (existingStatus !== 'granted' && forceRequest) {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                return null;
            }

            // Get the token
            const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

            if (!projectId) {
                throw new Error('Project ID not found in expo config');
            }

            token = (await Notifications.getExpoPushTokenAsync({
                projectId,
            })).data;

            if (Platform.OS === 'android') {
                Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                });
            }

            return token;
        } catch (error) {
            await handleError(error, {
                operation: 'register_push_notifications',
                component: 'notification-service',
            });
            return null;
        }
    },

    /**
     * Check current registration status
     */
    checkRegistrationStatus: async (): Promise<Notifications.PermissionStatus> => {
        const { status } = await Notifications.getPermissionsAsync();
        return status;
    },

    /**
     * Save the push token to the user profile
     */
    saveTokenToProfile: async (userId: string, token: string): Promise<void> => {
        try {
            const timezone = Localization.getCalendars()[0]?.timeZone || 'UTC';

            const { error } = await supabase
                .from('profiles')
                .update({
                    expo_push_token: token,
                    timezone: timezone
                })
                .eq('id', userId);

            if (error) throw error;
        } catch (error) {
            await handleError(error, {
                operation: 'save_push_token',
                component: 'notification-service',
                metadata: { userId, token },
            });
        }
    },

    /**
     * Remove the push token from the user profile
     */
    clearTokenFromProfile: async (userId: string): Promise<void> => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    expo_push_token: null
                })
                .eq('id', userId);

            if (error) throw error;
        } catch (error) {
            await handleError(error, {
                operation: 'clear_push_token',
                component: 'notification-service',
                metadata: { userId },
            });
        }
    },

    /**
     * Initialize notification listeners
     */
    initListeners: (onNotificationOpened?: (data: any) => void) => {
        // This listener is fired whenever a notification is received while the app is foregrounded
        const notificationListener = Notifications.addNotificationReceivedListener(notification => {
            console.log('Notification received:', notification);
        });

        // This listener is fired whenever a user taps on or interacts with a notification
        // (works when app is foregrounded, backgrounded, or killed)
        const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data;
            if (onNotificationOpened) {
                onNotificationOpened(data);
            }
        });

        return () => {
            notificationListener.remove();
            responseListener.remove();
        };
    }
};
