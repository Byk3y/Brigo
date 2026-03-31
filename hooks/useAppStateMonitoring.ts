/**
 * Hook for monitoring app state changes
 * Recovers stuck notebooks when app returns to foreground
 */

import { useEffect } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/lib/store';

export function useAppStateMonitoring() {
  const authUser = useStore((state) => state.authUser);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        // App returned to foreground - check for stuck notebooks

        const currentAuthUser = useStore.getState().authUser;
        if (!currentAuthUser) return;

        // Realtime Reconnection (Turbo-Plus Ultra)
        // Re-establish Realtime subscription on foreground to recover from WebSocket disconnects
        // that occur when the app is backgrounded (common iOS/Android behavior)
        const { subscribeToNotebookUpdates } = useStore.getState();
        console.log('[AppState] Re-establishing Realtime subscription on foreground...');
        subscribeToNotebookUpdates(currentAuthUser.id);

        // Proactive Re-sync (Turbo-Plus Refined)
        // If we have ANY notebooks effectively "in progress", we re-fetch the list
        // when foregrounded to catch any missed Realtime events.
        const { notebooks, loadNotebooks } = useStore.getState();
        const hasWorkInProgress = notebooks.some(n => n.status === 'extracting' || n.status === 'pending');
        if (hasWorkInProgress) {
          console.log('[AppState] Re-syncing notebooks on foreground...');
          loadNotebooks(currentAuthUser.id).catch(() => { });
        }

        try {
          // Find notebooks stuck in 'extracting' status for more than 3 minutes
          const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
          const { data: stuckNotebooks, error } = await supabase
            .from('notebooks')
            .select('id')
            .eq('user_id', currentAuthUser.id)
            .in('status', ['extracting', 'pending'])
            .lt('updated_at', threeMinutesAgo);

          if (error) {
            // Error already handled by centralized system
            return;
          }

          if (stuckNotebooks && stuckNotebooks.length > 0) {
            // Retry Edge Function for each stuck notebook
            for (const notebook of stuckNotebooks) {
              // Find ALL unprocessed materials for this notebook (multi-material aware)
              const { data: unprocessedMaterials } = await supabase
                .from('materials')
                .select('id')
                .eq('notebook_id', notebook.id)
                .neq('status', 'processed')
                .order('created_at', { ascending: true });

              if (!unprocessedMaterials || unprocessedMaterials.length === 0) {
                console.warn('[AppState] No unprocessed materials found for stuck notebook:', notebook.id);
                continue;
              }

              console.log(`[AppState] Retrying ${unprocessedMaterials.length} materials for notebook: ${notebook.id}`);

              // Invoke Edge Function for each material
              // We don't await each one sequentially to avoid blocking the main loop
              for (const material of unprocessedMaterials) {
                // Create timeout promise
                const timeoutPromise = new Promise((_, reject) =>
                  setTimeout(() => reject(new Error('Retry timeout after 60s')), 60000)
                );

                // Retry Edge Function invocation
                Promise.race([
                  supabase.functions.invoke('process-material', {
                    body: { material_id: material.id },
                  }),
                  timeoutPromise,
                ]).catch(async (err) => {
                  console.error(`[AppState] Failed to retry material ${material.id}:`, err);

                  // Mark as failed for permanent errors so we don't retry infinitely
                  const isTransient = err.message?.includes('timeout') || err.message?.includes('fetch') || err.message?.includes('network');
                  if (!isTransient) {
                    await supabase
                      .from('materials')
                      .update({ status: 'failed', meta: { error: `Recovery failed: ${err.message}` } })
                      .eq('id', material.id);
                  }
                });
              }
            }
          }
        } catch (err) {
          // Error already handled by centralized system
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [authUser?.id]);
}










