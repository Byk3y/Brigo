/**
 * Notebook slice - Notebooks state management with Supabase CRUD operations
 */

import type { StateCreator } from 'zustand';
import { supabase } from '@/lib/supabase';
import { notebookService } from '@/lib/services/notebookService';
import { materialService } from '@/lib/services/materialService';
import { processingService } from '@/lib/services/processingService';
import { chatService } from '@/lib/services/chatService';
import { track } from '@/lib/services/analyticsService';
import {
  mapSupabaseNotebookToModel,
  mapSupabaseMaterialToModel,
} from '@/lib/utils/notebookTransform';
import type { Notebook, Material, SupabaseUser, ChatMessage } from '../types';

export interface NotebookSlice {
  notebooks: Notebook[];
  notebooksSyncedAt: number | null;
  notebooksUserId: string | null;
  setNotebooks: (notebooks: Notebook[]) => void;
  loadNotebooks: (userId?: string) => Promise<void>;
  addNotebook: (
    notebook: Omit<Notebook, 'id' | 'createdAt' | 'materials'> & {
      material?: Omit<Material, 'id' | 'createdAt'> & {
        fileUri?: string;
        filename?: string;
      };
    }
  ) => Promise<string>;
  deleteNotebook: (id: string) => Promise<void>;
  updateNotebook: (id: string, updates: Partial<Notebook>) => Promise<void>;
  addMaterial: (
    notebookId: string,
    material: Omit<Material, 'id' | 'createdAt'> & { fileUri?: string; filename?: string }
  ) => Promise<void>;
  deleteMaterial: (notebookId: string, materialId: string) => Promise<void>;
  loadChatMessages: (notebookId: string) => Promise<void>;
  addChatMessage: (notebookId: string, message: ChatMessage) => void;
  updateLastChatMessage: (notebookId: string, content: string) => void;
  subscribeToNotebookUpdates: (userId: string) => void;
  unsubscribeFromNotebookUpdates: () => void;
  notebooksRealtimeChannel: any | null; // Track subscription in state
  resetNotebookState: () => void;
}

export const createNotebookSlice: StateCreator<
  NotebookSlice & {
    authUser: SupabaseUser | null;
    setAuthUser: (user: SupabaseUser | null) => void;
    setHasCreatedNotebook?: (value: boolean) => void;
  },
  [],
  [],
  NotebookSlice
