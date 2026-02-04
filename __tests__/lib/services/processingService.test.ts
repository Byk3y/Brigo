/**
 * Processing Service Tests
 * Tests for edge function triggering and background processing orchestration
 */

import { processingService } from '@/lib/services/processingService';
import { supabase } from '@/lib/supabase';

// Mock storage service
jest.mock('@/lib/storage/storageService', () => ({
    storageService: {
        uploadMaterialFile: jest.fn(() =>
            Promise.resolve({
                storagePath: 'user-1/mat-1/test.pdf',
                error: null,
            })
        ),
    },
}));

// Mock materialService
jest.mock('@/lib/services/materialService', () => ({
    materialService: {
        updateMaterialStatus: jest.fn(() => Promise.resolve()),
    },
}));

describe('processingService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('triggerProcessing', () => {
        it('should invoke edge function for URL material', async () => {
            (supabase.functions.invoke as jest.Mock).mockResolvedValue({
                data: { success: true },
                error: null,
            });

            const result = await processingService.triggerProcessing(
                'nb-1',
                'mat-1',
                false // not a file upload
            );

            expect(supabase.functions.invoke).toHaveBeenCalledWith('process-material', {
                body: { material_id: 'mat-1' },
            });
            expect(result.status).toBe('success');
        });

        it('should invoke edge function for file upload with storage path', async () => {
            (supabase.functions.invoke as jest.Mock).mockResolvedValue({
                data: { success: true },
                error: null,
            });

            const result = await processingService.triggerProcessing(
                'nb-1',
                'mat-1',
                true, // is file upload
                'user-1/mat-1/file.pdf'
            );

            // Note: The triggerProcessing function passes only material_id in the body
            // Storage path is not included in the edge function call
            expect(supabase.functions.invoke).toHaveBeenCalledWith('process-material', {
                body: {
                    material_id: 'mat-1',
                },
            });
            expect(result.status).toBe('success');
        });

        it('should handle edge function errors', async () => {
            (supabase.functions.invoke as jest.Mock).mockResolvedValue({
                data: null,
                error: { message: 'Processing failed' },
            });

            const mockFrom = jest.fn().mockReturnValue({
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
            });
            (supabase.from as jest.Mock) = mockFrom;

            const result = await processingService.triggerProcessing(
                'nb-1',
                'mat-1',
                false
            );

            expect(result.status).toBe('failed');
            // Error is returned as the original error object
            expect(result.error).toEqual({ message: 'Processing failed' });
        });

        it('should handle timeout scenario', async () => {
            // Skip fake timers for this test as Promise.race doesn't work well with them
            jest.useRealTimers();

            // Mock the invoke to reject with timeout error immediately
            (supabase.functions.invoke as jest.Mock).mockRejectedValue(
                new Error('Edge Function request timed out after 180s')
            );

            const mockFrom = jest.fn().mockReturnValue({
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
            });
            (supabase.from as jest.Mock) = mockFrom;

            const result = await processingService.triggerProcessing(
                'nb-1',
                'mat-1',
                false
            );

            expect(result.status).toBe('failed');
            expect(result.error.message).toContain('timed out');

            // Restore fake timers for other tests
            jest.useFakeTimers();
        });
    });

    describe('performBackgroundUploadAndProcessing', () => {
        it('should skip upload for text/URL materials', async () => {
            const { storageService } = require('@/lib/storage/storageService');
            (supabase.functions.invoke as jest.Mock).mockResolvedValue({
                data: { success: true },
                error: null,
            });

            const result = await processingService.performBackgroundUploadAndProcessing(
                'user-1',
                'nb-1',
                'mat-1',
                false // not a file upload
            );

            expect(storageService.uploadMaterialFile).not.toHaveBeenCalled();
            expect(result.status).toBe('success');
        });

        it('should upload file and trigger processing for file materials', async () => {
            const { storageService } = require('@/lib/storage/storageService');
            (supabase.functions.invoke as jest.Mock).mockResolvedValue({
                data: { success: true },
                error: null,
            });

            const result = await processingService.performBackgroundUploadAndProcessing(
                'user-1',
                'nb-1',
                'mat-1',
                true, // is file upload
                'file:///path/to/file.pdf',
                'file.pdf',
                'user-1/mat-1/file.pdf'
            );

            expect(storageService.uploadMaterialFile).toHaveBeenCalledWith(
                'user-1',
                'mat-1',
                'file:///path/to/file.pdf',
                'file.pdf'
            );
            expect(result.status).toBe('success');
        });

        it('should handle upload failure', async () => {
            const { storageService } = require('@/lib/storage/storageService');
            storageService.uploadMaterialFile.mockResolvedValueOnce({
                storagePath: null,
                error: 'Upload failed: Network error',
            });

            const mockFrom = jest.fn().mockReturnValue({
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
            });
            (supabase.from as jest.Mock) = mockFrom;

            const result = await processingService.performBackgroundUploadAndProcessing(
                'user-1',
                'nb-1',
                'mat-1',
                true,
                'file:///path/to/file.pdf',
                'file.pdf',
                'user-1/mat-1/file.pdf'
            );

            expect(result.status).toBe('failed');
            expect(result.error).toContain('Upload failed');
        });

        it('should handle edge function failure after successful upload', async () => {
            const { storageService } = require('@/lib/storage/storageService');
            storageService.uploadMaterialFile.mockResolvedValueOnce({
                storagePath: 'user-1/mat-1/file.pdf',
                error: null,
            });

            (supabase.functions.invoke as jest.Mock).mockResolvedValue({
                data: null,
                error: { message: 'Processing failed' },
            });

            const mockFrom = jest.fn().mockReturnValue({
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
            });
            (supabase.from as jest.Mock) = mockFrom;

            const result = await processingService.performBackgroundUploadAndProcessing(
                'user-1',
                'nb-1',
                'mat-1',
                true,
                'file:///path/to/file.pdf',
                'file.pdf',
                'user-1/mat-1/file.pdf'
            );

            expect(result.status).toBe('failed');
        });
    });
});
