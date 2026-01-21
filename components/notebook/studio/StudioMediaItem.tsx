import React from 'react';
import { View, Text, TouchableOpacity, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { TikTokLoader } from '@/components/TikTokLoader';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { useDynamicMessage } from '@/lib/hooks/useDynamicMessage';

interface StudioMediaItemProps {
    onPress?: () => void;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    title: string;
    subtitle?: string | React.ReactNode;
    onDelete?: () => void;
    isGenerating?: boolean;
    loadingColor?: string;
    loadingText?: string | readonly string[];
}

export const StudioMediaItem: React.FC<StudioMediaItemProps> = ({
    onPress,
    icon,
    iconColor,
    title,
    subtitle,
    onDelete,
    isGenerating,
    loadingColor = '#2563eb',
    loadingText = 'Generating...'
}) => {
    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);

    const displayLoadingText = typeof loadingText === 'string'
        ? loadingText
        : useDynamicMessage(loadingText || ['Generating...']);


    const isPad = Platform.OS === 'ios' && Platform.isPad;

    // Get icon background color based on icon type
    const getIconBgColor = () => {
        if (icon === 'help-circle-outline') return isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5'; // Quiz - green
        if (icon === 'copy-outline') return isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2'; // Flashcard - red
        if (icon === 'bar-chart-outline') return isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF'; // Audio - blue
        return isDarkMode ? 'rgba(107, 114, 128, 0.15)' : '#F3F4F6'; // Default
    };

    const content = (
        <TouchableOpacity
            onPress={onPress}
            disabled={!onPress}
            style={{
                paddingVertical: isPad ? 20 : 16,
                paddingHorizontal: isPad ? 20 : 16,
                marginBottom: isPad ? 0 : 10,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isGenerating ? 'transparent' : colors.mediaCard,
                borderRadius: isPad ? 18 : 14,
                borderWidth: isGenerating ? 0 : 1,
                borderColor: colors.mediaCardBorder,
                minHeight: isPad ? 84 : 72,
                flex: 1, // Allow filling container in grid
            }}
            activeOpacity={0.7}
        >
            {/* Icon with background */}
            <View style={{
                marginRight: isPad ? 18 : 14,
                width: isPad ? 48 : 42,
                height: isPad ? 48 : 42,
                borderRadius: isPad ? 12 : 10,
                backgroundColor: getIconBgColor(),
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <Ionicons name={icon} size={isPad ? 26 : 22} color={iconColor} />
            </View>

            {/* Content */}
            <View style={{ flex: 1 }}>
                <Text
                    style={{
                        fontSize: isPad ? 17 : 15,
                        fontWeight: '600',
                        color: colors.text,
                        letterSpacing: -0.2,
                        fontFamily: 'Nunito-SemiBold',
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                >
                    {title}
                </Text>
                {isGenerating ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: isPad ? 6 : 4 }}>
                        <TikTokLoader size={isPad ? 12 : 10} color={loadingColor} containerWidth={isPad ? 60 : 50} />
                        <Text style={{ fontSize: isPad ? 15 : 13, marginLeft: 8, color: loadingColor, fontFamily: 'Nunito-Medium' }}>
                            {displayLoadingText}
                        </Text>
                    </View>
                ) : (
                    <Text style={{
                        fontSize: isPad ? 15 : 13,
                        color: colors.textSecondary,
                        marginTop: isPad ? 6 : 4,
                        letterSpacing: -0.1,
                        fontFamily: 'Nunito-Regular',
                    }}>
                        {subtitle}
                    </Text>
                )}
            </View>

            {/* Chevron */}
            {!isGenerating && onPress && (
                <View style={{ marginLeft: 8 }}>
                    <Ionicons name="chevron-forward" size={20} color={colors.iconMuted} />
                </View>
            )}
        </TouchableOpacity>
    );

    if (onDelete) {
        return (
            <Swipeable
                renderRightActions={(progress, dragX) => {
                    const scale = dragX.interpolate({
                        inputRange: [-100, 0],
                        outputRange: [1, 0],
                        extrapolate: 'clamp',
                    });
                    return (
                        <TouchableOpacity
                            onPress={onDelete}
                            style={{
                                backgroundColor: '#ef4444',
                                justifyContent: 'center',
                                alignItems: 'center',
                                paddingHorizontal: 24,
                                marginBottom: 10,
                                borderRadius: 14,
                                minHeight: 72,
                            }}
                        >
                            <Animated.View style={{ transform: [{ scale }] }}>
                                <Ionicons name="trash-outline" size={24} color="#fff" />
                            </Animated.View>
                        </TouchableOpacity>
                    );
                }}
                overshootRight={false}
            >
                {content}
            </Swipeable>
        );
    }

    return content;
};
