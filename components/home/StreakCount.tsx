import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import { useStore } from '@/lib/store';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { getLocalDateString } from '@/lib/utils/time';
import { AttachStep } from 'react-native-spotlight-tour';

export const StreakCount: React.FC = () => {
    const { user, dailyTasks } = useStore();
    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);

    const streakCount = user?.streak || 0;

    // Logic to check if the streak is "At Risk" (not secured today)
    const isSecureTaskCompleted = dailyTasks?.find(t => t.task_key === 'secure_pet')?.completed;
    const today = getLocalDateString();
    const isAtRisk = streakCount > 0 && user?.last_streak_date !== today && !isSecureTaskCompleted;

    // Don't render anything if streak is 0 (nothing to highlight)
    if (streakCount === 0) return null;

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
                        isAtRisk && { opacity: 0.3 } // Dim the flame if you haven't studied today
                    ]}
                />
                <Text style={[
                    styles.text,
                    { color: isAtRisk ? (isDarkMode ? '#4B5563' : '#9CA3AF') : '#FF5F06' }
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
        paddingRight: 6,
        paddingBottom: 2,
        marginBottom: 4, // Nudge the entire unit up
    },
    lottie: {
        width: 54, // Increased from 44
        height: 54,
        marginBottom: -4, // Pull lower to baseline
    },
    text: {
        fontSize: 24, // Increased from 20
        fontFamily: 'Nunito-Bold',
        marginLeft: -12, // Pull tighter to the larger flame
        color: '#FF5F06',
        paddingBottom: 5, // Lowered from 8 to bring it closer to the floor
    },
});

