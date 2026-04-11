/**
 * Hook for notebook actions (rename, delete, quiz generation, menu)
 */

import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useStore, type Notebook } from '@/lib/store';
import { useErrorHandler } from '@/lib/hooks/useErrorHandler';

/**
 * Hook to manage notebook actions
 * @param notebook - Current notebook
 * @param id - Notebook ID
 * @param setNotebook - Function to update notebook state
 * @param setActiveTab - Function to change active tab
 * @param setTriggerQuizGeneration - Function to trigger quiz generation
 * @returns Object with action handlers and rename modal state
 */
export function useNotebookActions(
  notebook: Notebook | null,
  id: string | undefined,
  setNotebook: React.Dispatch<React.SetStateAction<Notebook | null>>,
  setActiveTab: (tab: 'sources' | 'chat' | 'studio') => void,
  setTriggerQuizGeneration: (trigger: boolean) => void
) {
  const router = useRouter();
  const { handleError } = useErrorHandler();
  const { updateNotebook, deleteNotebook } = useStore();
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  // Reset rename value when modal closes
  const handleDismissRename = () => {
    setRenameModalVisible(false);
    // Reset to current notebook title when dismissing
    if (notebook) {
      setRenameValue(notebook.title);
    }
  };

  // Handle "Take quiz" action from Chat tab
  const handleTakeQuiz = async () => {
    if (!notebook || !id) return;

    try {
      // Check if a quiz already exists for this notebook
      const { data: existingQuizzes, error } = await supabase
        .from('studio_quizzes')
        .select('id')
        .eq('notebook_id', id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error checking for existing quiz:', error);
        // Fall back to generating new quiz on error
        setActiveTab('studio');
        setTriggerQuizGeneration(true);
        setTimeout(() => setTriggerQuizGeneration(false), 100);
        return;
      }

      // If a quiz exists, navigate to it
      if (existingQuizzes && existingQuizzes.length > 0) {
        router.push(`/quiz/${existingQuizzes[0].id}`);
        return;
      }

      // No quiz exists, generate a new one
      setActiveTab('studio');
      setTriggerQuizGeneration(true);
      setTimeout(() => setTriggerQuizGeneration(false), 100);
    } catch (error) {
      console.error('Error in handleTakeQuiz:', error);
      // Fall back to generating new quiz on error
      setActiveTab('studio');
      setTriggerQuizGeneration(true);
      setTimeout(() => setTriggerQuizGeneration(false), 100);
    }
  };

  // Handle menu button press
  const handleMenuPress = () => {
    Alert.alert(
      notebook?.title || 'Notebook Options',
      undefined,
      [
        {
          text: 'Rename notebook',
          onPress: handleRenameNotebook,
        },
        {
          text: 'Delete notebook',
          style: 'destructive',
          onPress: handleDeleteNotebook,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  // Handle notebook rename
  const handleRenameNotebook = () => {
    if (!notebook) return;

    setRenameValue(notebook.title);
    setRenameModalVisible(true);
  };

  // Save renamed notebook
  const handleSaveRename = async () => {
    if (!notebook || !id || !renameValue.trim()) return;

    try {
      await updateNotebook(id, { title: renameValue.trim() });
      setNotebook((prev) => prev ? { ...prev, title: renameValue.trim() } : null);
      setRenameModalVisible(false);
    } catch (error) {
      await handleError(error, {
        operation: 'rename_notebook',
        component: 'notebook-detail',
        metadata: { notebookId: id }
      });
    }
  };

  // Handle notebook deletion
  const handleDeleteNotebook = () => {
    if (!notebook || !id) return;

    Alert.alert(
      'Delete Notebook',
      `Are you sure you want to delete "${notebook.title}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // IMPORTANT: navigate AWAY from this screen BEFORE deleting the
            // notebook. If we delete first and then navigate, Zustand removes
            // the notebook from the store and React re-renders this screen with
            // `notebook === undefined`, which paints blank (the sub-tab's render
            // guard returns null). On some Expo Router stack states `router.back()`
            // then silently no-ops, leaving the user stuck on a blank screen.
            //
            // `router.replace('/')` unconditionally leaves the detail route and
            // drops it from the stack, so the screen unmounts cleanly before the
            // store mutation propagates.
            router.replace('/');
            try {
              await deleteNotebook(id);
            } catch (error) {
              await handleError(error, {
                operation: 'delete_notebook',
                component: 'notebook-detail',
                metadata: { notebookId: id }
              });
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return {
    handleTakeQuiz,
    handleMenuPress,
    handleRenameNotebook,
    handleSaveRename,
    handleDeleteNotebook,
    renameModalVisible,
    setRenameModalVisible: handleDismissRename,
    renameValue,
    setRenameValue,
  };
}

