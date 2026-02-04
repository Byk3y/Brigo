import { supabase } from '@/lib/supabase';
import { storageService } from '@/lib/storage/storageService';
import type { Notebook, Material } from '@/lib/store/types';
import { handleError } from '@/lib/errors';
import { uuidv4 } from '@/lib/utils/uuid';
import {
    mapSupabaseNotebookToModel,
    mapSupabaseMaterialToModel,
} from '@/lib/utils/notebookTransform';


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
            const appError = await handleError(error, {
                operation: 'fetch_notebooks',
                component: 'notebook-service',
                userId,
                metadata: { userId }
            });
            throw appError;
        }

        // Use centralized mapper for transformation
        return (data || []).map((nb: any) => mapSupabaseNotebookToModel(nb));
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

    // DEPRECATED: Use materialService.addMaterialToNotebook() instead
    // DEPRECATED: Use processingService.triggerProcessing() instead
    // DEPRECATED: Use materialService.retryProcessing() instead

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

            // Use centralized mapper for transformation
            return mapSupabaseNotebookToModel(data);
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

    // DEPRECATED: Use chatService.fetchChatMessages() instead
    // DEPRECATED: Use processingService.performBackgroundUploadAndProcessing() instead
};

// Re-export decomposed services for backward compatibility
// New code should import directly from the specific service files
export { materialService } from './materialService';
export { chatService } from './chatService';
export { processingService } from './processingService';
