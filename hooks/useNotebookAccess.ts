/**
 * Hook for managing notebook access control based on subscription tier
 * 
 * NEW MODEL (Library vs Factory):
 * - All users can access ALL their notebooks (to keep their "library" safe)
 * - Expired users can view ALL notebooks but cannot add new materials or generate new content
 */

import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';

/**
 * Hook to check if notebook is accessible and manage locked overlay state
 * 
 * NEW: We no longer lock notebooks. Expired users can access all their notebooks
 * to view existing content, chat (limited), and study existing flashcards/podcasts.
 * 
 * @param id - Notebook ID
 * @returns Object with showLockedOverlay state and setter (always false now)
 */
export function useNotebookAccess(id: string | undefined) {
  // We always allow access now - no more notebook locking
  const [showLockedOverlay, setShowLockedOverlay] = useState(false);

  // No longer checking for expired status to lock notebooks
  // The user can always access their notebooks - they just can't add/generate new content

  return { showLockedOverlay, setShowLockedOverlay };
}
