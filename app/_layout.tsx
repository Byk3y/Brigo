import { useEffect, useRef, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { initSentry } from '@/lib/sentry';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* reloading the app might cause some errors here, safe to ignore */
});

initSentry();

// Suppress expected Supabase auth errors in console (invalid refresh token when logged out)
if (typeof console !== 'undefined' && console.error) {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const error = args[0];
    const message = (typeof error === 'string' ? error : error?.message || error?.toString()) || '';

    // Suppress expected auth or SDK race condition errors
    if (
      message.includes('Invalid Refresh Token') ||
      message.includes('Refresh Token Not Found') ||
      message.includes('refresh_token_not_found') ||
      message.includes('AuthApiError') ||
      message.includes('operation is already in progress') ||
      message.includes('Network request failed') ||
      message.includes('native store is not available') ||
      message.includes('RevenueCat') ||
      (message.includes('rate limit') && message.includes('Auth'))
    ) {
      return;
    }
    // Log all other errors normally
    originalError.apply(console, args);
  };
}

// Initialize Mixpanel as early as possible (before React renders)
import { initMixpanel } from '@/lib/services/analyticsService';
initMixpanel();

// Load Google Sign-In module (configures native SDK at module evaluation).
import { configureGoogleSignIn } from '@/lib/auth/googleSignIn';
configureGoogleSignIn();

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image, View } from 'react-native';
import { ThemeProvider, useTheme, getThemeColors } from '@/lib/ThemeContext';
import { ErrorNotificationProvider } from '@/lib/contexts/ErrorNotificationContext';
import { ErrorNotificationContainer } from '@/components/ErrorNotificationContainer';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { InAppNotification } from '@/components/InAppNotification';
import { StreakBanner } from '@/components/StreakBanner';
import { NetworkProvider } from '@/lib/contexts/NetworkContext';
import { CelebrationProvider } from '@/lib/contexts/CelebrationContext';
import { CelebrationOverlay } from '@/components/CelebrationOverlay';
import { OfflineBanner } from '@/components/OfflineBanner';
import { StudyPalConfirmationModal } from '@/components/modals/StudyPalConfirmationModal';
import '../global.css';

// Custom hooks for modular functionality
import { useAppFonts } from '@/hooks/useFonts';
import { useGlobalErrorHandler } from '@/hooks/useGlobalErrorHandler';
import { useThemeSync } from '@/hooks/useThemeSync';
import { useAuthSetup } from '@/hooks/useAuthSetup';
import { useDeepLinks } from '@/hooks/useDeepLinks';
import { useInviteHandler } from '@/hooks/useInviteHandler';
import { useAssetPreloading } from '@/hooks/useAssetPreloading';
import { useAppStateMonitoring } from '@/hooks/useAppStateMonitoring';
import { useRoutingLogic } from '@/hooks/useRoutingLogic';
import { useStreakCheck } from '@/hooks/useStreakCheck';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useWidgetSync } from '@/hooks/useWidgetSync';
import { useStore } from '@/lib/store';
import { SpotlightTourProvider } from 'react-native-spotlight-tour';
import { HOME_TOUR_STEPS } from '@/lib/walkthrough/steps';
import { HomeWalkthroughTooltip } from '@/lib/walkthrough/WalkthroughTooltip';

// Initialize audio configuration
import { initAudioConfig } from '@/lib/audioConfig';
initAudioConfig();

// Initialize RevenueCat SDK
import { initializePurchases } from '@/lib/purchases';

