/**
 * Quiz Navigation Component
 * Previous/Next/Finish buttons
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import type { QuizNavigationProps } from '@/lib/quiz/types';
import { BUTTON_COLORS } from '@/lib/quiz/constants';

const isPad = Platform.OS === 'ios' && Platform.isPad;

export function QuizNavigation({
  currentIndex,
  totalQuestions,
  onPrevious,
  onNext,
  colors,
}: QuizNavigationProps) {
  const isFirstQuestion = currentIndex === 0;
  const isLastQuestion = currentIndex === totalQuestions - 1;

  return (
    <View style={styles.container}>
      {isFirstQuestion ? (
        <View style={styles.singleButtonContainer}>
          <TouchableOpacity
            onPress={onNext}
            style={[styles.primaryButton, { backgroundColor: BUTTON_COLORS.primary }]}
          >
            <Text style={[styles.primaryButtonText, { color: BUTTON_COLORS.primaryText }]}>
              {isLastQuestion ? 'Finish' : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.buttonRow}>
          <TouchableOpacity
            onPress={onPrevious}
            style={[styles.secondaryButton, { borderColor: colors.border }]}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Previous</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onNext}
            style={[styles.primaryButton, { backgroundColor: BUTTON_COLORS.primary }]}
          >
            <Text style={[styles.primaryButtonText, { color: BUTTON_COLORS.primaryText }]}>
              {isLastQuestion ? 'Finish' : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: isPad ? 48 : 24,
    paddingTop: isPad ? 24 : 16,
    paddingBottom: isPad ? 48 : 32,
    marginBottom: 8,
  },
  singleButtonContainer: {
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  primaryButton: {
    width: isPad ? 220 : 140,
    borderRadius: 999,
    paddingVertical: isPad ? 16 : 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    textAlign: 'center',
    fontFamily: 'Nunito-SemiBold',
    fontSize: isPad ? 18 : 14,
  },
  secondaryButton: {
    width: isPad ? 220 : 140,
    borderWidth: 2,
    borderRadius: 999,
    paddingVertical: isPad ? 16 : 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    textAlign: 'center',
    fontFamily: 'Nunito-SemiBold',
    fontSize: isPad ? 18 : 14,
  },
});







