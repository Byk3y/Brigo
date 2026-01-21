import React from 'react';
import { TouchableOpacity, Text, View, Platform } from 'react-native';
import { AnimatedGradientBorder } from '@/components/AnimatedGradientBorder';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';

const isPad = Platform.OS === 'ios' && Platform.isPad;

interface AddNotebookCardProps {
  onPress: () => void;
}

export const AddNotebookCard: React.FC<AddNotebookCardProps> = ({ onPress }) => {
  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        marginBottom: isPad ? 20 : 16,
        width: isPad ? '48.5%' : '100%'
      }}
    >
      <AnimatedGradientBorder borderRadius={isPad ? 24 : 16}>
        <View
          style={{
            backgroundColor: colors.surface,
            paddingVertical: isPad ? 28 : 16,
            paddingHorizontal: isPad ? 32 : 20,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: isPad ? 24 : 16,
          }}
        >
          <Text
            style={{
              fontSize: isPad ? 20 : 15,
              fontFamily: 'Nunito-SemiBold',
              color: colors.text,
            }}
          >
            + Add New Notebook
          </Text>
        </View>
      </AnimatedGradientBorder>
    </TouchableOpacity>
  );
};