> = (set, get) => ({
  notebooks: [],
  notebooksSyncedAt: null,
  notebooksUserId: null,
  notebooksRealtimeChannel: null,

  setNotebooks: (notebooks) => set({ notebooks }),

  loadNotebooks: async (userId?: string) => {
    const effectiveUserId = userId || get().authUser?.id;
    if (!effectiveUserId) {
      set({ notebooks: [] });
      return;
    }

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const notebooks = await notebookService.fetchNotebooks(effectiveUserId);

        set({
          notebooks,
          notebooksSyncedAt: Date.now(),
          notebooksUserId: effectiveUserId,
        });

        // 2. Realtime Subscription (Turbo-Plus)
        // If we haven't subscribed to this user yet, do it now
        if (effectiveUserId) {
          get().subscribeToNotebookUpdates(effectiveUserId);
        }

        if (notebooks.length > 0) {
          if (get().setHasCreatedNotebook) {
            get().setHasCreatedNotebook!(true);
          }
          if ((get() as any).checkAndAwardTask) {
            (get() as any).checkAndAwardTask('create_notebook');
          }
        }

        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`Error loading notebooks (attempt ${attempt}/${maxRetries}):`, lastError);

        if (attempt === maxRetries) {
          // CRITICAL FIX: Don't overwrite cached notebooks on network failure
          // Only update sync metadata if this is the same user (to mark stale data)
          // Keep existing cached notebooks to enable offline viewing
          const currentState = get();
          if (currentState.notebooksUserId === effectiveUserId && currentState.notebooks.length > 0) {
            // Keep cached notebooks, just log the failure
            console.warn('[Store] Network failed, preserving cached notebooks for offline viewing');
          } else {
            // Only clear if no cached data for this user exists
            set({
              notebooks: [],
              notebooksSyncedAt: Date.now(),
              notebooksUserId: effectiveUserId,
            });
          }
          // Don't throw - allow app to continue with cached/empty data
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  },

  addNotebook: async (notebook) => {
    let authUser = get().authUser;

    if (!authUser) {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        console.error('No authenticated user', error);
        throw new Error('No authenticated user');
      }
      authUser = user;
      get().setAuthUser(user);
    }

    try {
      // 1. Create Notebook (DB Insert only, very fast)
      const {
        newNotebook,
        material: resultMaterial,
        isFileUpload,
        storagePath,
        fileUri,
        filename
      } = await notebookService.createNotebook(authUser.id, notebook as any);

      // 2. Optimistic Update (UI transitions here)
      const materialsArr = resultMaterial ? [resultMaterial] : [];

      // Use centralized mapper for transformation
      const transformedNotebook: Notebook = mapSupabaseNotebookToModel(
        newNotebook,
        materialsArr.map((m: any) => mapSupabaseMaterialToModel(m, newNotebook.title))
      );

      set((state) => {
        const exists = state.notebooks.some((n) => n.id === transformedNotebook.id);
        if (exists) {
          return {
            notebooks: state.notebooks.map((n) =>
              n.id === transformedNotebook.id ? transformedNotebook : n
            ),
          };
        }
        return {
          notebooks: [transformedNotebook, ...state.notebooks],
        };
      });

      // 3. Trigger Background Processing (Upload + Edge Function)
      if (resultMaterial) {
        processingService.performBackgroundUploadAndProcessing(
          authUser.id,
          newNotebook.id,
          resultMaterial.id,
          !!isFileUpload,
          fileUri,
          filename,
          storagePath
        ).catch((err) => {
          console.error('[Store] Background work failed:', err);
        });
      }

      // Global side effects
      if ((get() as any).checkAndAwardTask) {
        (get() as any).checkAndAwardTask('create_notebook');
      }
      if (get().setHasCreatedNotebook) {
        get().setHasCreatedNotebook!(true);
      }
      track('notebook_created', {
        notebook_id: newNotebook.id,
        has_material: !!resultMaterial,
        material_type: resultMaterial?.kind,
      });

      return newNotebook.id;
    } catch (error) {
      console.error('Error adding notebook:', error);
      throw error;
    }
  },

  deleteNotebook: async (id) => {
    const { authUser } = get();
    if (!authUser) return;
    try {
      await notebookService.deleteNotebook(authUser.id, id);
      set((state) => ({
        notebooks: state.notebooks.filter((n) => n.id !== id),
      }));
    } catch (error) {
      // Logged in service
    }
  },

  updateNotebook: async (id, updates) => {
    const { authUser } = get();
    if (!authUser) return;
    try {
      await notebookService.updateNotebook(authUser.id, id, updates);
      set((state) => ({
        notebooks: state.notebooks.map((n) => (n.id === id ? { ...n, ...updates } : n)),
      }));
    } catch (error) {
      // Logged in service
    }
  },

  addMaterial: async (notebookId, material) => {
    const { authUser } = get();
    if (!authUser) return;

    try {
      // 1. Service Call (DB Insert only)
      const {
        newMaterial,
        isFileUpload,
        storagePath,
        fileUri,
        filename
      } = await materialService.addMaterialToNotebook(
        authUser.id,
        notebookId,
        material as any
      );

      // 2. Optimistic/Local Update - Use centralized mapper
      const materialObj: Material = mapSupabaseMaterialToModel(newMaterial, material.title || 'New Source');

      set((state) => ({
        notebooks: state.notebooks.map((n) =>
          n.id === notebookId
            ? {
              ...n,
              status: 'pending',
              materials: n.materials.some(m => m.id === materialObj.id)
                ? n.materials.map(m => m.id === materialObj.id ? materialObj : m)
                : [materialObj, ...n.materials],
            }
            : n
        ),
      }));

      // 3. Trigger Background Processing
      processingService.performBackgroundUploadAndProcessing(
        authUser.id,
        notebookId,
        newMaterial.id,
        !!isFileUpload,
        fileUri,
        filename,
        storagePath
      ).catch((err) => {
        console.error('[Store] Background work failed for material:', err);
      });

      if ((get() as any).checkAndAwardTask) {
        (get() as any).checkAndAwardTask('add_material_daily');
      }
      track('material_added', {
        notebook_id: notebookId,
        material_type: newMaterial.kind,
      });
    } catch (error) {
      console.error('Error adding material:', error);
      throw error;
    }
  },

  deleteMaterial: async (notebookId, materialId) => {
    // Capture the material's storage path BEFORE the optimistic removal so
    // we can pass it to the service call. Without this, the service would
    // only delete the DB row and leave the file orphaned in storage.
    const notebook = get().notebooks.find((n) => n.id === notebookId);
    const material = notebook?.materials.find((m) => m.id === materialId);
    const storagePath: string | null =
      (material as any)?.storage_path || (material as any)?.storagePath || null;

    // Optimistic UI update: remove from local state immediately so the
    // delete feels instant. The service call runs in the background and
    // we don't block on it.
    set((s) => ({
      notebooks: s.notebooks.map((n) =>
        n.id === notebookId
          ? {
            ...n,
            materials: n.materials.filter((m) => m.id !== materialId),
          }
          : n
      ),
    }));

    // Background DB + storage delete. Fire-and-forget. If it fails we log
    // but don't roll back the UI — the user already saw the material
    // disappear and rolling back would be worse UX than a stale row.
    try {
      await materialService.deleteMaterial(materialId, storagePath || undefined);
    } catch (err) {
      console.error('[Store] Failed to delete material from backend:', err);
    }
  },

  loadChatMessages: async (notebookId) => {
    try {
      const messages = await chatService.fetchChatMessages(notebookId);
      set((state) => ({
        notebooks: state.notebooks.map((n) =>
          n.id === notebookId ? { ...n, chat_messages: messages } : n
        ),
      }));
    } catch (error) {
      console.error('Error loading chat messages:', error);
    }
  },

  addChatMessage: (notebookId, message) =>
    set((state) => ({
      notebooks: state.notebooks.map((n) =>
        n.id === notebookId
          ? {
            ...n,
            chat_messages: [...(n.chat_messages || []), message],
          }
          : n
      ),
    })),

  updateLastChatMessage: (notebookId, content) =>
    set((state) => ({
      notebooks: state.notebooks.map((n) => {
        if (n.id === notebookId && n.chat_messages && n.chat_messages.length > 0) {
          const newMessages = [...n.chat_messages];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg.role === 'assistant') {
            newMessages[newMessages.length - 1] = {
              ...lastMsg,
              content: content,
            };
            return { ...n, chat_messages: newMessages };
          }
        }
        return n;
      }),
    })),

  /**
   * Realtime Synchronization (Turbo-Plus Refined)
   * Subscribes to changes in the notebooks table for the current user.
   */
  subscribeToNotebookUpdates: (userId: string) => {
    // Clean up existing subscription if any
    get().unsubscribeFromNotebookUpdates();

    console.log(`[Store] Establishing hardened Realtime subscription for user: ${userId}`);

    const channel = supabase
      .channel(`notebook-updates-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notebooks',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const updatedNb = payload.new;

          console.log(`[Store] Realtime update: notebook ${updatedNb.id} status is now ${updatedNb.status}`);

          try {
            // Optimization: Only fetch full notebook when status is NOT extracting (i.e. processed/failed)
            // or if it's an update to a previously processed notebook (e.g. title/meta change)
            if (updatedNb.status !== 'extracting' && updatedNb.status !== 'pending') {
              // Fetch full notebook data
              const fullNotebook = await notebookService.getNotebookById(updatedNb.id);

              if (fullNotebook) {
                set((state) => ({
                  notebooks: state.notebooks.map((n) =>
                    n.id === fullNotebook.id ? fullNotebook : n
                  ),
                }));
              } else {
                // Fallback: update matching record with payload fields
                set((state) => ({
                  notebooks: state.notebooks.map((n) =>
                    n.id === updatedNb.id ? { ...n, ...updatedNb } : n
                  ),
                }));
              }
            } else {
              // For status-only updates while still extracting or pending, update record optimistically
              set((state) => ({
                notebooks: state.notebooks.map((n) =>
                  n.id === updatedNb.id ? { ...n, ...updatedNb } : n
                ),
              }));
            }
          } catch (error) {
            console.error('[Store] Error processing Realtime callback:', error);
            // Robust fallback: update with whatever is in the payload
            set((state) => ({
              notebooks: state.notebooks.map((n) =>
                n.id === updatedNb.id ? { ...n, ...updatedNb } : n
              ),
            }));
          }
        }
      )
      // Phase B: per-material status updates. When a material transitions
      // to 'processed' or 'failed', update it in the notebook's materials
      // array so the UI reflects individual failures immediately without
      // waiting for a manual refresh or the notebook-level status change.
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'materials',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          const materialId = updated.id;
          const status = updated.status;

          if (status === 'processed' || status === 'failed') {
            console.log(`[Store] Realtime: material ${materialId} status=${status}`);

            set((state) => ({
              notebooks: state.notebooks.map((n) => ({
                ...n,
                materials: n.materials.map((m) =>
                  m.id === materialId
                    ? {
                        ...m,
                        status,
                        processed: status === 'processed',
                        meta: updated.meta ?? m.meta,
                        content: updated.content ?? m.content,
                        preview_text: updated.preview_text ?? m.preview_text,
                      }
                    : m
                ),
              })),
            }));
          }
        }
      );

    let retryCount = 0;
    const maxRetries = 3;

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Store] ✅ Realtime subscription active');
        retryCount = 0;
      } else if (status === 'CLOSED') {
        console.warn('[Store] ⚠️ Realtime connection closed');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`[Store] ❌ Realtime subscription ${status.toLowerCase()} (Attempt ${retryCount + 1}/${maxRetries})`);

        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(() => {
            console.log(`[Store] 🔄 Retrying Realtime subscription...`);
            get().subscribeToNotebookUpdates(userId);
          }, 2000 * retryCount);
        }
      }
    });

    set({ notebooksRealtimeChannel: channel });
  },

  unsubscribeFromNotebookUpdates: () => {
    const { notebooksRealtimeChannel } = get();
    if (notebooksRealtimeChannel) {
      console.log('[Store] Cleaning up Realtime subscription');
      supabase.removeChannel(notebooksRealtimeChannel);
      set({ notebooksRealtimeChannel: null });
    }
  },

  resetNotebookState: () => {
    get().unsubscribeFromNotebookUpdates();
    set({
      notebooks: [],
      notebooksSyncedAt: null,
      notebooksUserId: null,
    });
  },
});
