/**
 * Pet Half-Sheet Modal - TikTok style
 * Shows pet with gradient background, streak, XP, and missions
 * 
 * REFACTORED: Now uses modular components for better maintainability
 * Updated: Dark mode support
 */

import React, { useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Modal,
  Pressable,
  Animated,
  StyleSheet,
  Dimensions,
  Text,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getLocalDateString } from '@/lib/utils/time';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '@/lib/store';
import { usePetSheetGestures } from '@/hooks/usePetSheetGestures';
import {
  PetSheetHeader,
  PetDisplay,
  PetInfo,
  MissionsList,
  StreakBadges,
} from '@/components/pet-sheet';
import { usePetTasks } from '@/hooks/usePetTasks';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { BrigoLogo } from '@/components/BrigoLogo';
import { track } from '@/lib/services/analyticsService';
import { useCelebration } from '@/lib/contexts/CelebrationContext';
import { ResponsiveContainer } from '@/lib/components/ResponsiveContainer';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function PetSheetScreen() {
  const router = useRouter();
  const { user, petState, dailyTasks, updatePetName, applyStreakFreeze } = useStore();

  // Check if secure_pet task is already completed today
  const isSecureTaskCompleted = dailyTasks?.find(t => t.task_key === 'secure_pet')?.completed;
  const scrollY = useRef(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const [hasJustRestored, setHasJustRestored] = useState(false);

  // Theme
  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);
  const { triggerCelebration } = useCelebration();

  // Pet growth missions - includes both foundational and daily tasks
  const { allTasks, taskProgress, foundationalTasks, loadDailyTasks, loadFoundationalTasks, checkAndAwardTask } = usePetTasks();

  // If foundational just finished in background, ensure daily tasks are loaded
  React.useEffect(() => {
    const isComplete = foundationalTasks.length > 0 && foundationalTasks.every(t => t.completed);
    if (isComplete && dailyTasks.length === 0) {
      loadDailyTasks();
    }
  }, [foundationalTasks, dailyTasks.length, loadDailyTasks]);

  // Derive stage from petState (automatically calculated from points)
  // Clamp to valid stage range for UI (1-3)
  const currentStage = Math.min(Math.max(petState.stage, 1), 3) as 1 | 2 | 3;

  // Local state for previewing next/previous stage (UI preview only, doesn't change actual stage)
  const [previewStage, setPreviewStage] = useState<1 | 2 | 3>(currentStage);

  // Update preview stage when actual stage changes
  React.useEffect(() => {
    setPreviewStage(currentStage);
  }, [currentStage]);

  // A streak is "at risk" if user has a streak and it hasn't been secured today
  const today = getLocalDateString();
  const isAtRisk = user.streak > 0 && user.last_streak_date !== today && !isSecureTaskCompleted;

  // A streak is "lost" if it's 0 but there's a recoverable streak in meta
  const recoverableStreak = user.meta?.last_recoverable_streak ?? 0;
  const isStreakLost = user.streak === 0 && recoverableStreak > 0;

  // Pet is dying if streak is at risk (not secured today) or streak was lost
  // Note: Previously had an onboarding exemption here, but removed because:
  // - Users with an active streak should see dying state regardless of foundational task completion
  // - New users (streak=0) won't trigger isAtRisk anyway
  // - This matches PetBubble.tsx behavior for consistency
  const isDying = isAtRisk || isStreakLost;
  const canRestore = isStreakLost && user.streak_freezes > 0;

  // Track pet sheet opened (after all state variables are defined)
  React.useEffect(() => {
    track('pet_sheet_opened', {
      streak: user.streak,
      pet_stage: currentStage,
      is_at_risk: isDying,
    });
  }, []);

  const handleRestore = async () => {
    if (!canRestore) return;
    const result = await applyStreakFreeze();
    if (result.success) {
      track('streak_restored', {
        restored_streak: recoverableStreak,
        freezes_remaining: user.streak_freezes - 1,
      });
      setHasJustRestored(true);
      triggerCelebration();
    }
  };

  // Gestures and loading are handled by hooks.
  const { translateY, handleBarPanResponder, contentPanResponder, dismiss } = usePetSheetGestures({
    onDismiss: () => router.back(),
    scrollY,
  });
  // usePetTasks already triggers loadDailyTasks and loadFoundationalTasks on mount if authUser exists.

  const handleNameChange = async (newName: string) => {
    // Use updatePetName instead of setPetState to trigger task completion check
    await updatePetName(newName);
    track('pet_name_changed', {
      pet_stage: currentStage,
    });
  };

  // Dark mode gradient colors - slightly muted version of the golden theme
  // Lavender gradient when pet is dying (streak lost or at risk)
  const getGradientColors = (): [string, string] => {
    // Lavender gradient when pet is dying
    if (isDying) {
      if (isDarkMode) {
        return ['#7c3aed', '#29292b']; // Muted purple/lavender for dark mode
      }
      return ['#ddd6fe', '#f5f3ff']; // Soft lavender for light mode
    }

    if (isDarkMode) {
      // Slightly darker/muted golden - blends into new background
      if (previewStage === 1) return ['#D4A843', '#29292b']; // Muted gold
      if (previewStage === 2) return ['#C88A30', '#29292b']; // Muted amber
      return ['#BE185D', '#29292b']; // Deep pink/magenta for Stage 3
    }
    // Light mode
    if (previewStage === 1) return ['#FFE082', '#FFFFFF'];
    if (previewStage === 2) return ['#FFB74D', '#FFFFFF'];
    return ['#F9A8D4', '#FFFFFF']; // Soft pink for Stage 3
  };

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="none"
      onRequestClose={dismiss}
      statusBarTranslucent={true}
    >
      <View style={styles.container} pointerEvents="box-none">
        {/* Backdrop */}
        <Pressable
          style={styles.backdrop}
          onPress={dismiss}
        />

        {/* Sheet - 85% of screen height */}
        <Animated.View
          style={[
            styles.sheet,
            {
              height: SCREEN_HEIGHT * 0.88,
              transform: [{ translateY }],
            },
          ]}
        >
          <LinearGradient
            colors={getGradientColors()}
            style={styles.gradient}
          >
            <View style={styles.safeArea}>
              <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                bounces={false}
                alwaysBounceVertical={false}
                contentContainerStyle={styles.scrollContent}
                scrollEventThrottle={16}
                nestedScrollEnabled={false}
                removeClippedSubviews={false}
                onScroll={(event) => {
                  scrollY.current = event.nativeEvent.contentOffset.y;
                }}
                onScrollEndDrag={(event) => {
                  scrollY.current = event.nativeEvent.contentOffset.y;
                }}
                onMomentumScrollEnd={(event) => {
                  scrollY.current = event.nativeEvent.contentOffset.y;
                }}
              >
                {/* Handle bar - Swipe down enabled */}
                <PetSheetHeader panHandlers={handleBarPanResponder.panHandlers} />

                <View style={styles.topSection}>
                  <PetDisplay
                    streak={user.streak}
                    freezes={user.streak_freezes}
                    stage={previewStage}
                    currentStage={currentStage}
                    onNextStage={previewStage < 3 ? () => setPreviewStage((prev) => (prev + 1) as 1 | 2 | 3) : undefined}
                    onPrevStage={previewStage > 1 ? () => setPreviewStage((prev) => (prev - 1) as 1 | 2 | 3) : undefined}
                    canRestore={canRestore}
                    isDying={isDying}
                    onRestore={handleRestore}
                    showBalance={hasJustRestored}
                  />
                </View>

                {/* Bottom Section - Swipeable (includes pet name, XP, missions, and stats) */}
                <View style={styles.bottomSection} {...contentPanResponder.panHandlers}>
                  <ResponsiveContainer>
                    <PetInfo
                      name={petState.name}
                      points={petState.points}
                      onNameChange={handleNameChange}
                    />
                  </ResponsiveContainer>

                  <ResponsiveContainer>
                    <MissionsList
                      missions={allTasks}
                      taskProgress={taskProgress}
                      activeColor={
                        previewStage === 1 ? '#FBBF24' :
                          previewStage === 2 ? '#FB923C' :
                            '#EC4899' // Vibrant pink for Stage 3
                      }
                    />
                  </ResponsiveContainer>

                  <ResponsiveContainer>
                    <StreakBadges
                      streak={user.streak}
                      showSafetyNet={isStreakLost || hasJustRestored}
                    />
                  </ResponsiveContainer>

                  {/* Powered by Brigo footer */}
                  <View style={styles.poweredByContainer}>
                    <Text style={[styles.poweredByText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(120, 80, 40, 0.5)' }]}>
                      Powered by
                    </Text>
                    <BrigoLogo size={16} textColor={isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(120, 80, 40, 0.5)'} />
                  </View>
                </View>
              </ScrollView>
              <SafeAreaView style={styles.bottomSafeArea} edges={['bottom']} />
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  gradient: {
    flex: 1,
  },
  bottomSafeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 0,
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  topSection: {
    // Only streak and pet emoji - not swipeable
  },
  bottomSection: {
    // Swipeable area - includes pet name, XP, missions, and stats
  },
  poweredByContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    gap: 6,
    opacity: 0.6,
  },
  poweredByText: {
    fontSize: 12,
    fontFamily: 'Outfit-Light',
    color: 'rgba(255, 255, 255, 0.5)',
  },
});
