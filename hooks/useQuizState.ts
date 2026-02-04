/**
 * Quiz State Hook
 * Manages all business logic for quiz interaction
 */

import { useState, useCallback, useRef } from 'react';
import type { Quiz, AnswerOption } from '@/lib/quiz/types';
import { useStore } from '@/lib/store';
import { completionService } from '@/lib/services/completionService';
import { calculateScore, calculateMetrics } from '@/lib/quiz/utils';
import { track } from '@/lib/services/analyticsService';
import type { UseQuizStateReturn } from '@/lib/quiz/types';
import { useCelebration } from '@/lib/contexts/CelebrationContext';

interface UseQuizStateProps {
  quiz: Quiz;
  onComplete?: (score: number) => void;
  onPlaySound: (sound: string) => void;
  onHaptic: (type: string) => void;
}

export function useQuizState({
  quiz,
  onComplete,
  onPlaySound,
  onHaptic,
}: UseQuizStateProps): UseQuizStateReturn {
  // State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerOption>>({});
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, boolean>>({});
  const [revealedHints, setRevealedHints] = useState<Record<string, boolean>>({});
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [optionLayouts, setOptionLayouts] = useState<Record<string, Record<string, number>>>({});

  // Task completion tracking
  const completionRecordedRef = useRef(false);
  const sessionStartRef = useRef(Date.now());
  const trackingInitRef = useRef(false);
  const { authUser, checkAndAwardTask, refreshTaskProgress, getUserTimezone } = useStore();
  const { triggerCelebration } = useCelebration();

  const totalQuestions = quiz.questions.length;
  const currentQuestion = quiz.questions[currentQuestionIndex];

  // Track quiz start (only once)
  if (!trackingInitRef.current && totalQuestions > 0) {
    trackingInitRef.current = true;
    track('quiz_started', {
      quiz_id: quiz.id,
      notebook_id: quiz.notebook_id,
      total_questions: totalQuestions,
    });
  }

  // Validate quiz has questions
  if (totalQuestions === 0) {
    console.error('[useQuizState] Quiz has no questions');
  }

  // Handle answer selection - auto-submit on selection
  const handleSelectAnswer = useCallback(
    (option: AnswerOption) => {
      if (isReviewMode || !currentQuestion) return;

      // Set the answer
      setAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: option,
      }));

      // Auto-submit immediately
      setSubmittedAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: true,
      }));

      // Record individual question answer for daily task
      if (authUser) {
        completionService.recordQuizQuestionAnswer(authUser.id, currentQuestion.id).then(async () => {
          // Check for "Answer 5 questions" task completion
          const timezone = await getUserTimezone();
          await completionService.checkAndAwardTaskIfThresholdMet(
            authUser.id,
            'quiz_5_questions',
            timezone,
            5,
            async () => {
              const res = await checkAndAwardTask('quiz_5_questions');
              if (res.success && (res.newPoints ?? 0) > 0) {
                triggerCelebration();
              }
              return res;
            }
          );
          // Refresh progress for UI
          await refreshTaskProgress('quiz_5_questions');
        });
      }
    },
    [currentQuestion, isReviewMode, authUser, getUserTimezone, checkAndAwardTask, refreshTaskProgress]
  );

  // Calculate and show results
  const calculateResults = useCallback(async () => {
    const scorePercent = calculateScore(answers, quiz.questions);
    const durationSeconds = Math.round((Date.now() - sessionStartRef.current) / 1000);

    setShowResults(true);
    if (onComplete) {
      onComplete(scorePercent);
    }

    // Track quiz completion
    const metrics = calculateMetrics(answers, quiz.questions);
    track('quiz_completed', {
      quiz_id: quiz.id,
      notebook_id: quiz.notebook_id,
      score_percent: scorePercent,
      correct_count: metrics.correctCount,
      total_questions: totalQuestions,
      duration_seconds: durationSeconds,
      is_perfect_score: scorePercent === 100,
    });

    // Record quiz completion for daily task (only once per quiz session)
    if (!completionRecordedRef.current && authUser) {
      completionRecordedRef.current = true;

      try {
        // Record quiz completion via service
        await completionService.recordQuizCompletion(
          authUser.id,
          quiz.id,
          scorePercent,
          totalQuestions,
          metrics.correctCount
        );

        // Check if threshold is met and award task
        const timezone = await getUserTimezone();

        // Check if perfect score and award task
        if (scorePercent === 100) {
          await completionService.checkAndAwardTaskIfThresholdMet(
            authUser.id,
            'quiz_perfect_score' as any,
            timezone,
            1,
            () => checkAndAwardTask('quiz_perfect_score')
          );
        }
      } catch (err) {
        // Silent fail - don't block user experience for task tracking
        console.log('[useQuizState] Completion record failed:', err);
      }
    }
  }, [answers, quiz, totalQuestions, onComplete, authUser, refreshTaskProgress, getUserTimezone, checkAndAwardTask]);

  // Navigate to next question
  const handleNext = useCallback(() => {
    if (currentQuestionIndex < totalQuestions - 1) {
      onPlaySound('tap');
      onHaptic('selection');
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      onPlaySound('complete');
      onHaptic('success');
      // In review mode, just return to results without recalculating
      if (isReviewMode) {
        setShowResults(true);
        setIsReviewMode(false);
      } else {
        calculateResults();
      }
    }
  }, [currentQuestionIndex, totalQuestions, isReviewMode, onPlaySound, onHaptic, calculateResults]);

  // Navigate to previous question
  const handlePrevious = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  }, [currentQuestionIndex]);

  // Reveal hint
  const handleRevealHint = useCallback(() => {
    if (!currentQuestion) return;
    const hintAvailable = currentQuestion.hint && currentQuestion.hint.trim().length > 0;
    if (!hintAvailable || isReviewMode) return;

    onPlaySound('hint');
    onHaptic('light');
    setRevealedHints((prev) => ({ ...prev, [currentQuestion.id]: true }));
  }, [currentQuestion, isReviewMode, onPlaySound, onHaptic]);

  // Reset quiz for retake
  const resetQuiz = useCallback(() => {
    setShowResults(false);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setSubmittedAnswers({});
    setRevealedHints({});
    setIsReviewMode(false);
    completionRecordedRef.current = false;
  }, []);

  // Enter review mode
  const enterReviewMode = useCallback(() => {
    setShowResults(false);
    setCurrentQuestionIndex(0);
    setIsReviewMode(true);
  }, []);

  // Handle option layout tracking
  const handleOptionLayout = useCallback((questionId: string, option: AnswerOption, y: number) => {
    setOptionLayouts((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        [option]: y,
      },
    }));
  }, []);

  return {
    // State
    currentQuestionIndex,
    answers,
    submittedAnswers,
    revealedHints,
    isReviewMode,
    showResults,
    optionLayouts,
    // Setters
    setCurrentQuestionIndex,
    setAnswers,
    setSubmittedAnswers,
    setRevealedHints,
    setIsReviewMode,
    setShowResults,
    setOptionLayouts,
    // Actions
    handleSelectAnswer,
    handleNext,
    handlePrevious,
    handleRevealHint,
    calculateResults,
    resetQuiz,
    enterReviewMode,
    handleOptionLayout,
  };
}

