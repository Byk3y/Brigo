/**
 * Studio API Client
 * Handles communication with the generate-studio-content Edge Function
 */

import { supabase } from '@/lib/supabase';
import { handleError } from '@/lib/errors';

export interface GenerateStudioContentRequest {
  notebook_id: string;
  content_type: 'flashcards' | 'quiz';
}

export interface GenerateStudioContentResponse {
  success: boolean;
  notebook_id: string;
  content_type: string;
  content_id: string;
  status: 'processing';
  message: string;
}

export interface StudioError {
  error: string;
  remaining?: number;
  limit?: number;
}

/**
 * Generate studio content (flashcards or quiz) for a notebook
 *
 * @param request - Generation request parameters
 * @returns Response with generated count and IDs
 * @throws Error if generation fails
 */
export async function generateStudioContent(
  request: GenerateStudioContentRequest
): Promise<GenerateStudioContentResponse> {
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error('Not authenticated. Please sign in to generate content.');
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured');
    }

    // Call Edge Function
    const response = await fetch(
      `${supabaseUrl}/functions/v1/generate-studio-content`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const errorData: StudioError = await response.json();

      // Create error with quota details preserved
      const error: any = new Error(errorData.error || `Failed to generate ${request.content_type}`);

      // Preserve quota information for better error handling
      if (errorData.remaining !== undefined) {
        error.remaining = errorData.remaining;
      }
      if (errorData.limit !== undefined) {
        error.limit = errorData.limit;
      }

      throw error;
    }

    const data: GenerateStudioContentResponse = await response.json();
    return data;
  } catch (error) {
    // Use centralized error handling
    const appError = await handleError(error, {
      operation: 'generate_studio_content',
      component: 'studio-api',
      metadata: { contentType: request.content_type, notebookId: request.notebook_id },
    });

    // Re-throw the classified error
    throw appError;
  }
}










