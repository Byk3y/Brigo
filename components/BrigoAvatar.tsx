/**
 * BrigoAvatar — renders a DiceBear avatar via react-native-svg so it works
 * on both iOS and Android. Android's expo-image fails silently on
 * base64-encoded SVG data URIs (the format DiceBear's toDataUri outputs),
 * which made avatars invisible on Android before this component existed.
 *
 * Accepts the same identifier shape getAvatarUrl takes:
 *   - `dicebear://<style>/<seed>`
 *   - a plain seed (falls back to the styleOverride or 'adventurer')
 *   - a legacy http(s) URL — falls through to <Image>
 */

import React from 'react';
import { Image, StyleSheet, View, ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { getAvatarSvg } from '@/lib/utils/avatarGradient';

interface BrigoAvatarProps {
    identifier: string | null | undefined;
    size: number;
    styleOverride?: 'adventurer' | 'lorelei';
    containerStyle?: ViewStyle;
}

export const BrigoAvatar: React.FC<BrigoAvatarProps> = ({
    identifier,
    size,
    styleOverride = 'adventurer',
    containerStyle,
}) => {
    // Legacy http(s) URL — render as an Image so existing stored URLs still work.
    if (identifier && identifier.startsWith('http')) {
        return (
            <Image
                source={{ uri: identifier }}
                style={[{ width: size, height: size, borderRadius: size / 2 }, containerStyle]}
            />
        );
    }

    const svg = getAvatarSvg(identifier, styleOverride);

    if (!svg) {
        return <View style={[{ width: size, height: size }, containerStyle]} />;
    }

    return (
        <View
            style={[
                { width: size, height: size, borderRadius: size / 2, overflow: 'hidden' },
                containerStyle,
            ]}
        >
            <SvgXml xml={svg} width={size} height={size} />
        </View>
    );
};
