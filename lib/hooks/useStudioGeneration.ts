import { useState, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { generateStudioContent } from '@/lib/api/studioApi';
import { generatePodcast } from '@/lib/api/podcastApi';
import { generateExamPrediction } from '@/lib/api/examPredictionApi';
import { podcastService } from '@/lib/services/podcastService';
import { storageService } from '@/lib/storage/storageService';
import { useStore } from '@/lib/store';
import type { Podcast, ExamPrediction } from '@/lib/store/types';
import { useErrorHandler } from './useErrorHandler';
import { checkQuotaRemaining } from '@/lib/services/subscriptionService';
import type { LimitReason, SubscriptionData } from '@/lib/services/subscriptionService';
import { useUpgrade } from '@/lib/hooks/useUpgrade';


interface UseStudioGenerationParams {
  notebookId: string;
  flashcardsCount: number;
  quizzesCount: number;
  podcastsCount: number;
  examPredictionsCount: number;
  setPodcasts: React.Dispatch<React.SetStateAction<Podcast[]>>;
  setExamPredictions: React.Dispatch<React.SetStateAction<ExamPrediction[]>>;
  refreshContent: () => Promise<void>;
  // From useAudioGeneration hook
  setGeneratingType: (type: 'flashcards' | 'quiz' | 'audio' | 'prediction' | null) => void;
  setGeneratingAudioId: (id: string | null) => void;
  startAudioPolling: (overviewId: string) => void;
  startPredictionPolling: (predictionId: string) => void;
  startFlashcardsPolling: (setId: string) => void;
  startQuizPolling: (quizId: string) => void;
  checkForPendingPrediction: () => Promise<void>;
}


export const useStudioGeneration = ({
  notebookId,
  flashcardsCount,
  quizzesCount,
  podcastsCount,
  examPredictionsCount,
  setPodcasts,
  setExamPredictions,
  refreshContent,
  setGeneratingType,
  setGeneratingAudioId,
  startAudioPolling,
  startPredictionPolling,
  startFlashcardsPolling,
  startQuizPolling,
  checkForPendingPrediction,
}: UseStudioGenerationParams) => {

  const { checkAndAwardTask, tier, status, isExpired, studioGenerationsCount, audioGenerationsCount, subscriptionSyncedAt, user, notebooks, cachedPetState, flashcardsStudied, notify, addStudioJob, removeStudioJob } = useStore();
  const { handleError, withErrorHandling } = useErrorHandler();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeModalSource, setUpgradeModalSource] = useState<'create_attempt' | null>(null);
  const [limitReason, setLimitReason] = useState<LimitReason>(null);
  const { trackCreateAttemptBlocked, trackUpgradeModalShown, trackUpgradeModalDismissed, trackUpgradeButtonClicked } = useUpgrade();

  // Memoize subscription object for quota checks to avoid unnecessary re-renders
  const subscription: SubscriptionData = useMemo(() => ({
    tier,
    status,
    studioGenerationsCount,
    audioGenerationsCount,
    isExpired,
    subscriptionSyncedAt,
  }), [tier, status, studioGenerationsCount, audioGenerationsCount, isExpired, subscriptionSyncedAt]);

  /**
   * Get notebook title for notifications
   */
  const notebookTitle = useMemo(() => {
    return notebooks.find(n => n.id === notebookId)?.title || 'your notebook';
  }, [notebooks, notebookId]);

  /**
   * Generate flashcards for the notebook. Pass retryId to delete a prior
   * failed set before regenerating (avoids clutter in the list).
   */
  const handleGenerateFlashcards = useCallback(async (retryId?: string) => {
    try {
      if (retryId) {
        try {
          const { studioService } = await import('@/lib/services/studioService');
          await studioService.deleteFlashcardSet(retryId);
        } catch (err) {
          console.error('Error deleting failed flashcard set on retry:', err);
        }
      }

      const quotaCheck = checkQuotaRemaining('studio', subscription);

      if (!quotaCheck.hasQuota) {
        trackCreateAttemptBlocked('flashcards');
        trackUpgradeModalShown('create_attempt');
        setUpgradeModalSource('create_attempt');
        setLimitReason(quotaCheck.reason);
        setShowUpgradeModal(true);
        return;
      }

      // Skip the confirmation dialog on retry — user already decided.
      if (!retryId) {
        const ok = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Flashcards',
            flashcardsCount > 0
              ? `You already have ${flashcardsCount} flashcards. Generate more?`
              : 'Generate flashcards for this notebook?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Generate', onPress: () => resolve(true) }
            ]
          );
        });
        if (!ok) return;
      }

      setGeneratingType('flashcards');

      // Optimistic slice entry so the dot shows instantly. Temp id is replaced
      // with the real content_id once the edge function responds.
      const optimisticId = `optimistic-flashcards-${Date.now()}`;
      addStudioJob(notebookId, { id: optimisticId, type: 'flashcards', startedAt: Date.now() });

      let result;
      try {
        result = await generateStudioContent({
          notebook_id: notebookId,
          content_type: 'flashcards',
        });
      } catch (err) {
        removeStudioJob(notebookId, optimisticId);
        throw err;
      }

      removeStudioJob(notebookId, optimisticId);
      addStudioJob(notebookId, {
        id: result.content_id,
        type: 'flashcards',
        startedAt: Date.now(),
      });

      await refreshContent();
      startFlashcardsPolling(result.content_id);
    } catch (error: any) {
      setGeneratingType(null);
    }
  }, [notebookId, flashcardsCount, setGeneratingType, refreshContent, subscription, trackCreateAttemptBlocked, trackUpgradeModalShown, addStudioJob, removeStudioJob, startFlashcardsPolling]);

  /**
   * Generate quiz for the notebook. Pass retryId to delete a prior failed
   * quiz before regenerating.
   */
  const handleGenerateQuiz = useCallback(async (retryId?: string) => {
    try {
      if (retryId) {
        try {
          const { studioService } = await import('@/lib/services/studioService');
          await studioService.deleteQuiz(retryId);
        } catch (err) {
          console.error('Error deleting failed quiz on retry:', err);
        }
      }

      const quotaCheck = checkQuotaRemaining('studio', subscription);

      if (!quotaCheck.hasQuota) {
        trackCreateAttemptBlocked('quiz');
        trackUpgradeModalShown('create_attempt');
        setUpgradeModalSource('create_attempt');
        setLimitReason(quotaCheck.reason);
        setShowUpgradeModal(true);
        return;
      }

      if (!retryId) {
        const ok = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Quiz',
            quizzesCount > 0
              ? `You already have ${quizzesCount} quizzes. Generate another?`
              : 'Generate a quiz for this notebook?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Generate', onPress: () => resolve(true) }
            ]
          );
        });
        if (!ok) return;
      }

      setGeneratingType('quiz');

      const optimisticId = `optimistic-quiz-${Date.now()}`;
      addStudioJob(notebookId, { id: optimisticId, type: 'quiz', startedAt: Date.now() });

      let result;
      try {
        result = await generateStudioContent({
          notebook_id: notebookId,
          content_type: 'quiz',
        });
      } catch (err) {
        removeStudioJob(notebookId, optimisticId);
        throw err;
      }

      removeStudioJob(notebookId, optimisticId);
      addStudioJob(notebookId, {
        id: result.content_id,
        type: 'quiz',
        startedAt: Date.now(),
      });

      await refreshContent();

      startQuizPolling(result.content_id);
    } catch (error: any) {
      setGeneratingType(null);
    }
  }, [notebookId, quizzesCount, setGeneratingType, refreshContent, subscription, trackCreateAttemptBlocked, trackUpgradeModalShown, addStudioJob, removeStudioJob, startQuizPolling]);

  /**
   * Generate podcast for the notebook
   */
  const handleGeneratePodcast = useCallback(async () => {
    // Check quota before proceeding with detailed reason
    const quotaCheck = checkQuotaRemaining('audio', subscription);
    if (!quotaCheck.hasQuota) {
      trackCreateAttemptBlocked('podcast');
      trackUpgradeModalShown('create_attempt');
      setUpgradeModalSource('create_attempt');
      setLimitReason(quotaCheck.reason);
      setShowUpgradeModal(true);
      return;
    }
    try {
      // TODO: Implement confirmation dialog with centralized error handling
      const ok = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Generate Podcast',
          podcastsCount > 0
            ? `You already have ${podcastsCount} podcasts. Generate another?`
            : 'Generate a podcast for this notebook?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Generate', onPress: () => resolve(true) }
          ]
        );
      });

      if (!ok) return;

      setGeneratingType('audio');

      const optimisticId = `optimistic-audio-${Date.now()}`;
      addStudioJob(notebookId, { id: optimisticId, type: 'audio', startedAt: Date.now() });

      let result;
      try {
        result = await generatePodcast(notebookId);
      } catch (err) {
        removeStudioJob(notebookId, optimisticId);
        throw err;
      }

      removeStudioJob(notebookId, optimisticId);
      setGeneratingAudioId(result.overview_id);
      addStudioJob(notebookId, {
        id: result.overview_id,
        type: 'audio',
        startedAt: Date.now(),
      });

      // Start polling for status updates
      startAudioPolling(result.overview_id);
    } catch (error: any) {
      // Check if generation actually started on the server despite the error
      // This handles network errors that occur after generation starts
      if (error?.isNetworkError) {
        // If API layer already confirmed generation started, use that info
        if (error?.generationStarted && error?.overviewId) {
          // Generation started! Restore state and continue polling
          setGeneratingType('audio');
          setGeneratingAudioId(error.overviewId);
          startAudioPolling(error.overviewId);
          return; // Don't show error - generation is in progress
        }

        // Otherwise, check for pending audio generation
        try {
          const pendingAudio = await podcastService.findPending(notebookId);

          if (pendingAudio) {
            // Generation actually started! Restore state and continue polling
            setGeneratingType('audio');
            setGeneratingAudioId(pendingAudio.id);
            addStudioJob(notebookId, {
              id: pendingAudio.id,
              type: 'audio',
              startedAt: Date.now(),
            });
            startAudioPolling(pendingAudio.id);
            return; // Don't show error - generation is in progress
          }
        } catch {
          // No pending audio found, fall through to show error
        }
      }

      // Only clear state and show error if generation didn't actually start
      setGeneratingType(null);
      setGeneratingAudioId(null);

      // Error already handled by API layer and displayed via ErrorNotificationContext
      // No need for Alert.alert - error UI will show automatically
    }
  }, [
    notebookId,
    podcastsCount,
    setGeneratingType,
    setGeneratingAudioId,
    startAudioPolling,
    subscription,
    trackCreateAttemptBlocked,
    trackUpgradeModalShown,
    addStudioJob,
    removeStudioJob,
  ]);

  /**
   * Generate exam predictions for the notebook
   */
  const handleGeneratePrediction = useCallback(async (retryId?: string) => {
    try {
      // If retrying, delete the old failed record first to avoid clutter
      if (retryId) {
        try {
          const { examPredictionService } = await import('@/lib/services/examPredictionService');
          await examPredictionService.delete(retryId);
          setExamPredictions((prev) => prev.filter((p) => p.id !== retryId));
        } catch (err) {
          console.error('Error deleting failed prediction on retry:', err);
        }
      }

      // Check quota before proceeding (uses studio quota)
      const quotaCheck = checkQuotaRemaining('studio', subscription);
      if (!quotaCheck.hasQuota) {
        trackCreateAttemptBlocked('prediction');
        trackUpgradeModalShown('create_attempt');
        setUpgradeModalSource('create_attempt');
        setLimitReason(quotaCheck.reason);
        setShowUpgradeModal(true);
        return;
      }

      const ok = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Predict Questions',
          examPredictionsCount > 0
            ? `You already have ${examPredictionsCount} predictions. Generate another?`
            : 'Analyze your notes and predict likely exam questions?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Generate', onPress: () => resolve(true) }
          ]
        );
      });

      if (!ok) return;

      setGeneratingType('prediction');

      const optimisticId = `optimistic-prediction-${Date.now()}`;
      addStudioJob(notebookId, { id: optimisticId, type: 'prediction', startedAt: Date.now() });

      let result;
      try {
        result = await generateExamPrediction({
          notebook_id: notebookId,
        });
      } catch (err) {
        removeStudioJob(notebookId, optimisticId);
        throw err;
      }

      removeStudioJob(notebookId, optimisticId);

      // Start polling for the prediction result
      if (result.prediction_id) {
        addStudioJob(notebookId, {
          id: result.prediction_id,
          type: 'prediction',
          startedAt: Date.now(),
        });
        startPredictionPolling(result.prediction_id);
      } else {
        // Fallback: if somehow no ID was returned, refresh immediately
        await refreshContent();
        setGeneratingType(null);
      }
    } catch (error: any) {
      setGeneratingType(null);
      // Error already handled by API layer and displayed via ErrorNotificationContext
    }
  }, [notebookId, examPredictionsCount, setGeneratingType, startPredictionPolling, refreshContent, subscription, trackCreateAttemptBlocked, trackUpgradeModalShown, notebookTitle, notify, addStudioJob, setExamPredictions]);

  /**
   * Delete a podcast
   */
  const handleDeletePodcast = useCallback(
    (overview: Podcast) => {
      Alert.alert(
        'Delete Podcast',
        `Are you sure you want to delete "${overview.title}"? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                // Delete from storage if path exists
                if (overview.storage_path) {
                  await storageService.deleteFile(overview.storage_path);
                }

                // Delete from database
                await podcastService.delete(overview.id);

                // Update local state without refetching everything
                setPodcasts((prev) => prev.filter((a) => a.id !== overview.id));

                Alert.alert('Deleted', 'Podcast has been deleted.');
              } catch (error: any) {
                // Error already handled by services and displayed via ErrorNotificationContext
                // No need for Alert.alert - error UI will show automatically
              }
            },
          },
        ]
      );
    },
    [setPodcasts, handleError]
  );

  /**
   * Delete an exam prediction
   */
  const handleDeletePrediction = useCallback(
    (prediction: ExamPrediction) => {
      Alert.alert(
        'Delete Predictions',
        `Are you sure you want to delete "${prediction.title}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                const { examPredictionService } = await import('@/lib/services/examPredictionService');
                await examPredictionService.delete(prediction.id);
                setExamPredictions((prev) => prev.filter((p) => p.id !== prediction.id));
              } catch (error: any) {
                // Ignore
              }
            },
          },
        ]
      );
    },
    [setExamPredictions]
  );

  // Calculate pet level
  const petLevel = Math.floor((cachedPetState?.points || 0) / 50) + 1;
  const petName = cachedPetState?.name || 'Sparky';

  return {
    handleGenerateFlashcards,
    handleGenerateQuiz,
    handleGeneratePodcast,
    handleGeneratePrediction,
    handleDeletePodcast,
    handleDeletePrediction,
    showUpgradeModal,
    setShowUpgradeModal,
    upgradeModalSource,
    upgradeModalProps: {
      notebooksCount: notebooks.length,
      flashcardsStudied: flashcardsStudied,
      streakDays: user.streak || 0,
      petName,
      petLevel,
      limitReason,
    },
  };
};