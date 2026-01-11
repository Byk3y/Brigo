import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

/**
 * BrigoLogo - Premium brand logo component
 * Displays "Brigo" text with a stylized orange glowing orb replacing the 'o'
 * 
 * @example
 * <BrigoLogo size={32} textColor="#FFFFFF" />
 */
interface BrigoLogoProps {
    /** Font size for the text (default: 28) */
    size?: number;
    /** Color for the text (default: '#000000') */
    textColor?: string;
    /** Whether to show the orb or just text (default: true) */
    showOrb?: boolean;
}

export const BrigoLogo: React.FC<BrigoLogoProps> = ({
    size = 28,
    textColor = '#000000',
    showOrb = true
}) => {
    const fontSize = size;
    // Orb should match the height of lowercase letters
    const orbSize = fontSize * 0.85;

    return (
        <View style={styles.container}>
            <Text style={[
                styles.text,
                {
                    fontSize,
                    color: textColor,
                }
            ]}>
                Brig
            </Text>
            {showOrb && (
                <View style={[styles.orbWrapper, { width: orbSize, height: orbSize }]}>
                    <Svg height="100%" width="100%" viewBox="0 0 100 100">
                        <Defs>
                            {/* Soft luminous glow - Orange version */}
                            <RadialGradient
                                id="softGlow"
                                cx="50%"
                                cy="50%"
                                rx="50%"
                                ry="50%"
                                fx="50%"
                                fy="50%"
                            >
                                {/* Bright white/cream center */}
                                <Stop offset="0%" stopColor="#FFFAF5" stopOpacity="1" />
                                <Stop offset="20%" stopColor="#FFE8D6" stopOpacity="1" />
                                {/* Fade to vibrant orange */}
                                <Stop offset="50%" stopColor="#FF9F43" stopOpacity="1" />
                                <Stop offset="75%" stopColor="#F78B2C" stopOpacity="1" />
                                {/* Gentle edge - warm deep orange */}
                                <Stop offset="100%" stopColor="#E67E22" stopOpacity="1" />
                            </RadialGradient>
                        </Defs>

                        {/* The Soft Luminous Orb */}
                        <Circle
                            cx="50"
                            cy="50"
                            r="46"
                            fill="url(#softGlow)"
                        />

                        {/* Thin delicate ring outline */}
                        <Circle
                            cx="50"
                            cy="50"
                            r="47"
                            stroke="#8B5A2B"
                            strokeWidth="1"
                            strokeOpacity="0.3"
                            fill="none"
                        />
                    </Svg>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    text: {
        fontFamily: 'Outfit-Light',
        fontWeight: '300',
        letterSpacing: -0.5,
    },
    orbWrapper: {
        marginLeft: 4,
        marginTop: 4, // Push down to align with text baseline
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default BrigoLogo;
