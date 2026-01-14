import { supabase } from '@/lib/supabase';
import { storageService } from '@/lib/storage/storageService';
import { getFilenameFromPath } from '@/lib/utils';
import type { Notebook, Material, ChatMessage } from '@/lib/store/types';
import { handleError } from '@/lib/errors';

// Simple UUID v4 generator for React Native environments
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

export const notebookService = {
    fetchNotebooks: async (userId: string) => {
        const { data, error } = await supabase
            .from('notebooks')
            .select(`
                *,
                materials!materials_notebook_id_fkey (*)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .order('created_at', { foreignTable: 'materials', ascending: false });

        if (error) {
            // Use centralized error handling
            const appError = await handleError(error, {
                operation: 'fetch_notebooks',
                component: 'notebook-service',
                userId,
                metadata: { userId }
            });
            throw appError;
        }

        // Transform Supabase data to Notebook format
        return (data || []).map((nb: any) => ({
            id: nb.id,
            title: nb.title,
            flashcardCount: nb.flashcard_count || 0,
            lastStudied: nb.last_studied,
            progress: nb.progress || 0,
            createdAt: nb.created_at,
            color: nb.color,
            emoji: (nb as any).emoji,
            status: nb.status as Notebook['status'],
            meta: nb.meta || {},
            materials: (nb.materials ? (Array.isArray(nb.materials) ? nb.materials : [nb.materials]) : []).map((m: any) => ({
                id: m.id,
                type: m.kind as Material['type'],
                uri: m.storage_path || m.external_url,
                filename: m.meta?.filename || getFilenameFromPath(m.storage_path),
                content: m.content,
                preview_text: m.preview_text,
                title: m.meta?.title || nb.title,
                createdAt: m.created_at,
                processed: !!m.processed,
                status: (m.status as Material['status']) || 'processing',
                thumbnail: m.thumbnail,
                meta: m.meta,
            })),
        }));
    },

    createNotebook: async (
        userId: string,
        notebook: Omit<Notebook, 'id' | 'createdAt'> & {
            material?: Omit<Material, 'id' | 'createdAt'> & {
                fileUri?: string;
                filename?: string;
            };
        }
    ) => {
        try {
            // Step 1: Create notebook record FIRST (Clean flow)
            const notebookData: any = {
                user_id: userId,
                title: notebook.title,
                color: notebook.color,
                status: 'extracting', // Initially extracting if material is present
                meta: {},
                flashcard_count: notebook.flashcardCount || 0,
                progress: notebook.progress || 0,
            };

            const { data: newNotebook, error: notebookError } = await supabase
                .from('notebooks')
                .insert(notebookData)
                .select()
                .single();

            if (notebookError) {
                throw notebookError;
            }

            // Step 2: Handle material if provided
            let material;
            let isFileUpload = false;
            let storagePath;

            if (notebook.material) {
                const materialId = uuidv4();
                isFileUpload = !!(notebook.material.fileUri && notebook.material.filename);

                if (isFileUpload) {
                    const sanitizedFilename = storageService.sanitizeFilename(notebook.material.filename!);
                    storagePath = `${userId}/${materialId}/${sanitizedFilename}`;
                }

                const materialData: any = {
                    id: materialId,
                    user_id: userId,
                    notebook_id: newNotebook.id, // Direct link!
                    kind: notebook.material.type || 'text',
                    storage_path: storagePath,
                    external_url: notebook.material.uri?.startsWith('http')
                        ? notebook.material.uri
                        : null,
                    content: isFileUpload ? null : notebook.material.content,
                    processed: false,
                    status: 'processing',
                    processed_at: null,
                };

                const { data: createdMaterial, error: materialError } = await supabase
                    .from('materials')
                    .insert(materialData)
                    .select()
                    .single();

                if (materialError) {
                    // Cleanup notebook if material creation fails? 
                    // Better to just let it exist or handle recovery
                    throw materialError;
                }

                material = createdMaterial;

                // Step 3: Backward compatibility - Set the "primary" material_id on the notebook
                // This keeps existing queries like `notebooks.material_id` working for now.
                await supabase
                    .from('notebooks')
                    .update({ material_id: material.id })
                    .eq('id', newNotebook.id);
            } else {
                // If no material, set status to 'ready' or similar if applicable
                // For now, keep as 'extracting' if the intention is to add materials later
            }

            // Step 5: Optimization - Return early so UI can navigate
            // The caller (Store/Hook) will handle the background upload and processing.
            return {
                newNotebook,
                material,
                isFileUpload,
                storagePath,
                // Pass the original file info for the background upload task
                fileUri: notebook.material?.fileUri,
                filename: notebook.material?.filename
            };
        } catch (error) {
            const appError = await handleError(error, {
                operation: 'create_notebook',
                component: 'notebook-service',
                userId,
                metadata: { notebookTitle: notebook.title, userId }
            });
            throw appError;
        }
    },

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
            // Must be a valid UUID for the DB schema
            const materialId = uuidv4();

            // Step 1: Pre-calculate storage path if there's a file
            let storagePath: string | undefined;
            const isFileUpload = !!(material.fileUri && material.filename);

            if (isFileUpload) {
                // We use a predictable path so we can insert the record BEFORE uploading
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
                status: 'processing',
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

            // Step 3: Update notebook status to extracting since new content is being added
            await supabase
                .from('notebooks')
                .update({ status: 'extracting' })
                .eq('id', notebookId);

            // Step 4: Return for instant UI update
            return {
                newMaterial,
                isFileUpload,
                storagePath,
                // Original file data for background task
                fileUri: material.fileUri,
                filename: material.filename
            };
        } catch (error) {
            const appError = await handleError(error, {
                operation: 'add_material_to_notebook',
                component: 'notebook-service',
                userId,
                metadata: { notebookId, userId }
            });
            throw appError;
        }
    },

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
            // Trigger Edge Function asynchronously
            // Create timeout promise (60 seconds)
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Edge Function request timed out after 180s')), 180000)
            );

            // Race between Edge Function invocation and timeout
            try {
                const result: any = await Promise.race([
                    supabase.functions.invoke('process-material', {
                        body: { material_id: materialId },
                    }),
                    timeoutPromise,
                ]);

                const { data, error } = result;
                if (error) {
                    await handleError(error, {
                        operation: 'trigger_processing',
                        component: 'notebook-service',
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
                // Check if this is a timeout or network error
                const isTimeout = err.message?.includes('timed out');
                const isNetworkError = err.message?.includes('fetch') || err.message?.includes('network');

                if (isTimeout) {
                    await handleError(err, {
                        operation: 'trigger_processing_timeout',
                        component: 'notebook-service',
                        userId,
                        metadata: { notebookId, materialId, errorType: 'timeout', timeout: '120s' }
                    });
                    // After 180s of no response, something is wrong. Mark material as failed so user can retry.
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
                    // Network errors during backgrounding are common and often false positives:
                    // - The request might have reached the server successfully
                    // - The response fetch was interrupted by app backgrounding
                    // - Realtime will push the actual status if it succeeded
                    // - AppState monitoring will retry if it truly failed
                    console.warn('[NotebookService] Network error during edge function trigger (likely app backgrounded):', err.message);
                    console.warn('[NotebookService] Relying on Realtime sync to get actual processing status');

                    // Don't mark as failed - let Realtime/AppState monitoring determine actual status
                    return { status: 'network_interrupted', error: err };
                } else {
                    await handleError(err, {
                        operation: 'trigger_processing_error',
                        component: 'notebook-service',
                        userId,
                        metadata: { notebookId, materialId, errorType: 'permanent' }
                    });
                    // Permanent error, mark as ready_for_studio so user can retry
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

    retryProcessing: async (notebookId: string, materialId: string) => {
        try {
            // Re-mark material as processing
            await supabase
                .from('materials')
                .update({ status: 'processing', processed: false })
                .eq('id', materialId);

            // Re-mark notebook as extracting
            await supabase
                .from('notebooks')
                .update({ status: 'extracting' })
                .eq('id', notebookId);

            // Trigger processing again
            const result = await supabase.functions.invoke('process-material', {
                body: { material_id: materialId },
            });

            if (result.error) throw result.error;
            return { success: true };
        } catch (error: any) {
            await handleError(error, {
                operation: 'retry_processing',
                component: 'notebook-service',
                metadata: { notebookId, materialId }
            });
            console.error('Retry failed:', error.message);
            // On immediate trigger failure, reset status so UI isn't stuck
            await supabase
                .from('materials')
                .update({
                    status: 'failed',
                    meta: { error: `Retry failed: ${error.message}` }
                })
                .eq('id', materialId);

            await supabase
                .from('notebooks')
                .update({ status: 'ready_for_studio' })
                .eq('id', notebookId);

            return { success: false, error: error.message };
        }
    },

    deleteNotebook: async (userId: string, notebookId: string) => {
        try {
            // Step 1: Fetch notebook with materials AND audio overviews to get storage paths
            const { data: notebook, error: fetchError } = await supabase
                .from('notebooks')
                .select(`
                    id,
                    materials!materials_notebook_id_fkey (id, storage_path),
                    audio_overviews!audio_overviews_notebook_id_fkey (id, storage_path)
                `)
                .eq('id', notebookId)
                .eq('user_id', userId)
                .single();

            if (fetchError || !notebook) {
                console.warn('[NotebookService] Notebook not found or fetch error during deletion:', fetchError);
                // Still try to delete from notebook table just in case it exists but fetch failed
                await supabase.from('notebooks').delete().eq('id', notebookId).eq('user_id', userId);
                return;
            }

            // Step 2: Delete storage files for all materials
            const materials = (notebook.materials as any[]) || [];
            for (const material of materials) {
                if (material.storage_path) {
                    await storageService.deleteFile(material.storage_path).catch(e =>
                        console.error('[NotebookService] Failed to delete material storage:', e)
                    );
                }
            }

            // Step 3: Delete storage files for all audio overviews
            const audioOverviews = (notebook.audio_overviews as any[]) || [];
            for (const audio of audioOverviews) {
                if (audio.storage_path) {
                    await storageService.deleteFile(audio.storage_path).catch(e =>
                        console.error('[NotebookService] Failed to delete audio storage:', e)
                    );
                }
            }

            // Step 4: Delete the notebook record (Cascades to materials, studio_flashcard_sets, studio_quizzes, etc.)
            const { error: deleteError } = await supabase
                .from('notebooks')
                .delete()
                .eq('id', notebookId)
                .eq('user_id', userId);

            if (deleteError) {
                const appError = await handleError(deleteError, {
                    operation: 'delete_notebook_record',
                    component: 'notebook-service',
                    userId,
                    metadata: { notebookId }
                });
                throw appError;
            }
        } catch (error) {
            const appError = await handleError(error, {
                operation: 'delete_notebook_fatal',
                component: 'notebook-service',
                userId,
                metadata: { notebookId }
            });
            throw appError;
        }
    },

    updateNotebook: async (userId: string, notebookId: string, updates: Partial<Notebook>) => {
        try {
            const updateData: any = {};
            if (updates.title !== undefined) updateData.title = updates.title;
            if (updates.emoji !== undefined) updateData.emoji = updates.emoji;
            if (updates.color !== undefined) updateData.color = updates.color;
            if (updates.status !== undefined) updateData.status = updates.status;
            if (updates.flashcardCount !== undefined)
                updateData.flashcard_count = updates.flashcardCount;
            if (updates.progress !== undefined) updateData.progress = updates.progress;
            if (updates.lastStudied !== undefined)
                updateData.last_studied = updates.lastStudied;
            if (updates.meta !== undefined) updateData.meta = updates.meta;

            const { error } = await supabase
                .from('notebooks')
                .update(updateData)
                .eq('id', notebookId)
                .eq('user_id', userId);

            if (error) {
                const appError = await handleError(error, {
                    operation: 'update_notebook',
                    component: 'notebook-service',
                    userId,
                    metadata: { notebookId, updates }
                });
                throw appError;
            }
        } catch (error) {
            const appError = await handleError(error, {
                operation: 'update_notebook',
                component: 'notebook-service',
                userId,
                metadata: { notebookId, updates }
            });
            throw appError;
        }
    },

    /**
     * Get a single notebook by ID with materials
     * @param notebookId - The notebook's ID
     * @returns Notebook with materials or null if not found
     */
    getNotebookById: async (notebookId: string): Promise<Notebook | null> => {
        try {
            const { data, error } = await supabase
                .from('notebooks')
                .select(`
          *,
          materials!materials_notebook_id_fkey (*)
        `)
                .eq('id', notebookId)
                .order('created_at', { foreignTable: 'materials', ascending: false })
                .single();

            if (error) {
                await handleError(error, {
                    operation: 'get_notebook_by_id',
                    component: 'notebook-service',
                    metadata: { notebookId },
                });
                return null;
            }

            if (!data) {
                return null;
            }

            const materialsArr = data.materials
                ? (Array.isArray(data.materials) ? data.materials : [data.materials])
                : [];
            const materialObj = materialsArr[0];

            // Transform Supabase data to Notebook format
            return {
                id: data.id,
                title: data.title,
                emoji: (data as any).emoji,
                flashcardCount: (data as any).flashcard_count || 0,
                lastStudied: (data as any).last_studied || undefined,
                progress: (data as any).progress || 0,
                createdAt: data.created_at || new Date().toISOString(),
                color: (data as any).color as Notebook['color'],
                status: data.status as Notebook['status'],
                meta: (data.meta as any) || {},
                materials: materialsArr.map((m: any) => ({
                    id: m.id,
                    type: m.kind as Material['type'],
                    uri: m.storage_path || m.external_url || undefined,
                    filename: m.meta?.filename || getFilenameFromPath(m.storage_path || undefined),
                    content: m.content || undefined,
                    preview_text: m.preview_text || undefined,
                    title: m.meta?.title || data.title,
                    createdAt: m.created_at || new Date().toISOString(),
                    status: (m.status as Material['status']) || 'processing',
                    processed: !!m.processed,
                    thumbnail: m.thumbnail || undefined,
                    meta: m.meta,
                })),
            };
        } catch (error) {
            await handleError(error, {
                operation: 'get_notebook_by_id',
                component: 'notebook-service',
                metadata: { notebookId },
            });
            return null;
        }
    },

    /**
     * Get a single notebook by ID
     * @param notebookId - The notebook's ID
     * @returns Notebook title or null if not found
     */
    getNotebookTitle: async (notebookId: string): Promise<string | null> => {
        try {
            const { data, error } = await supabase
                .from('notebooks')
                .select('title')
                .eq('id', notebookId)
                .single();

            if (error) {
                await handleError(error, {
                    operation: 'get_notebook_title',
                    component: 'notebook-service',
                    metadata: { notebookId },
                });
                return null;
            }

            return data?.title || null;
        } catch (error) {
            await handleError(error, {
                operation: 'get_notebook_title',
                component: 'notebook-service',
                metadata: { notebookId },
            });
            return null;
        }
    },

    /**
     * Fetch chat messages for a notebook
     */
    fetchChatMessages: async (notebookId: string): Promise<ChatMessage[]> => {
        try {
            const { data, error } = await supabase
                .from('notebook_chat_messages')
                .select('*')
                .eq('notebook_id', notebookId)
                .order('created_at', { ascending: true });

            if (error) {
                await handleError(error, {
                    operation: 'fetch_chat_messages',
                    component: 'notebook-service',
                    metadata: { notebookId },
                });
                return [];
            }

            return (data || []).map(msg => ({
                ...msg,
                role: msg.role as 'user' | 'assistant',
                sources: Array.isArray(msg.sources) ? msg.sources : [],
            })) as ChatMessage[];
        } catch (error) {
            await handleError(error, {
                operation: 'fetch_chat_messages',
                component: 'notebook-service',
                metadata: { notebookId },
            });
            return [];
        }
    },

    /**
     * Perform the heavy lifting (Upload + Processing) in the background.
     * This should NOT be awaited by the UI.
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
                console.log(`[NotebookService] Background upload starting for ${materialId}`);
                const uploadResult = await storageService.uploadMaterialFile(
                    userId,
                    materialId,
                    fileUri,
                    filename
                );

                if (uploadResult.error) {
                    console.error('[NotebookService] Background upload failed:', uploadResult.error);
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

                console.log(`[NotebookService] Background upload complete for ${materialId}. Storage path: ${uploadResult.storagePath}`);

                // Ensure storagePath matches what we pre-calculated
                if (uploadResult.storagePath !== storagePath) {
                    console.warn(`[NotebookService] Storage path mismatch! Expected ${storagePath}, got ${uploadResult.storagePath}`);
                }
            }

            // Step 2: Trigger Edge Function
            console.log(`[NotebookService] Triggering Edge Function 'process-material' for ${materialId}`);
            const triggerResult = await notebookService.triggerProcessing(
                notebookId,
                materialId,
                isFileUpload,
                storagePath,
                userId
            );
            console.log(`[NotebookService] Edge Function trigger result for ${materialId}:`, triggerResult?.status);
            return triggerResult;
        } catch (error: any) {
            await handleError(error, {
                operation: 'background_processing_fatal',
                component: 'notebook-service',
                metadata: { userId, notebookId, materialId, isFileUpload }
            });
            console.error('[NotebookService] Background processing fatal error:', error);
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
