/**
 * Google Sign-In Service
 * Native flow via @react-native-google-signin/google-signin + Supabase signInWithIdToken.
 * Requires a development build or production build — will not work in Expo Go.
 *
 * Module-load safety: the native module imports are wrapped behind an Expo Go
 * check so that opening the app in Expo Go doesn't crash the bundle. If
 * signInWithGoogle is actually invoked in Expo Go it throws with a clear
 * message; the email auth path still works.
 */

import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

const isExpoGo = Constants.appOwnership === 'expo';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

// Lazy-loaded native SDK. Loading happens on first call so module import
// doesn't crash under Expo Go, where the native binary is absent.
let googleSignInModule: typeof import('@react-native-google-signin/google-signin') | null = null;
let configured = false;

function loadGoogleSignIn() {
  if (isExpoGo) {
    throw new Error(
      'Google sign-in requires a dev/production build and cannot run in Expo Go.',
    );
  }
  if (!webClientId) {
    throw new Error('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set');
  }
  if (!googleSignInModule) {
    googleSignInModule = require('@react-native-google-signin/google-signin');
  }
  if (!configured) {
    googleSignInModule!.GoogleSignin.configure({
      webClientId,
      iosClientId,
      scopes: ['openid', 'email', 'profile'],
    });
    configured = true;
  }
  return googleSignInModule!;
}

/**
 * Sign in with Google using the native sign-in sheet.
 * Returns the Supabase session on success; throws with a typed message on failure.
 */
export async function signInWithGoogle(): Promise<{ session: any; user: any }> {
  const { GoogleSignin, statusCodes, isSuccessResponse, isErrorWithCode } = loadGoogleSignIn();

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      throw new Error('Sign in was cancelled');
    }

    const idToken = response.data.idToken;
    if (!idToken) {
      throw new Error('Google did not return an ID token');
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) throw error;
    if (!data.session || !data.user) {
      throw new Error('Failed to create Supabase session');
    }

    return { session: data.session, user: data.user };
  } catch (error: any) {
    if (isErrorWithCode(error)) {
      switch (error.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          throw new Error('Sign in was cancelled');
        case statusCodes.IN_PROGRESS:
          throw new Error('Sign in already in progress');
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          throw new Error('Google Play Services not available on this device');
        case 'DEVELOPER_ERROR':
        case '10':
          throw new Error('Google sign-in is misconfigured. Please try again or contact support.');
      }
    }
    throw error;
  }
}

/**
 * Kept for backwards compatibility with earlier OAuth-flow callers.
 * Configuration is deferred until signInWithGoogle is called.
 */
export function configureGoogleSignIn() {}
