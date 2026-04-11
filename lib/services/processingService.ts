/**
 * Processing Service
 * Handles background upload and Edge Function processing for materials.
 */

import { supabase } from '@/lib/supabase';
import { storageService } from '@/lib/storage/storageService';
import { handleError } from '@/lib/errors';

export const processingService = {
    /**
     * Trigger Edge Function processing for a material
     * @param notebookId - Notebook ID
     * @param materialId - Material ID
     * @param isFileUpload - Whether this is a file upload
     * @param storagePath - Optional storage path
     * @param userId - Optional user ID for error tracking
     */
    triggerProcessing: async (
        notebookId: string,
        materialId: string,
        isFileUpload: boolean,
        storagePath?: string,
        userId?: string
    ) => {
        // Check if file upload failed and fell back to local URI
        if (isFileUpload && storagePath && storagePath.startsWith('file://')) {
            console.warn(
                'File upload failed, using local URI. Edge Function cannot process local files. Marking as failed.'
            );
            await supabase
                .from('notebooks')
                .update({ status: 'ready_for_studio' })
                .eq('id', notebookId);
            return { status: 'failed' };
        }

        if (materialId) {
            // Create timeout promise (180 seconds)
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Edge Function request timed out after 180s')), 180000)
            );

            try {
                const result: any = await Promise.race([
                    supabase.functions.invoke('process-material', {
                        body: { material_id: materialId },
                    }),
                    timeoutPromise,
                ]);

                const { data, error } = result;
                if (error) {
                    // supabase-js wraps many conditions into a generic `FunctionsHttpError`
                    // with message "Edge Function returned a non-2xx status code". Before we
                    // fire scary logs / error toasts, re-read the material so we can tell
                    // what actually happened server-side:
                    //
                    //   (a) Server wrote a real user-facing failure (e.g. PDFTooLarge 400
                    //       rejection) — respect it quietly, don't fire the red error modal.
                    //   (b) Server actually succeeded and we're just seeing a dropped
                    //       connection on iOS/Expo — trust Realtime, return network_interrupted.
                    //   (c) Unknown real error — log loudly and let the global handler fire.
                    const { data: material } = await supabase
                        .from('materials')
                        .select('status, meta')
                        .eq('id', materialId)
                        .single();

                    // (a) Server wrote a user-facing failure
                    if (material?.status === 'failed' && (material as any)?.meta?.user_facing) {
                        console.warn(
                            '[ProcessingService] Processing rejected by server:',
                            (material as any).meta.error
                        );
                        return {
                            status: 'failed',
                            error: { message: (material as any).meta.error, userFacing: true }
                        };
                    }

                    // (b) Transient connection drop — let Realtime report the real status
                    const errMsg = String(error?.message || error || '');
                    const isLikelyTransientConnection =
                        errMsg.includes('non-2xx') ||
                        errMsg.includes('Failed to send a request');
                    if (isLikelyTransientConnection) {
                        console.warn(
                            '[ProcessingService] Transient invoke error, deferring to Realtime sync:',
                            errMsg
                        );
                        return { status: 'network_interrupted', error };
                    }

                    // (c) Unknown error — log loudly
                    await handleError(error, {
                        operation: 'trigger_processing',
                        component: 'processing-service',
                        userId,
                        metadata: { notebookId, materialId }
                    });
                    await supabase
                        .from('notebooks')
                        .update({ status: 'ready_for_studio' })
                        .eq('id', notebookId);
                    return { status: 'failed', error };
                } else {
                    console.log('Edge Function triggered successfully:', data);

                    // Check if this is a background processing response
                    if (data?.background_processing && data?.job_id) {
                        console.log('Large PDF queued for background processing:', data.job_id);
                        return {
                            status: 'background_processing',
                            data,
                            jobId: data.job_id,
                            estimatedPages: data.estimated_pages,
                        };
                    }

                    return { status: 'success', data };
                }

            } catch (err: any) {
                const isTimeout = err.message?.includes('timed out');
                const isNetworkError = err.message?.includes('fetch') || err.message?.includes('network');

                if (isTimeout) {
                    await handleError(err, {
                        operation: 'trigger_processing_timeout',
                        component: 'processing-service',
                        userId,
                        metadata: { notebookId, materialId, errorType: 'timeout', timeout: '180s' }
                    });
                    await supabase
                        .from('materials')
                        .update({
                            status: 'failed',
                            meta: { error: 'Request timed out after 180s. Please retry.' }
                        })
                        .eq('id', materialId);

                    await supabase
                        .from('notebooks')
                        .update({ status: 'ready_for_studio' })
                        .eq('id', notebookId);
                    return { status: 'failed', error: err };
                } else if (isNetworkError) {
                    console.warn('[ProcessingService] Network error during edge function trigger (likely app backgrounded):', err.message);
                    console.warn('[ProcessingService] Relying on Realtime sync to get actual processing status');
                    return { status: 'network_interrupted', error: err };
                } else {
                    await handleError(err, {
                        operation: 'trigger_processing_error',
                        component: 'processing-service',
                        userId,
                        metadata: { notebookId, materialId, errorType: 'permanent' }
                    });
                    await supabase
                        .from('notebooks')
                        .update({ status: 'ready_for_studio' })
                        .eq('id', notebookId);
                    return { status: 'failed', error: err };
                }
            }
        }
        return { status: 'pending' };
    },

    /**
     * Perform the heavy lifting (Upload + Processing) in the background.
     * This should NOT be awaited by the UI.
     * @param userId - User ID
     * @param notebookId - Notebook ID
     * @param materialId - Material ID
     * @param isFileUpload - Whether this requires file upload
     * @param fileUri - Local file URI
     * @param filename - Original filename
     * @param storagePath - Pre-calculated storage path
     */
    performBackgroundUploadAndProcessing: async (
        userId: string,
        notebookId: string,
        materialId: string,
        isFileUpload: boolean,
        fileUri?: string,
        filename?: string,
        storagePath?: string
    ) => {
        try {
            // Step 1: Handle Upload if necessary
            if (isFileUpload && fileUri && filename) {
                console.log(`[ProcessingService] Background upload starting for ${materialId}`);
                const uploadResult = await storageService.uploadMaterialFile(
                    userId,
                    materialId,
                    fileUri,
                    filename
                );

                if (uploadResult.error) {
                    console.error('[ProcessingService] Background upload failed:', uploadResult.error);
                    await supabase
                        .from('materials')
                        .update({
                            status: 'failed',
                            meta: { error: `Upload failed: ${uploadResult.error}` }
                        })
                        .eq('id', materialId);

                    await supabase.from('notebooks').update({ status: 'ready_for_studio' }).eq('id', notebookId);
                    return { status: 'failed', error: uploadResult.error };
                }

                console.log(`[ProcessingService] Background upload complete for ${materialId}. Storage path: ${uploadResult.storagePath}`);

                // Ensure storagePath matches what we pre-calculated
                if (uploadResult.storagePath !== storagePath) {
                    console.warn(`[ProcessingService] Storage path mismatch! Expected ${storagePath}, got ${uploadResult.storagePath}`);
                }
            }

            // Step 2: Trigger Edge Function
            console.log(`[ProcessingService] Triggering Edge Function 'process-material' for ${materialId}`);
            const triggerResult = await processingService.triggerProcessing(
                notebookId,
                materialId,
                isFileUpload,
                storagePath,
                userId
            );
            console.log(`[ProcessingService] Edge Function trigger result for ${materialId}:`, triggerResult?.status);
            return triggerResult;
        } catch (error: any) {
            await handleError(error, {
                operation: 'background_processing_fatal',
                component: 'processing-service',
                metadata: { userId, notebookId, materialId, isFileUpload }
            });
            console.error('[ProcessingService] Background processing fatal error:', error);
            await supabase
                .from('materials')
                .update({
                    status: 'failed',
                    meta: { error: `Internal error: ${error.message || 'Unknown'}` }
                })
                .eq('id', materialId);

            await supabase.from('notebooks').update({ status: 'ready_for_studio' }).eq('id', notebookId);
            return { status: 'failed', error };
        }
    },
};
