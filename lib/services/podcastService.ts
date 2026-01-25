/**
 * Podcast Service
 * Handles podcast database operations
 */

import { supabase } from '@/lib/supabase';
import { handleError } from '@/lib/errors';
import { storageService } from '@/lib/storage/storageService';
import type { Podcast } from '@/lib/store/types';

export interface PodcastStatus {
  status: 'pending' | 'generating_script' | 'generating_audio' | 'completed' | 'failed';
  progress?: number; // 0-100
  error_message?: string;
}

export const podcastService = {
  /**
   * Get status of a podcast (for polling during generation)
   */
  getStatus: async (overviewId: string): Promise<PodcastStatus> => {
    try {
      const { data, error } = await supabase
        .from('audio_overviews')
        .select('status, error_message')
        .eq('id', overviewId)
        .single();

      if (error) {
        await handleError(error, {
          operation: 'get_podcast_status',
          component: 'podcast-service',
          metadata: { overviewId },
        });
        throw new Error(`Failed to get status: ${error.message}`);
      }

      // Calculate progress based on status
      const progressMap: Record<string, number> = {
        'pending': 10,
        'generating_script': 40,
        'generating_audio': 70,
        'completed': 100,
        'failed': 0,
      };

      return {
        status: data.status as any,
        progress: progressMap[data.status || 'pending'] || 0,
        error_message: data.error_message || undefined,
      };
    } catch (error) {
      const appError = await handleError(error, {
        operation: 'get_podcast_status',
        component: 'podcast-service',
        metadata: { overviewId },
      });
      throw appError;
    }
  },

  /**
   * Fetch all podcasts for a notebook
   */
  fetchByNotebook: async (notebookId: string): Promise<Podcast[]> => {
    try {
      const { data, error } = await supabase
        .from('audio_overviews')
        .select('*')
        .eq('notebook_id', notebookId)
        .eq('status', 'completed') // Only show completed overviews
        .order('created_at', { ascending: false });

      if (error) {
        await handleError(error, {
          operation: 'fetch_podcasts',
          component: 'podcast-service',
          metadata: { notebookId },
        });
        return [];
      }

      // Transform to Podcast type
      return (data || []).map(overview => ({
        id: overview.id,
        notebook_id: overview.notebook_id,
        title: overview.title,
        duration: overview.duration,
        audio_url: overview.audio_url || '',
        script: overview.script || '',
        generated_at: overview.created_at || '',
      }));
    } catch (error) {
      // Use centralized error handling - return empty array on error for graceful degradation
      await handleError(error, {
        operation: 'fetch_podcasts',
        component: 'podcast-service',
        metadata: { notebookId },
      });
      return [];
    }
  },

  /**
   * Get a single podcast by ID
   * Refreshes signed URL if needed
   */
  getById: async (overviewId: string): Promise<Podcast | null> => {
    try {
      const { data, error } = await supabase
        .from('audio_overviews')
        .select('*')
        .eq('id', overviewId)
        .single();

      if (error || !data) {
        handleError(error || new Error('Podcast not found'), {
          operation: 'get_podcast_by_id',
          component: 'podcast-service',
          metadata: { overviewId }
        });
        return null;
      }

      // Check if signed URL needs refresh (7-day expiration)
      const needsRefresh = !data.audio_url || isUrlExpired(data.audio_url);

      let audioUrl = data.audio_url;

      if (needsRefresh && data.storage_path) {
        const { url, error: urlError } = await storageService.getSignedUrl(
          data.storage_path,
          7 * 24 * 3600 // 7 days
        );

        if (url && !urlError) {
          audioUrl = url;

          // Update database with new signed URL
          const { error: updateError } = await supabase
            .from('audio_overviews')
            .update({ audio_url: audioUrl })
            .eq('id', overviewId);

          if (updateError) {
            await handleError(updateError, {
              operation: 'update_podcast_url',
              component: 'podcast-service',
              metadata: { overviewId },
            });
            // Continue with new URL even if update fails
          }
        } else {
          // URL refresh failed - log error but continue with old URL
          // The old URL might be expired, but we'll let the audio player handle the error
          if (__DEV__) {
            console.warn('[Podcast Service] Failed to refresh signed URL:', urlError || 'No URL returned');
          }
          await handleError(
            urlError || new Error('Failed to get signed URL'),
            {
              operation: 'refresh_podcast_url',
              component: 'podcast-service',
              metadata: { overviewId, storagePath: data.storage_path },
            }
          );
        }
      }

      return {
        id: data.id,
        notebook_id: data.notebook_id,
        title: data.title,
        duration: data.duration,
        audio_url: audioUrl || '',
        storage_path: data.storage_path,
        script: data.script || '',
        generated_at: data.created_at || '',
      };
    } catch (error) {
      await handleError(error, {
        operation: 'get_podcast',
        component: 'podcast-service',
        metadata: { overviewId },
      });
      return null;
    }
  },

  /**
   * Delete a podcast
   */
  delete: async (overviewId: string): Promise<void> => {
    try {
      // Get storage path before deleting
      const { data } = await supabase
        .from('audio_overviews')
        .select('storage_path')
        .eq('id', overviewId)
        .single();

      // Delete from database (CASCADE will handle related records)
      const { error: deleteError } = await supabase
        .from('audio_overviews')
        .delete()
        .eq('id', overviewId);

      if (deleteError) {
        await handleError(deleteError, {
          operation: 'delete_podcast',
          component: 'podcast-service',
          metadata: { overviewId },
        });
        throw new Error(`Failed to delete podcast: ${deleteError.message}`);
      }

      // Delete from storage
      if (data?.storage_path) {
        await storageService.deleteFile(data.storage_path);
        // Error handling is done in storageService
      }
    } catch (error) {
      const appError = await handleError(error, {
        operation: 'delete_podcast',
        component: 'podcast-service',
        metadata: { overviewId },
      });
      throw appError;
    }
  },

  /**
   * Find pending/generating podcasts for a notebook
   */
  findPending: async (notebookId: string): Promise<{ id: string; status: string } | null> => {
    try {
      const { data, error } = await supabase
        .from('audio_overviews')
        .select('id, status')
        .eq('notebook_id', notebookId)
        .in('status', ['pending', 'generating_script', 'generating_audio'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        await handleError(error, {
          operation: 'find_pending_podcast',
          component: 'podcast-service',
          metadata: { notebookId },
        });
        return null;
      }

      return data ? { id: data.id, status: data.status || 'pending' } : null;
    } catch (error) {
      await handleError(error, {
        operation: 'find_pending_podcast',
        component: 'podcast-service',
        metadata: { notebookId },
      });
      return null;
    }
  },

  /**
   * Check if user has any completed podcasts
   */
  hasCompleted: async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('audio_overviews')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .limit(1)
        .maybeSingle();

      if (error) {
        await handleError(error, {
          operation: 'check_completed_podcasts',
          component: 'podcast-service',
          metadata: { userId },
        });
        return false;
      }

      return !!data;
    } catch (error) {
      await handleError(error, {
        operation: 'check_completed_podcasts',
        component: 'podcast-service',
        metadata: { userId },
      });
      return false;
    }
  },
};

