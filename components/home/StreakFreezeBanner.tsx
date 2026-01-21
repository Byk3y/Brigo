/**
 * Streak Freeze Banner
 * Compact, notebook-card-style banner for streak freeze/recovery.
 * Icon on left, details in middle, action button on right.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, useTheme } from '@/lib/ThemeContext';
import { MotiViewCompat as MotiView } from '@/components/MotiViewCompat';
import { StreakFreezeIcon } from '@/components/icons/StreakFreezeIcon';

interface StreakFreezeBannerProps {
    previousStreak: number;
    freezesLeft: number;
    onFreeze: () => Promise<void>;
    onDismiss: () => void;
}

export function StreakFreezeBanner({
    previousStreak,
    freezesLeft,
    onFreeze,
    onDismiss,
}: StreakFreezeBannerProps) {
    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);
    const [isApplying, setIsApplying] = useState(false);

    const handleFreeze = async () => {
        setIsApplying(true);
        try {
            await onFreeze();
            onDismiss(); // Dismiss banner after successful freeze
        } finally {
            setIsApplying(false);
        }
    };

    // Orange background for urgency
    const bgColor = isDarkMode ? '#4a3528' : '#fff7ed';

    return (
        <MotiView
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'timing', duration: 300 }}
        >
            <View style={[styles.container, { backgroundColor: bgColor }]}>
                {/* Icon on the left with count badge */}
                <View style={styles.iconContainer}>
                    <StreakFreezeIcon size={48} />
                    <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>{freezesLeft}</Text>
                    </View>
                </View>

                {/* Content in the middle */}
                <View style={styles.content}>
                    <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                        {freezesLeft === 0
                            ? (previousStreak > 0 ? `You lost your ${previousStreak}-day streak` : 'Streak lost')
                            : (previousStreak > 0 ? `Protect your ${previousStreak}-day streak` : 'Recover your streak')}
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        {freezesLeft === 0
                            ? 'No Streak Freezes remaining'
                            : `${freezesLeft} ${freezesLeft === 1 ? 'Streak Freeze' : 'Streak Freezes'} remaining`}
                    </Text>
                </View>

                {/* Button on the right */}
                <TouchableOpacity
                    onPress={freezesLeft === 0 ? onDismiss : handleFreeze}
                    disabled={isApplying}
                    style={[
                        styles.actionButton,
                        freezesLeft === 0 && styles.actionButtonDismiss,
                        isApplying && styles.actionButtonDisabled
                    ]}
                    activeOpacity={0.7}
                >
                    {isApplying ? (
                        <ActivityIndicator size="small" color="white" />
                    ) : (
                        <Text style={styles.actionButtonText}>{freezesLeft === 0 ? 'Dismiss' : 'Use'}</Text>
                    )}
                </TouchableOpacity>
            </View>
        </MotiView>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        padding: 12,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        marginRight: 14,
        position: 'relative',
    },
    countBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#0ea5e9',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: '#fff',
    },
    countBadgeText: {
        color: 'white',
        fontSize: 11,
        fontWeight: '800',
    },
    content: {
        flex: 1,
        paddingRight: 8,
    },
    title: {
        fontSize: 15,
        fontFamily: 'Nunito-SemiBold',
        marginBottom: 2,
    },
    subtitle: {
        fontSize: 13,
        fontFamily: 'Nunito-Regular',
    },
    actionButton: {
        backgroundColor: '#0ea5e9',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        minWidth: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionButtonDisabled: {
        opacity: 0.5,
    },
    actionButtonDismiss: {
        backgroundColor: '#9CA3AF',
    },
    actionButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '700',
    },
});
