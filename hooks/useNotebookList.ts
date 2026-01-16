/**
 * Hook for notebook list filtering and sorting logic
 * 
 * NOTE: With the "Library vs Factory" model, we no longer limit notebook access.
 * All users can access all their notebooks. The filtering logic is kept for
 * backward compatibility but showLimitedAccess is effectively deprecated.
 */

import { useMemo } from 'react';
import type { Notebook } from '@/lib/store';

interface UseNotebookListParams {
  notebooks: Notebook[];
  showLimitedAccess: boolean;
}

/**
 * Hook to handle notebook sorting and filtering
 * 
 * With the new "Library vs Factory" model:
 * - All users can access ALL their notebooks (the "Library")
 * - showLimitedAccess flag is kept for backward compatibility but has no effect
 */
export function useNotebookList({
  notebooks,
  showLimitedAccess,
}: UseNotebookListParams) {
  // Sort notebooks by creation date (most recent first)
  const sortedNotebooks = useMemo(() => {
    return [...notebooks].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });
  }, [notebooks]);

  // All notebook IDs are now accessible (Library model)
  const accessibleIds = useMemo(
    () => sortedNotebooks.map((n) => n.id),
    [sortedNotebooks]
  );

  // No filtering - all notebooks are accessible regardless of subscription status
  // This is the key change for the "Library vs Factory" model
  const accessibleNotebooks = sortedNotebooks;

  return {
    sortedNotebooks,
    accessibleNotebooks,
    accessibleIds,
  };
}
