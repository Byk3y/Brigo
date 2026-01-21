/**
 * Empty state component for home screen
 * Shows sign-in prompt or loading placeholder
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { ResponsiveContainer } from '@/lib/components/ResponsiveContainer';

interface HomeEmptyStateProps {
  isSignedIn: boolean;
}

export function HomeEmptyState({ isSignedIn }: HomeEmptyStateProps) {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);

  if (!isSignedIn) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}
      >
        <ResponsiveContainer style={{ alignItems: 'center' }}>
          <Text
            style={{
              fontSize: 24,
              fontFamily: 'Nunito-Bold',
              color: colors.text,
              marginBottom: 16,
            }}
          >
            Not Signed In
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              marginBottom: 32,
              textAlign: 'center',
              fontFamily: 'Nunito-Regular',
            }}
          >
            Please sign in to access your study materials
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/auth')}
            style={{
              backgroundColor: '#3B82F6',
              paddingHorizontal: 32,
              paddingVertical: 16,
              borderRadius: 999,
            }}
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontFamily: 'Nunito-SemiBold',
                fontSize: 18,
              }}
            >
              Sign In
            </Text>
          </TouchableOpacity>
        </ResponsiveContainer>
      </View>
    );
  }

  // Loading placeholder
  return <View style={{ flex: 1, backgroundColor: colors.background }} />;
}







