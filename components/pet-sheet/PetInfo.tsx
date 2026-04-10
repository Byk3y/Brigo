/**
 * Pet Info - Pet name and XP progress bar
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { PetNameEditor } from './PetNameEditor';
import { useTheme } from '@/lib/ThemeContext';

interface PetInfoProps {
    name: string;
    points: number;
    onNameChange: (newName: string) => void;
}

export function PetInfo({ name, points, onNameChange }: PetInfoProps) {
    const { isDarkMode } = useTheme();

    // Calculate progress within current stage (0-100 points per stage)
    // Handle edge case: at exactly 100, 200, etc., show 100% progress
    const pointsInStage = points % 100;
    const progressPercentage = pointsInStage === 0 && points > 0
        ? 100  // At stage boundary (100, 200, etc.), show 100%
        : (pointsInStage / 100) * 100;
    const pointsToNext = pointsInStage === 0 && points > 0
        ? 0  // At stage boundary, already at next stage
        : 100 - pointsInStage;

    // At the bottom of gradient (near dark area), use light text in dark mode
    const textOnGradient = isDarkMode ? '#E0E0E0' : '#555555';

    return (
        <View style={styles.container}>
            <View style={styles.characterContainer}>
                {/* XP Progress Bar */}
                <View style={styles.xpContainer}>
                    <View style={[
                        styles.xpBarBackground,
                        { backgroundColor: 'rgba(255, 255, 255, 0.5)' }
                    ]}>
                        <MotiView
                            animate={{ width: `${progressPercentage}%` }}
                            transition={{
                                type: 'spring',
                                damping: 15,
                                stiffness: 90,
                                mass: 1,
                            } as any}
                            style={styles.xpBarFill}
                        />
                    </View>
                    <Text style={[styles.xpText, { color: textOnGradient }]}>
                        {pointsToNext} points to unlock the next look
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'transparent',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 16,
        marginBottom: 12,
    },
    characterContainer: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    xpContainer: {
        width: 256,
    },
    xpBarBackground: {
        height: 14,
        borderRadius: 7,
        overflow: 'hidden',
        marginBottom: 8,
    },
    xpBarFill: {
        height: '100%',
        backgroundColor: '#FFB300',
        borderRadius: 7,
    },
    xpText: {
        fontSize: 13,
        textAlign: 'center',
    },
});
