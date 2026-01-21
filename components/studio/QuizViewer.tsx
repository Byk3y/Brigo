/**
 * QuizViewer - Interactive quiz interface with multiple choice questions
 * Refactored with component-based architecture
 */

import React, { useEffect, useRef } from 'react';
import { ScrollView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ResponsiveContainer from '@/lib/components/ResponsiveContainer';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { useFeedback } from '@/lib/feedback';
import { useStore } from '@/lib/store';
import { useQuizState } from '@/hooks/useQuizState';
import { QuizHeader } from '@/components/quiz/QuizHeader';
import { QuestionCard } from '@/components/quiz/QuestionCard';
import { AnswerOptions } from '@/components/quiz/AnswerOptions';
import { HintSection } from '@/components/quiz/HintSection';
import { QuizNavigation } from '@/components/quiz/QuizNavigation';
import { QuizResults } from '@/components/quiz/QuizResults';
import { calculateMetrics } from '@/lib/quiz/utils';
import type { QuizViewerProps } from '@/lib/quiz/types';

const isPad = Platform.OS === 'ios' && Platform.isPad;

export const QuizViewer: React.FC<QuizViewerProps> = ({ quiz, onClose, onComplete }) => {
  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);
  const { play, haptic, preload } = useFeedback();
  const { petState } = useStore();
  const petName = petState?.name || 'Maria';
  const scrollRef = useRef<ScrollView | null>(null);

  // Preload key sounds used in quiz
  useEffect(() => {
    preload(['correct', 'incorrect', 'complete', 'hint']);
  }, [preload]);

  // Use quiz state hook
  const quizState = useQuizState({
    quiz,
    onComplete,
    onPlaySound: play,
    onHaptic: haptic,
  });

  const {
    currentQuestionIndex,
    answers,
    submittedAnswers,
    revealedHints,
    isReviewMode,
    showResults,
    optionLayouts,
    handleSelectAnswer,
    handleNext,
    handlePrevious,
    handleRevealHint,
    resetQuiz,
    enterReviewMode,
    handleOptionLayout,
  } = quizState;

  const currentQuestion = quiz.questions[currentQuestionIndex];

  // Safety check: ensure current question exists
  if (!currentQuestion) {
    console.error('[QuizViewer] Invalid question index or empty quiz');
    return null;
  }
  const selectedAnswer = answers[currentQuestion.id];
  const isSubmitted = submittedAnswers[currentQuestion.id];
  const isCorrect = selectedAnswer === currentQuestion.correct;
  const wasSkipped = isReviewMode && !selectedAnswer;
  const hintAvailable = currentQuestion.hint && currentQuestion.hint.trim().length > 0;
  const hintRevealed = revealedHints[currentQuestion.id];

  // Feedback when an answer state changes to submitted
  useEffect(() => {
    if (!isSubmitted || !selectedAnswer) return;

    if (isCorrect) {
      play('correct');
      haptic('success');
    } else {
      play('incorrect');
      haptic('error');
    }
  }, [isSubmitted, selectedAnswer, isCorrect, play, haptic]);

  // Auto-scroll to the highlighted option in review/submitted state
  useEffect(() => {
    const layouts = optionLayouts[currentQuestion.id];
    if (!layouts) return;

    const targetKey = selectedAnswer && !isCorrect ? selectedAnswer : currentQuestion.correct;
    const targetY = layouts[targetKey];
    if (targetY !== undefined && scrollRef.current) {
      const y = Math.max(targetY - 60, 0);
      scrollRef.current.scrollTo({ y, animated: true });
    }
  }, [currentQuestion.id, currentQuestion.correct, selectedAnswer, isCorrect, isSubmitted, isReviewMode, optionLayouts]);

  // Calculate metrics for results screen
  const metrics = showResults ? calculateMetrics(answers, quiz.questions) : null;

  // Results screen
  if (showResults && metrics) {
    return (
      <QuizResults
        scorePercent={metrics.scorePercent}
        correctCount={metrics.correctCount}
        totalQuestions={quiz.questions.length}
        wrongCount={metrics.wrongCount}
        skippedCount={metrics.skippedCount}
        onClose={onClose}
        onRetake={resetQuiz}
        onReview={enterReviewMode}
        colors={colors}
        isDarkMode={isDarkMode}
        onPlaySound={play}
        onHaptic={haptic}
      />
    );
  }

  // Question screen
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <QuizHeader
        title={quiz.title}
        currentIndex={currentQuestionIndex}
        totalQuestions={quiz.questions.length}
        isReviewMode={isReviewMode}
        onClose={onClose}
        colors={colors}
        isDarkMode={isDarkMode}
      />

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: 40,
          paddingTop: 12
        }}
      >
        <ResponsiveContainer maxWidth={isPad ? 800 : 500} withPadding={true}>
          <QuestionCard question={currentQuestion.question} wasSkipped={wasSkipped} colors={colors} />

          <AnswerOptions
            question={currentQuestion}
            selectedAnswer={selectedAnswer}
            isSubmitted={isSubmitted}
            isReviewMode={isReviewMode}
            answers={answers}
            onSelectAnswer={handleSelectAnswer}
            onOptionLayout={handleOptionLayout}
            colors={colors}
            isDarkMode={isDarkMode}
          />

          <HintSection
            hint={currentQuestion.hint}
            hintAvailable={hintAvailable}
            hintRevealed={hintRevealed}
            petName={petName}
            onRevealHint={handleRevealHint}
            isReviewMode={isReviewMode}
            colors={colors}
            isDarkMode={isDarkMode}
          />
        </ResponsiveContainer>
      </ScrollView>

      <QuizNavigation
        currentIndex={currentQuestionIndex}
        totalQuestions={quiz.questions.length}
        onPrevious={handlePrevious}
        onNext={handleNext}
        colors={colors}
      />
    </SafeAreaView>
  );
};