// Inner layout component that uses the theme context
function RootLayoutInner() {
  // Load fonts
  const fontsLoaded = useAppFonts();

  // Hydration and data state from store
  const {
    _hasHydrated,
    isInitialized,
    user,
    petStateReady,
    userProfileSyncedAt,
    authUser
  } = useStore();

  // Get theme from context
  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);

  // Initialize all app setup hooks
  useGlobalErrorHandler();
  useThemeSync();
  useAuthSetup();
  useDeepLinks();
  useInviteHandler();
  useAssetPreloading();
  useAppStateMonitoring();
  useStreakCheck();
  usePushNotifications();
  useWidgetSync();

  // Initialize RevenueCat and Audio Preloading
  useEffect(() => {
    initializePurchases();

    // Preload audio feedback sounds once globally
    const { preloadAllSounds } = require('@/lib/feedback');
    preloadAllSounds().catch(() => { });
  }, []);

  // Handle routing logic (waits for fonts and hydration)
  const isRoutingReady = useRoutingLogic(fontsLoaded);

  // High-precision ready check for 2026 UX
  // If we have an auth user, we must wait for their profile and pet state to sync from database
  const isDataReady = !authUser || (user.id !== '' && petStateReady && !!userProfileSyncedAt);
  const isAppReady = fontsLoaded && _hasHydrated && isInitialized && isRoutingReady && isDataReady;

  // JS splash overlay: holds the wordmark on screen so Android isn't stuck
  // showing the tiny OS-level icon. iOS LaunchScreen already shows the same
  // wordmark, so the handoff is visually seamless.
  const [showJsSplash, setShowJsSplash] = useState(true);
  const hidOsSplashRef = useRef(false);

  // Dismiss the OS splash as soon as RN can render anything. The JS splash
  // overlay below is already mounted and painted by this point, so the OS
  // splash hand-off is invisible.
  useEffect(() => {
    if (hidOsSplashRef.current) return;
    if (fontsLoaded && _hasHydrated) {
      hidOsSplashRef.current = true;
      SplashScreen.hideAsync().catch(() => { });
    }
  }, [fontsLoaded, _hasHydrated]);

  // Once everything is ready, give the Stack 500ms to paint behind the
  // overlay, then drop the splash to reveal the painted home screen.
  useEffect(() => {
    if (isAppReady) {
      const timer = setTimeout(() => {
        setShowJsSplash(false);
        if (__DEV__) console.log('[UX] App ready, JS splash dismissed');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAppReady]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      {isAppReady && (<>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding/index" />
        <Stack.Screen name="auth/index" />
        <Stack.Screen name="auth/magic-link" />
        <Stack.Screen name="auth/callback" />

        <Stack.Screen name="quiz/[id]" />
        <Stack.Screen
          name="pet-sheet"
          options={{
            animation: 'slide_from_right',
            gestureEnabled: true,
            gestureDirection: 'horizontal',
          }}
        />
        <Stack.Screen
          name="friends"
          options={{
            presentation: 'formSheet',
            animation: 'slide_from_bottom',
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            sheetInitialDetentIndex: 0,
            sheetAllowedDetents: 'fitToContents',
          }}
        />
        <Stack.Screen
          name="paywall"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>

      <Image
        source={require('@/assets/pets/stage-1/full-view.png')}
        style={{ width: 300, height: 300, opacity: 0, position: 'absolute', top: -9999, left: -9999 }}
        fadeDuration={0}
      />
      <Image
        source={require('@/assets/pets/stage-2/silhouette.png')}
        style={{ width: 300, height: 300, opacity: 0, position: 'absolute', top: -9999, left: -9999 }}
        fadeDuration={0}
      />
      <Image
        source={require('@/assets/pets/stage-2/full-view.png')}
        style={{ width: 300, height: 300, opacity: 0, position: 'absolute', top: -9999, left: -9999 }}
        fadeDuration={0}
      />
      <Image
        source={require('@/assets/pets/stage-3/silhouette.png')}
        style={{ width: 300, height: 300, opacity: 0, position: 'absolute', top: -9999, left: -9999 }}
        fadeDuration={0}
      />
      <Image
        source={require('@/assets/pets/stage-3/full-view.png')}
        style={{ width: 300, height: 300, opacity: 0, position: 'absolute', top: -9999, left: -9999 }}
        fadeDuration={0}
      />
      <Image
        source={require('@/assets/pets/stage-3/bubble.png')}
        style={{ width: 110, height: 110, opacity: 0, position: 'absolute', top: -9999, left: -9999 }}
        fadeDuration={0}
      />

      <InAppNotification />
      <StreakBanner />
      <OfflineBanner />
      <CelebrationOverlay />
      <StudyPalConfirmationModal />
      </>)}

      {showJsSplash && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#faf9f6',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image
            source={require('@/assets/splash.png')}
            style={{ width: '100%', height: '100%' }}
            resizeMode="contain"
            fadeDuration={0}
          />
        </View>
      )}
    </View>
  );
}

// Main export - wraps with ThemeProvider, ErrorNotificationProvider, and ErrorBoundary
export default function RootLayout() {
  return (
    <ThemeProvider>
      <NetworkProvider>
        <CelebrationProvider>
          <RootLayoutTour />
        </CelebrationProvider>
      </NetworkProvider>
    </ThemeProvider>
  );
}

function RootLayoutTour() {
  const { isDarkMode } = useTheme();

  return (
    <SpotlightTourProvider
      steps={HOME_TOUR_STEPS}
      onBackdropPress="continue"
      overlayColor={isDarkMode ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,1,0.6)'}
    >
      <ErrorBoundary component="RootLayout">
        <ErrorNotificationProvider>
          <ErrorNotificationContainer />
          <RootLayoutInner />
        </ErrorNotificationProvider>
      </ErrorBoundary>
    </SpotlightTourProvider>
  );
}
