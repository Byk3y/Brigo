/**
 * Hook for managing real-time Supabase subscription for notebook updates
 */

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useStore, type Notebook } from '@/lib/store';
import { transformNotebook } from '@/lib/utils/notebookTransform';

/**
 * Hook to set up real-time subscription for notebook updates
 * @param id - Notebook ID
 * @param setNotebook - Function to update notebook state
 */
export function useNotebookSubscription(
  id: string | undefined,
  setNotebook: React.Dispatch<React.SetStateAction<Notebook | null>>
) {
  const { setNotebooks } = useStore();
  const isReloadingRef = useRef(false);

  useEffect(() => {
    if (!id) {
      return;
    }

    const channel = supabase
      .channel(`notebook:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notebooks',
          filter: `id=eq.${id}`,
        },
        async (payload) => {
          const updated = payload.new as any;
          const oldStatus = (payload.old as any)?.status;
          const newStatus = updated.status as Notebook['status'];

          // Get current notebook state
          setNotebook((currentNotebook) => {
            if (!currentNotebook) return currentNotebook;

            const oldStatusFromState = currentNotebook.status;

            // Update Zustand store AFTER render (defer to avoid React warning)
            // Use queueMicrotask to schedule store update after current render cycle
            queueMicrotask(() => {
              const currentNotebooks = useStore.getState().notebooks;
              setNotebooks(
                currentNotebooks.map((n) =>
                  n.id === id
                    ? {
                      ...n,
                      status: newStatus,
                      title: updated.title,
                      emoji: updated.emoji,
                      color: updated.color,
                      meta: updated.meta || {},
                    }
                    : n
                )
              );
            });

            // If status changed to preview_ready, reload notebook with materials
            // to get the updated preview_text from materials table
            if (newStatus === 'preview_ready' && (oldStatusFromState === 'extracting' || oldStatusFromState === 'pending')) {
              // Prevent multiple simultaneous reloads
              if (isReloadingRef.current) {
                return transformNotebook(updated, currentNotebook.materials);
              }

              isReloadingRef.current = true;

              // Fetch the notebook with materials from Supabase
              const reloadNotebook = async () => {
                try {
                  const { data: refreshedData, error } = await supabase
                    .from('notebooks')
                    .select(`
                      *,
                      materials!materials_notebook_id_fkey (*)
                    `)
                    .eq('id', id)
                    .single();

                  isReloadingRef.current = false;

                  if (!error && refreshedData) {
                    const refreshedNotebook = transformNotebook(refreshedData);
                    setNotebook(refreshedNotebook);

                    // Update store with refreshed data
                    queueMicrotask(() => {
                      const currentNotebooks = useStore.getState().notebooks;
                      setNotebooks(
                        currentNotebooks.map((n) =>
                          n.id === id ? refreshedNotebook : n
                        )
                      );
                    });
                  } else {
                    console.error('Error reloading notebook:', error);
                    // Fallback: update with what we have
                    const updatedNotebook = transformNotebook(updated, currentNotebook.materials);
                    setNotebook(updatedNotebook);
                  }
                } catch (error) {
                  isReloadingRef.current = false;
                  console.error('Error reloading notebook:', error);
                  // Fallback: update with what we have
                  const updatedNotebook = transformNotebook(updated, currentNotebook.materials);
                  setNotebook(updatedNotebook);
                }
              };

              void reloadNotebook();

              // Return current state while reloading
              return transformNotebook(updated, currentNotebook.materials);
            } else {
              // For other updates, just update with existing materials
              return transformNotebook(updated, currentNotebook.materials);
            }
          });
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' && err) {
          console.error('Channel subscription error:', err);
        } else if (status === 'TIMED_OUT') {
          console.warn('Subscription timed out');
        }
      });

    // Cleanup subscription on unmount
    return () => {
      isReloadingRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [id, setNotebook, setNotebooks]);
}







