/**
 * Pet Display - Streak counter and animated pet emoji
 */

import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ImageSourcePropType } from 'react-native';
import LottieView from 'lottie-react-native';
import { MotiViewCompat as MotiView } from '@/components/MotiViewCompat';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Easing } from 'react-native-reanimated';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { StreakFreezeIcon } from '@/components/icons/StreakFreezeIcon';

// Pet full-view images by stage - require() needs static strings
const STAGE_1_FULL = require('@/assets/pets/stage-1/full-view.png');
const STAGE_1_DYING = require('@/assets/pets/stage-1/dying.png');
const STAGE_2_FULL = require('@/assets/pets/stage-2/full-view.png');
const STAGE_2_DYING = require('@/assets/pets/stage-2/dying.png');
const STAGE_2_SILHOUETTE = require('@/assets/pets/stage-2/silhouette.png');

// Stage 3 Assets
const STAGE_3_FULL = require('@/assets/pets/stage-3/full-view.png');
const STAGE_3_SILHOUETTE = require('@/assets/pets/stage-3/silhouette.png');
const STAGE_3_DYING = require('@/assets/pets/stage-3/dying.png');

interface PetDisplayProps {
    streak: number;
    freezes?: number;
    stage: 1 | 2 | 3;
    currentStage: 1 | 2 | 3;
    onNextStage?: () => void;
    onPrevStage?: () => void;
    canRestore?: boolean;
    isDying?: boolean;
    onRestore?: () => void;
    showBalance?: boolean;
}

/**
 * FieryStreakNumber - Memoized sub-component to handle heavy fire animations
 * isolated from the pet's mounting logic.
 */
const FieryStreakNumber = memo(({ streak, isDying }: { streak: number, isDying: boolean }) => {
    return (
        <View style={styles.fieryTextContainer}>
            <LottieView
                source={require('@/assets/animations/fire.json')}
                autoPlay
                loop
                style={[
                    styles.lottieIcon,
                    isDying && { opacity: 0.3 } // Dim the fire when dying/lost
                ]}
            />
            <Text
                style={[
                    styles.streakValue,
                    { color: isDying ? '#9CA3AF' : '#FF5F06' } // Gray out the number when dying/lost
                ]}
                adjustsFontSizeToFit
                numberOfLines={1}
            >
                {streak}
            </Text>
        </View>
    );
});

