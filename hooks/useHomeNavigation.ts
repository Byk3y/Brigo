/**
 * Hook for handling navigation logic with flash prevention
 */

import { useRef, useEffect } from 'react';
import { useRouter } from 'expo-router';

/**
 * Hook to handle navigation to notebook with flash prevention
 * Uses refs and timeouts to prevent rapid double-taps
 */
export function useHomeNavigation() {
  const router = useRouter();
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isNavigatingRef = useRef(false);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  const navigateToNotebook = (notebookId: string | null | undefined, tab?: string) => {
    // Validate notebook ID before navigation
    if (!notebookId || typeof notebookId !== 'string' || notebookId.trim() === '') {
      console.warn('Attempted to navigate with invalid notebook ID:', notebookId);
      return;
    }

    // Prevent rapid double-taps from pushing the route twice
    if (isNavigatingRef.current) return;

    isNavigatingRef.current = true;
    const path = tab ? `/notebook/${notebookId}?tab=${tab}` : `/notebook/${notebookId}`;
    router.push(path);

    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
    }
    navigationTimeoutRef.current = setTimeout(() => {
      isNavigatingRef.current = false;
    }, 800);
  };

  return {
    navigateToNotebook,
    isNavigatingRef,
  };
}