/**
 * Check if a signed URL has expired
 * Supabase signed URLs contain a JWT token with expiration (exp claim)
 * Returns true if URL is expired or if expiration cannot be determined (safe to refresh)
 */
function isUrlExpired(url: string): boolean {
  try {
    if (!url || !url.includes('token=')) {
      // No token in URL, assume expired
      return true;
    }

    // Extract token from URL query parameter
    const tokenMatch = url.match(/[?&]token=([^&]+)/);
    if (!tokenMatch || !tokenMatch[1]) {
      return true; // No token found, assume expired
    }

    const token = tokenMatch[1];

    try {
      // JWT format: header.payload.signature
      // We need to decode the payload (second part)
      const parts = token.split('.');
      if (parts.length !== 3) {
        return true; // Invalid JWT format, assume expired
      }

      // Decode base64url encoded payload
      // Base64url uses - and _ instead of + and /, and no padding
      const payload = parts[1];
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);

      // Decode base64 to string using atob (available in React Native/Expo)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - atob is available in React Native/Expo runtime
      const decodedString = atob(padded);

      // Parse JSON payload
      const decoded = JSON.parse(decodedString);

      // Check expiration (exp is in seconds since epoch)
      if (decoded.exp && typeof decoded.exp === 'number') {
        const expirationTime = decoded.exp * 1000; // Convert to milliseconds
        const now = Date.now();
        const bufferTime = 60 * 60 * 1000; // 1 hour buffer before expiration

        // Return true if expired or will expire within 1 hour
        return now >= (expirationTime - bufferTime);
      }

      // No exp claim, assume expired
      return true;
    } catch (decodeError) {
      // Failed to decode token, assume expired to be safe
      if (__DEV__) {
        console.warn('[Podcast Service] Failed to decode JWT token:', decodeError);
      }
      return true;
    }
  } catch (error) {
    // Any other error, assume expired to be safe
    if (__DEV__) {
      console.warn('[Podcast Service] Error checking URL expiration:', error);
    }
    return true;
  }
}







