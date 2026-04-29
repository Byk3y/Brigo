/**
 * Answer Option Component
 * Individual answer option with styling and explanation
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AnswerOptionProps, AnswerOption as OptionType } from '@/lib/quiz/types';
import { OPTION_COLORS } from '@/lib/quiz/constants';
import { MarkdownText } from '@/components/MarkdownText';

const isPad = Platform.OS === 'ios' && Platform.isPad;

export function AnswerOption({
  optionKey,
  optionText,
  isSelected,
  isCorrect,
  showCorrect,
  showIncorrect,
  explanation,
  isSubmitted,
  isReviewMode,
  onSelect,
  onLayout,
  colors,
  isDarkMode,
}: AnswerOptionProps) {
  // Determine styling based on state
  let bgColor = colors.surface;
  let borderColor = colors.border;
  let badgeBg = isDarkMode ? colors.surfaceAlt : '#f5f5f5';
  let badgeText = colors.textSecondary;
  let optionTextColor = colors.text;

  if (showCorrect) {
    bgColor = isDarkMode ? OPTION_COLORS.correctBgDark : OPTION_COLORS.correctBgLight;
    borderColor = OPTION_COLORS.correctBorder;
    badgeBg = OPTION_COLORS.correctBadge;
    badgeText = '#FFFFFF';
    optionTextColor = isDarkMode ? OPTION_COLORS.correctTextDark : OPTION_COLORS.correctTextLight;
  } else if (showIncorrect) {
    bgColor = isDarkMode ? OPTION_COLORS.incorrectBgDark : OPTION_COLORS.incorrectBgLight;
    borderColor = OPTION_COLORS.incorrectBorder;
    badgeBg = OPTION_COLORS.incorrectBadge;
    badgeText = '#FFFFFF';
    optionTextColor = isDarkMode ? OPTION_COLORS.incorrectTextDark : OPTION_COLORS.incorrectTextLight;
  } else if (isSelected) {
    bgColor = isDarkMode ? OPTION_COLORS.selectedBgDark : OPTION_COLORS.selectedBgLight;
    borderColor = OPTION_COLORS.selectedBorder;
    badgeBg = OPTION_COLORS.selectedBadge;
    badgeText = '#FFFFFF';
    optionTextColor = isDarkMode ? OPTION_COLORS.selectedTextDark : OPTION_COLORS.selectedTextLight;
  }

  const shouldShowExplanation = explanation && (isSubmitted || isReviewMode) && (isCorrect || (isSelected && !isCorrect));

  return (
    <TouchableOpacity
      onPress={() => !isSubmitted && onSelect(optionKey)}
      disabled={isSubmitted || isReviewMode}
      onLayout={(e) => {
        const y = e.nativeEvent.layout.y;
        onLayout(optionKey, y);
      }}
      style={[
        styles.option,
        {
          backgroundColor: bgColor,
          borderColor: borderColor,
        },
      ]}
    >
      <View style={styles.optionContent}>
        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
          <Text style={[styles.badgeText, { color: badgeText }]}>{optionKey}</Text>
        </View>
        <MarkdownText style={[styles.optionText, { color: optionTextColor }]}>{optionText}</MarkdownText>
        {showCorrect && <Ionicons name="checkmark-circle" size={24} color={OPTION_COLORS.correctIcon} />}
        {showIncorrect && <Ionicons name="close-circle" size={24} color={OPTION_COLORS.incorrectIcon} />}
      </View>

      {shouldShowExplanation && (
        <View
          style={[
            styles.explanation,
            {
              backgroundColor: showCorrect
                ? isDarkMode
                  ? OPTION_COLORS.explanationCorrectBgDark
                  : OPTION_COLORS.explanationCorrectBgLight
                : isDarkMode
                  ? OPTION_COLORS.explanationIncorrectBgDark
                  : OPTION_COLORS.explanationIncorrectBgLight,
              borderColor: showCorrect ? OPTION_COLORS.explanationCorrectBorder : OPTION_COLORS.explanationIncorrectBorder,
            },
          ]}
        >
          <View style={styles.explanationHeader}>
            <Ionicons
              name={showCorrect ? 'checkmark-circle' : 'close-circle'}
              size={18}
              color={showCorrect ? OPTION_COLORS.correctIcon : OPTION_COLORS.incorrectIcon}
            />
            <Text
              style={[
                styles.explanationTitle,
                {
                  color: showCorrect
                    ? isDarkMode
                      ? OPTION_COLORS.explanationCorrectBgLight
                      : '#0f172a'
                    : isDarkMode
                      ? OPTION_COLORS.explanationIncorrectBgLight
                      : OPTION_COLORS.incorrectTextLight,
                },
              ]}
            >
              {showCorrect ? 'Why this is correct' : 'Why this is incorrect'}
            </Text>
          </View>
          <MarkdownText
            style={[
              styles.explanationText,
              {
                color: showCorrect
                  ? isDarkMode
                    ? OPTION_COLORS.explanationCorrectTextDark
                    : OPTION_COLORS.explanationCorrectTextLight
                  : isDarkMode
                    ? OPTION_COLORS.explanationIncorrectTextDark
                    : OPTION_COLORS.explanationIncorrectTextLight,
              },
            ]}
          >
            {explanation}
          </MarkdownText>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  option: {
    borderRadius: isPad ? 16 : 12,
    padding: isPad ? 20 : 16,
    borderWidth: 2,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    width: isPad ? 40 : 32,
    height: isPad ? 40 : 32,
    borderRadius: isPad ? 20 : 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: isPad ? 16 : 12,
  },
  badgeText: {
    fontFamily: 'Nunito-SemiBold',
    fontSize: isPad ? 18 : 14,
  },
  optionText: {
    flex: 1,
    fontSize: isPad ? 20 : 16,
    fontFamily: 'Nunito-Regular',
  },
  explanation: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  explanationTitle: {
    fontSize: 13,
    fontFamily: 'Nunito-SemiBold',
  },
  explanationText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Nunito-Regular',
  },
});







