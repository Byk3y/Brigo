/**
 * useAudioPlaybackPosition Hook
 * Manages audio playback position persistence for resume functionality
 */

import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';

const SAVE_DEBOUNCE_MS = 2000; // Save at most once every 2 seconds
const MIN_POSITION_TO_SAVE = 5; // Don't save positions less than 5 seconds

interface UseAudioPlaybackPositionReturn {
  savedPosition: number | null;
  saveCurrentPosition: (position: number) => void;
  clearSavedPosition: () => void;
  hasResumablePosition: boolean;
}

/**
 * Hook to manage audio playback position persistence
 *
 * @param podcastId - Unique identifier for the podcast
 * @param notebookId - ID of the parent notebook
 * @param audioUrl - URL of the audio file (for validation)
 * @param duration - Total duration of the audio in seconds
 * @returns Position management functions and state
 *
 * @example
 * ```typescript
 * const { savedPosition, saveCurrentPosition, clearSavedPosition, hasResumablePosition } =
 *   useAudioPlaybackPosition(audioId, notebookId, audioUrl, duration);
 *
 * // Load saved position after audio loads
 * if (savedPosition && savedPosition > 5) {
 *   await sound.setPositionAsync(savedPosition * 1000);
 * }
 *
 * // Save position during playback
 * const onPlaybackUpdate = (status) => {
 *   saveCurrentPosition(status.positionMillis / 1000);
 * };
 *
 * // Clear position when audio finishes
 * if (didFinish) {
 *   clearSavedPosition();
 * }
 * ```
 */
export const useAudioPlaybackPosition = (
  audioOverviewId: string,
  notebookId: string,
  audioUrl: string,
  duration: number
): UseAudioPlaybackPositionReturn => {
  const {
    savePosition,
    getPosition,
    clearPosition,
    hasStoredPosition,
  } = useStore();

  const savedPosition = getPosition(audioOverviewId);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedPositionRef = useRef<number | null>(null);

  /**
   * Save current playback position with debouncing
   * Only saves if position has changed significantly and meets minimum threshold
   */
  const saveCurrentPosition = useCallback(
    (position: number) => {
      // Don't save very early positions
      if (position < MIN_POSITION_TO_SAVE) return;

      // Don't save if position hasn't changed much (within 1 second)
      if (
        lastSavedPositionRef.current !== null &&
        Math.abs(position - lastSavedPositionRef.current) < 1
      ) {
        return;
      }

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Debounce save
      saveTimeoutRef.current = setTimeout(() => {
        savePosition(audioOverviewId, position, duration, notebookId, audioUrl);
        lastSavedPositionRef.current = position;
      }, SAVE_DEBOUNCE_MS);
    },
    [audioOverviewId, duration, notebookId, audioUrl, savePosition]
  );

  /**
   * Clear saved position for this audio
   */
  const clearSavedPosition = useCallback(() => {
    clearPosition(audioOverviewId);
    lastSavedPositionRef.current = null;
  }, [audioOverviewId, clearPosition]);

  /**
   * Check if there's a resumable position (>5 seconds)
   */
  const hasResumablePosition =
    hasStoredPosition(audioOverviewId) &&
    savedPosition !== null &&
    savedPosition > MIN_POSITION_TO_SAVE;

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    savedPosition,
    saveCurrentPosition,
    clearSavedPosition,
    hasResumablePosition,
  };
};
