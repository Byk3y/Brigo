/**
 * ResponsiveContainer - Tablet-optimized layout wrapper
 * 
 * Constrains content width on tablets (iPad) while remaining
 * full-width on phones. Uses maxWidth pattern which has NO
 * effect on screens smaller than the max.
 * 
 * Usage:
 * <ResponsiveContainer>
 *   <YourContent />
 * </ResponsiveContainer>
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

interface ResponsiveContainerProps {
    children: React.ReactNode;
    /** Maximum content width in pixels. Default: 500 (comfortable reading width) */
    maxWidth?: number;
    /** Additional styles to apply to the container */
    style?: ViewStyle;
    /** If true, adds horizontal padding. Default: false (use existing screen padding) */
    withPadding?: boolean;
}

/** Default max width - slightly wider than iPhone Pro Max but narrower than iPad mini */
const DEFAULT_MAX_WIDTH = 500;

export function ResponsiveContainer({
    children,
    maxWidth = DEFAULT_MAX_WIDTH,
    style,
    withPadding = false,
}: ResponsiveContainerProps) {
    return (
        <View style={[
            styles.container,
            { maxWidth },
            withPadding && styles.withPadding,
            style
        ]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        alignSelf: 'center',
    },
    withPadding: {
        paddingHorizontal: 24,
    },
});

export default ResponsiveContainer;
