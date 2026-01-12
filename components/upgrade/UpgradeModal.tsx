/**
 * Upgrade Modal Component
 * Full-screen modal for prompting upgrades when trial expires or features are locked
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
  source: 'trial_expired' | 'create_attempt' | 'locked_notebook';
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
        case 'trial_expired':
          return {
            emoji: '⏰',
            title: 'Your access has ended',
            message:
              "Unlock Pro for just $1.99 to continue creating notebooks and unlock all premium features.",
          };
        case 'quota_studio_exhausted':
          return {
            emoji: '🎴',
            title: 'Generation limit reached',
            message:
              "You've used your included Studio generations. Upgrade to Pro for unlimited flashcards and quizzes!",
          };
        case 'quota_audio_exhausted':
          return {
            emoji: '🎧',
            title: 'Podcast limit reached',
            message:
              "You've used your included podcasts. Upgrade to Pro for unlimited studio-quality audio summaries!",
          };
        case 'subscription_expired':
          return {
            emoji: '🔒',
            title: 'Subscription expired',
            message:
              "Your subscription has expired. Upgrade to Pro to continue accessing all features.",
          };
        default:
          return {
            emoji: '🔒',
            title: 'Trial limit reached',
            message:
              "You've reached your trial limit. Upgrade to Pro to create unlimited notebooks and unlock all features.",
          };
      }
    }

    // For other sources, use original logic
    switch (source) {
      case 'trial_expired':
        return {
          emoji: '🎉',
          title: 'Unlock more features',
          message:
            "You've made amazing progress! Unlock Pro for just $1.99 to continue using Smart Chat, Flashcards, and all your notebooks.",
        };
      case 'create_attempt':
        return {
          emoji: '🔒',
          title: 'Upgrade required',
          message:
            "Unlock Pro for just $1.99 to get unlimited Smart Chat, Notebooks, and Podcasts.",
        };
      case 'locked_notebook':
        return {
          emoji: '📚',
          title: 'Unlock all notebooks',
          message:
            'Upgrade to Pro to access all your notebooks, unlock Mastery Gap Analysis, and continue deep-diving with Smart Chat.',
        };
      default:
        return {
          emoji: '⭐',
          title: 'Upgrade to Pro',
          message: 'Unlock Strategic Briefings, Mastery Gap Analysis, and unlimited Study Tools to conquer your exams.',
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
