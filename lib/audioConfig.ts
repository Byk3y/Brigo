import { setAudioModeAsync } from 'expo-audio';
import { useStore } from './store';

// We've moved to expo-audio for better lock-screen and background support.
// This file handles global session property updates.

let isConfigured = false;
let initPromise: Promise<void> | null = null;
let currentSettings: any = null;
let currentMode: 'mixing' | 'primary' = 'mixing';

/**
 * Configures the global audio mode for the app.
 * Ensures that app sounds mix with background music rather than stopping it.
 */
export async function configureAudioMode(staysActiveInBackground: boolean = false) {
    try {
        const state = useStore.getState();
        const { audioSettings } = state;

        currentSettings = { ...audioSettings, staysActiveInBackground };

        const shouldBackground = staysActiveInBackground || audioSettings.backgroundPlayback;

        await setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: shouldBackground,
            interruptionMode: 'mixWithOthers',
            allowsRecording: false,
        });
        isConfigured = true;
        currentMode = 'mixing';
    } catch (error) {
        console.error('[AudioConfig] Failed to set audio mode:', error);
    }
}

/**
 * Configures audio mode for primary media playback (podcasts).
 * Uses DoNotMix so iOS Control Center shows our metadata (title, artist).
 * This makes Brigo the "primary" audio app and will pause other audio apps.
 */
export async function configureForMediaPlayback() {
    try {
        await setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: true,
            interruptionMode: 'doNotMix',
            allowsRecording: false,
        });
        currentMode = 'primary';
        console.log('[AudioConfig] Switched to primary media playback mode (doNotMix)');
    } catch (error) {
        console.error('[AudioConfig] Failed to set media playback mode:', error);
    }
}

/**
 * Reverts audio mode back to mixing (for sound effects, haptics, etc.).
 * Call this when the AudioPlayer is closed.
 */
export async function configureForMixing() {
    try {
        if (currentMode === 'mixing') return; // Already in mixing mode

        const state = useStore.getState();
        const { audioSettings } = state;

        await setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: audioSettings.backgroundPlayback,
            interruptionMode: 'mixWithOthers',
            allowsRecording: false,
        });
        currentMode = 'mixing';
        console.log('[AudioConfig] Reverted to mixing mode (mixWithOthers)');
    } catch (error) {
        console.error('[AudioConfig] Failed to revert to mixing mode:', error);
    }
}

/**
 * Subscriber to store changes - re-applies audio mode if preferences change.
 */
useStore.subscribe((state) => {
    const settings = state.audioSettings;
    if (!isConfigured || !settings) return;

    // Only re-configure if relevant flags changed
    if (
        currentSettings?.backgroundPlayback !== settings.backgroundPlayback ||
        currentSettings?.hapticsEnabled !== settings.hapticsEnabled
    ) {
        console.log('[AudioConfig] Audio settings changed, re-configuring...');
        configureAudioMode(currentSettings?.staysActiveInBackground);
    }
});

/**
 * Initial configuration for the app startup.
 * Sets the default "mixing" mode.
 * Returns a promise that resolves when audio is configured.
 * Multiple calls return the same promise (singleton pattern).
 */
export function initAudioConfig(): Promise<void> {
    if (isConfigured) return Promise.resolve();
    if (initPromise) return initPromise;

    initPromise = configureAudioMode(false);
    return initPromise;
}

/**
 * Wait for audio to be initialized.
 * Use this in components that need to play sounds.
 */
export async function waitForAudioInit(): Promise<void> {
    if (isConfigured) return;
    if (initPromise) {
        await initPromise;
    } else {
        await initAudioConfig();
    }
}

/**
 * Check if audio has been configured.
 */
export function isAudioConfigured(): boolean {
    return isConfigured;
}

