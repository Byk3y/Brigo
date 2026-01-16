import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { useStore } from '@/lib/store';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';

export default function AudioSettingsScreen() {
    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);
    const router = useRouter();

    const {
        audioSettings,
        setSoundEffectsEnabled,
        setHapticsEnabled,
        setVoiceVolume,
        setBackgroundPlayback
    } = useStore();

    const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
        <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {children}
            </View>
        </View>
    );

    const SettingRow = ({
        label,
        icon,
        description,
        value,
        onValueChange,
        type = 'switch'
    }: {
        label: string,
        icon: string,
        description?: string,
        value: any,
        onValueChange: (val: any) => void,
        type?: 'switch' | 'slider'
    }) => (
        <View style={[styles.row, { borderBottomColor: colors.borderLight }]}>
            <View style={styles.rowTop}>
                <View style={styles.rowLabelGroup}>
                    <View style={[styles.iconWrapper, { backgroundColor: isDarkMode ? '#3a3a3c' : '#f2f2f7' }]}>
                        <Ionicons name={icon as any} size={20} color={colors.primary} />
                    </View>
                    <View>
                        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
                        {description && <Text style={[styles.rowDesc, { color: colors.textMuted }]}>{description}</Text>}
                    </View>
                </View>
                {type === 'switch' && (
                    <Switch
                        value={value}
                        onValueChange={onValueChange}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor={Platform.OS === 'ios' ? undefined : '#fff'}
                    />
                )}
            </View>

            {type === 'slider' && (
                <View style={styles.sliderContainer}>
                    <Ionicons name="volume-low" size={16} color={colors.textMuted} />
                    <Slider
                        style={styles.slider}
                        minimumValue={0}
                        maximumValue={1}
                        value={value}
                        onSlidingComplete={onValueChange}
                        minimumTrackTintColor={colors.primary}
                        maximumTrackTintColor={colors.border}
                        thumbTintColor={Platform.OS === 'ios' ? '#fff' : colors.primary}
                    />
                    <Ionicons name="volume-high" size={16} color={colors.textMuted} />
                </View>
            )}
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Audio Settings</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Section title="GENERAL">
                    <SettingRow
                        label="Sound Effects"
                        icon="musical-notes-outline"
                        description="Pet noises and UI feedback"
                        value={audioSettings.soundEffectsEnabled}
                        onValueChange={setSoundEffectsEnabled}
                    />
                    <SettingRow
                        label="Haptic Feedback"
                        icon="vibrate-outline"
                        description="Vibrations for interactions"
                        value={audioSettings.hapticsEnabled}
                        onValueChange={setHapticsEnabled}
                    />
                    <SettingRow
                        label="Voice Volume"
                        icon="mic-outline"
                        description="Podcasts and Lessons"
                        type="slider"
                        value={audioSettings.voiceVolume}
                        onValueChange={setVoiceVolume}
                    />
                </Section>

                <Section title="PLAYBACK BEHAVIOR">
                    <SettingRow
                        label="Background Playback"
                        icon="play-circle-outline"
                        description="Keep playing when app is closed"
                        value={audioSettings.backgroundPlayback}
                        onValueChange={setBackgroundPlayback}
                    />
                </Section>

                <View style={[styles.infoBox, { backgroundColor: colors.primary + '05', borderColor: colors.primary + '20' }]}>
                    <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                        Pro Tip: Background playback allows you to listen to your AI-generated study podcasts while using other apps or when your screen is locked.
                    </Text>
                </View>

                <View style={{ height: 40 }} />
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
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 12,
        fontFamily: 'Nunito-Bold',
        letterSpacing: 1.2,
        marginBottom: 10,
        marginLeft: 4,
    },
    card: {
        borderRadius: 20,
        borderWidth: 1,
        overflow: 'hidden',
    },
    row: {
        padding: 16,
        borderBottomWidth: 1,
    },
    rowTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    rowLabelGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    iconWrapper: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rowLabel: {
        fontSize: 16,
        fontFamily: 'Nunito-Bold',
    },
    rowDesc: {
        fontSize: 12,
        fontFamily: 'Nunito-Medium',
        marginTop: 1,
    },
    sliderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        gap: 8,
    },
    slider: {
        flex: 1,
        height: 40,
    },
    infoBox: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        marginTop: 16,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        fontFamily: 'Nunito-Medium',
        lineHeight: 18,
    },
    previewContainer: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        alignItems: 'flex-start',
    },
    previewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 6,
    },
    previewButtonText: {
        fontSize: 13,
        fontFamily: 'Nunito-Bold',
    },
});
