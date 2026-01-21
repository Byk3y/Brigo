/**
 * Quiz Header Component
 * Displays quiz title, progress bar, and navigation icons
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { QuizHeaderProps } from '@/lib/quiz/types';
import { PROGRESS_COLORS, GRADIENT_COLORS } from '@/lib/quiz/constants';

const isPad = Platform.OS === 'ios' && Platform.isPad;

export function QuizHeader({
  title,
  currentIndex,
  totalQuestions,
  isReviewMode,
  onClose,
  colors,
  isDarkMode,
}: QuizHeaderProps) {
  const progress = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={28} color={colors.icon} />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>
            {title}
          </Text>
          {isReviewMode && (
            <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
              Reviewing answers
            </Text>
          )}
        </View>
        <View style={styles.spacer} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <Text style={[styles.questionCount, { color: colors.textSecondary }]}>
          {currentIndex + 1} / {totalQuestions}
        </Text>
        <View
          style={[
            styles.progressBar,
            { backgroundColor: isDarkMode ? colors.surfaceAlt : PROGRESS_COLORS.barBgLight },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              { width: `${Math.max(progress, 5)}%`, backgroundColor: PROGRESS_COLORS.barFill },
            ]}
          />
        </View>

        {/* Icons */}
        <View style={styles.iconsContainer}>
          <LinearGradient
            colors={[GRADIENT_COLORS.start, GRADIENT_COLORS.end]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientIcon}
          >
            <Ionicons name="flash" size={18} color="white" />
          </LinearGradient>
          <Ionicons name="infinite" size={28} color="#3b82f6" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 12,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: isPad ? 48 : 24,
    paddingVertical: isPad ? 24 : 16,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  title: {
    fontSize: isPad ? 20 : 16,
    fontFamily: 'Nunito-SemiBold',
    textAlign: 'center',
  },
  reviewText: {
    fontSize: 12,
    marginTop: 4,
    fontFamily: 'Nunito-Regular',
  },
  spacer: {
    width: 28,
  },
  progressContainer: {
    paddingHorizontal: isPad ? 48 : 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  questionCount: {
    fontSize: isPad ? 16 : 14,
    fontFamily: 'Nunito-Medium',
  },
  progressBar: {
    flex: 1,
    height: isPad ? 20 : 16,
    borderRadius: isPad ? 10 : 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  iconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gradientIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

