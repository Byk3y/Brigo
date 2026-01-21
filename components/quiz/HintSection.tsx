/**
 * Hint Section Component
 * Displays hint button and revealed hint content
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { HintSectionProps } from '@/lib/quiz/types';
import { HINT_COLORS } from '@/lib/quiz/constants';

const isPad = Platform.OS === 'ios' && Platform.isPad;

export function HintSection({
  hint,
  hintAvailable,
  hintRevealed,
  petName,
  onRevealHint,
  isReviewMode,
  colors,
  isDarkMode,
}: HintSectionProps) {
  if (isReviewMode) {
    return null;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={onRevealHint}
        disabled={!hintAvailable || hintRevealed}
        style={[
          styles.hintButton,
          {
            borderColor: hintRevealed ? colors.border : HINT_COLORS.hintButtonBorder,
            backgroundColor: hintRevealed ? colors.surface : 'transparent',
          },
        ]}
      >
        <View style={styles.hintButtonContent}>
          <Ionicons
            name="bulb-outline"
            size={18}
            color={hintRevealed ? colors.textMuted : HINT_COLORS.hintButtonText}
          />
          <Text
            style={[
              styles.hintButtonText,
              { color: hintRevealed ? colors.textMuted : HINT_COLORS.hintButtonText },
            ]}
          >
            {hintAvailable ? `Ask ${petName} for a hint` : 'No hint available'}
          </Text>
        </View>
      </TouchableOpacity>

      {hintRevealed && hintAvailable && hint && (
        <View
          style={[
            styles.hintContent,
            {
              backgroundColor: isDarkMode ? HINT_COLORS.hintBgDark : HINT_COLORS.hintBgLight,
              borderColor: isDarkMode ? HINT_COLORS.hintBorderDark : HINT_COLORS.hintBorderLight,
            },
          ]}
        >
          <View style={styles.hintHeader}>
            <Ionicons name="sparkles-outline" size={18} color={HINT_COLORS.hintIcon} />
            <Text
              style={[
                styles.hintTitle,
                { color: isDarkMode ? HINT_COLORS.hintTextDark : HINT_COLORS.hintTextLight },
              ]}
            >
              Hint
            </Text>
          </View>
          <Text
            style={[
              styles.hintText,
              { color: isDarkMode ? HINT_COLORS.hintTextDark : HINT_COLORS.hintTextLight },
            ]}
          >
            {hint}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  hintButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: isPad ? 20 : 16,
    paddingVertical: isPad ? 10 : 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  hintButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hintButtonText: {
    fontSize: isPad ? 16 : 14,
    fontFamily: 'Nunito-SemiBold',
  },
  hintContent: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  hintHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  hintTitle: {
    fontSize: 14,
    fontFamily: 'Nunito-SemiBold',
  },
  hintText: {
    fontSize: isPad ? 18 : 14,
    lineHeight: isPad ? 26 : 20,
    fontFamily: 'Nunito-Regular',
  },
});







