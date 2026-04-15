/**
 * Google Sign-In Service
 * Native flow via @react-native-google-signin/google-signin + Supabase signInWithIdToken.
 * Requires a development build or production build — will not work in Expo Go.
 */

import {
  GoogleSignin,
  statusCodes,
  isSuccessResponse,
  isErrorWithCode,
} from '@react-native-google-signin/google-signin';
import { supabase } from '@/lib/supabase';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

if (!webClientId) {
  throw new Error('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set');
}

GoogleSignin.configure({
  webClientId,
  iosClientId,
  scopes: ['openid', 'email', 'profile'],
});

/**
 * Sign in with Google using the native sign-in sheet.
 * Returns the Supabase session on success; throws with a typed message on failure.
 */
export async function signInWithGoogle(): Promise<{ session: any; user: any }> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      // v13+ surfaces cancellation as { type: 'cancelled', data: null }
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
      }
    }
    throw error;
  }
}

/**
 * Kept for backwards compatibility with earlier OAuth-flow callers.
 * Configuration happens at module load, so this is a no-op.
 */
export function configureGoogleSignIn() {}
