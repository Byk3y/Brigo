import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import LottieView from 'lottie-react-native';
import { useStore } from '@/lib/store';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { getLocalDateString } from '@/lib/utils/time';
import { AttachStep } from 'react-native-spotlight-tour';

const isPad = Platform.OS === 'ios' && Platform.isPad;

export const StreakCount: React.FC = () => {
    const { user, dailyTasks } = useStore();
    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);

    const streakCount = user?.streak || 0;

    // Logic to check if the streak is "At Risk" (not secured today)
    const isSecureTaskCompleted = dailyTasks?.find(t => t.task_key === 'secure_pet')?.completed;
    const today = getLocalDateString();
    const isAtRisk = streakCount > 0 && user?.last_streak_date !== today && !isSecureTaskCompleted;

    // Streak is 0 or at risk - show dimmed state
    const isDimmed = streakCount === 0 || isAtRisk;

    return (
        // @ts-ignore - Library type mismatch for children
        <AttachStep index={3}>

            <View style={styles.container}>
                <LottieView
                    source={require('../../assets/animations/fire.json')}
                    autoPlay
                    loop
                    style={[
                        styles.lottie,
                        isDimmed && { opacity: 0.3 } // Dim the flame if streak is 0 or at risk
                    ]}
                />
                <Text style={[
                    styles.text,
                    { color: isDimmed ? (isDarkMode ? '#4B5563' : '#9CA3AF') : '#FF5F06' }
                ]}>
                    {streakCount}
                </Text>
            </View>
        </AttachStep>
    );
};


const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingRight: isPad ? 12 : 6,
        paddingBottom: 2,
        marginBottom: isPad ? 6 : 4, // Nudge the entire unit up
    },
    lottie: {
        width: isPad ? 82 : 54, // Increased from 54 for iPad
        height: isPad ? 82 : 54,
        marginBottom: isPad ? -6 : -4, // Proportional to mobile
    },
    text: {
        fontSize: isPad ? 36 : 24, // Increased from 24 for iPad
        fontFamily: 'Nunito-Bold',
        marginLeft: isPad ? -18 : -12, // Proportional to mobile
        color: '#FF5F06',
        paddingBottom: isPad ? 8 : 5, // Proportional to mobile
    },
});

