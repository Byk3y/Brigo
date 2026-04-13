/**
 * Tests for notebookSlice
 */

import { create } from 'zustand';
import { createNotebookSlice, type NotebookSlice } from '@/lib/store/slices/notebookSlice';
import type { StudioJobsSlice } from '@/lib/store/slices/studioJobsSlice';
import { supabase } from '@/lib/supabase';
import { notebookService } from '@/lib/services/notebookService';
import type { Notebook, Material, SupabaseUser } from '@/lib/store/types';

const makeStudioJobsStub = (): StudioJobsSlice => ({
  activeStudioJobs: {},
  addStudioJob: jest.fn(),
  removeStudioJob: jest.fn(),
  hydrateStudioJobs: jest.fn(),
  clearStudioJobs: jest.fn(),
  loadPendingStudioJobs: jest.fn().mockResolvedValue(undefined),
});

// Mock dependencies
jest.mock('@/lib/supabase');
jest.mock('@/lib/services/notebookService');
jest.mock('@/lib/utils', () => ({
  getFilenameFromPath: jest.fn((path) => path?.split('/').pop()),
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockNotebookService = notebookService as jest.Mocked<typeof notebookService>;

describe('notebookSlice', () => {
  let useNotebookStore: ReturnType<typeof create<NotebookSlice & { authUser: SupabaseUser | null; setAuthUser: (user: SupabaseUser | null) => void }>>;
  const mockUser: SupabaseUser = {
    id: 'user-123',
    email: 'test@example.com',
    created_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    confirmation_sent_at: null,
    recovery_sent_at: null,
    email_change_sent_at: null,
    new_email: null,
    invited_at: null,
    action_link: null,
    phone: null,
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    role: 'authenticated',
    updated_at: new Date().toISOString(),
  };

  const mockNotebook: Notebook = {
    id: 'notebook-1',
    title: 'Test Notebook',
    flashcardCount: 10,
    progress: 50,
    createdAt: new Date().toISOString(),
    status: 'ready_for_studio',
    materials: [
      {
        id: 'material-1',
        type: 'pdf',
        uri: 'https://example.com/file.pdf',
        filename: 'file.pdf',
        createdAt: new Date().toISOString(),
      },
    ],
  };

  beforeEach(() => {
    // Create store with required dependencies
    useNotebookStore = create<NotebookSlice & StudioJobsSlice & { authUser: SupabaseUser | null; setAuthUser: (user: SupabaseUser | null) => void }>()((...a) => ({
      ...createNotebookSlice(...a),
      ...makeStudioJobsStub(),
      authUser: mockUser,
      setAuthUser: jest.fn(),
    }));

    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have empty notebooks array initially', () => {
      const state = useNotebookStore.getState();
      expect(state.notebooks).toEqual([]);
    });

    it('should have null syncedAt initially', () => {
      const state = useNotebookStore.getState();
      expect(state.notebooksSyncedAt).toBeNull();
    });

    it('should have null userId initially', () => {
      const state = useNotebookStore.getState();
      expect(state.notebooksUserId).toBeNull();
    });
  });

  describe('setNotebooks', () => {
    it('should set notebooks array', () => {
      const notebooks = [mockNotebook];
      useNotebookStore.getState().setNotebooks(notebooks);

      expect(useNotebookStore.getState().notebooks).toEqual(notebooks);
    });

    it('should replace existing notebooks', () => {
      const notebooks1 = [mockNotebook];
      const notebooks2 = [{ ...mockNotebook, id: 'notebook-2', title: 'Second Notebook' }];

      useNotebookStore.getState().setNotebooks(notebooks1);
      useNotebookStore.getState().setNotebooks(notebooks2);

      expect(useNotebookStore.getState().notebooks).toEqual(notebooks2);
      expect(useNotebookStore.getState().notebooks.length).toBe(1);
    });
  });

  describe('loadNotebooks', () => {
    it('should load notebooks from service', async () => {
      const mockNotebooks = [mockNotebook];
      mockNotebookService.fetchNotebooks.mockResolvedValue(mockNotebooks);

      await useNotebookStore.getState().loadNotebooks(mockUser.id);

      expect(mockNotebookService.fetchNotebooks).toHaveBeenCalledWith(mockUser.id);
      expect(useNotebookStore.getState().notebooks).toEqual(mockNotebooks);
      expect(useNotebookStore.getState().notebooksSyncedAt).not.toBeNull();
      expect(useNotebookStore.getState().notebooksUserId).toBe(mockUser.id);
    });

    it('should use authUser if userId not provided', async () => {
      const mockNotebooks = [mockNotebook];
      mockNotebookService.fetchNotebooks.mockResolvedValue(mockNotebooks);

      await useNotebookStore.getState().loadNotebooks();

      expect(mockNotebookService.fetchNotebooks).toHaveBeenCalledWith(mockUser.id);
    });

    it('should set empty array if no userId available', async () => {
      // Create store without authUser
      const storeWithoutAuth = create<NotebookSlice & StudioJobsSlice & { authUser: SupabaseUser | null; setAuthUser: (user: SupabaseUser | null) => void }>()((...a) => ({
        ...createNotebookSlice(...a),
        ...makeStudioJobsStub(),
        authUser: null,
        setAuthUser: jest.fn(),
      }));

      await storeWithoutAuth.getState().loadNotebooks();

      expect(storeWithoutAuth.getState().notebooks).toEqual([]);
      expect(mockNotebookService.fetchNotebooks).not.toHaveBeenCalled();
    });

    it('should handle errors and retry', async () => {
      const error = new Error('Network error');
      mockNotebookService.fetchNotebooks
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue([mockNotebook]);

      await useNotebookStore.getState().loadNotebooks(mockUser.id);

      // Should retry and eventually succeed
      expect(mockNotebookService.fetchNotebooks).toHaveBeenCalledTimes(3);
      expect(useNotebookStore.getState().notebooks).toEqual([mockNotebook]);
    });

    it('should set empty array after max retries', async () => {
      const error = new Error('Network error');
      mockNotebookService.fetchNotebooks.mockRejectedValue(error);

      await expect(
        useNotebookStore.getState().loadNotebooks(mockUser.id)
      ).rejects.toThrow();

      expect(mockNotebookService.fetchNotebooks).toHaveBeenCalledTimes(3);
      expect(useNotebookStore.getState().notebooks).toEqual([]);
    });
  });

  describe('addMaterial', () => {
    it('should add material to notebook', () => {
      useNotebookStore.getState().setNotebooks([mockNotebook]);

      const newMaterial: Omit<Material, 'id' | 'createdAt'> = {
        type: 'text',
        content: 'New material content',
      };

      useNotebookStore.getState().addMaterial(mockNotebook.id, newMaterial);

      const updatedNotebook = useNotebookStore.getState().notebooks.find(n => n.id === mockNotebook.id);
      expect(updatedNotebook?.materials.length).toBe(2);
      expect(updatedNotebook?.materials[1].content).toBe('New material content');
      expect(updatedNotebook?.materials[1].id).toContain('material-');
    });

    it('should not add material to non-existent notebook', () => {
      useNotebookStore.getState().setNotebooks([mockNotebook]);

      const newMaterial: Omit<Material, 'id' | 'createdAt'> = {
        type: 'text',
        content: 'New material',
      };

      useNotebookStore.getState().addMaterial('non-existent', newMaterial);

      const notebook = useNotebookStore.getState().notebooks.find(n => n.id === mockNotebook.id);
      expect(notebook?.materials.length).toBe(1);
    });
  });

  describe('deleteMaterial', () => {
    it('should delete material from notebook', () => {
      useNotebookStore.getState().setNotebooks([mockNotebook]);

      useNotebookStore.getState().deleteMaterial(mockNotebook.id, 'material-1');

      const updatedNotebook = useNotebookStore.getState().notebooks.find(n => n.id === mockNotebook.id);
      expect(updatedNotebook?.materials.length).toBe(0);
    });

    it('should not delete material from non-existent notebook', () => {
      useNotebookStore.getState().setNotebooks([mockNotebook]);

      useNotebookStore.getState().deleteMaterial('non-existent', 'material-1');

      const notebook = useNotebookStore.getState().notebooks.find(n => n.id === mockNotebook.id);
      expect(notebook?.materials.length).toBe(1);
    });
  });

  describe('deleteNotebook', () => {
    it('should delete notebook from store', async () => {
      useNotebookStore.getState().setNotebooks([mockNotebook]);
      mockNotebookService.deleteNotebook.mockResolvedValue(undefined);

      await useNotebookStore.getState().deleteNotebook(mockNotebook.id);

      expect(mockNotebookService.deleteNotebook).toHaveBeenCalledWith(mockUser.id, mockNotebook.id);
      expect(useNotebookStore.getState().notebooks).toEqual([]);
    });

    it('should not delete if no authUser', async () => {
      const storeWithoutAuth = create<NotebookSlice & StudioJobsSlice & { authUser: SupabaseUser | null; setAuthUser: (user: SupabaseUser | null) => void }>()((...a) => ({
        ...createNotebookSlice(...a),
        ...makeStudioJobsStub(),
        authUser: null,
        setAuthUser: jest.fn(),
      }));

      storeWithoutAuth.getState().setNotebooks([mockNotebook]);

      await storeWithoutAuth.getState().deleteNotebook(mockNotebook.id);

      expect(mockNotebookService.deleteNotebook).not.toHaveBeenCalled();
      expect(storeWithoutAuth.getState().notebooks.length).toBe(1);
    });
  });

  describe('updateNotebook', () => {
    it('should update notebook in store', async () => {
      useNotebookStore.getState().setNotebooks([mockNotebook]);
      mockNotebookService.updateNotebook.mockResolvedValue(undefined);

      const updates = { title: 'Updated Title', progress: 75 };
      await useNotebookStore.getState().updateNotebook(mockNotebook.id, updates);

      expect(mockNotebookService.updateNotebook).toHaveBeenCalledWith(mockUser.id, mockNotebook.id, updates);
      const updatedNotebook = useNotebookStore.getState().notebooks.find(n => n.id === mockNotebook.id);
      expect(updatedNotebook?.title).toBe('Updated Title');
      expect(updatedNotebook?.progress).toBe(75);
    });

    it('should not update if no authUser', async () => {
      const storeWithoutAuth = create<NotebookSlice & StudioJobsSlice & { authUser: SupabaseUser | null; setAuthUser: (user: SupabaseUser | null) => void }>()((...a) => ({
        ...createNotebookSlice(...a),
        ...makeStudioJobsStub(),
        authUser: null,
        setAuthUser: jest.fn(),
      }));

      storeWithoutAuth.getState().setNotebooks([mockNotebook]);

      await storeWithoutAuth.getState().updateNotebook(mockNotebook.id, { title: 'Updated' });

      expect(mockNotebookService.updateNotebook).not.toHaveBeenCalled();
      expect(storeWithoutAuth.getState().notebooks[0].title).toBe('Test Notebook');
    });
  });
});










