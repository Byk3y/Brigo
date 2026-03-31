/**
 * Chat Service
 * Handles chat-related database operations for notebooks.
 */

import { supabase } from '@/lib/supabase';
import { handleError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/store/types';
import { mapSupabaseChatMessageToModel } from '@/lib/utils/notebookTransform';

export const chatService = {
    /**
     * Fetch chat messages for a notebook
     * @param notebookId - The notebook ID
     * @returns Array of chat messages
     */
    fetchChatMessages: async (notebookId: string): Promise<ChatMessage[]> => {
        try {
            const { data, error } = await supabase
                .from('notebook_chat_messages')
                .select('*')
                .eq('notebook_id', notebookId)
                .order('created_at', { ascending: true });

            if (error) {
                await handleError(error, {
                    operation: 'fetch_chat_messages',
                    component: 'chat-service',
                    metadata: { notebookId },
                });
                return [];
            }

            return (data || []).map(mapSupabaseChatMessageToModel);
        } catch (error) {
            await handleError(error, {
                operation: 'fetch_chat_messages',
                component: 'chat-service',
                metadata: { notebookId },
            });
            return [];
        }
    },

    /**
     * Add a chat message to a notebook
     * @param notebookId - The notebook ID
     * @param role - 'user' or 'assistant'
     * @param content - Message content
     * @param sources - Optional array of source references
     * @returns The created message or null on error
     */
    addChatMessage: async (
        notebookId: string,
        role: 'user' | 'assistant',
        content: string,
        sources: string[] = []
    ): Promise<ChatMessage | null> => {
        try {
            const { data, error } = await supabase
                .from('notebook_chat_messages')
                .insert({
                    notebook_id: notebookId,
                    role,
                    content,
                    sources,
                })
                .select()
                .single();

            if (error) {
                await handleError(error, {
                    operation: 'add_chat_message',
                    component: 'chat-service',
                    metadata: { notebookId, role },
                });
                return null;
            }

            return mapSupabaseChatMessageToModel(data);
        } catch (error) {
            await handleError(error, {
                operation: 'add_chat_message',
                component: 'chat-service',
                metadata: { notebookId, role },
            });
            return null;
        }
    },

    /**
     * Clear chat history for a notebook
     * @param notebookId - The notebook ID
     */
    clearChatHistory: async (notebookId: string): Promise<void> => {
        try {
            const { error } = await supabase
                .from('notebook_chat_messages')
                .delete()
                .eq('notebook_id', notebookId);

            if (error) {
                await handleError(error, {
                    operation: 'clear_chat_history',
                    component: 'chat-service',
                    metadata: { notebookId },
                });
            }
        } catch (error) {
            await handleError(error, {
                operation: 'clear_chat_history',
                component: 'chat-service',
                metadata: { notebookId },
            });
        }
    },

    /**
     * Check if a user has any chat messages across all notebooks
     */
    hasUserMessages: async (userId: string): Promise<boolean> => {
        try {
            const { data, error } = await supabase
                .from('notebook_chat_messages')
                .select('id')
                .eq('user_id', userId)
                .limit(1)
                .maybeSingle();

            if (error) {
                await handleError(error, {
                    operation: 'check_user_messages',
                    component: 'chat-service',
                    metadata: { userId },
                });
                return false;
            }

            return !!data;
        } catch (error) {
            await handleError(error, {
                operation: 'check_user_messages',
                component: 'chat-service',
                metadata: { userId },
            });
            return false;
        }
    },
};
