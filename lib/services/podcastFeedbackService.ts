/**
 * Podcast Feedback Service
 * Handles like/dislike operations for podcasts
 */

import { supabase } from '@/lib/supabase';
import { handleError } from '@/lib/errors';

export type PodcastFeedback = {
  id: string;
  user_id: string;
  audio_overview_id: string; // Keep DB column name
  is_liked: boolean;
  created_at: string;
  updated_at: string;
};

export const podcastFeedbackService = {
  /**
   * Get user's feedback for a specific podcast
   * @param userId - The user's ID
   * @param audioOverviewId - The podcast's ID
   * @returns The feedback record or null if none exists
   */
  getFeedback: async (
    userId: string,
    audioOverviewId: string
  ): Promise<PodcastFeedback | null> => {
    try {
      const { data, error } = await supabase
        .from('audio_feedback')
        .select('*')
        .eq('user_id', userId)
        .eq('audio_overview_id', audioOverviewId)
        .single();

      if (error) {
        // 406 = no rows returned (PGRST error code for .single() when no rows)
        if (error.code === 'PGRST116' || error.code === '406') {
          return null; // No feedback exists yet
        }

        await handleError(error, {
          operation: 'get_podcast_feedback',
          component: 'podcast-feedback-service',
          userId,
          metadata: { audioOverviewId },
        });
        throw error;
      }

      return {
        ...data,
        created_at: data.created_at || '',
        updated_at: data.updated_at || '',
      };
    } catch (error) {
      const appError = await handleError(error, {
        operation: 'get_podcast_feedback',
        component: 'podcast-feedback-service',
        userId,
        metadata: { audioOverviewId },
      });
      throw appError;
    }
  },

  /**
   * Save or update user's feedback for a podcast
   * Uses upsert pattern: inserts if new, updates if exists
   * @param userId - The user's ID
   * @param audioOverviewId - The podcast's ID
   * @param isLiked - true for like, false for dislike
   */
  saveFeedback: async (
    userId: string,
    audioOverviewId: string,
    isLiked: boolean
  ): Promise<void> => {
    try {
      const { error } = await supabase
        .from('audio_feedback')
        .upsert(
          {
            user_id: userId,
            audio_overview_id: audioOverviewId,
            is_liked: isLiked,
          },
          {
            onConflict: 'user_id,audio_overview_id',
          }
        );

      if (error) {
        await handleError(error, {
          operation: 'save_podcast_feedback',
          component: 'podcast-feedback-service',
          userId,
          metadata: { audioOverviewId, isLiked },
        });
        throw error;
      }
    } catch (error) {
      const appError = await handleError(error, {
        operation: 'save_podcast_feedback',
        component: 'podcast-feedback-service',
        userId,
        metadata: { audioOverviewId, isLiked },
      });
      throw appError;
    }
  },

  /**
   * Remove user's feedback for a podcast
   * @param userId - The user's ID
   * @param audioOverviewId - The podcast's ID
   */
  removeFeedback: async (
    userId: string,
    audioOverviewId: string
  ): Promise<void> => {
    try {
      const { error } = await supabase
        .from('audio_feedback')
        .delete()
        .eq('user_id', userId)
        .eq('audio_overview_id', audioOverviewId);

      if (error) {
        await handleError(error, {
          operation: 'remove_podcast_feedback',
          component: 'podcast-feedback-service',
          userId,
          metadata: { audioOverviewId },
        });
        throw error;
      }
    } catch (error) {
      const appError = await handleError(error, {
        operation: 'remove_podcast_feedback',
        component: 'podcast-feedback-service',
        userId,
        metadata: { audioOverviewId },
      });
      throw appError;
    }
  },
};







