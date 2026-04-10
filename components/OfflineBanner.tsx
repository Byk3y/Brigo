/**
 * Offline Banner Component - Minimal, non-alarming indicator
 * Best Practice 2026: Show briefly, then auto-dismiss.
 * Only resurface when user attempts a network action.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetwork } from '@/lib/contexts/NetworkContext';
import { useTheme } from '@/lib/ThemeContext';

export function OfflineBanner() {
    const { isOffline } = useNetwork();
    const { isDarkMode } = useTheme();
    const insets = useSafeAreaInsets();

    const slideAnim = useRef(new Animated.Value(-100)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const [isRendered, setIsRendered] = useState(false);
    const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (dismissTimer.current) clearTimeout(dismissTimer.current);

        if (isOffline) {
            setIsRendered(true);
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 65,
                    friction: 10,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();

            // Auto-dismiss after 3 seconds — user got the message
            dismissTimer.current = setTimeout(() => {
                Animated.parallel([
                    Animated.timing(slideAnim, {
                        toValue: -100,
                        duration: 300,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacityAnim, {
                        toValue: 0,
                        duration: 300,
                        useNativeDriver: true,
                    }),
                ]).start(() => setIsRendered(false));
            }, 3000);
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: -100,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start(() => setIsRendered(false));
        }

        return () => {
            if (dismissTimer.current) clearTimeout(dismissTimer.current);
        };
    }, [isOffline, slideAnim, opacityAnim]);

    if (!isOffline && !isRendered) return null;

    const pillBg = isDarkMode
        ? 'rgba(255, 255, 255, 0.12)'
        : 'rgba(0, 0, 0, 0.06)';
    const textColor = isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)';
    const iconColor = isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.35)';

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    top: Platform.OS === 'ios' ? insets.top + 8 : 16,
                    transform: [{ translateY: slideAnim }],
                    opacity: opacityAnim,
                },
            ]}
            pointerEvents="none"
        >
            <View style={[styles.pill, { backgroundColor: pillBg }]}>
                <Ionicons name="cloud-offline-outline" size={13} color={iconColor} />
                <Text style={[styles.text, { color: textColor }]}>Offline</Text>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 9999,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    text: {
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 5,
        fontFamily: 'Outfit-Medium',
    },
});
