import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';

interface GenerateOptionProps {
    type: 'audio' | 'flashcards' | 'quiz' | 'prediction';
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    label: string;
    bgColor: string; // kept for backwards compatibility but not used
    textColor: string; // kept for backwards compatibility but not used
    isGenerating: boolean;
    onPress: () => void;
    disabled: boolean;
}

export const GenerateOption = React.forwardRef<View, GenerateOptionProps>(({
    type,
    icon,
    color,
    label,
    isGenerating,
    onPress,
    disabled
}, ref) => {
    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);

    const isPad = Platform.OS === 'ios' && Platform.isPad;

    // Get the appropriate background color based on type
    const getBackgroundColor = () => {
        switch (type) {
            case 'audio':
                return colors.cardAudio;
            case 'flashcards':
                return colors.cardFlashcard;
            case 'quiz':
                return colors.cardQuiz;
            case 'prediction':
                return colors.cardPrediction;
            default:
                return colors.surfaceAlt;
        }
    };

    return (
        <TouchableOpacity
            ref={ref}
            collapsable={false}
            onPress={onPress}
            disabled={disabled}
            style={{
                backgroundColor: getBackgroundColor(),
                borderRadius: isPad ? 24 : 999,
                paddingVertical: isPad ? 20 : 13,
                paddingHorizontal: isPad ? 20 : 16,
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: isPad ? 0 : 10, // Margin will be handled by container gap on iPad
                width: '100%',
                opacity: disabled && !isGenerating ? 0.6 : 1,
            }}
            activeOpacity={0.7}
        >
            <View style={{ marginRight: isPad ? 20 : 16, marginLeft: isPad ? 0 : 4 }}>
                <Ionicons name={icon} size={isPad ? 32 : 24} color={color} />
            </View>
            <Text style={{ flex: 1, fontSize: isPad ? 18 : 16, fontWeight: '600', color: colors.text, fontFamily: 'Nunito-SemiBold' }}>
                {label}
            </Text>
            {isGenerating ? (
                <ActivityIndicator size="small" color={color} />
            ) : (
                <View style={{
                    width: isPad ? 40 : 36,
                    height: isPad ? 40 : 36,
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    borderRadius: isPad ? 20 : 18,
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Ionicons name="pencil" size={isPad ? 20 : 16} color={colors.iconMuted} />
                </View>
            )}
        </TouchableOpacity>
    );
});
