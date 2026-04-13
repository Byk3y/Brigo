/**
 * Studio Service
 * Handles studio content (flashcards, quizzes) database operations
 */

import { supabase } from '@/lib/supabase';
import { handleError } from '@/lib/errors';
import type { StudioFlashcard, Quiz, FlashcardSet, StudioJobStatus } from '@/lib/store/types';

export const studioService = {
  /**
   * Fetch all flashcard sets for a notebook
   */
  fetchFlashcardSets: async (notebookId: string): Promise<FlashcardSet[]> => {
    try {
      // Includes pending/processing/failed rows so the UI can show
      // "Analyzing..." and "Tap to retry" driven by row.status.
      const { data, error } = await supabase
        .from('studio_flashcard_sets')
        .select('*, cards:studio_flashcards(count)')
        .eq('notebook_id', notebookId)
        .order('created_at', { ascending: false });

      if (error) {
        const appError = await handleError(error, {
          operation: 'fetch_flashcard_sets',
          component: 'studio-service',
          metadata: { notebookId },
        });
        throw appError;
      }

      return (data || []).map(set => ({
        ...set,
        total_cards: (set.cards?.[0] as any)?.count || 0,
      }));
    } catch (error) {
      const appError = await handleError(error, {
        operation: 'fetch_flashcard_sets',
        component: 'studio-service',
        metadata: { notebookId },
      });
      throw appError;
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
        const appError = await handleError(error, {
          operation: 'fetch_quizzes',
          component: 'studio-service',
          metadata: { notebookId },
        });
        throw appError;
      }

      return data || [];
    } catch (error) {
      const appError = await handleError(error, {
        operation: 'fetch_quizzes',
        component: 'studio-service',
        metadata: { notebookId },
      });
      throw appError;
    }
  },

  /**
   * Fetch flashcards and quizzes in parallel
   */
  fetchAll: async (notebookId: string): Promise<{
    flashcard_sets: FlashcardSet[];
    quizzes: Quiz[];
  }> => {
    // Let errors propagate so callers can decide whether to wipe state
    // (they usually shouldn't — a transient network failure should leave
    // the existing list on screen).
    const [flashcard_sets, quizzes] = await Promise.all([
      studioService.fetchFlashcardSets(notebookId),
      studioService.fetchQuizzes(notebookId),
    ]);

    return { flashcard_sets, quizzes };
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
   * Delete a flashcard set (used for retry cleanup).
   * Children in studio_flashcards cascade via FK.
   */
  deleteFlashcardSet: async (setId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('studio_flashcard_sets')
        .delete()
        .eq('id', setId);
      if (error) {
        await handleError(error, {
          operation: 'delete_flashcard_set',
          component: 'studio-service',
          metadata: { setId },
        });
        return false;
      }
      return true;
    } catch (error) {
      await handleError(error, {
        operation: 'delete_flashcard_set',
        component: 'studio-service',
        metadata: { setId },
      });
      return false;
    }
  },

  /**
   * Delete a quiz (used for retry cleanup).
   * Children in studio_quiz_questions cascade via FK.
   */
  deleteQuiz: async (quizId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('studio_quizzes')
        .delete()
        .eq('id', quizId);
      if (error) {
        await handleError(error, {
          operation: 'delete_quiz',
          component: 'studio-service',
          metadata: { quizId },
        });
        return false;
      }
      return true;
    } catch (error) {
      await handleError(error, {
        operation: 'delete_quiz',
        component: 'studio-service',
        metadata: { quizId },
      });
      return false;
    }
  },

  /**
   * Get status for a flashcard set (polling target).
   */
  getFlashcardSetStatus: async (setId: string): Promise<{ status: StudioJobStatus; error_message?: string | null; title?: string | null }> => {
    try {
      const { data, error } = await supabase
        .from('studio_flashcard_sets')
        .select('status, error_message, title')
        .eq('id', setId)
        .single();
      if (error) throw error;
      return data as any;
    } catch (error) {
      console.error('Error getting flashcard set status:', error);
      return { status: 'failed', error_message: 'Failed to check status' };
    }
  },

  /**
   * Get status for a quiz (polling target).
   */
  getQuizStatus: async (quizId: string): Promise<{ status: StudioJobStatus; error_message?: string | null; title?: string | null }> => {
    try {
      const { data, error } = await supabase
        .from('studio_quizzes')
        .select('status, error_message, title')
        .eq('id', quizId)
        .single();
      if (error) throw error;
      return data as any;
    } catch (error) {
      console.error('Error getting quiz status:', error);
      return { status: 'failed', error_message: 'Failed to check status' };
    }
  },

  /**
   * Find a pending flashcard set for this notebook (resume on remount).
   */
  findPendingFlashcardSet: async (notebookId: string): Promise<{ id: string } | null> => {
    try {
      const { data, error } = await supabase
        .from('studio_flashcard_sets')
        .select('id')
        .eq('notebook_id', notebookId)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data;
    } catch {
      return null;
    }
  },

  /**
   * Find a pending quiz for this notebook (resume on remount).
   */
  findPendingQuiz: async (notebookId: string): Promise<{ id: string } | null> => {
    try {
      const { data, error } = await supabase
        .from('studio_quizzes')
        .select('id')
        .eq('notebook_id', notebookId)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data;
    } catch {
      return null;
    }
  },

  /**
   * Find all pending flashcard sets for a user (hydration on app open).
   * Filters out stuck rows (created_at > 1 hour ago) to avoid phantom
   * indicators from crashed edge-function jobs.
   */
  findAllPendingFlashcardSets: async (
    userId: string,
  ): Promise<Array<{ id: string; notebook_id: string; created_at: string | null }>> => {
    try {
      const freshSince = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('studio_flashcard_sets')
        .select('id, notebook_id, created_at')
        .eq('user_id', userId)
        .in('status', ['pending', 'processing'])
        .gt('created_at', freshSince);
      if (error) return [];
      return data || [];
    } catch {
      return [];
    }
  },

  /**
   * Find all pending quizzes for a user (hydration on app open).
   */
  findAllPendingQuizzes: async (
    userId: string,
  ): Promise<Array<{ id: string; notebook_id: string; created_at: string | null }>> => {
    try {
      const freshSince = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('studio_quizzes')
        .select('id, notebook_id, created_at')
        .eq('user_id', userId)
        .in('status', ['pending', 'processing'])
        .gt('created_at', freshSince);
      if (error) return [];
      return data || [];
    } catch {
      return [];
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










