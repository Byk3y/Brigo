import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/lib/ThemeContext';
import { useFeedback } from '@/lib/feedback';
import { AnimatedGradientBorder } from '@/components/AnimatedGradientBorder';
import { AttachStep } from 'react-native-spotlight-tour';

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
                bottom: bottom,
                left: 24,
                right: 24,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
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
                        width: 56,
                        height: 56,
                        borderRadius: 28,
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
                    <AnimatedGradientBorder borderRadius={28} style={{ flex: 1 }}>
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
                                    size={24}
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
                                    borderRadius: 28,
                                }}
                            >
                                <MaterialIcons
                                    name="camera-alt"
                                    size={24}
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
                        borderRadius: 32, // Match the visual border radius for the spotlight
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
                                    paddingHorizontal: 32,
                                    paddingVertical: 16,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 8,
                                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                                }}
                            >
                                <MaterialIcons
                                    name="add"
                                    size={20}
                                    color="#FFFFFF"
                                />
                                <Text
                                    style={{
                                        fontFamily: 'Nunito-SemiBold',
                                        fontSize: 16,
                                        color: '#FFFFFF',
                                    }}
                                >
                                    Add Material
                                </Text>
                            </BlurView>
                        ) : (
                            <View
                                style={{
                                    paddingHorizontal: 32,
                                    paddingVertical: 16,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 8,
                                    backgroundColor: '#FFFFFF',
                                    // Border handled by AnimatedGradientBorder
                                    borderRadius: 999,
                                }}
                            >
                                <MaterialIcons
                                    name="add"
                                    size={20}
                                    color="#1a1a1a"
                                />
                                <Text
                                    style={{
                                        fontFamily: 'Nunito-SemiBold',
                                        fontSize: 16,
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


