/**
 * Studio Utility Functions
 * Shared utilities for StudioTab and related components
 */

import { Alert } from 'react-native';

/**
 * Format seconds into human-readable duration (e.g., 125 -> "2m 5s")
 */
export const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
};

/**
 * Get relative time string (e.g., "2h ago", "Just now")
 */
export const getTimeAgo = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

/**
 * Show confirmation dialog for repeat generation
 * Returns true if user confirms, false if cancelled
 */
export const confirmRepeatGeneration = (
  label: string,
  existingCount: number
): Promise<boolean> => {
  if (existingCount === 0) {
    return Promise.resolve(true);
  }
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      `Generate another ${label}?`,
      `You've already generated a ${label.toLowerCase()} for this notebook. Generate another?`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Generate', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true }
    );
  });
};

/**
 * Error message formatting for studio generation errors
 * Returns structured error info for display
 */
export interface StudioErrorInfo {
  title: string;
  message: string;
}

export const formatStudioError = (
  error: any,
  contentType: 'flashcards' | 'quiz' | 'audio'
): StudioErrorInfo => {
  const errorMessage = error?.message || `Failed to generate ${contentType}`;

  // Quota/trial limit errors
  if (errorMessage.includes('Trial limit reached') || errorMessage.includes('quota')) {
    const limitMessage = contentType === 'audio'
      ? 'podcasts'
      : 'Studio jobs';
    const featureMessage = contentType === 'audio'
      ? 'audio summaries'
      : 'flashcards and quizzes';

    if (error?.remaining !== undefined && error?.limit !== undefined) {
      return {
        title: 'Limit Reached',
        message: `You've used all ${error.limit} ${limitMessage} in your trial. Upgrade to Premium for unlimited ${featureMessage}!`,
      };
    }
    return {
      title: 'Limit Reached',
      message: `You've reached your trial limit. Upgrade to Premium for unlimited access!`,
    };
  }

  // Trial expired
  if (errorMessage.includes('trial has expired')) {
    const contentName = contentType === 'audio' ? 'audio summaries' : contentType;
    return {
      title: 'Trial Expired',
      message: `Your trial has ended. Upgrade to Premium to continue creating ${contentName}!`,
    };
  }

  // Authentication errors
  if (errorMessage.includes('Not authenticated')) {
    return {
      title: 'Authentication Required',
      message: `Please sign in to generate ${contentType}.`,
    };
  }

  // Content too short
  if (errorMessage.includes('Material content too short')) {
    const contentName = contentType === 'audio' ? 'a podcast' : contentType;
    return {
      title: 'Content Too Short',
      message: `Your material needs at least 500 characters to generate ${contentName}.`,
    };
  }

  // Network errors
  const isNetworkError =
    error?.isNetworkError ||
    errorMessage.includes('Network request failed') ||
    errorMessage.includes('network') ||
    errorMessage.includes('fetch') ||
    error?.name === 'TypeError' ||
    error?.name === 'AbortError';

  if (isNetworkError) {
    return {
      title: 'Connection Issue',
      message: `Unable to ${contentType === 'audio' ? 'start audio generation' : `generate ${contentType}`}. Please check your connection and try again.`,
    };
  }

  // Generic fallback
  return {
    title: 'Generation Failed',
    message: `Unable to generate ${contentType}. Please check your connection and try again.`,
  };
};

/**
 * Check if an error is a network-related error
 */
export const isNetworkError = (error: any): boolean => {
  return (
    error?.isNetworkError ||
    error?.message?.includes('Network request failed') ||
    error?.message?.includes('network') ||
    error?.message?.includes('fetch') ||
    error?.name === 'TypeError' ||
    error?.name === 'AbortError'
  );
};




















