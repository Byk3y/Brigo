/**
 * GeneratedMediaSection - Displays generated flashcards, quizzes, podcasts, and predictions
 */

import React, { useMemo, useEffect } from 'react';
import { View, Text, Alert, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { useFeedback } from '@/lib/feedback';
import { TikTokLoader } from '@/components/TikTokLoader';
import { StudioMediaItem } from './StudioMediaItem';
import { StudioEmptyState } from './StudioEmptyState';
import { formatDuration, getTimeAgo } from '@/lib/utils/studio';
import { LOADING_MESSAGES } from '@/lib/constants/loadingMessages';
import type { StudioFlashcard, Quiz, AudioOverview, FlashcardSet, ExamPrediction } from '@/lib/store/types';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type GeneratingType = 'flashcards' | 'quiz' | 'audio' | 'prediction' | null;

// Unified media item type for sorting
type MediaItem =
  | { type: 'flashcard_set'; data: FlashcardSet; createdAt: string }
  | { type: 'quiz'; data: Quiz; createdAt: string }
  | { type: 'audio'; data: AudioOverview; createdAt: string }
  | { type: 'prediction'; data: ExamPrediction; createdAt: string };

interface GeneratedMediaSectionProps {
  notebookId: string;
  notebookTitle: string;
  flashcard_sets: FlashcardSet[];
  quizzes: Quiz[];
  audioOverviews: AudioOverview[];
  examPredictions: ExamPrediction[];
  loading: boolean;
  generatingType: GeneratingType;
  audioProgressStage: string;
  onDeleteAudio: (overview: AudioOverview) => void;
  onDeletePrediction?: (prediction: ExamPrediction) => void;
  onGeneratePrediction?: (retryId?: string) => void;
}

export const GeneratedMediaSection: React.FC<GeneratedMediaSectionProps> = ({
  notebookId,
  notebookTitle,
  flashcard_sets,
  quizzes,
  audioOverviews,
  examPredictions,
  loading,
  generatingType,
  audioProgressStage,
  onDeleteAudio,
  onDeletePrediction,
  onGeneratePrediction,
}) => {
  const isPad = Platform.OS === 'ios' && Platform.isPad;
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);
  const { play } = useFeedback();

  const hasProcessingPrediction = useMemo(() =>
    examPredictions.some(p => p.status === 'processing' || p.status === 'pending'),
    [examPredictions]
  );

  // Smooth layout animation when items are added/removed
  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [generatingType, examPredictions.length, audioOverviews.length, flashcard_sets.length, quizzes.length]);

  const sortedMediaItems = useMemo(() => {
    const items: MediaItem[] = [];

    // Add flashcard sets
    flashcard_sets.forEach((set) => {
      items.push({
        type: 'flashcard_set',
        data: set,
        createdAt: set.created_at,
      });
    });

    // Add quizzes
    quizzes.forEach((quiz) => {
      items.push({
        type: 'quiz',
        data: quiz,
        createdAt: quiz.created_at,
      });
    });

    // Add audio overviews
    audioOverviews.forEach((overview) => {
      items.push({
        type: 'audio',
        data: overview,
        createdAt: overview.generated_at,
      });
    });

    // Add exam predictions
    examPredictions.forEach((prediction) => {
      items.push({
        type: 'prediction',
        data: prediction,
        createdAt: prediction.created_at,
      });
    });

    // Sort by creation date descending (newest first, newest at top)
    return items.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });
  }, [flashcard_sets, quizzes, audioOverviews, examPredictions]);

  const renderMediaItem = (item: MediaItem) => {
    if (item.type === 'flashcard_set') {
      return (
        <StudioMediaItem
          key={item.data.id}
          icon="albums-outline"
          iconColor="#dc2626"
          title={item.data.title}
          subtitle={`${item.data.total_cards || 0} cards • ${getTimeAgo(item.createdAt)}`}
          onPress={() => {
            play('start');
            router.push({
              pathname: `/flashcards/${notebookId}`,
              params: { setId: item.data.id }
            });
          }}
        />
      );
    }

    if (item.type === 'quiz') {
      return (
        <StudioMediaItem
          key={item.data.id}
          icon="help-circle-outline"
          iconColor="#0891b2"
          title={item.data.title}
          subtitle={`${item.data.total_questions} questions • 1 source • ${getTimeAgo(item.createdAt)}`}
          onPress={() => {
            play('start');
            router.push(`/quiz/${item.data.id}`);
          }}
        />
      );
    }

    if (item.type === 'prediction') {
      const isFailed = item.data.status === 'failed';
      const isProcessing = item.data.status === 'processing' || item.data.status === 'pending';
      const predictionCount = item.data.report_data?.predictions?.length || 0;

      return (
        <StudioMediaItem
          key={item.data.id}
          icon={isFailed ? "alert-circle-outline" : "bulb-outline"}
          iconColor={isFailed ? "#ef4444" : isProcessing ? "#737373" : "#9333ea"}
          title={item.data.title}
          subtitle={isFailed ? "Generation failed • Tap to retry" : `${predictionCount} predictions • ${getTimeAgo(item.createdAt)}`}
          isGenerating={isProcessing}
          loadingText={LOADING_MESSAGES.prediction}
          loadingColor="#9333ea"
          onPress={() => {
            if (isFailed) {
              Alert.alert(
                'Generation Failed',
                `${item.data.error_message || 'An unexpected error occurred.'}\n\nWould you like to try again?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Retry',
                    onPress: () => {
                      if (onGeneratePrediction) {
                        onGeneratePrediction(item.data.id);
                      }
                    }
                  }
                ]
              );
              return;
            }
            if (isProcessing) return;
            play('start');
            router.push(`/predictions/${item.data.id}`);
          }}
          onDelete={onDeletePrediction ? () => onDeletePrediction(item.data) : undefined}
        />
      );
    }

    // Podcast
    return (
      <StudioMediaItem
        key={item.data.id}
        icon="stats-chart"
        iconColor="#4f46e5"
        title={item.data.title}
        subtitle={`${formatDuration(item.data.duration)} • ${getTimeAgo(item.createdAt)}`}
        onPress={() => router.push(`/audio-player/${item.data.id}`)}
        onDelete={() => onDeleteAudio(item.data)}
      />
    );
  };

  return (
    <View style={{ paddingHorizontal: isPad ? 24 : 16, paddingVertical: 8 }}>
      <Text
        style={{
          fontSize: isPad ? 17 : 14,
          fontWeight: '500',
          color: colors.textSecondary,
          marginBottom: isPad ? 20 : 16,
          paddingHorizontal: 8,
        }}
      >
        Generated media
      </Text>

      {loading && sortedMediaItems.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 48 }}>
          <TikTokLoader size={12} color="#6366f1" containerWidth={60} />
        </View>
      ) : (
        <>
          {/* Grid Container for Media Items on iPad */}
          <View style={{
            flexDirection: isPad ? 'row' : 'column',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: isPad ? 20 : 0
          }}>
            {/* Generating States at the TOP */}
            {generatingType === 'flashcards' && (
              <View style={{ width: isPad ? '48.5%' : '100%', marginBottom: isPad ? 0 : 10 }}>
                <StudioMediaItem
                  icon="albums-outline"
                  iconColor="#737373"
                  title="Flashcards"
                  isGenerating={true}
                  loadingColor="#2563eb"
                  loadingText={LOADING_MESSAGES.flashcards}
                />
              </View>
            )}

            {generatingType === 'quiz' && (
              <View style={{ width: isPad ? '48.5%' : '100%', marginBottom: isPad ? 0 : 10 }}>
                <StudioMediaItem
                  icon="help-circle-outline"
                  iconColor="#737373"
                  title="Quiz"
                  isGenerating={true}
                  loadingColor="#2563eb"
                  loadingText={LOADING_MESSAGES.quiz}
                />
              </View>
            )}

            {generatingType === 'audio' && (
              <View style={{ width: isPad ? '48.5%' : '100%', marginBottom: isPad ? 0 : 10 }}>
                <StudioMediaItem
                  icon="stats-chart"
                  iconColor="#737373"
                  title="Podcast"
                  isGenerating={true}
                  loadingColor="#4f46e5"
                  loadingText={LOADING_MESSAGES.audio}
                />
              </View>
            )}

            {generatingType === 'prediction' && !hasProcessingPrediction && (
              <View style={{ width: isPad ? '48.5%' : '100%', marginBottom: isPad ? 0 : 10 }}>
                <StudioMediaItem
                  icon="bulb-outline"
                  iconColor="#737373"
                  title="Predict Questions"
                  isGenerating={true}
                  loadingColor="#9333ea"
                  loadingText={LOADING_MESSAGES.prediction}
                />
              </View>
            )}

            {/* Sorted Media Items (newest first) */}
            {sortedMediaItems.map(item => (
              <View key={item.data.id} style={{ width: isPad ? '48.5%' : '100%', marginBottom: isPad ? 0 : 10 }}>
                {renderMediaItem(item)}
              </View>
            ))}
          </View>

          {/* Background loading indicator if needed */}
          {loading && sortedMediaItems.length > 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 16, opacity: 0.6 }}>
              <TikTokLoader size={8} color="#6366f1" containerWidth={40} />
            </View>
          )}

          {/* Empty State */}
          {!generatingType && sortedMediaItems.length === 0 && <StudioEmptyState />}
        </>
      )}
    </View>
  );
};




















