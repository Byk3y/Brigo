/**
 * Question Card Component
 * Displays question text and skip message
 */

import React from 'react';
import { Text, StyleSheet, Platform } from 'react-native';
import type { QuestionCardProps } from '@/lib/quiz/types';

const isPad = Platform.OS === 'ios' && Platform.isPad;

export function QuestionCard({ question, wasSkipped, colors }: QuestionCardProps) {
  return (
    <>
      <Text style={[styles.questionText, { color: colors.text }]}>{question}</Text>
      {wasSkipped && (
        <Text style={[styles.skipMessage, { color: colors.textSecondary }]}>
          You skipped this question. Correct answer is highlighted below.
        </Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  questionText: {
    fontSize: isPad ? 32 : 24,
    fontFamily: 'Nunito-Bold',
    marginBottom: isPad ? 32 : 24,
    lineHeight: isPad ? 42 : 34,
  },
  skipMessage: {
    fontSize: 14,
    marginTop: -12,
    marginBottom: 16,
    fontFamily: 'Nunito-Regular',
  },
});







