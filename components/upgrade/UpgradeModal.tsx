/**
 * Upgrade Modal Component
 * Full-screen modal for prompting upgrades when subscription expires or features are locked
 */

import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getThemeColors } from '@/lib/ThemeContext';
import { useTheme } from '@/lib/ThemeContext';
import { useRouter } from 'expo-router';
import { ProgressSummary } from './ProgressSummary';
import { useUpgrade } from '@/lib/hooks/useUpgrade';
import type { LimitReason } from '@/lib/services/subscriptionService';
import { usePaywall } from '@/lib/hooks/usePaywall';

interface UpgradeModalProps {
  visible: boolean;
  onDismiss: () => void;
  source: 'subscription_expired' | 'create_attempt' | 'locked_notebook';
  notebooksCount?: number;
  flashcardsStudied?: number;
  streakDays?: number;
  petName?: string;
  petLevel?: number;
  limitReason?: LimitReason;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  visible,
  onDismiss,
  source,
  notebooksCount = 0,
  flashcardsStudied = 0,
  streakDays = 0,
  petName = 'Sparky',
  petLevel = 1,
  limitReason = null,
}) => {
  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);
  const router = useRouter();
  const { trackUpgradeButtonClicked } = useUpgrade();
  const { showPaywall } = usePaywall({ source });

  const getMessage = () => {
    // For create_attempt source, show specific message based on limit reason
    if (source === 'create_attempt' && limitReason) {
      switch (limitReason) {
        case 'subscription_expired':
        case 'not_subscribed':
          return {
            emoji: '⏰',
            title: 'Subscription required',
            message:
              "Upgrade to Pro to continue creating notebooks, generating flashcards, and using all premium features.",
          };
        default:
          return {
            emoji: '🔒',
            title: 'Upgrade required',
            message:
              "Upgrade to Pro to create unlimited notebooks and unlock all features.",
          };
      }
    }

    // For other sources, use original logic
    switch (source) {
      case 'subscription_expired':
        return {
          emoji: '🎉',
          title: 'Keep studying with Pro',
          message:
            "You've made amazing progress! Upgrade to Pro to continue using Smart Chat, Flashcards, Podcasts, and all your study tools.",
        };
      case 'create_attempt':
        return {
          emoji: '🔒',
          title: 'Upgrade required',
          message:
            "Upgrade to Pro for unlimited Smart Chat, Notebooks, Flashcards, and AI Podcasts.",
        };
      case 'locked_notebook':
        return {
          emoji: '📚',
          title: 'Unlock all notebooks',
          message:
            'Upgrade to Pro to access all your notebooks and continue deep-diving with Smart Chat.',
        };
      default:
        return {
          emoji: '⭐',
          title: 'Upgrade to Pro',
          message: 'Unlock unlimited Flashcards, Quizzes, AI Podcasts, and Smart Chat to conquer your exams.',
        };
    }
  };

  const handleUpgrade = () => {
    trackUpgradeButtonClicked(source);
    onDismiss();
    showPaywall();
  };

  const content = getMessage();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0, 0, 0, 0.7)' }]}>
        <SafeAreaView style={styles.container}>
          <View
            style={[
              styles.modal,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {/* Happy Pet Emoji */}
            <View style={styles.emojiContainer}>
              <Text style={styles.emoji}>{content.emoji}</Text>
            </View>

            {/* Title */}
            <Text style={[styles.title, { color: colors.text }]}>
              {content.title}
            </Text>

            {/* Progress Summary */}
            <View style={styles.progressContainer}>
              <ProgressSummary
                notebooksCount={notebooksCount}
                flashcardsStudied={flashcardsStudied}
                streakDays={streakDays}
                petName={petName}
                petLevel={petLevel}
                compact={true}
              />
            </View>

            {/* Message */}
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              {content.message}
            </Text>

            {/* Action buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={handleUpgrade}
              >
                <Text style={styles.primaryButtonText}>Upgrade to Premium</Text>
              </TouchableOpacity>

              {source !== 'create_attempt' && (
                <TouchableOpacity
                  style={[styles.secondaryButton, { borderColor: colors.border }]}
                  onPress={onDismiss}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                    Continue with Limited Access
                  </Text>
                </TouchableOpacity>
              )}

              {source === 'create_attempt' && (
                <TouchableOpacity
                  style={[styles.secondaryButton, { borderColor: colors.border }]}
                  onPress={onDismiss}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                    Maybe Later
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  emojiContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  emoji: {
    fontSize: 64,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'Nunito-Bold',
  },
  progressContainer: {
    marginBottom: 20,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    fontFamily: 'Nunito-Regular',
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Nunito-SemiBold',
    color: '#FFFFFF',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Nunito-Medium',
  },
});
