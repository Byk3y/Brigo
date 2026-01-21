import React, { useEffect, useRef } from 'react';
import { ScrollView, View, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useStore, type Notebook } from '@/lib/store';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { useStudioContent } from '@/lib/hooks/useStudioContent';
import { useAudioGeneration } from '@/lib/hooks/useAudioGeneration';
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
      }, 1000); // Shorter delay since they've already been the notebook for a bit
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
  onGenerateQuiz?: () => void;
}

export const StudioTab: React.FC<StudioTabProps> = ({ notebook, onGenerateQuiz }) => {
  const isExtracting = notebook.status === 'extracting';
  const isProcessingSources = notebook.materials?.some(m => m.status === 'processing') || false;

  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);

  const {
    flashcard_sets,
    quizzes,
    audioOverviews,
    setAudioOverviews,
    examPredictions,
    setExamPredictions,
    loading,
    refreshContent,
  } = useStudioContent(notebook.id);

  const {
    generatingType,
    setGeneratingType,
    setGeneratingAudioId,
    audioProgress,
    checkForPendingAudio,
    startAudioPolling,
    startPredictionPolling,
    checkForPendingPrediction,
  } = useAudioGeneration(notebook.id, notebook.title, refreshContent);

  const {
    handleGenerateFlashcards,
    handleGenerateQuiz,
    handleGenerateAudioOverview,
    handleGeneratePrediction,
    handleDeleteAudioOverview,
    handleDeletePrediction,
    showUpgradeModal,
    setShowUpgradeModal,
    upgradeModalSource,
    upgradeModalProps,
  } = useStudioGeneration({
    notebookId: notebook.id,
    flashcardsCount: flashcard_sets.length,
    quizzesCount: quizzes.length,
    audioOverviewsCount: audioOverviews.length,
    examPredictionsCount: examPredictions.length,
    setAudioOverviews,
    setExamPredictions,
    refreshContent,
    setGeneratingType,
    setGeneratingAudioId,
    startAudioPolling,
    startPredictionPolling,
    checkForPendingPrediction,
  });

  const { trackUpgradeModalDismissed } = useUpgrade();

  useEffect(() => {
    checkForPendingAudio();
    checkForPendingPrediction();
  }, [checkForPendingAudio, checkForPendingPrediction]);

  useAppState({
    onForeground: () => {
      checkForPendingAudio();
      checkForPendingPrediction();
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

  if (isExtracting) {
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
              onGenerateAudio={handleGenerateAudioOverview}
              onGenerateFlashcards={handleGenerateFlashcards}
              onGenerateQuiz={handleGenerateQuiz}
              onGeneratePrediction={handleGeneratePrediction}
              isProcessingSources={isProcessingSources}
            />

            <GeneratedMediaSection
              notebookId={notebook.id}
              notebookTitle={notebook.title}
              flashcard_sets={flashcard_sets}
              quizzes={quizzes}
              audioOverviews={audioOverviews}
              examPredictions={examPredictions}
              loading={loading}
              generatingType={generatingType}
              audioProgressStage={audioProgress.stage}
              onDeleteAudio={handleDeleteAudioOverview}
              onDeletePrediction={handleDeletePrediction}
              onGeneratePrediction={handleGeneratePrediction}
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


