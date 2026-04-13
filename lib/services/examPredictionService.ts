/**
 * Exam Prediction Service
 * Handles exam predictions database operations
 */

import { supabase } from '@/lib/supabase';
import { handleError } from '@/lib/errors';
import type { ExamPrediction } from '@/lib/store/types';

export const examPredictionService = {
    /**
     * Fetch all exam predictions for a notebook
     */
    fetchByNotebook: async (notebookId: string): Promise<ExamPrediction[]> => {
        try {
            const { data, error } = await supabase
                .from('studio_exam_predictions')
                .select('*')
                .eq('notebook_id', notebookId)
                .in('status', ['completed', 'failed'])
                .order('created_at', { ascending: false });

            if (error) {
                await handleError(error, {
                    operation: 'fetch_exam_predictions',
                    component: 'exam-prediction-service',
                    metadata: { notebookId },
                });
                return [];
            }

            return data || [];
        } catch (error) {
            await handleError(error, {
                operation: 'fetch_exam_predictions',
                component: 'exam-prediction-service',
                metadata: { notebookId },
            });
            return [];
        }
    },

    /**
     * Fetch a single exam prediction by ID
     */
    fetchById: async (predictionId: string): Promise<ExamPrediction | null> => {
        try {
            const { data, error } = await supabase
                .from('studio_exam_predictions')
                .select('*')
                .eq('id', predictionId)
                .single();

            if (error) {
                await handleError(error, {
                    operation: 'fetch_exam_prediction_by_id',
                    component: 'exam-prediction-service',
                    metadata: { predictionId },
                });
                return null;
            }

            return data;
        } catch (error) {
            await handleError(error, {
                operation: 'fetch_exam_prediction_by_id',
                component: 'exam-prediction-service',
                metadata: { predictionId },
            });
            return null;
        }
    },

    /**
     * Delete an exam prediction
     */
    delete: async (predictionId: string): Promise<boolean> => {
        try {
            const { error } = await supabase
                .from('studio_exam_predictions')
                .delete()
                .eq('id', predictionId);

            if (error) {
                await handleError(error, {
                    operation: 'delete_exam_prediction',
                    component: 'exam-prediction-service',
                    metadata: { predictionId },
                });
                return false;
            }

            return true;
        } catch (error) {
            await handleError(error, {
                operation: 'delete_exam_prediction',
                component: 'exam-prediction-service',
                metadata: { predictionId },
            });
            return false;
        }
    },

    /**
     * Get prediction status for polling
     */
    getStatus: async (predictionId: string): Promise<{ status: 'pending' | 'processing' | 'completed' | 'failed'; error_message?: string; title?: string }> => {
        try {
            const { data, error } = await supabase
                .from('studio_exam_predictions')
                .select('status, error_message, title')
                .eq('id', predictionId)
                .single();

            if (error) throw error;
            return data as any;
        } catch (error) {
            console.error('Error getting prediction status:', error);
            return { status: 'failed', error_message: 'Failed to check status' };
        }
    },

    /**
     * Find all pending predictions for a user across all their notebooks.
     * Filters out stuck rows (updated_at older than 1 hour) to avoid phantom
     * indicators from crashed edge-function jobs.
     */
    findAllPending: async (
        userId: string,
    ): Promise<Array<{ id: string; notebook_id: string; created_at: string | null }>> => {
        try {
            const freshSince = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            const { data, error } = await supabase
                .from('studio_exam_predictions')
                .select('id, notebook_id, created_at')
                .eq('user_id', userId)
                .eq('status', 'processing')
                .gt('updated_at', freshSince);

            if (error) return [];
            return data || [];
        } catch (error) {
            return [];
        }
    },

    /**
     * Find any pending prediction for a notebook
     */
    findPending: async (notebookId: string): Promise<{ id: string } | null> => {
        try {
            const { data, error } = await supabase
                .from('studio_exam_predictions')
                .select('id')
                .eq('notebook_id', notebookId)
                .eq('status', 'processing')
                .maybeSingle();

            if (error) return null;
            return data;
        } catch (error) {
            return null;
        }
    },

    /**
     * Check if user has any completed predictions
     */
    hasCompleted: async (userId: string): Promise<boolean> => {
        try {
            const { count, error } = await supabase
                .from('studio_exam_predictions')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('status', 'completed');

            if (error) return false;
            return (count || 0) > 0;
        } catch (error) {
            return false;
        }
    },
};
