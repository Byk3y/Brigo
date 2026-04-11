/**
 * Material Service
 * Handles material-related database operations for notebooks.
 */

import { supabase } from '@/lib/supabase';
import { storageService } from '@/lib/storage/storageService';
import { handleError } from '@/lib/errors';
import { uuidv4 } from '@/lib/utils/uuid';
import type { Material } from '@/lib/store/types';

export const materialService = {
    /**
     * Add a material to a notebook
     * @param userId - User ID
     * @param notebookId - Notebook ID
     * @param material - Material data with optional file info
     * @returns The created material record and upload info for background processing
     */
    addMaterialToNotebook: async (
        userId: string,
        notebookId: string,
        material: Omit<Material, 'id' | 'createdAt'> & {
            fileUri?: string;
            filename?: string;
        }
    ) => {
        try {
            // Generating a unique material ID manually for path predictability
            const materialId = uuidv4();

            // Step 1: Pre-calculate storage path if there's a file
            let storagePath: string | undefined;
            const isFileUpload = !!(material.fileUri && material.filename);

            if (isFileUpload) {
                const sanitizedFilename = storageService.sanitizeFilename(material.filename!);
                storagePath = `${userId}/${materialId}/${sanitizedFilename}`;
            }

            // Step 2: Create material record (Fast)
            const materialData: any = {
                id: materialId,
                user_id: userId,
                notebook_id: notebookId,
                kind: material.type || 'text',
                storage_path: storagePath,
                external_url: material.uri?.startsWith('http')
                    ? material.uri
                    : null,
                content: isFileUpload ? null : material.content,
                preview_text: null,
                processed: false,
                status: 'pending',
                processed_at: null,
                meta: {
                    title: material.title || material.filename || 'Source',
                    filename: material.filename
                }
            };

            const { data: newMaterial, error: materialError } = await supabase
                .from('materials')
                .insert(materialData)
                .select()
                .single();

            if (materialError) {
                throw materialError;
            }

            // Step 3: Update notebook status to pending
            await supabase
                .from('notebooks')
                .update({ status: 'pending' })
                .eq('id', notebookId);

            // Step 4: Return for instant UI update
            return {
                newMaterial,
                isFileUpload,
                storagePath,
                fileUri: material.fileUri,
                filename: material.filename
            };
        } catch (error) {
            const appError = await handleError(error, {
                operation: 'add_material_to_notebook',
                component: 'material-service',
                userId,
                metadata: { notebookId, userId }
            });
            throw appError;
        }
    },

    /**
     * Retry processing a failed material
     * @param notebookId - Notebook ID
     * @param materialId - Material ID
     * @returns Success status
     */
    retryProcessing: async (notebookId: string, materialId: string) => {
        try {
            // Re-mark material as pending
            await supabase
                .from('materials')
                .update({ status: 'pending', processed: false })
                .eq('id', materialId);

            // Re-mark notebook as pending
            await supabase
                .from('notebooks')
                .update({ status: 'pending' })
                .eq('id', notebookId);

            // Trigger processing again
            const result = await supabase.functions.invoke('process-material', {
                body: { material_id: materialId },
            });

            if (result.error) throw result.error;
            return { success: true };
        } catch (error: any) {
            // IMPORTANT: before we log anything scary, re-read the material so we
            // can tell what actually happened server-side. supabase-js wraps many
            // different conditions into a generic `FunctionsHttpError` with message
            // "Edge Function returned a non-2xx status code" — that could be:
            //   (a) the server wrote a real user-facing failure (e.g. PDFTooLarge)
            //       and returned 400 with a clean reason — we should respect it.
            //   (b) the server actually succeeded but the client's HTTP connection
            //       dropped mid-processing — we should trust Realtime.
            //   (c) a genuinely unknown error — log it loudly.
            //
            // We can't distinguish these from the error object alone, so the only
            // reliable signal is the authoritative DB state.
            const { data: material } = await supabase
                .from('materials')
                .select('status, processed, content, meta')
                .eq('id', materialId)
                .single();

            // (a) Server already wrote a user-facing failure — respect it.
            //     Log at warn level so the global console.error interceptor doesn't
            //     render its red error modal for a case we've already handled cleanly.
            if (material?.status === 'failed' && material?.meta?.user_facing) {
                console.warn(
                    '[MaterialService] Retry rejected by server:',
                    material.meta.error
                );
                return { success: false, error: material.meta.error };
            }

            // (b1) Server actually succeeded and wrote a processed row — align client.
            if (material?.processed && material?.content) {
                console.log(
                    '[MaterialService] Retry actually succeeded server-side, aligning client state'
                );
                await supabase
                    .from('materials')
                    .update({ status: 'processed' })
                    .eq('id', materialId);
                await supabase
                    .from('notebooks')
                    .update({ status: 'ready_for_studio' })
                    .eq('id', notebookId);
                return { success: true };
            }

            // (b2) Server is still working — connection drop without resolution yet.
            //      Defer to Realtime instead of racing it.
            const errMsg = String(error?.message || error || '');
            const isLikelyTransientConnection =
                errMsg.includes('non-2xx') ||
                errMsg.includes('Failed to send a request');
            if (isLikelyTransientConnection) {
                console.warn(
                    '[MaterialService] Transient retry error, deferring to Realtime sync:',
                    errMsg
                );
                return { success: true, deferred: true };
            }

            // (c) Unknown error path — log loudly so it gets Sentry attention.
            console.error('[MaterialService] Retry failed with unknown error:', errMsg);
            await handleError(error, {
                operation: 'retry_processing',
                component: 'material-service',
                metadata: { notebookId, materialId }
            });
            await supabase
                .from('materials')
                .update({
                    status: 'failed',
                    meta: { error: `Retry failed: ${errMsg}` }
                })
                .eq('id', materialId);
            await supabase
                .from('notebooks')
                .update({ status: 'ready_for_studio' })
                .eq('id', notebookId);
            return { success: false, error: errMsg };
        }
    },

    /**
     * Update material status
     * @param materialId - Material ID
     * @param status - New status
     * @param meta - Optional metadata to merge
     */
    updateMaterialStatus: async (
        materialId: string,
        status: Material['status'],
        meta?: Record<string, any>
    ): Promise<void> => {
        try {
            const updateData: any = { status };
            if (meta) {
                updateData.meta = meta;
            }

            const { error } = await supabase
                .from('materials')
                .update(updateData)
                .eq('id', materialId);

            if (error) {
                await handleError(error, {
                    operation: 'update_material_status',
                    component: 'material-service',
                    metadata: { materialId, status }
                });
            }
        } catch (error) {
            await handleError(error, {
                operation: 'update_material_status',
                component: 'material-service',
                metadata: { materialId, status }
            });
        }
    },

    /**
     * Delete a material and its associated storage files
     * @param materialId - Material ID
     * @param storagePath - Optional storage path to delete
     */
    deleteMaterial: async (materialId: string, storagePath?: string): Promise<void> => {
        try {
            // Delete storage file if exists
            if (storagePath) {
                await storageService.deleteFile(storagePath).catch(e =>
                    console.error('[MaterialService] Failed to delete storage:', e)
                );
            }

            // Delete from database
            const { error } = await supabase
                .from('materials')
                .delete()
                .eq('id', materialId);

            if (error) {
                await handleError(error, {
                    operation: 'delete_material',
                    component: 'material-service',
                    metadata: { materialId }
                });
            }
        } catch (error) {
            await handleError(error, {
                operation: 'delete_material',
                component: 'material-service',
                metadata: { materialId }
            });
        }
    },
};
