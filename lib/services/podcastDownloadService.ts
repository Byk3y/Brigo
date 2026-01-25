/**
 * Podcast Download Service
 * Handles downloading and sharing podcast files
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { handleError } from '@/lib/errors';

interface DownloadResult {
  success: boolean;
  message: string;
}

interface DownloadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * Sanitize filename to prevent path traversal and invalid characters
 */
function sanitizeFilename(filename: string): string {
  // Remove special characters and replace with underscore
  let sanitized = filename.replace(/[\/\\?%*:|"<>]/g, '_');

  // Remove leading/trailing whitespace and dots
  sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '');

  // Limit length to 100 characters (excluding extension)
  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 100);
  }

  // Ensure at least some content remains
  if (!sanitized || sanitized.length === 0) {
    sanitized = 'podcast';
  }

  return sanitized;
}

/**
 * Extract file extension from storage path
 */
function extractFileExtension(storagePath?: string): string {
  if (!storagePath) return '.mp3';

  const match = storagePath.match(/\.([a-zA-Z0-9]+)$/);
  return match ? `.${match[1]}` : '.mp3';
}

/**
 * Download and share a podcast file
 */
export async function downloadPodcastFile(
  audioUrl: string,
  title: string,
  storagePath?: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<DownloadResult> {
  try {
    // Input validation
    if (!audioUrl || typeof audioUrl !== 'string' || audioUrl.trim().length === 0) {
      return {
        success: false,
        message: 'Invalid podcast URL provided.',
      };
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return {
        success: false,
        message: 'Invalid title provided.',
      };
    }

    // Validate URL format
    try {
      new URL(audioUrl);
    } catch {
      return {
        success: false,
        message: 'Invalid podcast URL format.',
      };
    }

    // Check if sharing is available on this platform
    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (!isSharingAvailable) {
      return {
        success: false,
        message: 'Sharing is not available on this device.',
      };
    }

    // Sanitize filename and add extension
    const sanitizedTitle = sanitizeFilename(title);
    const extension = extractFileExtension(storagePath);
    const filename = `${sanitizedTitle}${extension}`;

    // Download directly to cache directory using FileSystem.downloadAsync
    const fileUri = `${FileSystem.cacheDirectory}${filename}`;

    // Use createDownloadResumable for progress tracking
    const downloadResumable = FileSystem.createDownloadResumable(
      audioUrl,
      fileUri,
      {},
      (downloadProgress) => {
        if (onProgress && downloadProgress.totalBytesExpectedToWrite > 0) {
          const percentage = Math.round(
            (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100
          );
          onProgress({
            loaded: downloadProgress.totalBytesWritten,
            total: downloadProgress.totalBytesExpectedToWrite,
            percentage,
          });
        }
      }
    );

    // Start the download
    const result = await downloadResumable.downloadAsync();

    if (!result || !result.uri) {
      return {
        success: false,
        message: 'Download failed to initialize.',
      };
    }

    const uri = result.uri;

    // Verify file was downloaded successfully
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      return {
        success: false,
        message: 'Downloaded file not found.',
      };
    }

    // Present native share sheet using the downloaded file URI
    try {
      await Sharing.shareAsync(uri, {
        mimeType: extension === '.wav' ? 'audio/wav' : 'audio/mpeg',
        dialogTitle: 'Save Podcast',
        UTI: extension === '.wav' ? 'public.wav-audio' : 'public.mp3',
      });
    } catch (shareError: any) {
      // If sharing fails but file was downloaded, check if it's a cancellation
      const errorMsg = shareError?.message?.toLowerCase() || '';
      const errorCode = shareError?.code?.toLowerCase() || '';

      // Common cancellation indicators across platforms
      if (
        errorMsg.includes('cancel') ||
        errorMsg.includes('dismiss') ||
        errorMsg.includes('user cancelled') ||
        errorCode === 'user_cancelled' ||
        errorCode === 'cancelled'
      ) {
        // User cancelled share, but download was successful
        return {
          success: true,
          message: 'Podcast downloaded. You can share it later.',
        };
      }
      // Re-throw if it's a real error (not cancellation)
      throw shareError;
    }

    return {
      success: true,
      message: 'Podcast downloaded successfully!',
    };
  } catch (error: any) {
    // Handle specific error types
    let errorMessage = 'Download failed. Please try again.';

    if (error.message) {
      const msg = error.message.toLowerCase();

      if (msg.includes('network') || msg.includes('connection') || msg.includes('fetch')) {
        errorMessage = 'Failed to download. Please check your connection.';
      } else if (msg.includes('storage') || msg.includes('space') || msg.includes('disk')) {
        errorMessage = 'Not enough storage space.';
      } else if (msg.includes('permission') || msg.includes('denied')) {
        errorMessage = 'Permission denied. Please enable storage access.';
      }
    }

    // Log error for debugging
    await handleError(error, {
      operation: 'download_podcast_file',
      component: 'podcast-download-service',
      metadata: { title, storagePath },
    });

    return {
      success: false,
      message: errorMessage,
    };
  }
}

export const podcastDownloadService = {
  downloadPodcastFile,
};
