/**
 * Onboarding Flow - Main Orchestrator
 * Coordinates 7 screens introducing Brigo's value proposition
 * Science-backed education leading to subscription signup
 *
 * Modular architecture with separate screen components
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, BackHandler, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { useStore } from '@/lib/store';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';

// Components
import { ProgressBar } from '@/components/onboarding/components/ProgressBar';
import { OnboardingButton } from '@/components/onboarding/components/OnboardingButton';

// Constants
import {
  SCREEN_INDICES,
  TOTAL_SCREENS,
  FIRST_SCREEN,
  LAST_SCREEN,
  AUTH_REQUIRED_SCREEN,
  isLastScreen,
  isFirstScreen,
  shouldHideFooter,
  getNextScreen,
} from '@/lib/onboarding/constants';

// Screens
import { Screen1 } from '@/components/onboarding/screens/Screen1';
import { Screen2 } from '@/components/onboarding/screens/Screen2';
import { Screen3 } from '@/components/onboarding/screens/Screen3';
import { Screen3_AhaMoment } from '@/components/onboarding/screens/AhaMoment';
import { Screen4_PetNaming } from '@/components/onboarding/screens/Screen4_PetNaming';
import { Screen4_Education } from '@/components/onboarding/screens/Screen4_Education';
import { Screen4_LearningStyle } from '@/components/onboarding/screens/Screen4_LearningStyle';
import { Screen4_TimeGoal } from '@/components/onboarding/screens/Screen4_TimeGoal';
import { Screen4_Notifications } from '@/components/onboarding/screens/Screen4_Notifications';

// Analytics
import { track } from '@/lib/services/analyticsService';

// Screen names for analytics
const SCREEN_NAMES: Record<number, string> = {
  0: 'problem',
  1: 'science',
  2: 'aha_moment',
  3: 'auth',
  4: 'pet_naming',
  5: 'education',
  6: 'learning_style',
  7: 'time_goal',
  8: 'notifications',
};

export default function OnboardingScreen() {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [petName, setPetName] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);
  const {
    setPendingPetName,
    setCurrentOnboardingScreen,
    markOnboardingComplete,
    currentOnboardingScreen: savedScreen,
    hasCompletedOnboarding,
    authUser,
    updatePetName,
    petState,
    loadPetState,
    educationLevel,
    learningStyle,
    dailyCommitmentMinutes,
  } = useStore();

  const [onboardingStartTime] = useState(() => Date.now());

  // Track onboarding started on mount
  useEffect(() => {
    track('onboarding_started', {
      timestamp: new Date().toISOString(),
    });
  }, []);

  // Track screen views
  useEffect(() => {
    track('onboarding_screen_viewed', {
      screen_number: currentScreen + 1,
      screen_name: SCREEN_NAMES[currentScreen] || 'unknown',
      total_screens: TOTAL_SCREENS,
    });
  }, [currentScreen]);

  // Load saved screen on mount if resuming after auth
  useEffect(() => {
    // If onboarding is already marked complete in the store, just go to paywall/home
    if (authUser && hasCompletedOnboarding) {
      console.log('[Onboarding] Already complete, redirecting to paywall');
      router.replace('/paywall?source=onboarding_resume');
      return;
    }

    if (authUser && savedScreen > 0 && savedScreen < TOTAL_SCREENS) {
      console.log('Resuming onboarding at screen', savedScreen);
      track('onboarding_resumed', {
        resumed_at_screen: savedScreen + 1,
        screen_name: SCREEN_NAMES[savedScreen] || 'unknown',
      });
      setCurrentScreen(savedScreen);
    }
  }, [authUser, savedScreen, hasCompletedOnboarding]);

  // Load existing pet name when reaching pet naming screen
  useEffect(() => {
    // Only run when reaching pet naming screen and user is logged in
    if (currentScreen !== SCREEN_INDICES.SCREEN_5_PET_NAMING || !authUser) {
      return;
    }

    // Check if pet state is already loaded with a custom name
    if (petState.name && petState.name !== 'Nova' && petState.name.trim() !== '') {
      // Pet already has a custom name, pre-fill it only if input is empty
      // Use function update to avoid stale closure issues
      setPetName((current) => {
        return current.trim() === '' ? petState.name : current;
      });
      return;
    }

    // Load pet state from database if not already loaded or if it's default
    if (!petState.name || petState.name === 'Nova') {
      loadPetState()
        .then(() => {
          // After loading, get fresh state and check if pet has a custom name
          // Use getState() here because we're in an async callback and need a one-time read
          // See docs/ZUSTAND_GETSTATE_PATTERN.md for details
          const store = useStore.getState();
          const loadedName = store.petState.name;

          // Only set if we got a valid custom name
          if (loadedName && loadedName !== 'Nova' && loadedName.trim() !== '') {
            // Use function update to get the latest petName state
            // Only update if input is still empty (user might have typed while loading)
            setPetName((current) => {
              return current.trim() === '' ? loadedName : current;
            });
          }
        })
        .catch((error) => {
          console.error('Failed to load pet state:', error);
          // Silently fail - user can still enter a name manually
        });
    }
  }, [currentScreen, authUser, petState.name]);

  // Handle hardware back button on Android
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (!isFirstScreen(currentScreen)) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setCurrentScreen((prev) => prev - 1);
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [currentScreen])
  );

  const handleContinue = async () => {
    if (isNavigating) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Screen 3 (Solution) now has its own buttons, so this won't be called for it
    // But keeping the logic in case it's needed elsewhere

    // Pet Naming Screen - Save pet name before advancing
    if (currentScreen === SCREEN_INDICES.SCREEN_5_PET_NAMING) {
      const trimmedName = petName.trim();

      // Validate pet name is not empty
      if (!trimmedName) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return; // Don't advance if name is empty
      }

      setIsNavigating(true);
      let saveSuccess = false;

      try {
        if (authUser) {
          // User is logged in - save directly to database
          try {
            await updatePetName(trimmedName);
            console.log('Pet name saved to database:', trimmedName);
            saveSuccess = true;
          } catch (updateError) {
            // updatePetName might not throw, but setPetState inside it might fail
            // Check if the name was actually saved by verifying petState
            console.error('Error in updatePetName:', updateError);
            // Verify the save by checking if petState was updated
            // Use getState() here because we're in an error handler and need a one-time read
            // See docs/ZUSTAND_GETSTATE_PATTERN.md for details
            const store = useStore.getState();
            if (store.petState.name === trimmedName) {
              saveSuccess = true;
              console.log('Pet name verified in state:', trimmedName);
            } else {
              throw new Error('Pet name was not saved to state');
            }
          }
        } else {
          // User not logged in yet - save to pendingPetName (will be saved in callback.tsx after auth)
          setPendingPetName(trimmedName);
          console.log('Pet name saved to pendingPetName:', trimmedName);
          saveSuccess = true;
        }

        // Save progress for both logged-in and non-logged-in users
        // Use next screen index to ensure consistency
        const nextScreen = getNextScreen(currentScreen);
        setCurrentOnboardingScreen(nextScreen);

        // Only advance if save was successful
        if (saveSuccess) {
          setCurrentScreen(nextScreen);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          console.error('Failed to save pet name - not advancing');
        }
      } catch (error) {
        console.error('Failed to save pet name:', error);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        // Don't advance if save failed - user should retry
        // This prevents losing the pet name they entered
      } finally {
        setIsNavigating(false);
      }
      return;
    }

    // Last screen - Mark complete and go home
    if (isLastScreen(currentScreen)) {
      setIsNavigating(true);
      try {
        await markOnboardingComplete();
        // Redirect to paywall screen
        router.replace('/paywall?source=onboarding');
      } catch (error) {
        console.error('Failed to mark onboarding complete:', error);
        router.replace('/');
      }
      return;
    }

    // All other screens - save progress and advance
    const nextScreen = getNextScreen(currentScreen);
    setCurrentOnboardingScreen(nextScreen);
    setCurrentScreen(nextScreen);
  };


  // Enhanced button text with commitment language
  const getContinueButtonText = () => {
    switch (currentScreen) {
      case SCREEN_INDICES.SCREEN_5_PET_NAMING:
        return "Name my companion →";
      case SCREEN_INDICES.SCREEN_6_EDUCATION:
        return "Continue →";
      case SCREEN_INDICES.SCREEN_7_LEARNING_STYLE:
        return "Continue →";
      case SCREEN_INDICES.SCREEN_8_TIME_GOAL:
        return "Finish setup →";
      default:
        return 'Continue →';
    }
  };

  const continueButtonText = getContinueButtonText();
  const isLastScreenValue = isLastScreen(currentScreen);

  // Render current screen
  const renderScreen = () => {
    switch (currentScreen) {
      case SCREEN_INDICES.SCREEN_1_PROBLEM:
        return <Screen1 colors={colors} />;
      case SCREEN_INDICES.SCREEN_2_SCIENCE:
        return <Screen2 colors={colors} />;
      case SCREEN_INDICES.SCREEN_3_AHA_MOMENT:
        return (
          <Screen3_AhaMoment
            colors={colors}
            onComplete={() => setCurrentScreen(SCREEN_INDICES.SCREEN_4_AUTH)}
          />
        );
      case SCREEN_INDICES.SCREEN_4_AUTH:
        return <Screen3 colors={colors} onContinue={handleContinue} />;
      case SCREEN_INDICES.SCREEN_5_PET_NAMING:
        return <Screen4_PetNaming petName={petName} onNameChange={setPetName} colors={colors} />;
      case SCREEN_INDICES.SCREEN_6_EDUCATION:
        return <Screen4_Education colors={colors} />;
      case SCREEN_INDICES.SCREEN_7_LEARNING_STYLE:
        return <Screen4_LearningStyle colors={colors} />;
      case SCREEN_INDICES.SCREEN_8_TIME_GOAL:
        return <Screen4_TimeGoal colors={colors} />;
      case SCREEN_INDICES.SCREEN_9_NOTIFICATIONS:
        return (
          <Screen4_Notifications
            petName={petName}
            colors={colors}
            onDone={async () => {
              // Track onboarding completion
              const totalDurationSeconds = Math.round((Date.now() - onboardingStartTime) / 1000);
              track('onboarding_completed', {
                total_duration_seconds: totalDurationSeconds,
                education_level: educationLevel,
                learning_style: learningStyle,
                daily_commitment_minutes: dailyCommitmentMinutes,
              });

              // Mark onboarding complete and go to paywall
              await markOnboardingComplete();
              router.replace('/paywall?source=onboarding');
            }}
          />
        );
      default:
        return <Screen1 colors={colors} />;
    }
  };

  // Determine background color based on current screen
  const screenBackground = colors.background;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: screenBackground }]} edges={['top', 'bottom']}>
      {/* Progress bar with milestones */}
      <ProgressBar
        current={currentScreen + 1}
        total={TOTAL_SCREENS}
        onBack={() => {
          if (!isFirstScreen(currentScreen)) {
            setCurrentScreen((prev) => prev - 1);
          }
        }}
        barColor={undefined}
      />

      {/* Current screen with animation */}
      <View style={styles.screenWrapper}>
        <MotiView
          key={currentScreen}
          from={{ opacity: 0, translateX: 50 }}
          animate={{ opacity: 1, translateX: 0 }}
          exit={{ opacity: 0, translateX: -50 }}
          transition={{ type: 'spring', damping: 20, stiffness: 100 } as any}
          style={styles.screenContent}
        >
          {renderScreen()}
        </MotiView>
      </View>

      {/* Navigation footer - hide for screens with their own navigation/buttons */}
      {!shouldHideFooter(currentScreen) && (
        <View style={styles.footer}>
          <OnboardingButton
            text={continueButtonText}
            onPress={handleContinue}
            variant={isLastScreenValue ? 'commitment' : 'primary'}
            loading={isNavigating}
            disabled={
              isNavigating ||
              (currentScreen === SCREEN_INDICES.SCREEN_5_PET_NAMING && !petName.trim()) ||
              (currentScreen === SCREEN_INDICES.SCREEN_6_EDUCATION && !educationLevel) ||
              (currentScreen === SCREEN_INDICES.SCREEN_7_LEARNING_STYLE && !learningStyle) ||
              (currentScreen === SCREEN_INDICES.SCREEN_8_TIME_GOAL && !dailyCommitmentMinutes)
            }
          />
        </View>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenWrapper: {
    flex: 1,
  },
  screenContent: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
  },
});
