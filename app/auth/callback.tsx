/**
 * Auth Callback Handler
 * Handles OAuth and magic link callbacks
 */

import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { validateTokens } from '@/lib/auth/tokenValidator';
import { useErrorHandler } from '@/lib/hooks/useErrorHandler';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { handleError } = useErrorHandler();

  useEffect(() => {
    let mounted = true;

    const handleAuthCallback = async () => {
      try {
        if (__DEV__) console.log('[Auth Callback] Screen mounted, checking auth state...');

        // Check if user is already authenticated (e.g., from googleSignIn.ts OAuth flow)
        // This prevents duplicate setSession() calls that interrupt data fetching
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        const alreadyAuthenticated = !!existingSession?.user;

        if (__DEV__) {
          console.log('[Auth Callback] Auth check:', {
            alreadyAuthenticated,
            hasSession: !!existingSession,
            userId: existingSession?.user?.id?.substring(0, 8)
          });
        }

        if (alreadyAuthenticated) {
          if (__DEV__) console.log('[Auth Callback] Skipping duplicate setSession, proceeding to routing...');
        }

        // Handle deep link URL if app was opened via magic link or OAuth callback
        const url = await Linking.getInitialURL();
        if (url) {
          const parsed = Linking.parse(url);
          console.log('Deep link URL:', url);
          console.log('Parsed URL:', parsed);

          // Extract tokens from query params, hash fragment, or route params
          const queryParams = parsed.queryParams || {};
          let accessToken = (queryParams.access_token || params.access_token) as string | undefined;
          let refreshToken = (queryParams.refresh_token || params.refresh_token) as string | undefined;

          // SECURITY: Sanitize raw params
          if (accessToken) accessToken = accessToken.trim();
          if (refreshToken) refreshToken = refreshToken.trim();

          // If not in query params, check hash fragment (OAuth callbacks use hash)
          if (!accessToken || !refreshToken) {
            try {
              const urlObj = new URL(url);
              // Supabase OAuth callbacks often use #access_token=...&refresh_token=...
              // We check both the hash and potentially query if URL parsing differed
              const fragment = urlObj.hash.substring(1) || urlObj.search.substring(1);

              if (fragment) {
                const searchParams = new URLSearchParams(fragment);
                accessToken = accessToken || (searchParams.get('access_token')?.trim() as string | undefined);
                refreshToken = refreshToken || (searchParams.get('refresh_token')?.trim() as string | undefined);

                // Fallback for types if they are in different keys
                if (!accessToken) accessToken = searchParams.get('token')?.trim() as string | undefined;
              }
            } catch (e) {
              console.warn('[Auth Callback] URL parsing failed, using regex fallback:', e);
              // Regex fallback for malformed URLs or specific deep link formats
              const accessTokenMatch = url.match(/[#?&]access_token=([^&]+)/);
              const refreshTokenMatch = url.match(/[#?&]refresh_token=([^&]+)/);

              if (accessTokenMatch) accessToken = accessToken || decodeURIComponent(accessTokenMatch[1]).trim();
              if (refreshTokenMatch) refreshToken = refreshToken || decodeURIComponent(refreshTokenMatch[2]).trim();
            }
          }

          if (accessToken && refreshToken && !alreadyAuthenticated) {
            // Validate tokens before using them (security - prevents injection attacks)
            const validation = validateTokens(accessToken, refreshToken);
            if (!validation.isValid) {
              console.error('Auth callback - token validation failed:', validation.error);
              if (!mounted) return;
              router.replace('/auth');
              return;
            }

            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              console.error('Auth callback error:', error);
              if (!mounted) return;
              router.replace('/auth');
              return;
            }
          }
        } else {
          // Handle OAuth and magic link callbacks from params
          const accessToken = params.access_token as string | undefined;
          const refreshToken = params.refresh_token as string | undefined;

          if (accessToken && refreshToken && !alreadyAuthenticated) {
            // Validate tokens before using them (security - prevents injection attacks)
            const validation = validateTokens(accessToken, refreshToken);
            if (!validation.isValid) {
              console.error('Auth callback - token validation failed:', validation.error);
              if (!mounted) return;
              router.replace('/auth');
              return;
            }

            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              console.error('Auth callback error:', error);
              if (!mounted) return;
              router.replace('/auth');
              return;
            }
          }
        }

        // Check if user is authenticated
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          // Check for pending names from magic link signup
          const pendingFirstName = await AsyncStorage.getItem('pending_first_name');
          const pendingLastName = await AsyncStorage.getItem('pending_last_name');

          if (pendingFirstName && pendingLastName) {
            try {
              // Save names to profiles table
              const { error } = await supabase
                .from('profiles')
                .update({
                  first_name: pendingFirstName,
                  last_name: pendingLastName,
                })
                .eq('id', user.id);

              if (!error) {
                // Clear pending data
                await AsyncStorage.removeItem('pending_first_name');
                await AsyncStorage.removeItem('pending_last_name');
                console.log('Names saved from magic link:', pendingFirstName, pendingLastName);
              } else {
                console.error('Failed to save names:', error);
              }
            } catch (error) {
              console.error('Error saving names:', error);
            }
          } else {
            // No magic link names - check if we should extract from OAuth metadata
            // This handles existing accounts that sign in via OAuth
            try {
              // Check current profile state
              const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', user.id)
                .single();

              if (profileError && profileError.code !== 'PGRST116') {
                console.error('Error checking profile:', profileError);
              } else if (profile) {
                // Check if names are missing or invalid (empty, null, or email-like)
                const hasValidFirstName = profile.first_name &&
                  profile.first_name.trim() !== '' &&
                  !profile.first_name.includes('@');
                const hasValidLastName = profile.last_name &&
                  profile.last_name.trim() !== '';

                // Only update if names are missing or invalid
                if (!hasValidFirstName || !hasValidLastName) {
                  // Extract name from OAuth metadata
                  const oauthName = user.user_metadata?.name ||
                    user.user_metadata?.full_name;

                  if (oauthName && typeof oauthName === 'string' && oauthName.trim() !== '') {
                    // Parse OAuth name into first and last
                    let parsedFirstName = '';
                    let parsedLastName = '';

                    if (oauthName.includes(' ')) {
                      // Has space - split into first and last
                      const parts = oauthName.trim().split(/\s+/);
                      parsedFirstName = parts[0];
                      parsedLastName = parts.slice(1).join(' '); // Handle multiple spaces
                    } else {
                      // No space - put entire string in first_name
                      parsedFirstName = oauthName.trim();
                      parsedLastName = '';
                    }

                    // Only update the missing parts
                    const updates: { first_name?: string; last_name?: string } = {};
                    if (!hasValidFirstName) {
                      updates.first_name = parsedFirstName;
                    }
                    if (!hasValidLastName && parsedLastName) {
                      updates.last_name = parsedLastName;
                    }

                    if (Object.keys(updates).length > 0) {
                      const { error: updateError } = await supabase
                        .from('profiles')
                        .update(updates)
                        .eq('id', user.id);

                      if (!updateError) {
                        console.log('Names extracted from OAuth metadata:', updates);
                      } else {
                        console.error('Failed to update names from OAuth:', updateError);
                      }
                    }
                  }
                }
              }
            } catch (error) {
              console.error('Error extracting OAuth names:', error);
            }
          }

          // Handle pending pet name from onboarding with retry logic
          const store = useStore.getState();
          const pendingPetName = store.pendingPetName;
          const currentOnboardingScreen = store.currentOnboardingScreen;

          if (pendingPetName) {
            // Check if pet state already exists with a customized name
            // Default names that can be overwritten: 'Nova', 'Sparky', or empty/null
            const defaultNames = ['Nova', 'Sparky', 'Holian'];

            try {
              const { data: existingPetState, error: petStateError } = await (supabase
                .from('pet_states' as any) as any)
                .select('name')
                .eq('user_id', user.id)
                .single();

              // PGRST116 = no rows returned (pet state doesn't exist yet)
              if (petStateError && (petStateError as any).code === 'PGRST116') {
                // No pet state exists - save the new name from onboarding
                // This will create the pet state with the new name
                let retryCount = 0;
                const maxRetries = 3;
                let success = false;

                while (retryCount < maxRetries && !success) {
                  try {
                    await store.updatePetName(pendingPetName);
                    store.clearPendingPetName();
                    console.log('Pet name saved (new pet state):', pendingPetName);
                    success = true;
                  } catch (error) {
                    retryCount++;
                    console.error(`Error saving pet name (attempt ${retryCount}/${maxRetries}):`, error);

                    if (retryCount >= maxRetries) {
                      console.error('Failed to save pet name after max retries.');
                    } else {
                      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                    }
                  }
                }
                // Continue to navigation logic below - don't return early
              }

              if (petStateError) {
                // Some other error - proceed with save attempt
                throw petStateError;
              }

              const petState = existingPetState as any;
              const hasCustomName = petState &&
                petState.name &&
                petState.name.trim() !== '' &&
                !defaultNames.includes(petState.name.trim());

              if (hasCustomName) {
                // Pet already has a customized name - preserve it, don't overwrite
                console.log('Pet name already customized, preserving:', petState.name);
                store.clearPendingPetName(); // Clear pending name since we're not using it
              } else {
                // No custom name exists - save the new name from onboarding
                let retryCount = 0;
                const maxRetries = 3;
                let success = false;

                while (retryCount < maxRetries && !success) {
                  try {
                    // Save pet name to database
                    await store.updatePetName(pendingPetName);

                    // Clear pending name only after successful save
                    store.clearPendingPetName();

                    console.log('Pet name saved:', pendingPetName);
                    success = true;
                  } catch (error) {
                    retryCount++;
                    console.error(`Error saving pet name (attempt ${retryCount}/${maxRetries}):`, error);

                    if (retryCount >= maxRetries) {
                      // Failed after all retries - keep pendingPetName for later retry
                      console.error('Failed to save pet name after max retries. Will retry on next app launch.');
                      // Don't clear pendingPetName - it will be retried on next app open
                    } else {
                      // Wait before retry (exponential backoff)
                      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                    }
                  }
                }
              }
            } catch (error) {
              // Error checking pet state - proceed with saving (safer to save than lose)
              console.error('Error checking existing pet state, proceeding with save:', error);
              let retryCount = 0;
              const maxRetries = 3;
              let success = false;

              while (retryCount < maxRetries && !success) {
                try {
                  await store.updatePetName(pendingPetName);
                  store.clearPendingPetName();
                  console.log('Pet name saved:', pendingPetName);
                  success = true;
                } catch (saveError) {
                  retryCount++;
                  console.error(`Error saving pet name (attempt ${retryCount}/${maxRetries}):`, saveError);

                  if (retryCount >= maxRetries) {
                    console.error('Failed to save pet name after max retries.');
                  } else {
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                  }
                }
              }
            }
          }

          // Check if onboarding is incomplete
          if (currentOnboardingScreen >= 3 && currentOnboardingScreen < 9) {
            // Resume onboarding at saved screen (after auth break at screen 3)
            if (__DEV__) console.log('[Auth Callback] Resuming onboarding at screen', currentOnboardingScreen);
            if (!mounted) return;
            router.replace('/onboarding');
          } else {
            // Onboarding complete, go to home
            if (__DEV__) console.log('[Auth Callback] Onboarding complete, routing to home');
            if (!mounted) return;
            router.replace('/');
          }
        } else {
          if (!mounted) return;
          router.replace('/auth');
        }
      } catch (error) {
        if (!mounted) return;

        // Use centralized error handler for proper classification and reporting
        await handleError(error, {
          operation: 'auth_callback',
          component: 'auth-callback',
          metadata: {
            hasParams: !!params,
            paramsKeys: Object.keys(params || {})
          },
        });

        // Redirect to auth on error
        if (!mounted) return;
        router.replace('/auth');
      }
    };

    handleAuthCallback();

    return () => {
      mounted = false;
    };
  }, [params]);

  return (
    <View className="flex-1 items-center justify-center bg-neutral-50">
      <ActivityIndicator size="large" color="#3B82F6" />
      <Text className="mt-4 text-neutral-600">Completing sign in...</Text>
    </View>
  );
}

