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
        justifyContent: 'center', // Center the container for iPad
        paddingHorizontal: 16,
        paddingVertical: isPad ? 16 : 12,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        maxWidth: isPad ? 800 : '100%',
      }}>
        <TouchableOpacity
          onPress={onBack}
          style={{ width: isPad ? 48 : 40, height: isPad ? 48 : 40, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="arrow-back" size={isPad ? 28 : 24} color={colors.icon} />
        </TouchableOpacity>

        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <Text
            style={{
              fontSize: isPad ? 20 : 17,
              fontFamily: 'Nunito-Bold',
              color: colors.text,
              textAlign: isPad ? 'center' : 'left',
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
        </View>

        <TouchableOpacity
          onPress={onMenuPress}
          style={{ width: isPad ? 48 : 40, height: isPad ? 48 : 40, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="ellipsis-vertical" size={isPad ? 28 : 24} color={colors.icon} />
        </TouchableOpacity>
      </View>
    </View>
  );
};







