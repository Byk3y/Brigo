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
        const hasWorkInProgress = notebooks.some(n => n.status === 'extracting');
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
            .eq('status', 'extracting')
            .lt('updated_at', threeMinutesAgo);

          if (error) {
            // Error already handled by centralized system
            return;
          }

          if (stuckNotebooks && stuckNotebooks.length > 0) {
            // Retry Edge Function for each stuck notebook
            for (const notebook of stuckNotebooks) {
              // Find the first unprocessed material for this notebook (multi-material aware)
              const { data: unprocessedMaterial } = await supabase
                .from('materials')
                .select('id')
                .eq('notebook_id', notebook.id)
                .neq('status', 'processed')
                .order('created_at', { ascending: true })
                .limit(1)
                .single();

              // Skip if no unprocessed materials found (notebook might be in weird state)
              if (!unprocessedMaterial) {
                console.warn('[AppState] No unprocessed material found for stuck notebook:', notebook.id);
                continue;
              }

              // Create timeout promise
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Retry timeout after 60s')), 60000)
              );

              // Retry Edge Function invocation
              Promise.race([
                supabase.functions.invoke('process-material', {
                  body: { material_id: unprocessedMaterial.id },
                }),
                timeoutPromise,
              ])
                .then(async (result: any) => {
                  const { data, error } = result;
                  if (error) {
                    // Error already handled by centralized system
                    // Mark as failed
                    const { error: updateError } = await supabase
                      .from('notebooks')
                      .update({ status: 'failed' })
                      .eq('id', notebook.id);
                    if (updateError) {
                      // Non-critical error, just log
                      if (__DEV__) {
                        console.warn(`Failed to update notebook ${notebook.id} status:`, updateError);
                      }
                    }
                  }
                })
                .catch(async (err) => {
                  // Error already handled by centralized system
                  // Don't mark as failed on timeout/network errors - will retry on next foreground
                  const isTimeout = err.message?.includes('timeout');
                  const isNetworkError =
                    err.message?.includes('fetch') || err.message?.includes('network');

                  if (!isTimeout && !isNetworkError) {
                    // Permanent error, mark as failed
                    const { error: updateError } = await supabase
                      .from('notebooks')
                      .update({ status: 'failed' })
                      .eq('id', notebook.id);
                    if (updateError) {
                      if (__DEV__) {
                        console.warn(`Failed to update notebook ${notebook.id} status:`, updateError);
                      }
                    }
                  }
                });
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










