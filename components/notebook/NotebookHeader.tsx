/**
 * NotebookHeader - Header component with back button, title, and menu
 */

import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';

interface NotebookHeaderProps {
  title: string;
  onBack: () => void;
  onMenuPress: () => void;
}

export const NotebookHeader: React.FC<NotebookHeaderProps> = ({
  title,
  onBack,
  onMenuPress,
}) => {
  const isPad = Platform.OS === 'ios' && Platform.isPad;
  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: isPad ? 24 : 16,
        paddingVertical: isPad ? 16 : 12,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        minHeight: isPad ? 72 : 56,
      }}
    >
      <TouchableOpacity
        onPress={onBack}
        style={{
          width: isPad ? 56 : 40,
          height: isPad ? 56 : 40,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        }}
      >
        <Ionicons name="arrow-back" size={isPad ? 28 : 24} color={colors.icon} />
      </TouchableOpacity>

      <View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: isPad ? 80 : 60,
      }}>
        <Text
          style={{
            fontSize: isPad ? 20 : 17,
            fontFamily: 'Nunito-Bold',
            color: colors.text,
            textAlign: 'center',
          }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
      </View>

      <TouchableOpacity
        onPress={onMenuPress}
        style={{
          width: isPad ? 56 : 40,
          height: isPad ? 56 : 40,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        }}
      >
        <Ionicons name="ellipsis-vertical" size={isPad ? 28 : 24} color={colors.icon} />
      </TouchableOpacity>
    </View>
  );
};







