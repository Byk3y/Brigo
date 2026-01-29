/**
 * Notebook slice - Notebooks state management with Supabase CRUD operations
 */

import type { StateCreator } from 'zustand';
import { supabase } from '@/lib/supabase';
import { notebookService } from '@/lib/services/notebookService';
import { getFilenameFromPath } from '@/lib/utils';
import { track } from '@/lib/services/analyticsService';
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
  deleteMaterial: (notebookId: string, materialId: string) => void;
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

      const transformedNotebook: Notebook = {
        id: newNotebook.id,
        title: newNotebook.title,
        emoji: (newNotebook as any).emoji,
        flashcardCount: (newNotebook as any).flashcard_count || 0,
        lastStudied: (newNotebook as any).last_studied || undefined,
        progress: (newNotebook as any).progress || 0,
        createdAt: newNotebook.created_at || new Date().toISOString(),
        color: (newNotebook as any).color as Notebook['color'],
        status: newNotebook.status as Notebook['status'],
        meta: (newNotebook.meta as any) || {},
        materials: materialsArr.map((m: any) => ({
          id: m.id,
          type: m.kind as Material['type'],
          uri: m.storage_path || m.external_url || undefined,
          filename: m.meta?.filename || getFilenameFromPath(m.storage_path || undefined),
          content: m.content || undefined,
          preview_text: m.preview_text || undefined,
          title: m.meta?.title || newNotebook.title,
          createdAt: m.created_at || new Date().toISOString(),
          processed: !!m.processed,
          status: m.status || 'processing',
          thumbnail: m.thumbnail || undefined,
          meta: m.meta,
        })),
      };

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
        notebookService.performBackgroundUploadAndProcessing(
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
      } = await notebookService.addMaterialToNotebook(
        authUser.id,
        notebookId,
        material as any
      );

      // 2. Optimistic/Local Update
      const materialObj: Material = {
        id: (newMaterial as any).id,
        type: (newMaterial as any).kind as Material['type'],
        uri: (newMaterial as any).storage_path || (newMaterial as any).external_url || undefined,
        filename: (newMaterial as any).meta?.filename || getFilenameFromPath((newMaterial as any).storage_path || undefined),
        content: (newMaterial as any).content || undefined,
        preview_text: (newMaterial as any).preview_text || undefined,
        title: (newMaterial as any).meta?.title || material.title || 'New Source',
        createdAt: (newMaterial as any).created_at || new Date().toISOString(),
        thumbnail: (newMaterial as any).thumbnail || undefined,
        processed: (newMaterial as any).processed || false,
        status: (newMaterial as any).status || 'processing',
        meta: (newMaterial as any).meta,
      };

      set((state) => ({
        notebooks: state.notebooks.map((n) =>
          n.id === notebookId
            ? {
              ...n,
              status: 'extracting',
              materials: n.materials.some(m => m.id === materialObj.id)
                ? n.materials.map(m => m.id === materialObj.id ? materialObj : m)
                : [materialObj, ...n.materials],
            }
            : n
        ),
      }));

      // 3. Trigger Background Processing
      notebookService.performBackgroundUploadAndProcessing(
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

  deleteMaterial: (notebookId, materialId) =>
    set((state) => ({
      notebooks: state.notebooks.map((n) =>
        n.id === notebookId
          ? {
            ...n,
            materials: n.materials.filter((m) => m.id !== materialId),
          }
          : n
      ),
    })),

  loadChatMessages: async (notebookId) => {
    try {
      const messages = await notebookService.fetchChatMessages(notebookId);
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
            if (updatedNb.status !== 'extracting') {
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
              // For status-only updates while still extracting, update record optimistically
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
