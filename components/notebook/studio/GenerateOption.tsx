import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
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
            onPress={onPress}
            disabled={disabled}
            style={{
                backgroundColor: getBackgroundColor(),
                borderRadius: 999,
                paddingVertical: 13,
                paddingHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 10,
                width: '100%',
                opacity: disabled && !isGenerating ? 0.6 : 1,
            }}
            activeOpacity={0.7}
        >
            <View style={{ marginRight: 16, marginLeft: 4 }}>
                <Ionicons name={icon} size={24} color={color} />
            </View>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: colors.text }}>
                {label}
            </Text>
            {isGenerating ? (
                <ActivityIndicator size="small" color={color} />
            ) : (
                <View style={{
                    width: 36,
                    height: 36,
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Ionicons name="pencil" size={16} color={colors.iconMuted} />
                </View>
            )}
        </TouchableOpacity>
    );
});
