import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/lib/ThemeContext';
import { useFeedback } from '@/lib/feedback';
import { AnimatedGradientBorder } from '@/components/AnimatedGradientBorder';
import { AttachStep } from 'react-native-spotlight-tour';

const isPad = Platform.OS === 'ios' && Platform.isPad;

interface HomeActionButtonsProps {
    onCameraPress: () => void;
    onAddPress: () => void;
    bottom?: number;
}

export const HomeActionButtons: React.FC<HomeActionButtonsProps> = ({
    onCameraPress,
    onAddPress,
    bottom = 20
}) => {
    const { isDarkMode } = useTheme();
    const { play } = useFeedback();

    // In light mode, use solid styling with shadow for visibility
    // In dark mode, use liquid glass effect
    const useLiquidGlass = isDarkMode && Platform.OS === 'ios';

    return (
        <View
            style={{
                position: 'absolute',
                bottom: isPad ? 60 : bottom, // Lifted more for iPad
                left: isPad ? 48 : 24,
                right: isPad ? 48 : 24,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: isPad ? 32 : 16,
                zIndex: 10,
            }}
        >
            {/* Camera Button - Walkthrough Step 1 (Index 1 in our logic, but let's align with array index) */}
            {/* @ts-ignore - Library type mismatch for children */}
            <AttachStep index={1}>
                <TouchableOpacity
                    onPress={() => {
                        play('tap');
                        onCameraPress();
                    }}
                    activeOpacity={0.8}
                    style={{
                        width: isPad ? 72 : 56,
                        height: isPad ? 72 : 56,
                        borderRadius: isPad ? 36 : 28,
                        overflow: 'hidden',
                        // Light mode shadow
                        ...(!useLiquidGlass && {
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.15,
                            shadowRadius: 12,
                            elevation: 8,
                        }),
                    }}
                >
                    <AnimatedGradientBorder borderRadius={isPad ? 36 : 28} style={{ flex: 1 }}>
                        {useLiquidGlass ? (
                            <BlurView
                                intensity={40}
                                tint="light"
                                style={{
                                    flex: 1,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                                }}
                            >
                                <MaterialIcons
                                    name="camera-alt"
                                    size={isPad ? 32 : 24}
                                    color="#FFFFFF"
                                />
                            </BlurView>
                        ) : (
                            <View
                                style={{
                                    flex: 1,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: '#FFFFFF',
                                    // Border handled by AnimatedGradientBorder
                                    borderRadius: isPad ? 36 : 28,
                                }}
                            >
                                <MaterialIcons
                                    name="camera-alt"
                                    size={isPad ? 32 : 24}
                                    color="#1a1a1a"
                                />
                            </View>
                        )}
                    </AnimatedGradientBorder>
                </TouchableOpacity>
            </AttachStep>

            {/* Add Materials Button - Walkthrough Step 0 */}
            {/* @ts-ignore - Library type mismatch for children */}
            <AttachStep index={0}>
                <TouchableOpacity
                    onPress={() => {
                        play('tap');
                        onAddPress();
                    }}
                    activeOpacity={0.8}
                    style={{
                        borderRadius: isPad ? 40 : 32, // Match the visual border radius for the spotlight
                        overflow: 'hidden',
                        // Light mode shadow
                        ...(!useLiquidGlass && {
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.15,
                            shadowRadius: 12,
                            elevation: 8,
                        }),
                    }}
                >
                    <AnimatedGradientBorder borderRadius={999}>
                        {useLiquidGlass ? (
                            <BlurView
                                intensity={40}
                                tint="light"
                                style={{
                                    paddingHorizontal: isPad ? 48 : 32,
                                    paddingVertical: isPad ? 20 : 16,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: isPad ? 12 : 8,
                                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                                }}
                            >
                                <MaterialIcons
                                    name="add"
                                    size={isPad ? 28 : 20}
                                    color="#FFFFFF"
                                />
                                <Text
                                    style={{
                                        fontFamily: 'Nunito-SemiBold',
                                        fontSize: isPad ? 20 : 16,
                                        color: '#FFFFFF',
                                    }}
                                >
                                    Add Material
                                </Text>
                            </BlurView>
                        ) : (
                            <View
                                style={{
                                    paddingHorizontal: isPad ? 48 : 32,
                                    paddingVertical: isPad ? 20 : 16,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: isPad ? 12 : 8,
                                    backgroundColor: '#FFFFFF',
                                    // Border handled by AnimatedGradientBorder
                                    borderRadius: 999,
                                }}
                            >
                                <MaterialIcons
                                    name="add"
                                    size={isPad ? 28 : 20}
                                    color="#1a1a1a"
                                />
                                <Text
                                    style={{
                                        fontFamily: 'Nunito-SemiBold',
                                        fontSize: isPad ? 20 : 16,
                                        color: '#1a1a1a',
                                    }}
                                >
                                    Add Material
                                </Text>
                            </View>
                        )}
                    </AnimatedGradientBorder>
                </TouchableOpacity>
            </AttachStep>
        </View>
    );
};


