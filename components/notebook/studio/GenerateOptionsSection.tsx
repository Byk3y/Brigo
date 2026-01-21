import React from 'react';
import { View, Text, Platform } from 'react-native';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { GenerateOption } from './GenerateOption';
import { AttachStep } from 'react-native-spotlight-tour';

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
  const isPad = Platform.OS === 'ios' && Platform.isPad;
  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);

  const isDisabled = generatingType !== null || isProcessingSources;

  return (
    <View style={{ paddingHorizontal: isPad ? 24 : 16, paddingVertical: isPad ? 32 : 24 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: isPad ? 20 : 16, paddingHorizontal: 8 }}>
        <Text
          style={{
            fontSize: isPad ? 17 : 14,
            fontWeight: '500',
            color: colors.textSecondary,
          }}
        >
          Generate new
        </Text>
        {isProcessingSources && (
          <Text style={{ fontSize: isPad ? 14 : 12, color: '#f59e0b', fontWeight: '600' }}>
            Wait for sources...
          </Text>
        )}
      </View>

      <View style={{
        flexDirection: isPad ? 'row' : 'column',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: isPad ? 20 : 0
      }}>
        {/* Predict Questions Option - Index 0 */}
        <View style={{ width: isPad ? '48.5%' : '100%', marginBottom: isPad ? 0 : 4 }}>
          {/* @ts-ignore - Library type mismatch for children */}
          <AttachStep index={0} fill={true} style={{ width: '100%' }}>
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
          </AttachStep>
        </View>

        {/* Audio Overview Option - Index 1 */}
        <View style={{ width: isPad ? '48.5%' : '100%', marginBottom: isPad ? 0 : 4 }}>
          {/* @ts-ignore - Library type mismatch for children */}
          <AttachStep index={1} fill={true} style={{ width: '100%' }}>
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
          </AttachStep>
        </View>

        {/* Flashcards Option - Index 2 */}
        <View style={{ width: isPad ? '48.5%' : '100%', marginBottom: isPad ? 0 : 4 }}>
          {/* @ts-ignore - Library type mismatch for children */}
          <AttachStep index={2} fill={true} style={{ width: '100%' }}>
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
          </AttachStep>
        </View>

        {/* Quiz Option - Index 3 */}
        <View style={{ width: isPad ? '48.5%' : '100%', marginBottom: isPad ? 0 : 4 }}>
          {/* @ts-ignore - Library type mismatch for children */}
          <AttachStep index={3} fill={true} style={{ width: '100%' }}>
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
          </AttachStep>
        </View>
      </View>
    </View>
  );
};





















