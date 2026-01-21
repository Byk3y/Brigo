import { useEffect } from 'react';
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
      (message.includes('rate limit') && message.includes('Auth'))
    ) {
      if (__DEV__) return;
      return;
    }
    // Log all other errors normally
    originalError.apply(console, args);
  };
}

// Initialize Mixpanel as early as possible (before React renders)
import { initMixpanel } from '@/lib/services/analyticsService';
initMixpanel();

// Initialize Google Sign-In configuration (OAuth flow - works in Expo Go)
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
import { NetworkProvider } from '@/lib/contexts/NetworkContext';
import { CelebrationProvider } from '@/lib/contexts/CelebrationContext';
import { CelebrationOverlay } from '@/components/CelebrationOverlay';
import { OfflineBanner } from '@/components/OfflineBanner';
import '../global.css';

// Custom hooks for modular functionality
import { useAppFonts } from '@/hooks/useFonts';
import { useGlobalErrorHandler } from '@/hooks/useGlobalErrorHandler';
import { useThemeSync } from '@/hooks/useThemeSync';
import { useAuthSetup } from '@/hooks/useAuthSetup';
import { useDeepLinks } from '@/hooks/useDeepLinks';
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

  // Hydration state from store
  const { _hasHydrated, isInitialized } = useStore();

  // Get theme from context
  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);

  // Initialize all app setup hooks
  useGlobalErrorHandler();
  useThemeSync();
  useAuthSetup();
  useDeepLinks();
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
  const isAppReady = fontsLoaded && _hasHydrated && isInitialized && isRoutingReady;

  // Hide splash screen once app is completely ready
  useEffect(() => {
    if (isAppReady) {
      // Small delay to ensure the UI has actually painted the first frame of the target screen
      const timer = setTimeout(async () => {
        await SplashScreen.hideAsync().catch(() => { });
        if (__DEV__) console.log('[UX] App ready, splash screen hidden');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAppReady]);

  // Don't render Stack until everything is ready.
  // Returning null keeps the native splash screen visible.
  if (!isAppReady) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
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
            presentation: 'transparentModal',
            animation: 'none',
            contentStyle: { backgroundColor: 'transparent' },
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
      <OfflineBanner />
      <CelebrationOverlay />
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
      backdropColor={isDarkMode ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.6)'}
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
