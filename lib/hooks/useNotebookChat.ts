import { useState, useCallback, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { handleError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/store/types';
import { EXPIRED_USER_DAILY_CHAT_LIMIT } from '@/lib/services/subscriptionService';

export interface ChatLimitState {
    /** Whether the user has reached their daily chat limit */
    limitReached: boolean;
    /** Remaining messages for today (null for premium users who have unlimited) */
    remainingMessages: number | null;
}

export function useNotebookChat(notebookId: string) {
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [limitReached, setLimitReached] = useState(false);
    const [remainingMessages, setRemainingMessages] = useState<number | null>(null);

    const addChatMessage = useStore(state => state.addChatMessage);
    const updateLastChatMessage = useStore(state => state.updateLastChatMessage);
    const authUser = useStore(state => state.authUser);
    const checkAndAwardTask = useStore(state => state.checkAndAwardTask);
    const tier = useStore(state => state.tier);
    const status = useStore(state => state.status);
    const isExpired = useStore(state => state.isExpired);

    /**
     * Fetch current chat usage for expired users (to show remaining count)
     */
    const fetchRemainingMessages = useCallback(async () => {
        // Premium users don't need to see remaining count
        if (tier === 'premium' && status === 'active') {
            setRemainingMessages(null);
            return;
        }

        // For expired users, fetch current usage from database
        if (!authUser?.id) return;

        try {
            const { data, error: fetchError } = await supabase
                .from('user_subscriptions')
                .select('daily_chat_messages_used, daily_chat_reset_at')
                .eq('user_id', authUser.id)
                .single();

            if (fetchError || !data) {
                // Default to full quota if we can't fetch
                setRemainingMessages(EXPIRED_USER_DAILY_CHAT_LIMIT);
                return;
            }

            // Check if we need to reset (new day)
            const resetAt = data.daily_chat_reset_at ? new Date(data.daily_chat_reset_at) : new Date();
            const now = new Date();
            const hoursSinceReset = (now.getTime() - resetAt.getTime()) / (1000 * 60 * 60);

            if (hoursSinceReset >= 24) {
                // New day, reset count
                setRemainingMessages(EXPIRED_USER_DAILY_CHAT_LIMIT);
            } else {
                // Same day, calculate remaining
                const used = data.daily_chat_messages_used || 0;
                const remaining = Math.max(0, EXPIRED_USER_DAILY_CHAT_LIMIT - used);
                setRemainingMessages(remaining);

                if (remaining === 0) {
                    setLimitReached(true);
                }
            }
        } catch (err) {
            console.error('Error fetching remaining messages:', err);
            setRemainingMessages(EXPIRED_USER_DAILY_CHAT_LIMIT);
        }
    }, [authUser?.id, tier, status]);

    // Initialize remaining messages count when component mounts or subscription changes
    useEffect(() => {
        // Only fetch for expired/non-premium users
        const isPremium = tier === 'premium' && status === 'active';

        if (!isPremium && authUser?.id) {
            fetchRemainingMessages();
        } else {
            // Premium users: clear the remaining count (they have unlimited)
            setRemainingMessages(null);
            setLimitReached(false);
        }
    }, [authUser?.id, tier, status, isExpired, fetchRemainingMessages]);

    /**
     * Check if user can send a chat message
     * Premium users: unlimited
     * Expired users: 5 messages/day to keep their streak
     */
    const checkAndIncrementChatUsage = useCallback(async (): Promise<{ allowed: boolean; remaining: number; isPremium: boolean }> => {
        // Premium active users have unlimited chat
        if (tier === 'premium' && status === 'active') {
            return { allowed: true, remaining: Infinity, isPremium: true };
        }

        // For expired/free users, check daily limit via database function
        try {
            const { data, error: rpcError } = await supabase.rpc('check_and_increment_chat_usage', {
                user_id_param: authUser?.id || '',
            });

            if (rpcError) {
                console.error('Error checking chat limit:', rpcError);
                // On error, allow the message (fail open for better UX)
                return { allowed: true, remaining: EXPIRED_USER_DAILY_CHAT_LIMIT, isPremium: false };
            }

            // Handle the response (it's an array with one row)
            if (data && Array.isArray(data) && data.length > 0) {
                const result = data[0];
                return {
                    allowed: result.allowed,
                    remaining: result.remaining,
                    isPremium: result.is_premium,
                };
            }

            // Fallback: allow if unexpected response format
            return { allowed: true, remaining: EXPIRED_USER_DAILY_CHAT_LIMIT, isPremium: false };
        } catch (err) {
            console.error('Exception checking chat limit:', err);
            return { allowed: true, remaining: EXPIRED_USER_DAILY_CHAT_LIMIT, isPremium: false };
        }
    }, [authUser?.id, tier, status]);

    const sendMessage = useCallback(async (message: string, selectedMaterialIds: string[]) => {
        if (!authUser || !message.trim()) return;

        setIsStreaming(true);
        setError(null);

        // Check chat limit first
        const limitCheck = await checkAndIncrementChatUsage();

        if (!limitCheck.allowed) {
            // User has hit their daily limit
            setLimitReached(true);
            setRemainingMessages(0);
            setIsStreaming(false);

            // Add the user's message
            const userMsgId = Date.now().toString();
            const userMsg: ChatMessage = {
                id: userMsgId,
                notebook_id: notebookId,
                role: 'user',
                content: message,
                sources: selectedMaterialIds,
                created_at: new Date().toISOString(),
            };
            addChatMessage(notebookId, userMsg);

            // Add limit reached message from assistant
            const limitMsgId = (Date.now() + 1).toString();
            const limitMsg: ChatMessage = {
                id: limitMsgId,
                notebook_id: notebookId,
                role: 'assistant',
                content: `You've used all ${EXPIRED_USER_DAILY_CHAT_LIMIT} free messages for today! 🎯\n\nYour streak is safe for today. Come back tomorrow for ${EXPIRED_USER_DAILY_CHAT_LIMIT} more messages, or upgrade to Pro for unlimited chat plus flashcards, quizzes, and AI podcasts.`,
                sources: [],
                created_at: new Date().toISOString(),
            };
            addChatMessage(notebookId, limitMsg);
            return;
        }

        // Update remaining messages for non-premium users
        if (!limitCheck.isPremium) {
            setRemainingMessages(limitCheck.remaining);
        }

        // 1. Generate IDs for optimistic updates
        const userMsgId = Date.now().toString();
        const assistantMsgId = (Date.now() + 1).toString();

        // 2. Optimistic User Message
        const userMsg: ChatMessage = {
            id: userMsgId,
            notebook_id: notebookId,
            role: 'user',
            content: message,
            sources: selectedMaterialIds,
            created_at: new Date().toISOString(),
        };
        addChatMessage(notebookId, userMsg);

        // 3. Add Placeholder Assistant Message
        const assistantMsg: ChatMessage = {
            id: assistantMsgId,
            notebook_id: notebookId,
            role: 'assistant',
            content: '', // Start empty
            sources: selectedMaterialIds,
            created_at: new Date().toISOString(),
        };
        addChatMessage(notebookId, assistantMsg);

        try {
            const { data: { session } } = await supabase.auth.getSession();

            const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/notebook-chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({
                    notebook_id: notebookId,
                    message: message,
                    selected_material_ids: selectedMaterialIds,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to connect to AI assistant');
            }

            // 4. Get full JSON response
            const data = await response.json();
            const content = data.content || "I couldn't generate a response.";

            // 5. Update assistant message with final content
            updateLastChatMessage(notebookId, content);

            // 6. Award tasks
            checkAndAwardTask('chat_with_notebook');
            checkAndAwardTask('first_notebook_chat');

        } catch (err: any) {
            await handleError(err, {
                operation: 'notebook_chat',
                component: 'useNotebookChat',
                metadata: { notebookId, messageLength: message.length },
            });
            setError(err.message);

            // Update with a helpful error message if we hit a snag
            updateLastChatMessage(
                notebookId,
                "I'm sorry, I'm having trouble connecting to my brain right now. Please try again in a moment."
            );
        } finally {
            setIsStreaming(false);
        }
    }, [notebookId, authUser, addChatMessage, updateLastChatMessage, checkAndIncrementChatUsage, checkAndAwardTask]);

    return {
        sendMessage,
        isStreaming,
        error,
        limitReached,
        remainingMessages,
    };
}
