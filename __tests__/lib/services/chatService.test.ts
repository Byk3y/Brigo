/**
 * Chat Service Tests
 * Tests for chat message operations
 */

import { chatService } from '@/lib/services/chatService';
import { supabase } from '@/lib/supabase';

// Mock Supabase responses
const mockChatMessages = [
    {
        id: 'msg-1',
        notebook_id: 'nb-1',
        role: 'user',
        content: 'What is photosynthesis?',
        sources: [],
        created_at: '2024-01-01T00:00:00Z',
    },
    {
        id: 'msg-2',
        notebook_id: 'nb-1',
        role: 'assistant',
        content: 'Photosynthesis is the process...',
        sources: ['material-1'],
        created_at: '2024-01-01T00:01:00Z',
    },
];

describe('chatService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('fetchChatMessages', () => {
        it('should fetch and transform chat messages for a notebook', async () => {
            // Setup mock
            const mockFrom = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        order: jest.fn().mockResolvedValue({
                            data: mockChatMessages,
                            error: null,
                        }),
                    }),
                }),
            });
            (supabase.from as jest.Mock) = mockFrom;

            const result = await chatService.fetchChatMessages('nb-1');

            expect(mockFrom).toHaveBeenCalledWith('notebook_chat_messages');
            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({
                id: 'msg-1',
                role: 'user',
                content: 'What is photosynthesis?',
            });
            expect(result[1]).toMatchObject({
                id: 'msg-2',
                role: 'assistant',
            });
        });

        it('should return empty array on error', async () => {
            const mockFrom = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        order: jest.fn().mockResolvedValue({
                            data: null,
                            error: { message: 'DB error' },
                        }),
                    }),
                }),
            });
            (supabase.from as jest.Mock) = mockFrom;

            const result = await chatService.fetchChatMessages('nb-1');

            expect(result).toEqual([]);
        });

        it('should return empty array when no messages exist', async () => {
            const mockFrom = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        order: jest.fn().mockResolvedValue({
                            data: [],
                            error: null,
                        }),
                    }),
                }),
            });
            (supabase.from as jest.Mock) = mockFrom;

            const result = await chatService.fetchChatMessages('nb-1');

            expect(result).toEqual([]);
        });
    });

    describe('addChatMessage', () => {
        it('should add a user message to a notebook', async () => {
            const newMessage = {
                id: 'msg-new',
                notebook_id: 'nb-1',
                role: 'user',
                content: 'Test question',
                sources: [],
                created_at: '2024-01-01T00:00:00Z',
            };

            const mockFrom = jest.fn().mockReturnValue({
                insert: jest.fn().mockReturnValue({
                    select: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: newMessage,
                            error: null,
                        }),
                    }),
                }),
            });
            (supabase.from as jest.Mock) = mockFrom;

            const result = await chatService.addChatMessage('nb-1', 'user', 'Test question');

            expect(mockFrom).toHaveBeenCalledWith('notebook_chat_messages');
            expect(result).not.toBeNull();
            expect(result?.content).toBe('Test question');
            expect(result?.role).toBe('user');
        });

        it('should return null on error', async () => {
            const mockFrom = jest.fn().mockReturnValue({
                insert: jest.fn().mockReturnValue({
                    select: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: null,
                            error: { message: 'Insert failed' },
                        }),
                    }),
                }),
            });
            (supabase.from as jest.Mock) = mockFrom;

            const result = await chatService.addChatMessage('nb-1', 'user', 'Test');

            expect(result).toBeNull();
        });
    });

    describe('clearChatHistory', () => {
        it('should delete all messages for a notebook', async () => {
            const mockFrom = jest.fn().mockReturnValue({
                delete: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({
                        data: null,
                        error: null,
                    }),
                }),
            });
            (supabase.from as jest.Mock) = mockFrom;

            await chatService.clearChatHistory('nb-1');

            expect(mockFrom).toHaveBeenCalledWith('notebook_chat_messages');
        });

        it('should handle errors gracefully', async () => {
            const mockFrom = jest.fn().mockReturnValue({
                delete: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({
                        data: null,
                        error: { message: 'Delete failed' },
                    }),
                }),
            });
            (supabase.from as jest.Mock) = mockFrom;

            // Should not throw
            await expect(chatService.clearChatHistory('nb-1')).resolves.not.toThrow();
        });
    });
});
