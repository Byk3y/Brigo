/**
 * Limited Access Banner
 * Persistent banner shown on home screen when subscription has expired
 * Non-dismissible reminder of limited access state
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors } from '@/lib/ThemeContext';
import { useTheme } from '@/lib/ThemeContext';

interface LimitedAccessBannerProps {
  accessibleCount: number;
  totalCount: number;
  onUpgrade: () => void;
}

export function LimitedAccessBanner({
  accessibleCount,
  totalCount,
  onUpgrade,
}: LimitedAccessBannerProps) {
  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.primary + '33', // 20% opacity
        },
      ]}
      onPress={onUpgrade}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <Text style={styles.emoji}>⏰</Text>
        <Text style={[styles.text, { color: colors.text }]}>
          <Text style={styles.boldText}>Subscription required</Text>
        </Text>
      </View>

      <View style={styles.upgradeButton}>
        <Text style={[styles.upgradeText, { color: colors.primary }]}>
          Unlock all features
        </Text>
        <Ionicons name="arrow-forward" size={16} color={colors.primary} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 0,
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  emoji: {
    fontSize: 18,
    marginRight: 10,
  },
  text: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    flex: 1,
    flexShrink: 1,
  },
  boldText: {
    fontWeight: '600',
    fontFamily: 'Nunito-SemiBold',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 12,
    flexShrink: 0,
  },
  upgradeText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Nunito-SemiBold',
    flexShrink: 0,
  },
});
