/**
 * NotebookHeader - Header component with back button, title, and menu
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
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
  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      <TouchableOpacity
        onPress={onBack}
        style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="arrow-back" size={24} color={colors.icon} />
      </TouchableOpacity>

      <View style={{ flex: 1, marginHorizontal: 8 }}>
        <Text
          style={{
            fontSize: 17,
            fontFamily: 'Nunito-SemiBold',
            color: colors.text
          }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
      </View>

      <TouchableOpacity
        onPress={onMenuPress}
        style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="ellipsis-vertical" size={24} color={colors.icon} />
      </TouchableOpacity>
    </View>
  );
};







