/**
 * Hook for handling friend invite acceptance — deep links + clipboard
 * Watches for pendingInviteCode, accepts it, surfaces the confirmation modal
 */

import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useStore } from '@/lib/store';
import { track } from '@/lib/services/analyticsService';

export function useInviteHandler() {
  const hasCheckedClipboard = useRef(false);
  const isProcessing = useRef(false);

  const authUser = useStore((s) => s.authUser);
  const pendingInviteCode = useStore((s) => s.pendingInviteCode);
  const pendingInviteSource = useStore((s) => s.pendingInviteSource);
  const setPendingInviteCode = useStore((s) => s.setPendingInviteCode);
  const acceptFriendInvite = useStore((s) => s.acceptFriendInvite);
  const loadFriendStreaks = useStore((s) => s.loadFriendStreaks);
  const setJustAcceptedPal = useStore((s) => s.setJustAcceptedPal);

  // Watch for pending invite code (set by deep link or clipboard check)
  useEffect(() => {
    if (!pendingInviteCode || !authUser || isProcessing.current) return;

    const handleInvite = async () => {
      isProcessing.current = true;
      const code = pendingInviteCode;
      const source = pendingInviteSource;
      setPendingInviteCode(null); // Clear immediately

      try {
        const result = await acceptFriendInvite(code);

        if (result.success) {
          await loadFriendStreaks();

          const pal = useStore.getState().friends.find(
            (f) => f.friend.id === result.friend_id,
          )?.friend;
          if (pal) setJustAcceptedPal(pal);

          track('friend_invite_accepted', {
            friend_id: result.friend_id,
            source,
          });
        } else if (source === 'deeplink') {
          // Only show errors for deep links — clipboard failures are silent
          Alert.alert('Oops', result.error || 'Could not accept invite');
        }
      } finally {
        isProcessing.current = false;
      }
    };

    handleInvite();
  }, [pendingInviteCode, authUser]);

  // Check clipboard on first launch (once per session)
  useEffect(() => {
    if (!authUser || hasCheckedClipboard.current) return;
    hasCheckedClipboard.current = true;

    const checkClipboard = async () => {
      try {
        const text = await Clipboard.getStringAsync();
        if (!text) return;

        // Extract code from full URL or raw code
        let code: string | null = null;
        const urlMatch = text.match(/brigo\.app\/invite\/([A-Z0-9]{8})/i);
        if (urlMatch) {
          code = urlMatch[1].toUpperCase();
        } else if (/^[A-Z0-9]{8}$/i.test(text.trim())) {
          code = text.trim().toUpperCase();
        }

        if (code) {
          useStore.getState().setPendingInviteCode(code, 'clipboard');
        }
      } catch {
        // Clipboard access denied or unavailable — silently ignore
      }
    };

    // Small delay to let the app settle after launch
    const timer = setTimeout(checkClipboard, 2000);
    return () => clearTimeout(timer);
  }, [authUser]);
}
