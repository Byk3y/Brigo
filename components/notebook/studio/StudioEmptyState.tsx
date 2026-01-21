import React from 'react';
import { View, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';

export const StudioEmptyState: React.FC = () => {
  const isPad = Platform.OS === 'ios' && Platform.isPad;
  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);

  return (
    <View style={{ alignItems: 'center', paddingVertical: isPad ? 64 : 48, paddingHorizontal: 24 }}>
      <View style={{
        width: isPad ? 100 : 80,
        height: isPad ? 100 : 80,
        backgroundColor: colors.surfaceAlt,
        borderRadius: isPad ? 50 : 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: isPad ? 20 : 16
      }}>
        <Ionicons name="sparkles-outline" size={isPad ? 40 : 32} color={colors.iconMuted} />
      </View>

      <Text style={{
        color: colors.textSecondary,
        textAlign: 'center',
        fontWeight: '600',
        fontSize: isPad ? 18 : 14,
        fontFamily: 'Nunito-SemiBold'
      }}>
        No generated media yet
      </Text>
      <Text style={{
        color: colors.textMuted,
        textAlign: 'center',
        marginTop: 8,
        fontSize: isPad ? 15 : 12,
        fontFamily: 'Nunito-Regular'
      }}>
        Tap a generator above to create audio, flashcards, or a quiz.
      </Text>
    </View>
  );
};
