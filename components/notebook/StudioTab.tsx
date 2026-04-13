import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, View, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useStore, type Notebook } from '@/lib/store';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { useStudioContent } from '@/lib/hooks/useStudioContent';
import { usePodcastGeneration } from '@/lib/hooks/usePodcastGeneration';
import { useStudioGeneration } from '@/lib/hooks/useStudioGeneration';
import { useAppState } from '@/lib/hooks/useAppState';
import { StudioExtractingState } from './studio/StudioExtractingState';
import { GenerateOptionsSection } from './studio/GenerateOptionsSection';
import { GeneratedMediaSection } from './studio/GeneratedMediaSection';
import { UpgradeModal } from '@/components/upgrade/UpgradeModal';
import { useUpgrade } from '@/lib/hooks/useUpgrade';
import { SpotlightTourProvider, useSpotlightTour } from 'react-native-spotlight-tour';
import { STUDIO_TOUR_STEPS } from '@/lib/walkthrough/steps';
import { StudioWalkthroughTooltip } from '@/lib/walkthrough/WalkthroughTooltip';

// Inner component to trigger the tour
const StudioTourTrigger = () => {
  const { start } = useSpotlightTour();
  const { hasSeenStudioWalkthrough, setStudioWalkthroughSeen, _hasHydrated } = useStore();

  useEffect(() => {
    if (_hasHydrated && !hasSeenStudioWalkthrough) {
      const timer = setTimeout(() => {
        start();
        setStudioWalkthroughSeen();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [hasSeenStudioWalkthrough, _hasHydrated]);

  return null;
};

// Wrapper provider for the studio tour
const StudioTourController: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <SpotlightTourProvider
      steps={STUDIO_TOUR_STEPS}
      onBackdropPress="continue"
    >
      <StudioTourTrigger />
      {children}
    </SpotlightTourProvider>
  );
};

interface StudioTabProps {
  notebook: Notebook;
  onGenerateQuiz?: boolean;
}

export const StudioTab: React.FC<StudioTabProps> = ({
  notebook,
  onGenerateQuiz = false,
}) => {
  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);

  const {
    podcasts,
    flashcard_sets,
    quizzes,
    examPredictions,
    loading,
    refreshContent,
    setPodcasts,
    setExamPredictions,
    deletePodcast,
    deleteExamPrediction,
  } = useStudioContent(notebook.id);

  const {
    generatingType,
    setGeneratingType,
    audioProgress,
    setGeneratingAudioId,
    checkForPendingAudio,
    startAudioPolling,
    startPredictionPolling,
    startFlashcardsPolling,
    startQuizPolling,
    checkForPendingPrediction,
    checkForPendingFlashcards,
    checkForPendingQuiz,
  } = usePodcastGeneration(notebook.id, notebook.title, refreshContent);

  const {
    handleGenerateFlashcards,
    handleGenerateQuiz,
    handleGeneratePodcast,
    handleGeneratePrediction,
    handleDeletePodcast,
    handleDeletePrediction,
    showUpgradeModal,
    setShowUpgradeModal,
    upgradeModalSource,
    upgradeModalProps,
  } = useStudioGeneration({
    notebookId: notebook.id,
    flashcardsCount: flashcard_sets.length,
    quizzesCount: quizzes.length,
    podcastsCount: podcasts.length,
    examPredictionsCount: examPredictions.length,
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
  });

  const { trackUpgradeModalDismissed } = useUpgrade();

  const clearUnseenCompletions = useStore((s) => s.clearUnseenCompletions);

  useEffect(() => {
    checkForPendingAudio();
    checkForPendingPrediction();
    checkForPendingFlashcards();
    checkForPendingQuiz();
    // Clear "new material" dot for this notebook since user is now viewing Studio.
    clearUnseenCompletions(notebook.id);
  }, [checkForPendingAudio, checkForPendingPrediction, checkForPendingFlashcards, checkForPendingQuiz, clearUnseenCompletions, notebook.id]);

  useAppState({
    onForeground: () => {
      checkForPendingAudio();
      checkForPendingPrediction();
      checkForPendingFlashcards();
      checkForPendingQuiz();
      refreshContent();
    },
  });

  const hasTriggeredQuiz = useRef(false);

  useEffect(() => {
    if (onGenerateQuiz && !hasTriggeredQuiz.current) {
      hasTriggeredQuiz.current = true;
      handleGenerateQuiz();
    }
  }, [onGenerateQuiz, handleGenerateQuiz]);

  if (notebook.status === 'extracting' || notebook.status === 'pending') {
    return <StudioExtractingState />;
  }

  const isPad = Platform.OS === 'ios' && Platform.isPad;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StudioTourController>
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.background }}
          contentContainerStyle={{
            paddingHorizontal: isPad ? 48 : 0,
            paddingVertical: isPad ? 24 : 0
          }}
        >
          <View style={{ maxWidth: isPad ? 800 : '100%', alignSelf: 'center', width: '100%' }}>
            <GenerateOptionsSection
              generatingType={generatingType}
              onGeneratePodcast={handleGeneratePodcast}
              onGenerateFlashcards={handleGenerateFlashcards}
              onGenerateQuiz={handleGenerateQuiz}
              onGeneratePrediction={handleGeneratePrediction}
              isProcessingSources={false} // Default for now
            />

            <GeneratedMediaSection
              notebookId={notebook.id}
              notebookTitle={notebook.title}
              flashcard_sets={flashcard_sets}
              quizzes={quizzes}
              podcasts={podcasts}
              examPredictions={examPredictions}
              loading={loading}
              generatingType={generatingType}
              audioProgressStage={audioProgress.stage}
              onDeletePodcast={deletePodcast}
              onDeletePrediction={deleteExamPrediction}
              onGeneratePrediction={handleGeneratePrediction}
              onGenerateFlashcards={handleGenerateFlashcards}
              onGenerateQuiz={handleGenerateQuiz}
            />
          </View>
        </ScrollView>
      </StudioTourController>

      {upgradeModalSource && (
        <UpgradeModal
          visible={showUpgradeModal}
          onDismiss={() => {
            trackUpgradeModalDismissed(upgradeModalSource);
            setShowUpgradeModal(false);
          }}
          source={upgradeModalSource}
          {...upgradeModalProps}
        />
      )}
    </GestureHandlerRootView>
  );
};
