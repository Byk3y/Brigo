import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { useStore } from '@/lib/store';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

export default function NotificationsSettingsScreen() {
    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);
    const router = useRouter();
    const { user, authUser, setUser } = useStore();

    const [isMasterEnabled, setIsMasterEnabled] = React.useState(false);
    const [studyReminders, setStudyReminders] = React.useState(true);
    const [streakAlerts, setStreakAlerts] = React.useState(true);
    const [contentUpdates, setContentUpdates] = React.useState(true);
    const [friendNudges, setFriendNudges] = React.useState(true);
    const [isUpdating, setIsUpdating] = React.useState(false);

    React.useEffect(() => {
        const checkStatus = async () => {
            const { notificationService } = await import('@/lib/services/notificationService');
            const status = await notificationService.checkRegistrationStatus();
            setIsMasterEnabled(status === 'granted');

            // Load granular preferences from profile meta if available
            if (user?.meta?.notification_settings) {
                const settings = user.meta.notification_settings;
                setStudyReminders(settings.study_reminders ?? true);
                setStreakAlerts(settings.streak_alerts ?? true);
                setContentUpdates(settings.content_updates ?? true);
                setFriendNudges(settings.friend_nudges ?? true);
            }
        };
        checkStatus();
    }, [user]);

    const saveSettings = async (newSettings: any) => {
        if (!authUser?.id) return;

        try {
            const updatedMeta = {
                ...(user?.meta || {}),
                notification_settings: {
                    ...(user?.meta?.notification_settings || {}),
                    ...newSettings
                }
            };

            // Optimistic update
            setUser({ meta: updatedMeta });

            // Fetch fresh meta from DB to avoid overwriting concurrent changes
            const { data: fresh, error: fetchError } = await supabase
                .from('profiles')
                .select('meta')
                .eq('id', authUser.id)
                .single();

            if (fetchError) throw fetchError;

            const freshMeta = (fresh?.meta as Record<string, any>) || {};
            const mergedMeta = {
                ...freshMeta,
                notification_settings: {
                    ...(freshMeta.notification_settings || {}),
                    ...newSettings
                }
            };

            const { error } = await supabase
                .from('profiles')
                .update({ meta: mergedMeta })
                .eq('id', authUser.id);

            if (error) throw error;
        } catch (error) {
            console.error('Failed to save notification settings:', error);
        }
    };

    const handleMasterToggle = async () => {
        setIsUpdating(true);
        const { notificationService } = await import('@/lib/services/notificationService');

        if (isMasterEnabled) {
            try {
                if (user?.id) {
                    // Optimistic update
                    setUser({ expo_push_token: undefined });

                    await supabase
                        .from('profiles')
                        .update({ expo_push_token: null })
                        .eq('id', user.id);

                    setIsMasterEnabled(false);
                    Alert.alert('Notifications Disabled', 'You will no longer receive push notifications.');
                }
            } catch (error) {
                Alert.alert('Error', 'Failed to update notification settings.');
            }
            setIsUpdating(false);
            return;
        }

        try {
            // Check current permission status first
            const currentStatus = await notificationService.checkRegistrationStatus();

            // If previously denied, prompt user to open Settings
            if (currentStatus === 'denied') {
                Alert.alert(
                    'Notifications Blocked',
                    'You previously denied notification permissions. To enable notifications, please go to your device Settings.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Open Settings',
                            onPress: () => Linking.openSettings()
                        }
                    ]
                );
                setIsUpdating(false);
                return;
            }

            const token = await notificationService.registerForPushNotificationsAsync(true);
            if (token && user?.id) {
                // Optimistic update
                setUser({ expo_push_token: token });

                await notificationService.saveTokenToProfile(user.id, token);
                setIsMasterEnabled(true);
            } else {
                // User declined the permission prompt
                Alert.alert(
                    'Notifications Not Enabled',
                    'You can enable notifications anytime from Settings.',
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            console.error('Failed to enable notifications:', error);
        } finally {
            setIsUpdating(false);
        }
    };

    const OptionRow = ({ label, description, value, onValueChange, icon, disabled }: any) => (
        <View style={[styles.optionCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: disabled ? 0.5 : 1 }]}>
            <View style={styles.optionLeft}>
                <View style={[styles.iconWrapper, { backgroundColor: colors.surfaceAlt }]}>
                    <Ionicons name={icon} size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, { color: colors.text }]}>{label}</Text>
                    <Text style={[styles.optionDesc, { color: colors.textMuted }]}>{description}</Text>
                </View>
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                disabled={disabled || isUpdating}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : (value ? colors.primary : '#f4f3f4')}
            />
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>MASTER CONTROL</Text>
                <OptionRow
                    label="Push Notifications"
                    description="Enable or disable all notifications"
                    value={isMasterEnabled}
                    onValueChange={handleMasterToggle}
                    icon="notifications"
                />

                <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: 32 }]}>ALERTS & REMINDERS</Text>
                <View style={styles.optionsList}>
                    <OptionRow
                        label="Daily Reminders"
                        description="Stay consistent with study prompts"
                        value={studyReminders}
                        onValueChange={(val: boolean) => {
                            setStudyReminders(val);
                            saveSettings({ study_reminders: val });
                        }}
                        icon="calendar-clear"
                        disabled={!isMasterEnabled}
                    />
                    <OptionRow
                        label="Streak Protection"
                        description="Alerts when your streak is at risk"
                        value={streakAlerts}
                        onValueChange={(val: boolean) => {
                            setStreakAlerts(val);
                            saveSettings({ streak_alerts: val });
                        }}
                        icon="flame"
                        disabled={!isMasterEnabled}
                    />
                    <OptionRow
                        label="Study Updates"
                        description="When new podcasts or sets are ready"
                        value={contentUpdates}
                        onValueChange={(val: boolean) => {
                            setContentUpdates(val);
                            saveSettings({ content_updates: val });
                        }}
                        icon="sparkles"
                        disabled={!isMasterEnabled}
                    />
                </View>

                <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: 32 }]}>STUDY PALS</Text>
                <View style={styles.optionsList}>
                    <OptionRow
                        label="Friend Nudges"
                        description="When a pal reminds you to study"
                        value={friendNudges}
                        onValueChange={(val: boolean) => {
                            setFriendNudges(val);
                            saveSettings({ friend_nudges: val });
                        }}
                        icon="notifications"
                        disabled={!isMasterEnabled}
                    />
                    {/* Friend Activity — toggle is saved but currently unused.
                        Will be wired up for shared streak milestones in a future update. */}
                </View>

                <View style={[styles.infoBox, { backgroundColor: colors.surfaceAlt, marginTop: 40 }]}>
                    <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                        We only send notifications that help you reach your study goals. No spam, ever.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 20,
        fontFamily: 'Nunito-Bold',
    },
    scrollContent: {
        padding: 24,
    },
    sectionTitle: {
        fontSize: 12,
        fontFamily: 'Nunito-Bold',
        letterSpacing: 1.2,
        marginBottom: 16,
        marginLeft: 4,
    },
    optionsList: {
        gap: 12,
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 12,
    },
    optionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        flex: 1,
    },
    iconWrapper: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    optionLabel: {
        fontSize: 16,
        fontFamily: 'Nunito-Bold',
    },
    optionDesc: {
        fontSize: 12,
        fontFamily: 'Nunito-Medium',
        marginTop: 2,
    },
    infoBox: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        fontFamily: 'Nunito-Medium',
        lineHeight: 18,
    },
});
