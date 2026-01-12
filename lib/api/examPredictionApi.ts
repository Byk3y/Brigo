/**
 * Exam Prediction API Client
 * Handles communication with the generate-exam-prediction Edge Function
 */

import { supabase } from '@/lib/supabase';
import { handleError } from '@/lib/errors';

export interface GenerateExamPredictionRequest {
    notebook_id: string;
}

export interface GenerateExamPredictionResponse {
    success: boolean;
    notebook_id: string;
    prediction_id: string;
    title: string;
    message: string;
}

export interface PredictionError {
    error: string;
    remaining?: number;
    limit?: number;
}

/**
 * Generate exam predictions for a notebook
 *
 * @param request - Generation request parameters
 * @returns Response with prediction ID and details
 * @throws Error if generation fails
 */
export async function generateExamPrediction(
    request: GenerateExamPredictionRequest
): Promise<GenerateExamPredictionResponse> {
    try {
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token) {
            throw new Error('Not authenticated. Please sign in to generate predictions.');
        }

        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        if (!supabaseUrl) {
            throw new Error('Supabase URL not configured');
        }

        // Call Edge Function
        const response = await fetch(
            `${supabaseUrl}/functions/v1/generate-exam-prediction`,
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
            const errorData: PredictionError = await response.json();

            // Create error with quota details preserved
            const error: any = new Error(errorData.error || 'Failed to generate exam predictions');

            // Preserve quota information for better error handling
            if (errorData.remaining !== undefined) {
                error.remaining = errorData.remaining;
            }
            if (errorData.limit !== undefined) {
                error.limit = errorData.limit;
            }

            throw error;
        }

        const data: GenerateExamPredictionResponse = await response.json();
        return data;
    } catch (error) {
        // Use centralized error handling
        const appError = await handleError(error, {
            operation: 'generate_exam_prediction',
            component: 'exam-prediction-api',
            metadata: { notebookId: request.notebook_id },
        });

        // Re-throw the classified error
        throw appError;
    }
}
