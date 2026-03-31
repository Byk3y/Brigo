/**
 * Studio Service
 * Handles studio content (flashcards, quizzes) database operations
 */

import { supabase } from '@/lib/supabase';
import { handleError } from '@/lib/errors';
import type { StudioFlashcard, Quiz, FlashcardSet } from '@/lib/store/types';

export const studioService = {
  /**
   * Fetch all flashcard sets for a notebook
   */
  fetchFlashcardSets: async (notebookId: string): Promise<FlashcardSet[]> => {
    try {
      // Get sets and card counts
      const { data, error } = await supabase
        .from('studio_flashcard_sets')
        .select('*, cards:studio_flashcards(count)')
        .eq('notebook_id', notebookId)
        .order('created_at', { ascending: false });

      if (error) {
        await handleError(error, {
          operation: 'fetch_flashcard_sets',
          component: 'studio-service',
          metadata: { notebookId },
        });
        return [];
      }

      return (data || []).map(set => ({
        ...set,
        total_cards: (set.cards?.[0] as any)?.count || 0,
      }));
    } catch (error) {
      await handleError(error, {
        operation: 'fetch_flashcard_sets',
        component: 'studio-service',
        metadata: { notebookId },
      });
      return [];
    }
  },

  /**
   * Fetch individual flashcards by set_id
   */
  fetchFlashcardsBySet: async (setId: string): Promise<StudioFlashcard[]> => {
    try {
      const { data, error } = await supabase
        .from('studio_flashcards')
        .select('*')
        .eq('set_id', setId)
        .order('created_at', { ascending: true });

      if (error) {
        await handleError(error, {
          operation: 'fetch_flashcards_by_set',
          component: 'studio-service',
          metadata: { setId },
        });
        return [];
      }

      return data || [];
    } catch (error) {
      await handleError(error, {
        operation: 'fetch_flashcards_by_set',
        component: 'studio-service',
        metadata: { setId },
      });
      return [];
    }
  },

  /**
   * Fetch all quizzes for a notebook
   */
  fetchQuizzes: async (notebookId: string): Promise<Quiz[]> => {
    try {
      const { data, error } = await supabase
        .from('studio_quizzes')
        .select('*')
        .eq('notebook_id', notebookId)
        .order('created_at', { ascending: false });

      if (error) {
        await handleError(error, {
          operation: 'fetch_quizzes',
          component: 'studio-service',
          metadata: { notebookId },
        });
        return [];
      }

      return data || [];
    } catch (error) {
      await handleError(error, {
        operation: 'fetch_quizzes',
        component: 'studio-service',
        metadata: { notebookId },
      });
      return [];
    }
  },

  /**
   * Fetch flashcards and quizzes in parallel
   */
  fetchAll: async (notebookId: string): Promise<{
    flashcard_sets: FlashcardSet[];
    quizzes: Quiz[];
  }> => {
    try {
      const [flashcard_sets, quizzes] = await Promise.all([
        studioService.fetchFlashcardSets(notebookId),
        studioService.fetchQuizzes(notebookId),
      ]);

      return { flashcard_sets, quizzes };
    } catch (error) {
      await handleError(error, {
        operation: 'fetch_studio_content',
        component: 'studio-service',
        metadata: { notebookId },
      });
      return { flashcard_sets: [], quizzes: [] };
    }
  },

  /**
   * Fetch flashcard progress for a notebook
   */
  fetchFlashcardProgress: async (notebookId: string, userId: string, setId?: string): Promise<{
    last_flashcard_id: string | null;
    last_index: number;
  } | null> => {
    try {
      let query = supabase
        .from('user_flashcard_progress')
        .select('last_flashcard_id, last_index')
        .eq('notebook_id', notebookId)
        .eq('user_id', userId);

      if (setId) {
        query = query.eq('set_id', setId);
      } else {
        query = query.is('set_id', null);
      }

      const { data, error } = await query.maybeSingle();

      if (error && error.code !== 'PGRST116') {
        await handleError(error, {
          operation: 'fetch_flashcard_progress',
          component: 'studio-service',
          metadata: { notebookId, userId, setId },
        });
        return null;
      }

      return data || null;
    } catch (error) {
      await handleError(error, {
        operation: 'fetch_flashcard_progress',
        component: 'studio-service',
        metadata: { notebookId, userId, setId },
      });
      return null;
    }
  },

  /**
   * Upsert flashcard progress for a notebook
   */
  upsertFlashcardProgress: async (
    notebookId: string,
    userId: string,
    lastFlashcardId: string | null,
    lastIndex: number,
    setId?: string
  ): Promise<void> => {
    try {
      const match: any = { notebook_id: notebookId, user_id: userId };
      if (setId) match.set_id = setId;
      else match.set_id = null;

      const { error } = await supabase
        .from('user_flashcard_progress')
        .upsert(
          {
            ...match,
            last_flashcard_id: lastFlashcardId,
            last_index: lastIndex,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,notebook_id,set_id',
          }
        );

      if (error) {
        await handleError(error, {
          operation: 'upsert_flashcard_progress',
          component: 'studio-service',
          metadata: { notebookId, userId, lastFlashcardId, lastIndex },
        });
        throw error;
      }
    } catch (error) {
      const appError = await handleError(error, {
        operation: 'upsert_flashcard_progress',
        component: 'studio-service',
        metadata: { notebookId, userId, lastFlashcardId, lastIndex },
      });
      throw appError;
    }
  },

  /**
   * Check if a user has any flashcard sets across all notebooks
   */
  hasUserFlashcards: async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('studio_flashcard_sets')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (error) {
        await handleError(error, {
          operation: 'check_user_flashcards',
          component: 'studio-service',
          metadata: { userId },
        });
        return false;
      }

      return !!data;
    } catch (error) {
      await handleError(error, {
        operation: 'check_user_flashcards',
        component: 'studio-service',
        metadata: { userId },
      });
      return false;
    }
  },

  /**
   * Check if a user has any quizzes across all notebooks
   */
  hasUserQuizzes: async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('studio_quizzes')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (error) {
        await handleError(error, {
          operation: 'check_user_quizzes',
          component: 'studio-service',
          metadata: { userId },
        });
        return false;
      }

      return !!data;
    } catch (error) {
      await handleError(error, {
        operation: 'check_user_quizzes',
        component: 'studio-service',
        metadata: { userId },
      });
      return false;
    }
  },
};










