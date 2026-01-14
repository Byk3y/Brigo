/**
 * DiscoverSourcesSkeleton - Loading skeleton for discover sources screen
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';

export const DiscoverSourcesSkeleton: React.FC = () => {
    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);
    const shimmerOpacity = useSharedValue(0.4);

    useEffect(() => {
        shimmerOpacity.value = withRepeat(
            withTiming(0.8, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: shimmerOpacity.value,
    }));

    const SkeletonRow = () => (
        <View style={styles.row}>
            {/* Circular indicator */}
            <Animated.View
                style={[
                    styles.circle,
                    { backgroundColor: colors.surfaceAlt },
                    animatedStyle
                ]}
            />

            {/* Content lines */}
            <View style={styles.lines}>
                <Animated.View
                    style={[
                        styles.line,
                        { width: '80%', backgroundColor: colors.surfaceAlt },
                        animatedStyle
                    ]}
                />
                <Animated.View
                    style={[
                        styles.line,
                        { width: '60%', backgroundColor: colors.surfaceAlt, marginTop: 8 },
                        animatedStyle
                    ]}
                />
                <Animated.View
                    style={[
                        styles.line,
                        { width: '90%', backgroundColor: colors.surfaceAlt, marginTop: 8 },
                        animatedStyle
                    ]}
                />
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={[styles.listContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <SkeletonRow />
                <View style={[styles.separator, { backgroundColor: colors.border }]} />
                <SkeletonRow />
                <View style={[styles.separator, { backgroundColor: colors.border }]} />
                <SkeletonRow />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingTop: 10,
    },
    listContainer: {
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        padding: 14,
        alignItems: 'center',
    },
    circle: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    lines: {
        flex: 1,
        marginLeft: 16,
    },
    line: {
        height: 10,
        borderRadius: 5,
    },
    separator: {
        height: 1,
        marginHorizontal: 20,
    },
});
