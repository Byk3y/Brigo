/**
 * Notebook Transform Utility Tests
 * Tests for the Supabase-to-model mapper functions
 */

import {
    mapSupabaseMaterialToModel,
    mapSupabaseNotebookToModel,
    mapSupabaseChatMessageToModel,
    transformNotebook,
} from '@/lib/utils/notebookTransform';

describe('notebookTransform utility', () => {
    describe('mapSupabaseMaterialToModel', () => {
        it('should map all Supabase fields to Material model fields', () => {
            const supabaseMaterial = {
                id: 'mat-1',
                user_id: 'user-1',
                notebook_id: 'nb-1',
                kind: 'pdf',
                content: 'Extracted text content',
                storage_path: 'user-1/mat-1/file.pdf',
                status: 'processed',
                processed: true,
                meta: { title: 'My Document', pages: 10 },
                created_at: '2024-01-01T00:00:00Z',
            };

            const result = mapSupabaseMaterialToModel(supabaseMaterial);

            // Mapper transforms to Material app type
            expect(result.id).toBe('mat-1');
            expect(result.type).toBe('pdf'); // kind -> type
            expect(result.content).toBe('Extracted text content');
            expect(result.uri).toBe('user-1/mat-1/file.pdf'); // storage_path -> uri
            expect(result.status).toBe('processed');
            expect(result.processed).toBe(true);
            expect(result.meta).toEqual({ title: 'My Document', pages: 10 });
            expect(result.createdAt).toBe('2024-01-01T00:00:00Z');
        });

        it('should use meta.title for title if available', () => {
            const supabaseMaterial = {
                id: 'mat-1',
                kind: 'pdf',
                meta: { title: 'Document Title' },
                created_at: '2024-01-01T00:00:00Z',
            };

            const result = mapSupabaseMaterialToModel(supabaseMaterial);

            expect(result.title).toBe('Document Title');
        });

        it('should use fallback title if meta.title is not available', () => {
            const supabaseMaterial = {
                id: 'mat-1',
                kind: 'pdf',
                meta: {},
                created_at: '2024-01-01T00:00:00Z',
            };

            const result = mapSupabaseMaterialToModel(supabaseMaterial, 'Notebook Title');

            expect(result.title).toBe('Notebook Title');
        });

        it('should handle null/undefined values for optional fields', () => {
            const supabaseMaterial = {
                id: 'mat-1',
                kind: 'text',
                content: null,
                storage_path: null,
                status: 'processing',
                processed: false,
                meta: null,
                created_at: '2024-01-01T00:00:00Z',
            };

            const result = mapSupabaseMaterialToModel(supabaseMaterial);

            expect(result.content).toBeUndefined();
            expect(result.uri).toBeUndefined();
            expect(result.meta).toBeNull();
        });

        it('should extract filename from storage_path', () => {
            const supabaseMaterial = {
                id: 'mat-1',
                kind: 'pdf',
                storage_path: 'user-1/mat-1/my_document.pdf',
                created_at: '2024-01-01T00:00:00Z',
            };

            const result = mapSupabaseMaterialToModel(supabaseMaterial);

            expect(result.filename).toBe('my_document.pdf');
        });
    });

    describe('mapSupabaseNotebookToModel', () => {
        it('should map notebook without materials', () => {
            const supabaseNotebook = {
                id: 'nb-1',
                user_id: 'user-1',
                title: 'My Notebook',
                emoji: '📚',
                status: 'ready_for_studio',
                created_at: '2024-01-01T00:00:00Z',
                flashcard_count: 10,
                progress: 50,
            };

            const result = mapSupabaseNotebookToModel(supabaseNotebook);

            expect(result.id).toBe('nb-1');
            expect(result.title).toBe('My Notebook');
            expect(result.emoji).toBe('📚');
            expect(result.status).toBe('ready_for_studio');
            expect(result.createdAt).toBe('2024-01-01T00:00:00Z');
            expect(result.flashcardCount).toBe(10);
            expect(result.progress).toBe(50);
            expect(result.materials).toEqual([]);
        });

        it('should map notebook with materials array', () => {
            const supabaseNotebook = {
                id: 'nb-1',
                title: 'My Notebook',
                status: 'processing',
                created_at: '2024-01-01T00:00:00Z',
                materials: [
                    {
                        id: 'mat-1',
                        kind: 'pdf',
                        content: null,
                        storage_path: 'path/to/file.pdf',
                        status: 'processing',
                        processed: false,
                        meta: {},
                        created_at: '2024-01-01T00:00:00Z',
                    },
                ],
            };

            const result = mapSupabaseNotebookToModel(supabaseNotebook);

            expect(result.materials).toHaveLength(1);
            expect(result.materials[0].id).toBe('mat-1');
            expect(result.materials[0].type).toBe('pdf');
            expect(result.materials[0].uri).toBe('path/to/file.pdf');
        });

        it('should handle null materials', () => {
            const supabaseNotebook = {
                id: 'nb-1',
                title: 'My Notebook',
                status: 'ready_for_upload',
                created_at: '2024-01-01T00:00:00Z',
                materials: null,
            };

            const result = mapSupabaseNotebookToModel(supabaseNotebook);

            expect(result.materials).toEqual([]);
        });

        it('should use existing materials if provided', () => {
            const supabaseNotebook = {
                id: 'nb-1',
                title: 'My Notebook',
                status: 'ready_for_studio',
                created_at: '2024-01-01T00:00:00Z',
                materials: [
                    { id: 'new-mat', kind: 'text' },
                ],
            };

            const existingMaterials = [
                {
                    id: 'existing-mat',
                    type: 'pdf' as const,
                    createdAt: '2024-01-01T00:00:00Z',
                    processed: true,
                    status: 'processed' as const,
                },
            ];

            const result = mapSupabaseNotebookToModel(supabaseNotebook, existingMaterials);

            expect(result.materials).toHaveLength(1);
            expect(result.materials[0].id).toBe('existing-mat');
        });
    });

    describe('mapSupabaseChatMessageToModel', () => {
        it('should map user message', () => {
            const supabaseMessage = {
                id: 'msg-1',
                notebook_id: 'nb-1',
                role: 'user',
                content: 'What is mitosis?',
                sources: [],
                created_at: '2024-01-01T00:00:00Z',
            };

            const result = mapSupabaseChatMessageToModel(supabaseMessage);

            expect(result.id).toBe('msg-1');
            expect(result.notebook_id).toBe('nb-1');
            expect(result.role).toBe('user');
            expect(result.content).toBe('What is mitosis?');
            expect(result.sources).toEqual([]);
            expect(result.created_at).toBe('2024-01-01T00:00:00Z');
        });

        it('should map assistant message with sources', () => {
            const supabaseMessage = {
                id: 'msg-2',
                notebook_id: 'nb-1',
                role: 'assistant',
                content: 'Mitosis is cell division...',
                sources: ['mat-1', 'mat-2'],
                created_at: '2024-01-01T00:00:00Z',
            };

            const result = mapSupabaseChatMessageToModel(supabaseMessage);

            expect(result.role).toBe('assistant');
            expect(result.sources).toEqual(['mat-1', 'mat-2']);
        });

        it('should handle null sources array', () => {
            const supabaseMessage = {
                id: 'msg-1',
                notebook_id: 'nb-1',
                role: 'user',
                content: 'Test',
                sources: null,
                created_at: '2024-01-01T00:00:00Z',
            };

            const result = mapSupabaseChatMessageToModel(supabaseMessage);

            expect(result.sources).toEqual([]);
        });
    });

    describe('transformNotebook (backward compatibility)', () => {
        it('should be an alias for mapSupabaseNotebookToModel', () => {
            const supabaseNotebook = {
                id: 'nb-1',
                title: 'Test',
                status: 'ready_for_studio',
                created_at: '2024-01-01T00:00:00Z',
            };

            const result1 = transformNotebook(supabaseNotebook);
            const result2 = mapSupabaseNotebookToModel(supabaseNotebook);

            expect(result1).toEqual(result2);
        });
    });
});