export const PetDisplay = memo(({
    streak,
    freezes = 0,
    stage,
    currentStage,
    onNextStage,
    onPrevStage,
    canRestore,
    isDying,
    onRestore,
    showBalance = false
}: PetDisplayProps) => {
    const { isDarkMode } = useTheme();

    const textSecondaryOnGradient = useMemo(() =>
        isDarkMode ? '#FFFFFF' : '#333333'
        , [isDarkMode]);

    const isUnlocked = stage <= currentStage;

    const stage2Source = useMemo(() => {
        const stage2Unlocked = currentStage >= 2;
        if (!stage2Unlocked) return STAGE_2_SILHOUETTE;

        // Only show dying state if this IS the current active stage
        const activeStageDying = isDying && currentStage === 2;
        return activeStageDying ? STAGE_2_DYING : STAGE_2_FULL;
    }, [currentStage, isDying]);

    const stage3Source = useMemo(() => {
        const stage3Unlocked = currentStage >= 3;
        if (!stage3Unlocked) return STAGE_3_SILHOUETTE;

        // Show dying state if this IS the current active stage and pet is dying
        const activeStageDying = isDying && currentStage === 3;
        return activeStageDying ? STAGE_3_DYING : STAGE_3_FULL;
    }, [currentStage, isDying]);

    return (
        <View style={styles.container}>
            <View
                style={styles.streakContainer}
                accessibilityLabel={`Your current streak is ${streak} days`}
                accessibilityRole="text"
            >
                <View style={styles.labelRow}>
                    <Text style={[styles.streakLabel, { color: textSecondaryOnGradient }]}>
                        {streak === 0 && (canRestore || freezes === 0) ? 'Streak lost' : 'Streak days'}
                    </Text>

                    {/* Restore Action or Balance Badge */}
                    {canRestore ? (
                        <TouchableOpacity
                            onPress={onRestore}
                            activeOpacity={0.7}
                            style={styles.restoreButton}
                        >
                            <LinearGradient
                                colors={['#38BDF8', '#0284C7']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.restoreButtonGradient}
                            >
                                <StreakFreezeIcon size={16} />
                                <Text style={styles.restoreButtonText}>{streak === 0 ? 'Restore' : 'Protect'}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    ) : (
                        showBalance && freezes > 0 ? (
                            <MotiView
                                from={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                style={styles.restoreBadge}
                            >
                                <View style={styles.shieldBackground}>
                                    <StreakFreezeIcon size={16} />
                                    <Text style={styles.restoreCountText}>{freezes} {freezes === 1 ? 'Freeze' : 'Freezes'}</Text>
                                </View>
                            </MotiView>
                        ) : streak === 0 && freezes === 0 && (
                            <View style={styles.noRestoresBadge}>
                                <Text style={styles.noRestoresText}>0 freezes left</Text>
                            </View>
                        )
                    )}
                </View>

                <FieryStreakNumber streak={streak} isDying={Boolean(isDying)} />
            </View>

            <View style={styles.petCharacterContainer}>
                <MotiView
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{
                        type: 'timing',
                        duration: 2000,
                        loop: true,
                        repeatReverse: true,
                    }}
                    style={styles.petEmojiContainer}
                >
                    {/* Stage 1 Render - Always mounted, toggle opacity */}
                    <View style={[styles.imageWrapper, { opacity: stage === 1 ? 1 : 0 }]}>
                        <Image
                            source={(isDying && currentStage === 1) ? STAGE_1_DYING : STAGE_1_FULL}
                            style={{
                                width: (isDying && currentStage === 1) ? 280 : 250,
                                height: (isDying && currentStage === 1) ? 280 : 250
                            }}
                            resizeMode="contain"
                            fadeDuration={0}
                        />
                    </View>

                    {/* Stage 2 Render */}
                    <View
                        style={[
                            styles.imageWrapper,
                            styles.absoluteWrapper,
                            { opacity: stage === 2 ? 1 : 0 }
                        ]}
                    >
                        <Image
                            source={stage2Source}
                            style={{
                                width: isUnlocked ? ((isDying && currentStage === 2) ? 260 : 340) : 280,
                                height: isUnlocked ? ((isDying && currentStage === 2) ? 260 : 340) : 280
                            }}
                            resizeMode="contain"
                            fadeDuration={0}
                        />
                    </View>

                    {/* Stage 3 Render */}
                    <View
                        style={[
                            styles.imageWrapper,
                            styles.absoluteWrapper,
                            { opacity: stage === 3 ? 1 : 0 }
                        ]}
                    >
                        <Image
                            source={stage3Source}
                            style={{
                                width: isUnlocked ? ((isDying && currentStage === 3) ? 280 : 300) : 280,
                                height: isUnlocked ? ((isDying && currentStage === 3) ? 280 : 300) : 280
                            }}
                            resizeMode="contain"
                            fadeDuration={0}
                        />
                    </View>
                </MotiView>
            </View>

            {(stage === 1 || stage === 2) && onNextStage && (
                <TouchableOpacity
                    style={styles.navigationArrow}
                    onPress={onNextStage}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="chevron-forward" size={32} color={textSecondaryOnGradient} />
                </TouchableOpacity>
            )}

            {(stage === 2 || stage === 3) && onPrevStage && (
                <TouchableOpacity
                    style={[styles.navigationArrow, { right: undefined, left: 0 }]}
                    onPress={onPrevStage}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="chevron-back" size={32} color={textSecondaryOnGradient} />
                </TouchableOpacity>
            )}
        </View >
    );
});

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'transparent',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 8,
        marginBottom: 6,
        position: 'relative',
    },
    streakContainer: {
        marginBottom: 12,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    streakLabel: {
        fontSize: 15,
        fontWeight: '500',
    },
    restoreBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    shieldBackground: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.2)',
        gap: 4,
    },
    restoreCountText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#38BDF8',
    },
    restoreButton: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    restoreButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 6,
    },
    restoreButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '700',
    },
    noRestoresBadge: {
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    noRestoresText: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(0, 0, 0, 0.4)',
    },
    streakValue: {
        fontSize: 72,
        fontFamily: 'Nunito-Bold',
        letterSpacing: -3,
        marginLeft: -15, // Pull tight to the large flame
        paddingBottom: 0, // Lowered to the absolute baseline
    },
    fieryTextContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: 100,
        marginLeft: -15,
    },
    lottieIcon: {
        width: 100,
        height: 100,
    },
    petCharacterContainer: {
        alignItems: 'center',
        paddingVertical: 0,
        position: 'relative',
    },
    navigationArrow: {
        position: 'absolute',
        right: 0,
        top: '50%',
        marginTop: 20,
        zIndex: 10,
        padding: 8,
    },
    petEmojiContainer: {
        width: 300,
        height: 280,
        alignItems: 'center',
        justifyContent: 'center',
    },
    petImage: {
        width: '100%',
        height: '100%',
    },
    imageWrapper: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    absoluteWrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
});
