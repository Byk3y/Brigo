/**
 * Material Service Tests
 * Tests for material CRUD operations
 */

import { materialService } from '@/lib/services/materialService';
import { supabase } from '@/lib/supabase';

// Mock storage service
jest.mock('@/lib/storage/storageService', () => ({
    storageService: {
        sanitizeFilename: jest.fn((filename: string) => filename.replace(/[^a-zA-Z0-9.-]/g, '_')),
        deleteFile: jest.fn(() => Promise.resolve()),
    },
}));

describe('materialService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('addMaterialToNotebook', () => {
        it('should create a text material with content', async () => {
            const mockMaterial = {
                id: 'mat-1',
                user_id: 'user-1',
                notebook_id: 'nb-1',
                kind: 'text',
                content: 'Test content',
                storage_path: null,
                status: 'processing',
                processed: false,
                meta: { title: 'Test Material' },
                created_at: '2024-01-01T00:00:00Z',
            };

            const mockFrom = jest.fn().mockReturnValue({
                insert: jest.fn().mockReturnValue({
                    select: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: mockMaterial,
                            error: null,
                        }),
                    }),
                }),
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
            });
            (supabase.from as jest.Mock) = mockFrom;

            const result = await materialService.addMaterialToNotebook('user-1', 'nb-1', {
                type: 'text',
                content: 'Test content',
                title: 'Test Material',
            } as any);

            expect(result.newMaterial).toBeDefined();
            expect(result.newMaterial.kind).toBe('text');
            expect(result.isFileUpload).toBe(false);
        });

        it('should create a file material with storage path', async () => {
            const mockMaterial = {
                id: 'mat-2',
                user_id: 'user-1',
                notebook_id: 'nb-1',
                kind: 'pdf',
                storage_path: 'user-1/mat-2/test.pdf',
                status: 'processing',
                processed: false,
                meta: { title: 'Document', filename: 'test.pdf' },
                created_at: '2024-01-01T00:00:00Z',
            };

            const mockFrom = jest.fn().mockReturnValue({
                insert: jest.fn().mockReturnValue({
                    select: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: mockMaterial,
                            error: null,
                        }),
                    }),
                }),
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
            });
            (supabase.from as jest.Mock) = mockFrom;

            const result = await materialService.addMaterialToNotebook('user-1', 'nb-1', {
                type: 'pdf',
                fileUri: 'file:///path/to/test.pdf',
                filename: 'test.pdf',
                title: 'Document',
            } as any);

            expect(result.newMaterial).toBeDefined();
            expect(result.isFileUpload).toBe(true);
            expect(result.storagePath).toContain('test.pdf');
            expect(result.fileUri).toBe('file:///path/to/test.pdf');
        });

        it('should throw error on database failure', async () => {
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

            await expect(
                materialService.addMaterialToNotebook('user-1', 'nb-1', {
                    type: 'text',
                    content: 'Test',
                } as any)
            ).rejects.toThrow();
        });
    });

    describe('retryProcessing', () => {
        it('should trigger processing and return success', async () => {
            const mockFrom = jest.fn().mockReturnValue({
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
            });
            (supabase.from as jest.Mock) = mockFrom;
            (supabase.functions.invoke as jest.Mock).mockResolvedValue({
                data: { success: true },
                error: null,
            });

            const result = await materialService.retryProcessing('nb-1', 'mat-1');

            expect(result.success).toBe(true);
            expect(supabase.functions.invoke).toHaveBeenCalledWith('process-material', {
                body: { material_id: 'mat-1' },
            });
        });

        it('should handle edge function errors and check actual status', async () => {
            const mockFrom = jest.fn().mockReturnValue({
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { status: 'processing', processed: false, content: null },
                            error: null,
                        }),
                    }),
                }),
            });
            (supabase.from as jest.Mock) = mockFrom;
            (supabase.functions.invoke as jest.Mock).mockResolvedValue({
                data: null,
                error: { message: 'Function error' },
            });

            const result = await materialService.retryProcessing('nb-1', 'mat-1');

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should recognize successful processing despite error response', async () => {
            const mockFrom = jest.fn().mockImplementation((table: string) => {
                if (table === 'materials') {
                    return {
                        update: jest.fn().mockReturnValue({
                            eq: jest.fn().mockResolvedValue({ data: null, error: null }),
                        }),
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                single: jest.fn().mockResolvedValue({
                                    data: { status: 'processed', processed: true, content: 'Extracted content' },
                                    error: null,
                                }),
                            }),
                        }),
                    };
                }
                return {
                    update: jest.fn().mockReturnValue({
                        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
                    }),
                };
            });
            (supabase.from as jest.Mock) = mockFrom;
            (supabase.functions.invoke as jest.Mock).mockRejectedValue(new Error('Network error'));

            const result = await materialService.retryProcessing('nb-1', 'mat-1');

            // Should recognize the material was actually processed
            expect(result.success).toBe(true);
        });
    });

    describe('updateMaterialStatus', () => {
        it('should update material status', async () => {
            const mockFrom = jest.fn().mockReturnValue({
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
            });
            (supabase.from as jest.Mock) = mockFrom;

            await materialService.updateMaterialStatus('mat-1', 'processed');

            expect(mockFrom).toHaveBeenCalledWith('materials');
        });

        it('should handle errors gracefully', async () => {
            const mockFrom = jest.fn().mockReturnValue({
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({
                        data: null,
                        error: { message: 'Update failed' },
                    }),
                }),
            });
            (supabase.from as jest.Mock) = mockFrom;

            // Should not throw
            await expect(
                materialService.updateMaterialStatus('mat-1', 'failed')
            ).resolves.not.toThrow();
        });
    });

    describe('deleteMaterial', () => {
        it('should delete material from database', async () => {
            const mockFrom = jest.fn().mockReturnValue({
                delete: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
            });
            (supabase.from as jest.Mock) = mockFrom;

            await materialService.deleteMaterial('mat-1');

            expect(mockFrom).toHaveBeenCalledWith('materials');
        });

        it('should attempt to delete storage file if path provided', async () => {
            const { storageService } = require('@/lib/storage/storageService');
            const mockFrom = jest.fn().mockReturnValue({
                delete: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
            });
            (supabase.from as jest.Mock) = mockFrom;

            await materialService.deleteMaterial('mat-1', 'user-1/mat-1/file.pdf');

            expect(storageService.deleteFile).toHaveBeenCalledWith('user-1/mat-1/file.pdf');
        });
    });
});
