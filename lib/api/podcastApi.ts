/**
 * Podcast API Client
 * Handles communication with the generate-audio-overview Edge Function
 * 
 * Note: Database operations are handled by podcastService
 */

import { supabase } from '@/lib/supabase';
import { handleError } from '@/lib/errors';
import { podcastService } from '@/lib/services/podcastService';

const EDGE_FUNCTION_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate-audio-overview`;

export interface GeneratePodcastRequest {
  notebook_id: string;
}

export interface GeneratePodcastResponse {
  success: boolean;
  overview_id: string;
  status: string;
  estimated_completion_seconds?: number;
  message: string;
}

/**
 * Trigger podcast generation for a notebook
 * Returns immediately with overview_id for status polling
 */
export async function generatePodcast(
  notebookId: string
): Promise<GeneratePodcastResponse> {
  try {
    // Get current session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notebook_id: notebookId,
      } as GeneratePodcastRequest),
    });

    if (!response.ok) {
      // Safely parse error body (may be truncated)
      let errorData: any = {};
      const raw = await response.text();
      try {
        errorData = raw ? JSON.parse(raw) : {};
      } catch {
        // ignore parse error, use raw as fallback
        errorData = { error: raw };
      }

      // Create error with quota details preserved
      const error: any = new Error(errorData.error || 'Failed to generate podcast');

      // Preserve quota information for better error handling
      if (errorData.remaining !== undefined) {
        error.remaining = errorData.remaining;
      }
      if (errorData.limit !== undefined) {
        error.limit = errorData.limit;
      }

      throw error;
    }

    // Parse success body defensively to handle truncated responses
    const raw = await response.text();
    let data: GeneratePodcastResponse;
    try {
      data = JSON.parse(raw);
    } catch (parseError) {
      const enhancedError: any = new Error('Malformed response from podcast generator');
      enhancedError.isNetworkError = true; // trigger recovery flow to re-check pending jobs
      enhancedError.raw = raw;
      throw enhancedError;
    }

    return data;
  } catch (error) {
    // For network/parsing errors, check if generation actually started on the server
    // This prevents false positive error logs when the server successfully started
    // generation but the client couldn't read the response
    const isNetworkOrParseError =
      (error as any)?.isNetworkError ||
      error instanceof TypeError ||
      (error as Error)?.message?.includes('Malformed response') ||
      (error as Error)?.message?.includes('Failed to fetch') ||
      (error as Error)?.message?.includes('network');

    if (isNetworkOrParseError) {
      try {
        // Check for pending podcast generation - if found, generation started successfully
        const pendingAudio = await podcastService.findPending(notebookId);

        if (pendingAudio) {
          // Generation actually started! Don't log as error, just log info
          if (__DEV__) {
            console.info(
              '[Podcast API] Network/parsing error but generation started successfully',
              { overviewId: pendingAudio.id, status: pendingAudio.status }
            );
          }

          // Mark error as recovered so it doesn't show in UI
          const enhancedError: any = error;
          enhancedError.isNetworkError = true;
          enhancedError.generationStarted = true;
          enhancedError.overviewId = pendingAudio.id;

          // Re-throw without logging as error (recovery flow will handle it)
          throw enhancedError;
        }
      } catch (checkError) {
        // If checking for pending podcast fails, fall through to normal error handling
        // This ensures we don't lose error information if the check itself fails
        if (__DEV__) {
          console.warn('[Podcast API] Failed to check for pending podcast:', checkError);
        }
      }
    }

    // Use centralized error handling (only if generation didn't start or check failed)
    const appError = await handleError(error, {
      operation: 'generate_podcast',
      component: 'podcast-api',
      metadata: { notebookId },
    });

    // Re-throw the classified error
    throw appError;
  }
}





