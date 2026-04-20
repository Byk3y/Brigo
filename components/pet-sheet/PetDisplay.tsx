/**
 * Pet Display - Streak counter and animated pet emoji
 */

import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { MotiViewCompat as MotiView } from '@/components/MotiViewCompat';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/ThemeContext';
import type { FriendStreak } from '@/lib/services/friendService';
import { BrigoAvatar } from '@/components/BrigoAvatar';
import { ResponsiveContainer } from '@/lib/components/ResponsiveContainer';

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
    friends?: FriendStreak[];
    onFriendsPress?: () => void;
    userAvatar?: string | null;
    userId?: string;
    /** Color of the sheet background behind the avatars — used as the
     *  outer ring on the overlapping avatar to create the "bite" cutout. */
    seamColor?: string;
}

/**
 * FieryStreakNumber - Memoized sub-component to handle heavy fire animations
 * isolated from the pet's mounting logic.
 */
const StreakNumber = memo(({ streak, isDying, textColor }: { streak: number, isDying: boolean, textColor: string }) => {
    return (
        <Text
            style={[
                styles.streakValue,
                { color: isDying ? '#9CA3AF' : textColor }
            ]}
            adjustsFontSizeToFit
            numberOfLines={1}
        >
            {streak}
        </Text>
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
    showBalance = false,
    friends = [],
    onFriendsPress,
    userAvatar,
    userId,
    seamColor,
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
            {/* zIndex + elevation lift the whole streak row (incl. Study Pals
                Pressable) above petCharacterContainer so Android hit-testing
                can't route taps into the pet views rendered below. */}
            <ResponsiveContainer maxWidth={560} style={{ zIndex: 2, elevation: 2 }}>
                <View
                    style={styles.streakContainer}
                    accessibilityLabel={`Your current streak is ${streak} days`}
                    accessibilityRole="text"
                >
                    <View style={styles.labelRow}>
                        <Text style={[styles.streakLabel, { color: textSecondaryOnGradient }]}>
                            {streak === 0 && (canRestore || freezes === 0) ? 'Streak lost' : 'Streak days'}
                        </Text>
                        <Text style={[styles.streakLabel, { color: textSecondaryOnGradient }]}>
                            Study Pals
                        </Text>
                    </View>

                    <View style={styles.streakRow}>
                        <StreakNumber streak={streak} isDying={Boolean(isDying)} textColor={textSecondaryOnGradient} />

                        {/* Avatars — user's own + study pal (or invite placeholder).
                            Pressable handles the tap + opacity only; layout lives on the
                            inner View so iOS doesn't misinterpret the function-style and
                            collapse the row into a vertical stack. */}
                        <Pressable
                            onPress={onFriendsPress}
                            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                        >
                            <View style={styles.friendAvatarsContainer}>
                                {/* User's own avatar — always visible */}
                                <BrigoAvatar
                                    identifier={userAvatar || userId}
                                    size={styles.friendAvatar.width as number}
                                    containerStyle={styles.friendAvatar}
                                />

                                {/* Second circle: study pal or "+" invite.
                                    Border color matches the sheet background (seamColor)
                                    so the overlap "eats" a clean arc out of the first
                                    avatar, instead of both white borders fusing. */}
                                {friends.length > 0 ? (
                                    <>
                                        <BrigoAvatar
                                            identifier={friends[0].friend.avatar_url || friends[0].friend.id}
                                            size={styles.friendAvatar.width as number}
                                            containerStyle={{
                                                ...styles.friendAvatar,
                                                borderColor: seamColor ?? styles.friendAvatar.borderColor,
                                                marginLeft: -14,
                                            }}
                                        />
                                        {friends.length > 1 && (
                                            <View style={[styles.friendAvatarMore, { borderColor: seamColor ?? styles.friendAvatarMore.borderColor, marginLeft: -14 }]}>
                                                <Text style={styles.friendAvatarMoreText}>+{friends.length - 1}</Text>
                                            </View>
                                        )}
                                    </>
                                ) : (
                                    <View style={[
                                        styles.addPalCircle,
                                        {
                                            backgroundColor: isDarkMode ? '#3B3B4F' : '#E5E7EB',
                                            borderColor: seamColor ?? styles.addPalCircle.borderColor,
                                            marginLeft: -14,
                                        },
                                    ]}>
                                        <Ionicons name="add" size={22} color={isDarkMode ? 'rgba(255,255,255,0.6)' : '#9CA3AF'} />
                                    </View>
                                )}
                            </View>
                        </Pressable>
                    </View>
                </View>
            </ResponsiveContainer>

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
                    <View
                        style={[styles.imageWrapper, styles.absoluteWrapper, { opacity: stage === 1 ? 1 : 0 }]}
                        pointerEvents={stage === 1 ? 'auto' : 'none'}
                    >
                        <Image
                            source={(isDying && currentStage === 1) ? STAGE_1_DYING : STAGE_1_FULL}
                            style={{
                                width: (isDying && currentStage === 1) ? 280 : 250,
                                height: (isDying && currentStage === 1) ? 280 : 250
                            }}
                            contentFit="contain"
                            transition={0}
                        />
                    </View>

                    {/* Stage 2 Render */}
                    <View
                        style={[
                            styles.imageWrapper,
                            styles.absoluteWrapper,
                            { opacity: stage === 2 ? 1 : 0 }
                        ]}
                        pointerEvents={stage === 2 ? 'auto' : 'none'}
                    >
                        <Image
                            source={stage2Source}
                            style={{
                                width: isUnlocked ? ((isDying && currentStage === 2) ? 260 : 340) : 280,
                                height: isUnlocked ? ((isDying && currentStage === 2) ? 260 : 340) : 280
                            }}
                            contentFit="contain"
                            transition={0}
                        />
                    </View>

                    {/* Stage 3 Render */}
                    <View
                        style={[
                            styles.imageWrapper,
                            styles.absoluteWrapper,
                            { opacity: stage === 3 ? 1 : 0 }
                        ]}
                        pointerEvents={stage === 3 ? 'auto' : 'none'}
                    >
                        <Image
                            source={stage3Source}
                            style={{
                                width: isUnlocked ? ((isDying && currentStage === 3) ? 280 : 300) : 280,
                                height: isUnlocked ? ((isDying && currentStage === 3) ? 280 : 300) : 280
                            }}
                            contentFit="contain"
                            transition={0}
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
        paddingTop: 10,
        paddingBottom: 4,
        marginBottom: 2,
        position: 'relative',
    },
    streakContainer: {
        marginBottom: 0,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 0,
    },
    streakLabel: {
        fontSize: 15,
        fontWeight: '500',
    },
    streakValue: {
        fontSize: 56,
        fontFamily: 'Nunito-Bold',
        letterSpacing: -2,
        lineHeight: 62,
        marginTop: 4,
    },
    streakRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    friendAvatarsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    friendAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 3,
        borderColor: 'white',
        backgroundColor: '#E5E7EB',
    },
    friendAvatarMore: {
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 3,
        borderColor: 'white',
        backgroundColor: '#9CA3AF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    friendAvatarMoreText: {
        fontSize: 16,
        fontWeight: '700',
        color: 'white',
    },
    addPalCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 3,
        borderColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
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
