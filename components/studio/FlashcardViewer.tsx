/**
 * FlashcardViewer - Modern minimalist flashcard viewer
 * Features: tap to flip, swipe navigation, dark card design
 * Updated: Dark mode support
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Dimensions, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { StudioFlashcard } from '@/lib/store/types';
import { useStore } from '@/lib/store';
import { studioService } from '@/lib/services/studioService';
import { completionService } from '@/lib/services/completionService';
import { taskService } from '@/lib/services/taskService';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { useFeedback } from '@/lib/feedback';
import { useCelebration } from '@/lib/contexts/CelebrationContext';

interface FlashcardViewerProps {
  flashcards: StudioFlashcard[];
  initialIndex?: number;
  onClose: () => void;
  title?: string;
  setId?: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isPad = Platform.OS === 'ios' && Platform.isPad;
const CARD_WIDTH = isPad ? Math.min(SCREEN_WIDTH - 200, 800) : SCREEN_WIDTH - 80;
const CARD_HEIGHT = isPad ? Math.min(SCREEN_HEIGHT * 0.65, 900) : SCREEN_HEIGHT * 0.58;

export const FlashcardViewer: React.FC<FlashcardViewerProps> = ({
  flashcards,
  initialIndex = 0,
  onClose,
  title = 'Flashcards',
  setId,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isFlipped, setIsFlipped] = useState(false);

  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);
  const { play, haptic } = useFeedback();
  const { triggerCelebration } = useCelebration();

  // Animation values
  const flipRotation = useSharedValue(0);

  // Track completed cards to prevent duplicate DB writes
  const completedCardsRef = useRef(new Set<string>());

  const { authUser, checkAndAwardTask, getUserTimezone } = useStore();
  const notebookId = flashcards[0]?.notebook_id;

  // Keep state in sync if parent passes a different starting index (resume)
  useEffect(() => {
    setCurrentIndex(initialIndex);
    setIsFlipped(false);
    flipRotation.value = 0;
  }, [initialIndex, flipRotation]);

  const persistProgress = useCallback(
    async (indexToSave: number) => {
      if (!authUser || !notebookId) return;
      const card = flashcards[indexToSave];
      if (!card) return;

      try {
        await studioService.upsertFlashcardProgress(
          notebookId,
          authUser.id,
          card.id,
          indexToSave,
          setId
        );
      } catch (err) {
        // Silently ignore; progress save failures shouldn't block UI
      }
    },
    [authUser, flashcards, notebookId]
  );

  // Helper to record completion
  const recordCompletion = async (cardId: string) => {
    if (!authUser) return;

    // Skip if already recorded this session
    if (completedCardsRef.current.has(cardId)) return;
    completedCardsRef.current.add(cardId);

    try {
      // Record completion via service
      await completionService.recordFlashcardCompletion(authUser.id, cardId);

      // Check if we've reached 5 cards for the task
      const timezone = await getUserTimezone();
      await completionService.checkAndAwardTaskIfThresholdMet(
        authUser.id,
        'study_flashcards',
        timezone,
        5,
        async () => {
          const res = await checkAndAwardTask('study_flashcards');
          if (res.success) {
            triggerCelebration();
          }
          return res;
        }
      );
    } catch (e) {
      // Log but don't block - might be duplicate constraint
      console.log('[FlashcardViewer] Completion record failed (may be duplicate):', e);
    }
  };

  // Flip gesture - record completion when revealing answer?
  // Or when navigating away?
  // Let's do it when revealing answer (flipping).
  const flipCard = () => {
    // Only play sound when revealing the answer (not when going back to question)
    if (!isFlipped) {
      play('reveal');
    }
    haptic('selection');
    flipRotation.value = withTiming(isFlipped ? 0 : 180, { duration: 400 });

    if (!isFlipped) {
      // We are revealing the answer -> Mark as completed
      recordCompletion(flashcards[currentIndex].id);
    }

    setIsFlipped(!isFlipped);
    persistProgress(currentIndex);
  };

  // Navigation
  const goToNext = () => {
    if (currentIndex < flashcards.length - 1) {
      play('flip');
      haptic('light');
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
      flipRotation.value = 0;
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      play('flip');
      haptic('light');
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
      flipRotation.value = 0;
    }
  };

  // Tap gesture - for flipping the card
  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      runOnJS(flipCard)();
    });

  // Swipe gesture - detects swipe for navigation
  const panGesture = Gesture.Pan()
    .onEnd((event) => {
      const isSwipe = Math.abs(event.translationX) > 50; // Swipe detection threshold

      if (isSwipe) {
        // Swipe detected - navigate
        if (event.translationX > 0 && currentIndex > 0) {
          runOnJS(goToPrevious)();
        } else if (event.translationX < 0 && currentIndex < flashcards.length - 1) {
          runOnJS(goToNext)();
        }
      }
    });

  // Combine gestures - tap has priority
  const combinedGesture = Gesture.Race(tapGesture, panGesture);

  // Card animation styles
  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipRotation.value, [0, 180], [0, 180]);
    const opacity = interpolate(flipRotation.value, [0, 90, 180], [1, 0, 0]);

    return {
      transform: [
        { rotateY: `${rotateY}deg` },
      ],
      opacity,
    };
  });

  const backAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipRotation.value, [0, 180], [180, 360]);
    const opacity = interpolate(flipRotation.value, [0, 90, 180], [0, 0, 1]);

    return {
      transform: [
        { rotateY: `${rotateY}deg` },
      ],
      opacity,
    };
  });

  const currentCard = flashcards[currentIndex];

  // Persist whenever the index changes (navigation or resume)
  useEffect(() => {
    persistProgress(currentIndex);
  }, [currentIndex, persistProgress]);

  // No cleanup needed (progress writes are immediate)
  useEffect(() => undefined, []);

  // Dynamic card color based on theme
  const cardBgColor = isDarkMode ? '#3f3f46' : '#3f3f46'; // Keep dark cards in both modes for flashcards
  const stackedCard2Opacity = isDarkMode ? 0.5 : 0.7;
  const stackedCard3Opacity = isDarkMode ? 0.3 : 0.5;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: isPad ? 40 : 24, paddingVertical: isPad ? 32 : 16 }}>
        {/* Header */}
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={isPad ? 32 : 24} color={colors.icon} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: 16 }}>
          <Text
            style={{
              fontSize: isPad ? 22 : 18,
              fontFamily: 'Nunito-Medium',
              color: colors.text,
              textAlign: 'center'
            }}
            numberOfLines={1}
          >
            {title} Flashcards
          </Text>
        </View>
        <View style={{ width: isPad ? 32 : 24 }} />{/* Spacer to balance the back arrow for centering */}
      </View>

      {/* Card Container */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        {/* Stacked cards effect - background cards */}
        <View style={[styles.card, styles.stackedCard3, { backgroundColor: cardBgColor, opacity: stackedCard3Opacity }]} />
        <View style={[styles.card, styles.stackedCard2, { backgroundColor: cardBgColor, opacity: stackedCard2Opacity }]} />

        <GestureDetector gesture={combinedGesture}>
          <TouchableOpacity
            activeOpacity={1}
            style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
          >
            {/* Front of card (Question) */}
            <Animated.View
              style={[
                styles.card,
                { backgroundColor: cardBgColor },
                frontAnimatedStyle,
              ]}
            >
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingVertical: 64 }}>
                <Text style={styles.questionText}>
                  {currentCard.question}
                </Text>
              </View>
              <View style={{ paddingBottom: isPad ? 40 : 32, alignItems: 'center' }}>
                <Text style={{ fontSize: isPad ? 16 : 14, color: '#a1a1aa', fontFamily: 'Nunito-Medium' }}>
                  See answer
                </Text>
              </View>
            </Animated.View>

            {/* Back of card (Answer) */}
            <Animated.View
              style={[
                styles.card,
                { backgroundColor: cardBgColor },
                backAnimatedStyle,
              ]}
            >
              {/* Answer Tag */}
              <View style={styles.answerTag}>
                <Text style={styles.answerTagText}>Answer</Text>
              </View>
              <View style={{ flex: 1, paddingHorizontal: isPad ? 60 : 40, paddingVertical: isPad ? 80 : 64 }}>
                <Text style={styles.answerText}>
                  {currentCard.answer}
                </Text>

                {!!currentCard.explanation && (
                  <View style={{ marginTop: isPad ? 32 : 24, paddingTop: isPad ? 32 : 24, borderTopWidth: 1, borderTopColor: '#525252' }}>
                    <Text style={{
                      fontSize: isPad ? 18 : 16,
                      color: '#d4d4d8',
                      lineHeight: isPad ? 28 : 24,
                      fontFamily: 'Nunito-Regular'
                    }}>
                      {currentCard.explanation}
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ paddingBottom: 32, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: '#a1a1aa' }}>
                  Swipe to navigate
                </Text>
              </View>
            </Animated.View>
          </TouchableOpacity>
        </GestureDetector>
      </View>

      {/* Navigation */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: isPad ? 80 : 48, paddingBottom: isPad ? 64 : 48 }}>
        <TouchableOpacity
          onPress={goToPrevious}
          disabled={currentIndex === 0}
          style={{
            width: isPad ? 72 : 56,
            height: isPad ? 72 : 56,
            borderRadius: isPad ? 36 : 28,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: currentIndex === 0 ? colors.border : '#3b82f6',
            backgroundColor: currentIndex === 0 ? colors.surface : 'transparent',
          }}
        >
          <Ionicons
            name="arrow-back"
            size={isPad ? 32 : 24}
            color={currentIndex === 0 ? colors.textMuted : '#3b82f6'}
          />
        </TouchableOpacity>

        <Text style={{ fontSize: isPad ? 24 : 18, color: colors.text, fontFamily: 'Nunito-Medium', minWidth: isPad ? 120 : 80, textAlign: 'center' }}>
          {currentIndex + 1} / {flashcards.length}
        </Text>

        <TouchableOpacity
          onPress={goToNext}
          disabled={currentIndex === flashcards.length - 1}
          style={{
            width: isPad ? 72 : 56,
            height: isPad ? 72 : 56,
            borderRadius: isPad ? 36 : 28,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: currentIndex === flashcards.length - 1 ? colors.border : '#3b82f6',
            backgroundColor: currentIndex === flashcards.length - 1 ? colors.surface : 'transparent',
          }}
        >
          <Ionicons
            name="arrow-forward"
            size={isPad ? 32 : 24}
            color={currentIndex === flashcards.length - 1 ? colors.textMuted : '#3b82f6'}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: isPad ? 44 : 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: isPad ? 20 : 12,
    elevation: 10,
    zIndex: 100,
    backfaceVisibility: 'hidden',
  },
  stackedCard2: {
    transform: [{ scale: 0.95 }, { translateY: 24 }],
    elevation: 2,
    zIndex: -1,
  },
  stackedCard3: {
    transform: [{ scale: 0.90 }, { translateY: 48 }],
    elevation: 1,
    zIndex: -2,
  },
  questionText: {
    fontSize: isPad ? 36 : 28,
    lineHeight: isPad ? 52 : 40,
    color: '#ffffff',
    textAlign: 'center',
    fontFamily: 'Nunito-Regular',
    letterSpacing: 0.2,
  },
  answerText: {
    fontSize: isPad ? 32 : 24,
    lineHeight: isPad ? 48 : 36,
    color: '#ffffff',
    fontFamily: 'Nunito-Medium',
    letterSpacing: 0.2,
  },
  answerTag: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(79, 91, 213, 0.2)',
    paddingHorizontal: isPad ? 16 : 12,
    paddingVertical: isPad ? 8 : 6,
    borderRadius: isPad ? 16 : 12,
    borderWidth: 1,
    borderColor: 'rgba(79, 91, 213, 0.4)',
    zIndex: 10,
  },
  answerTagText: {
    fontSize: isPad ? 15 : 12,
    color: '#818cf8',
    fontFamily: 'Nunito-SemiBold',
    letterSpacing: 0.5,
  },
});
