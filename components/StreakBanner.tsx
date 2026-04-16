/**
 * StreakBanner — rich top-of-screen celebration for streak increments.
 * Shows current streak number + this week's day strip with today checkmarked.
 * Fires from taskSlice.fireCompletionBanner via triggerStreakBanner().
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { View, Text, Animated, StyleSheet, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useStore } from '@/lib/store';
import { useCelebration } from '@/lib/contexts/CelebrationContext';

const AnimatedPath = Animated.createAnimatedComponent(Path);
// Path total length for M3.5 8.5 L7 11.5 L13 5 — rough sum of segment lengths.
// M→first L = sqrt(3^2+3^2) ≈ 4.24, L→second L = sqrt(6^2+6.5^2) ≈ 8.85. +slack.
const CHECK_PATH_LENGTH = 14;

const AUTO_DISMISS_DELAY = 7000;
const SWIPE_THRESHOLD = 40;
const TAP_SLOP = 6; // dx/dy below this on release is treated as a tap

// Day-of-week abbreviations, Sunday-first (JS Date.getDay() order).
const DOW_ABBREV = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

// Streak milestones — these get confetti on top of the banner.
const MILESTONE_STREAKS = [7, 30, 100, 365] as const;
// Copy for "1 day away from X" nudge.
const MILESTONE_LABELS: Record<number, string> = {
    7: 'a week',
    30: 'a month',
    100: '100',
    365: 'a year',
};

interface DayCell {
    label: string;
    daysBack: number; // 0 = today, 1 = yesterday, ..., 6 = 6 days ago
    isToday: boolean;
}

// Returns the last 7 days ending with today, labeled by weekday.
// Rolling window avoids the "Monday with a 7-day streak looks empty" bug
// that a fixed Mon–Sun calendar grid has.
function lastSevenDays(today: Date): DayCell[] {
    const cells: DayCell[] = [];
    for (let daysBack = 6; daysBack >= 0; daysBack--) {
        const d = new Date(today);
        d.setDate(today.getDate() - daysBack);
        cells.push({
            label: DOW_ABBREV[d.getDay()],
            daysBack,
            isToday: daysBack === 0,
        });
    }
    return cells;
}

function isMilestoneStreak(streak: number): boolean {
    return MILESTONE_STREAKS.includes(streak as (typeof MILESTONE_STREAKS)[number]);
}

function bannerTitle(newStreak: number, autoFreezeApplied: boolean): string {
    if (autoFreezeApplied) return 'Streak restored!';
    if (newStreak === 1) return 'New daily streak started';

    // Near-milestone nudge — exactly one day short of a milestone.
    // No "Day N" prefix — the ring already shows the streak count.
    const nextMilestoneLabel = MILESTONE_LABELS[newStreak + 1];
    if (nextMilestoneLabel) {
        return `1 day from ${nextMilestoneLabel}!`;
    }

    return `Day ${newStreak} streak`;
}

export const StreakBanner: React.FC = () => {
    const banner = useStore((s) => s.streakBanner);
    const dismissStreakBanner = useStore((s) => s.dismissStreakBanner);

    const { triggerCelebration } = useCelebration();

    const slideAnim = useRef(new Animated.Value(-200)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const panY = useRef(new Animated.Value(0)).current;
    const todayDotScale = useRef(new Animated.Value(0)).current;
    const checkDashOffset = useRef(new Animated.Value(CHECK_PATH_LENGTH)).current;
    const countAnim = useRef(new Animated.Value(0)).current;
    const [displayedCount, setDisplayedCount] = useState(0);
    const autoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Feed the animated count value back into React state so we can render it.
    useEffect(() => {
        const id = countAnim.addListener(({ value }) => {
            setDisplayedCount(Math.floor(value));
        });
        return () => countAnim.removeListener(id);
    }, [countAnim]);

    const isVisible = !!banner;

    const handleDismiss = useCallback(() => {
        if (autoDismissTimer.current) {
            clearTimeout(autoDismissTimer.current);
            autoDismissTimer.current = null;
        }
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: -200,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
        ]).start(() => {
            dismissStreakBanner();
        });
    }, [dismissStreakBanner, slideAnim, opacityAnim]);

    useEffect(() => {
        if (isVisible && banner) {
            panY.setValue(0);
            todayDotScale.setValue(0);
            checkDashOffset.setValue(CHECK_PATH_LENGTH);
            const startCount = Math.max(0, banner.newStreak - 1);
            countAnim.setValue(startCount);
            setDisplayedCount(startCount);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

            // Banner slide-in (transform + opacity → native driver OK)
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 60,
                    friction: 10,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 350,
                    useNativeDriver: true,
                }),
            ]).start();

            // Today-dot pop (transform scale → native driver)
            Animated.sequence([
                Animated.delay(350),
                Animated.spring(todayDotScale, {
                    toValue: 1,
                    tension: 140,
                    friction: 7,
                    useNativeDriver: true,
                }),
            ]).start();

            // Checkmark stroke draw-in — SVG props can't use native driver.
            Animated.sequence([
                Animated.delay(550),
                Animated.timing(checkDashOffset, {
                    toValue: 0,
                    duration: 320,
                    useNativeDriver: false,
                }),
            ]).start();

            // Streak number ticks up just the +1 step (e.g. 6 → 7), landing around
            // the same time as the checkmark — celebrates the increment, not the journey.
            Animated.sequence([
                Animated.delay(450),
                Animated.timing(countAnim, {
                    toValue: banner.newStreak,
                    duration: 350,
                    useNativeDriver: false,
                }),
            ]).start();

            const checkTickTimer = setTimeout(() => {
                Haptics.selectionAsync().catch(() => {});
            }, 550);

            // Milestone celebration — layer confetti on top once the check lands.
            let milestoneTimer: ReturnType<typeof setTimeout> | null = null;
            if (isMilestoneStreak(banner.newStreak)) {
                milestoneTimer = setTimeout(() => {
                    triggerCelebration();
                }, 900);
            }

            autoDismissTimer.current = setTimeout(() => {
                handleDismiss();
            }, AUTO_DISMISS_DELAY);

            return () => {
                clearTimeout(checkTickTimer);
                if (milestoneTimer) clearTimeout(milestoneTimer);
                if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
            };
        }

        return () => {
            if (autoDismissTimer.current) {
                clearTimeout(autoDismissTimer.current);
            }
        };
    }, [isVisible, banner?.shownAt, banner, handleDismiss, panY, slideAnim, opacityAnim, todayDotScale, checkDashOffset, countAnim, triggerCelebration]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 10,
            onPanResponderMove: (_, g) => {
                if (g.dy < 10) panY.setValue(g.dy);
            },
            onPanResponderRelease: (_, g) => {
                // Tap (no meaningful movement) → dismiss
                if (Math.abs(g.dx) < TAP_SLOP && Math.abs(g.dy) < TAP_SLOP) {
                    handleDismiss();
                    return;
                }
                if (g.dy < -SWIPE_THRESHOLD || g.vy < -0.5) {
                    handleDismiss();
                } else {
                    Animated.spring(panY, {
                        toValue: 0,
                        useNativeDriver: true,
                        tension: 50,
                        friction: 8,
                    }).start();
                }
            },
        })
    ).current;

    if (!isVisible || !banner) return null;

    const { newStreak, autoFreezeApplied } = banner;
    const today = new Date();
    const cells = lastSevenDays(today);

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [{ translateY: Animated.add(slideAnim, panY) }],
                    opacity: opacityAnim,
                },
            ]}
            pointerEvents="box-none"
        >
            <SafeAreaView edges={['top']} style={styles.safeArea}>
                <Animated.View style={styles.banner} {...panResponder.panHandlers}>
                    <Text style={styles.title} numberOfLines={1}>
                        {bannerTitle(newStreak, autoFreezeApplied)}
                    </Text>

                    <View style={styles.row}>
                        {/* Streak ring + number */}
                        <View style={styles.ringWrap}>
                            <View style={styles.ring}>
                                <Text
                                    style={[
                                        styles.ringNumber,
                                        newStreak >= 100 && styles.ringNumberCompact,
                                    ]}
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                >
                                    {displayedCount}
                                </Text>
                            </View>
                            <View style={styles.sparkle}>
                                <Ionicons name="flame" size={16} color="#FF5F06" />
                            </View>
                        </View>

                        {/* Rolling 7-day strip — today last, prior 6 days before */}
                        <View style={styles.dayStrip}>
                            {cells.map((cell, i) => {
                                const { label, daysBack, isToday } = cell;
                                const withinStreak = daysBack < newStreak;

                                if (isToday) {
                                    return (
                                        <View key={`${label}-${i}`} style={styles.dayCol}>
                                            <Text style={[styles.dayLabel, styles.dayLabelToday]}>
                                                {label}
                                            </Text>
                                            <Animated.View
                                                style={[
                                                    styles.dayDot,
                                                    styles.dayDotToday,
                                                    { transform: [{ scale: todayDotScale }] },
                                                ]}
                                            >
                                                <Svg width={CHECK_SVG_SIZE} height={CHECK_SVG_SIZE} viewBox="0 0 16 16">
                                                    <AnimatedPath
                                                        d="M3.5 8.5 L7 11.5 L13 5"
                                                        stroke="#FFFFFF"
                                                        strokeWidth={2.4}
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        fill="none"
                                                        strokeDasharray={`${CHECK_PATH_LENGTH}, ${CHECK_PATH_LENGTH}`}
                                                        strokeDashoffset={checkDashOffset as unknown as number}
                                                    />
                                                </Svg>
                                            </Animated.View>
                                        </View>
                                    );
                                }

                                return (
                                    <View key={`${label}-${i}`} style={styles.dayCol}>
                                        <Text style={styles.dayLabel}>{label}</Text>
                                        <View
                                            style={[
                                                styles.dayDot,
                                                withinStreak && styles.dayDotFilled,
                                            ]}
                                        >
                                            {withinStreak && (
                                                <Ionicons
                                                    name="checkmark"
                                                    size={18}
                                                    color="rgba(255,255,255,0.85)"
                                                />
                                            )}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                </Animated.View>
            </SafeAreaView>
        </Animated.View>
    );
};

const RING_SIZE = 56;
const DOT_SIZE = 32;
const CHECK_SVG_SIZE = 20;

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9998, // just under InAppNotification so they'd stack predictably
    },
    safeArea: {
        paddingHorizontal: 12,
        paddingTop: 8,
    },
    banner: {
        backgroundColor: 'rgba(24, 24, 27, 0.96)',
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 18,
        paddingTop: 12,
        paddingBottom: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 20,
    },
    title: {
        color: '#F5F5F4',
        fontSize: 17,
        fontFamily: 'Outfit-SemiBold',
        textAlign: 'center',
        letterSpacing: -0.3,
        marginBottom: 10,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ringWrap: {
        width: RING_SIZE,
        height: RING_SIZE,
        marginRight: 14,
        position: 'relative',
    },
    ring: {
        width: RING_SIZE,
        height: RING_SIZE,
        borderRadius: RING_SIZE / 2,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.85)',
        borderRightColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: '-30deg' }],
    },
    ringNumber: {
        color: '#FFFFFF',
        fontSize: 22,
        fontFamily: 'Outfit-Bold',
        transform: [{ rotate: '30deg' }],
    },
    ringNumberCompact: {
        fontSize: 17,
    },
    sparkle: {
        position: 'absolute',
        left: -4,
        bottom: -2,
    },
    dayStrip: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dayCol: {
        alignItems: 'center',
        flex: 1,
    },
    dayLabel: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 11,
        fontFamily: 'Outfit-SemiBold',
        marginBottom: 4,
        letterSpacing: 0.2,
    },
    dayLabelToday: {
        color: '#FFFFFF',
    },
    dayDot: {
        width: DOT_SIZE,
        height: DOT_SIZE,
        borderRadius: DOT_SIZE / 2,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayDotFilled: {
        backgroundColor: 'rgba(255, 95, 6, 0.35)',
    },
    dayDotToday: {
        backgroundColor: '#FF5F06',
    },
});
