import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Ellipse } from 'react-native-svg';

interface StreakFreezeIconProps {
    size?: number;
}

export const StreakFreezeIcon = ({ size = 100 }: StreakFreezeIconProps) => {
    const scale = size / 100;

    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={size} height={size} viewBox="0 0 100 100">
                <Defs>
                    {/* Outer crystal gradient - light blue */}
                    <LinearGradient id="outerCrystal" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor="#a8e0f8" />
                        <Stop offset="50%" stopColor="#7fd4f5" />
                        <Stop offset="100%" stopColor="#5bc9f2" />
                    </LinearGradient>

                    {/* Inner crystal gradient - darker blue */}
                    <LinearGradient id="innerCrystal" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor="#2da0d1" />
                        <Stop offset="100%" stopColor="#1a8bbf" />
                    </LinearGradient>

                    {/* Droplet gradient - cyan */}
                    <LinearGradient id="droplet" x1="50%" y1="0%" x2="50%" y2="100%">
                        <Stop offset="0%" stopColor="#5ee8e8" />
                        <Stop offset="100%" stopColor="#2dd4d4" />
                    </LinearGradient>
                </Defs>

                {/* Outer crystal shape - light blue irregular polygon */}
                <Path
                    d="M30 8 L70 5 L85 25 L80 55 L75 70 L55 75 L35 78 L20 65 L15 35 Z"
                    fill="url(#outerCrystal)"
                />

                {/* Inner crystal shape - darker blue */}
                <Path
                    d="M38 22 L62 20 L72 35 L68 58 L55 65 L40 62 L30 50 L32 30 Z"
                    fill="url(#innerCrystal)"
                />

                {/* Top left sparkle diamond */}
                <Path
                    d="M28 25 L32 30 L28 35 L24 30 Z"
                    fill="white"
                    opacity={0.9}
                />

                {/* Bottom right sparkle diamond */}
                <Path
                    d="M68 52 L72 57 L68 62 L64 57 Z"
                    fill="white"
                    opacity={0.9}
                />

                {/* Water droplet in center */}
                <Path
                    d="M50 40 C42 50 40 58 48 66 C52 70 58 68 60 62 C64 54 58 46 50 40 Z"
                    fill="url(#droplet)"
                />

                {/* Icicle drips at bottom */}
                {/* Left icicle */}
                <Path
                    d="M28 68 L30 65 L32 68 L30 85 Z"
                    fill="#7fd4f5"
                />

                {/* Middle-left icicle */}
                <Path
                    d="M42 75 L45 72 L48 75 L45 95 Z"
                    fill="#7fd4f5"
                />

                {/* Middle icicle */}
                <Path
                    d="M55 73 L58 70 L61 73 L58 88 Z"
                    fill="#7fd4f5"
                />

                {/* Highlight on outer crystal */}
                <Path
                    d="M35 12 L55 10 L60 18 L40 20 Z"
                    fill="white"
                    opacity={0.3}
                />
            </Svg>
        </View>
    );
};

export default StreakFreezeIcon;
