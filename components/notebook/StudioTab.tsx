/**
 * StudioTab - Generate flashcards, quizzes, podcasts, and exam predictions
 * Orchestrates the studio generation UI and displays generated content
 */

import React, { useEffect, useRef } from 'react';
import { ScrollView } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { Notebook } from '@/lib/store';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';

// Hooks
import { useStudioContent } from '@/lib/hooks/useStudioContent';
import { useAudioGeneration } from '@/lib/hooks/useAudioGeneration';
import { useStudioGeneration } from '@/lib/hooks/useStudioGeneration';
import { useAppState } from '@/lib/hooks/useAppState';

// Components
import { StudioExtractingState } from './studio/StudioExtractingState';
import { GenerateOptionsSection } from './studio/GenerateOptionsSection';
import { GeneratedMediaSection } from './studio/GeneratedMediaSection';
import { UpgradeModal } from '@/components/upgrade/UpgradeModal';
import { useUpgrade } from '@/lib/hooks/useUpgrade';

interface StudioTabProps {
  notebook: Notebook;
  onGenerateQuiz?: () => void;
}

export const StudioTab: React.FC<StudioTabProps> = ({ notebook, onGenerateQuiz }) => {
  const isExtracting = notebook.status === 'extracting';

  // Theme
  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);

  // Fetch studio content (flashcards, quizzes, podcasts, predictions)
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

  // Audio generation state and polling
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

  // Generation handlers
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

  // Check for in-progress audio/prediction generation on mount (handles navigation back)
  useEffect(() => {
    checkForPendingAudio();
    checkForPendingPrediction();
  }, [checkForPendingAudio, checkForPendingPrediction]);

  // Monitor app state to recover from backgrounding
  useAppState({
    onForeground: () => {
      checkForPendingAudio();
      checkForPendingPrediction();
      refreshContent();
    },
  });

  // Ref to prevent duplicate generation from external trigger
  const hasTriggeredQuiz = useRef(false);

  // Trigger quiz generation from external source (only once)
  useEffect(() => {
    if (onGenerateQuiz && !hasTriggeredQuiz.current) {
      hasTriggeredQuiz.current = true;
      handleGenerateQuiz();
    }
  }, [onGenerateQuiz, handleGenerateQuiz]);

  // Show extracting state while material is processing
  if (isExtracting) {
    return <StudioExtractingState />;
  }

  // Main studio view
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        {/* Generate New Section */}
        <GenerateOptionsSection
          generatingType={generatingType}
          onGenerateAudio={handleGenerateAudioOverview}
          onGenerateFlashcards={handleGenerateFlashcards}
          onGenerateQuiz={handleGenerateQuiz}
          onGeneratePrediction={handleGeneratePrediction}
        />

        {/* Generated Media Section */}
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
      </ScrollView>


      {/* Upgrade Modal (quota exceeded) */}
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

