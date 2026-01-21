/**
 * Quiz Results Component
 * Displays quiz completion results with metrics and actions
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { QuizResultsProps } from '@/lib/quiz/types';
import { RESULTS_COLORS, BUTTON_COLORS } from '@/lib/quiz/constants';
import { useCelebration } from '@/lib/contexts/CelebrationContext';

export function QuizResults({
  scorePercent,
  correctCount,
  totalQuestions,
  wrongCount,
  skippedCount,
  onClose,
  onRetake,
  onReview,
  colors,
  isDarkMode,
  onPlaySound,
  onHaptic,
}: QuizResultsProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const [displayPercent, setDisplayPercent] = useState(0);
  const fadeAnim = useMemo(() => new Animated.Value(0), []);
  const { triggerCelebration } = useCelebration();

  // Animation logic
  useEffect(() => {
    // Trigger celebration for perfect score
    if (scorePercent === 100) {
      triggerCelebration();
    }
    // Fade in content
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Animate numbers
    let startTimestamp: number | null = null;
    const duration = 1500;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);

      // Easing function: outQuad
      const easeProgress = progress * (2 - progress);

      setDisplayScore(Math.floor(easeProgress * correctCount));
      setDisplayPercent(Math.floor(easeProgress * scorePercent));

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, [correctCount, scorePercent]);

  // Performance mapping
  const performance = useMemo(() => {
    if (scorePercent === 100) return { title: 'Mastermind!', emoji: '🧠🔥', sub: 'Flawless victory! You know your stuff.' };
    if (scorePercent >= 80) return { title: 'Excellent!', emoji: '🌟👏', sub: 'Incredible job! You\'re almost there.' };
    if (scorePercent >= 60) return { title: 'Good Effort!', emoji: '👍📖', sub: 'Well done! A bit more study and you\'ll be a pro.' };
    return { title: 'Keep Going!', emoji: '💪📈', sub: 'Persistence is key. Let\'s try one more time.' };
  }, [scorePercent]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Quiz Results</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {/* Main Score Display */}
          <View style={styles.scoreContainer}>
            <LinearGradient
              colors={isDarkMode ? ['#3B82F6', '#2563EB'] : ['#60A5FA', '#3B82F6']}
              style={styles.scoreCircle}
            >
              <Text style={styles.scoreText}>{displayPercent}%</Text>
              <Text style={styles.scoreSubtext}>ACCURACY</Text>
            </LinearGradient>

            {/* Background Glow */}
            <View style={[styles.glow, { backgroundColor: isDarkMode ? '#3B82F6' : '#93C5FD', opacity: isDarkMode ? 0.2 : 0.3 }]} />
          </View>

          {/* Performance Message */}
          <Text style={[styles.performanceEmoji]}>{performance.emoji}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{performance.title}</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {performance.sub}
          </Text>

          {/* Detailed Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.statHeader}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Correct</Text>
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>{displayScore} / {totalQuestions}</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.statHeader}>
                <Ionicons name="close-circle" size={16} color="#EF4444" />
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Wrong</Text>
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>{wrongCount}</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.statHeader}>
                <Ionicons name="play-skip-forward-circle" size={16} color={colors.textMuted} />
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Skipped</Text>
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>{skippedCount}</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={() => {
                onPlaySound?.('start');
                onHaptic?.('selection');
                onRetake();
              }}
              style={[styles.retakeButton, { borderColor: colors.border }]}
            >
              <Ionicons name="refresh" size={20} color={colors.text} />
              <Text style={[styles.buttonText, { color: colors.text }]}>Retake</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                onPlaySound?.('tap');
                onHaptic?.('selection');
                onReview();
              }}
              style={[styles.reviewButton, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.reviewButtonText}>Review Answers</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
  },
  headerSpacer: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 60,
  },
  scoreContainer: {
    width: 180,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    position: 'relative',
  },
  scoreCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  glow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    zIndex: 1,
  },
  scoreText: {
    fontSize: 48,
    fontFamily: 'Nunito-Bold',
    color: '#FFFFFF',
  },
  scoreSubtext: {
    fontSize: 12,
    fontFamily: 'Nunito-Bold',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 2,
    marginTop: -4,
  },
  performanceEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Nunito-Bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    fontFamily: 'Nunito-Medium',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    width: '100%',
    marginBottom: 48,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statLabel: {
    fontSize: 14,
    fontFamily: 'Nunito-Bold',
  },
  statValue: {
    fontSize: 22,
    fontFamily: 'Nunito-Bold',
  },
  footer: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  retakeButton: {
    flex: 1,
    height: 56,
    borderRadius: 20,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'Nunito-Bold',
  },
  reviewButton: {
    flex: 2,
    height: 56,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  reviewButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Nunito-Bold',
  },
});







