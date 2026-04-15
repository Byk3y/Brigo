/**
 * InAppNotification - Global iOS-style compact notification banner
 * Slides down from top, handles multiple notification types
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useStore } from '@/lib/store';
import type { NotificationType } from '@/lib/store/slices/notificationSlice';

const AUTO_DISMISS_DELAY = 6000; // 6 seconds
const SWIPE_THRESHOLD = 40; // Minimum swipe distance to trigger dismiss

export const InAppNotification: React.FC = () => {
    const router = useRouter();
    const { notification, dismissNotification } = useStore();

    const slideAnim = useRef(new Animated.Value(-150)).current; // Start above screen
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const panY = useRef(new Animated.Value(0)).current;
    const autoDismissTimer = useRef<NodeJS.Timeout | null>(null);

    const isVisible = !!notification;

    const handleDismiss = useCallback(() => {
        if (autoDismissTimer.current) {
            clearTimeout(autoDismissTimer.current);
            autoDismissTimer.current = null;
        }

        // Slide up animation before actually clearing the state
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: -150,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
        ]).start(() => {
            dismissNotification();
        });
    }, [dismissNotification]);

    // Handle visibility changes
    useEffect(() => {
        if (isVisible) {
            // Reset position if it was changed by panned
            panY.setValue(0);

            // Slide down and fade in
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 65,
                    friction: 11,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 350,
                    useNativeDriver: true,
                }),
            ]).start();

            // Set auto-dismiss timer
            autoDismissTimer.current = setTimeout(() => {
                handleDismiss();
            }, AUTO_DISMISS_DELAY);
        }

        return () => {
            if (autoDismissTimer.current) {
                clearTimeout(autoDismissTimer.current);
            }
        };
    }, [isVisible, handleDismiss]);

    const handleTap = () => {
        if (!notification) return;

        const { type, data } = notification;

        // Fast dismiss
        handleDismiss();

        // Navigate based on type
        if (type === 'flashcards' && data?.notebookId) {
            router.push({
                pathname: '/flashcards/[id]',
                params: { id: data.notebookId, setId: data.setId }
            });
        } else if (type === 'audio' && data?.overviewId) {
            router.push(`/audio-player/${data.overviewId}`);
        } else if (type === 'quiz' && data?.quizId) {
            router.push(`/quiz/${data.quizId}`);
        } else if (type === 'prediction' && data?.predictionId) {
            router.push(`/predictions/${data.predictionId}`);
        }
    };

    // PanResponder for swipe-to-dismiss (upwards)
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dy) > 10;
            },
            onPanResponderMove: (_, gestureState) => {
                // Only allow upward movement or small downward bounce
                if (gestureState.dy < 10) {
                    panY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy < -SWIPE_THRESHOLD || gestureState.vy < -0.5) {
                    handleDismiss();
                } else {
                    // Snap back
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

    if (!isVisible) return null;

    // Type-specific UI config
    const getConfig = (type: NotificationType) => {
        switch (type) {
            case 'flashcards':
                return { icon: 'albums', color: '#3b82f6', label: 'Flashcards Ready' };
            case 'audio':
                return { icon: 'headset', color: '#6366f1', label: 'Podcast Ready' };
            case 'quiz':
                return { icon: 'help-circle', color: '#0891b2', label: 'Quiz Ready' };
            case 'prediction':
                return { icon: 'bulb', color: '#9333ea', label: 'Predictions Ready' };
            case 'success':
                return { icon: 'checkmark-circle', color: '#22c55e', label: 'Success' };
            case 'streak':
                return { icon: 'flame', color: '#FF5F06', label: 'Streak' };
            case 'warning':
                return { icon: 'alert-circle', color: '#F59E0B', label: 'Warning' };
            case 'offline':
                return { icon: 'cloud-offline', color: '#EF4444', label: 'Offline' };
            case 'info':
                return { icon: 'information-circle', color: '#6366f1', label: 'Info' };
            default:
                return { icon: 'notifications', color: '#94a3b8', label: 'Notification' };
        }
    };

    const config = getConfig(notification.type);

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [
                        { translateY: Animated.add(slideAnim, panY) }
                    ],
                    opacity: opacityAnim,
                },
            ]}
            pointerEvents="box-none"
        >
            <SafeAreaView edges={['top']} style={styles.safeArea}>
                <Animated.View
                    style={styles.notification}
                    {...panResponder.panHandlers}
                >
                    <TouchableOpacity
                        onPress={handleTap}
                        activeOpacity={0.9}
                        style={styles.touchableContent}
                    >
                        <View style={styles.content}>
                            <View style={[styles.iconContainer, { backgroundColor: `${config.color}20` }]}>
                                <Ionicons name={config.icon as any} size={20} color={config.color} />
                            </View>
                            <View style={styles.textContainer}>
                                <Text style={styles.title}>{notification.title || config.label}</Text>
                                <Text style={styles.message} numberOfLines={1}>
                                    {notification.message}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                        </View>
                    </TouchableOpacity>
                </Animated.View>
            </SafeAreaView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
    },
    safeArea: {
        paddingHorizontal: 12,
        paddingTop: 8,
    },
    notification: {
        backgroundColor: 'rgba(24, 24, 27, 0.95)', // Glass effect base
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 20,
        overflow: 'hidden',
    },
    touchableContent: {
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: '800',
        color: '#ffffff',
        marginBottom: 1,
        letterSpacing: -0.3,
    },
    message: {
        fontSize: 13.5,
        color: '#d4d4d8',
        opacity: 0.9,
    },
});
