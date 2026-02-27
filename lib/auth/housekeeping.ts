import { supabase } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Performs post-sign-in housekeeping tasks:
 * 1. Extracts and syncs names from OAuth metadata if missing in profile
 * 2. Saves any pending pet name from onboarding
 * 3. Syncs any pending names from magic link flow
 */
export async function performAuthHousekeeping(userId: string, userMetadata: any) {
    try {
        if (__DEV__) console.log('[Auth Housekeeping] Starting for user:', userId);

        // 1. Sync profile names from OAuth metadata
        const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', userId)
            .single();

        if (profile) {
            const hasValidFirstName = profile.first_name &&
                profile.first_name.trim() !== '' &&
                !profile.first_name.includes('@');

            if (!hasValidFirstName) {
                const oauthName = userMetadata?.name || userMetadata?.full_name;
                if (oauthName && typeof oauthName === 'string' && oauthName.trim() !== '') {
                    let firstName = '';
                    let lastName = '';

                    if (oauthName.includes(' ')) {
                        const parts = oauthName.trim().split(/\s+/);
                        firstName = parts[0];
                        lastName = parts.slice(1).join(' ');
                    } else {
                        firstName = oauthName.trim();
                    }

                    if (firstName) {
                        await supabase.from('profiles').update({
                            first_name: firstName,
                            last_name: lastName || ''
                        }).eq('id', userId);

                        if (__DEV__) console.log('[Auth Housekeeping] Synced names from OAuth:', { firstName, lastName });
                    }
                }
            }
        }

        // 2. Handle pending pet name from onboarding
        const store = useStore.getState();
        const pendingPetName = store.pendingPetName;
        if (pendingPetName) {
            if (__DEV__) console.log('[Auth Housekeeping] Saving pending pet name:', pendingPetName);
            await store.updatePetName(pendingPetName);
            store.clearPendingPetName();
        }

        // 3. Handle pending names from magic link (AsyncStorage fallback)
        const pendingFirstName = await AsyncStorage.getItem('pending_first_name');
        const pendingLastName = await AsyncStorage.getItem('pending_last_name');
        if (pendingFirstName) {
            await supabase.from('profiles').update({
                first_name: pendingFirstName,
                last_name: pendingLastName || '',
            }).eq('id', userId);

            await AsyncStorage.removeItem('pending_first_name');
            await AsyncStorage.removeItem('pending_last_name');
            if (__DEV__) console.log('[Auth Housekeeping] Saved pending names from storage');
        }

    } catch (error) {
        console.error('[Auth Housekeeping] Error:', error);
        // Don't throw - housekeeping shouldn't block the main auth flow
    }
}
