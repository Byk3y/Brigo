/**
 * GenerateOptionsSection - The "Generate new" section with generation buttons
 */

import React from 'react';
import { View, Text } from 'react-native';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { GenerateOption } from './GenerateOption';

type GeneratingType = 'flashcards' | 'quiz' | 'audio' | 'prediction' | null;

interface GenerateOptionsSectionProps {
  generatingType: GeneratingType;
  onGenerateAudio: () => void;
  onGenerateFlashcards: () => void;
  onGenerateQuiz: () => void;
  onGeneratePrediction: () => void;
  isProcessingSources?: boolean;
}

export const GenerateOptionsSection: React.FC<GenerateOptionsSectionProps> = ({
  generatingType,
  onGenerateAudio,
  onGenerateFlashcards,
  onGenerateQuiz,
  onGeneratePrediction,
  isProcessingSources = false,
}) => {
  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);

  const isDisabled = generatingType !== null || isProcessingSources;

  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 24 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 8 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '500',
            color: colors.textSecondary,
          }}
        >
          Generate new
        </Text>
        {isProcessingSources && (
          <Text style={{ fontSize: 12, color: '#f59e0b', fontWeight: '600' }}>
            Wait for sources...
          </Text>
        )}
      </View>

      {/* Predict Questions Option */}
      <GenerateOption
        type="prediction"
        icon="bulb-outline"
        color="#9333ea"
        label="Predict Questions"
        bgColor="bg-purple-50"
        textColor="text-purple-600"
        isGenerating={generatingType === 'prediction'}
        onPress={() => onGeneratePrediction()}
        disabled={isDisabled}
      />

      {/* Audio Overview Option */}
      <GenerateOption
        type="audio"
        icon="stats-chart"
        color="#4f46e5"
        label="Podcast"
        bgColor="bg-indigo-50"
        textColor="text-indigo-600"
        isGenerating={generatingType === 'audio'}
        onPress={onGenerateAudio}
        disabled={isDisabled}
      />

      {/* Flashcards Option */}
      <GenerateOption
        type="flashcards"
        icon="albums-outline"
        color="#dc2626"
        label="Flashcards"
        bgColor="bg-red-50"
        textColor="text-red-600"
        isGenerating={generatingType === 'flashcards'}
        onPress={onGenerateFlashcards}
        disabled={isDisabled}
      />

      {/* Quiz Option */}
      <GenerateOption
        type="quiz"
        icon="help-circle-outline"
        color="#0891b2"
        label="Quiz"
        bgColor="bg-cyan-50"
        textColor="text-cyan-600"
        isGenerating={generatingType === 'quiz'}
        onPress={onGenerateQuiz}
        disabled={isDisabled}
      />
    </View>
  );
};




















