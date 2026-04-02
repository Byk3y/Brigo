/**
 * Tests for useMaterialAddition hook
 * Covers all material addition types, subscription gating, and error paths
 */

import { renderHook, act } from '@testing-library/react-native';

// Mock expo-image-picker before import
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

import * as ImagePicker from 'expo-image-picker';

// --- Mocks ---

const mockAddMaterial = jest.fn(() => Promise.resolve());
const mockLoadNotebooks = jest.fn(() => Promise.resolve());
const mockTrackCreateAttemptBlocked = jest.fn();
const mockTrackUpgradeModalShown = jest.fn();
const mockPickDocument = jest.fn();
const mockTakePhoto = jest.fn();

// Default: premium active user
let mockStoreState = {
  tier: 'premium' as const,
  status: 'active' as const,
  isExpired: false,
};

jest.mock('@/lib/store', () => ({
  useStore: Object.assign(
    () => ({
      addMaterial: mockAddMaterial,
      loadNotebooks: mockLoadNotebooks,
      user: { id: 'user-1' },
      notebooks: [],
      cachedPetState: null,
      flashcardsStudied: 0,
    }),
    { getState: () => mockStoreState }
  ),
}));

jest.mock('@/lib/hooks/useCamera', () => ({
  useCamera: () => ({ takePhoto: mockTakePhoto }),
}));

jest.mock('@/lib/hooks/useDocumentPicker', () => ({
  useDocumentPicker: () => ({ pickDocument: mockPickDocument }),
}));

jest.mock('@/lib/hooks/useErrorHandler', () => ({
  useErrorHandler: () => ({
    handleError: jest.fn(),
    // Mirror real behavior: swallow errors and return null
    withErrorHandling: (fn: Function, _ctx: any) => async (...args: any[]) => {
      try {
        return await fn(...args);
      } catch {
        return null;
      }
    },
  }),
}));

jest.mock('@/lib/hooks/useUpgrade', () => ({
  useUpgrade: () => ({
    trackCreateAttemptBlocked: mockTrackCreateAttemptBlocked,
    trackUpgradeModalShown: mockTrackUpgradeModalShown,
  }),
}));

jest.mock('@/lib/services/materialService', () => ({
  materialService: {
    retryProcessing: jest.fn(() => Promise.resolve({ success: true })),
  },
}));

const { Alert } = require('react-native');

import { useMaterialAddition } from '@/lib/hooks/useMaterialAddition';

describe('useMaterialAddition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreState = { tier: 'premium', status: 'active', isExpired: false };
  });

  // --- A. Subscription gate ---

  describe('subscription gate', () => {
    it('should block when user is not subscribed', async () => {
      mockStoreState = { tier: 'free' as any, status: null as any, isExpired: false };
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      await act(async () => {
        await result.current.handleTextSave('Title', 'Content', 'text');
      });

      expect(mockAddMaterial).not.toHaveBeenCalled();
      expect(result.current.showUpgradeModal).toBe(true);
      expect(mockTrackCreateAttemptBlocked).toHaveBeenCalledWith('material');
      expect(mockTrackUpgradeModalShown).toHaveBeenCalledWith('create_attempt');
    });

    it('should block when subscription is expired', async () => {
      mockStoreState = { tier: 'premium', status: 'expired' as any, isExpired: true };
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      await act(async () => {
        await result.current.handleTextSave('Title', 'Content', 'text');
      });

      expect(mockAddMaterial).not.toHaveBeenCalled();
      expect(result.current.showUpgradeModal).toBe(true);
    });

    it('should allow when premium and active', async () => {
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      await act(async () => {
        await result.current.handleTextSave('Title', 'Content', 'text');
      });

      expect(mockAddMaterial).toHaveBeenCalled();
      expect(result.current.showUpgradeModal).toBe(false);
    });
  });

  // --- B. handlePDFUpload ---

  describe('handlePDFUpload', () => {
    it('should upload PDF on happy path', async () => {
      mockPickDocument.mockResolvedValue({
        uri: 'file:///docs/notes.pdf',
        name: 'notes.pdf',
        type: 'application/pdf',
        size: 1024,
        cancelled: false,
      });
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      await act(async () => {
        await result.current.handlePDFUpload();
      });

      expect(mockPickDocument).toHaveBeenCalledWith({ type: 'application/pdf' });
      expect(mockAddMaterial).toHaveBeenCalledWith('nb-1', expect.objectContaining({
        type: 'pdf',
        uri: 'file:///docs/notes.pdf',
        filename: 'notes.pdf',
      }));
    });

    it('should return null when cancelled', async () => {
      mockPickDocument.mockResolvedValue({ cancelled: true });
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.handlePDFUpload();
      });

      expect(returnValue).toBeNull();
      expect(mockAddMaterial).not.toHaveBeenCalled();
    });

    it('should return null when picker returns null', async () => {
      mockPickDocument.mockResolvedValue(null);
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.handlePDFUpload();
      });

      expect(returnValue).toBeNull();
      expect(mockAddMaterial).not.toHaveBeenCalled();
    });
  });

  // --- C. handleAudioUpload ---

  describe('handleAudioUpload', () => {
    it('should upload audio on happy path', async () => {
      mockPickDocument.mockResolvedValue({
        uri: 'file:///audio/lecture.mp3',
        name: 'lecture.mp3',
        type: 'audio/mpeg',
        size: 5000,
        cancelled: false,
      });
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      await act(async () => {
        await result.current.handleAudioUpload();
      });

      expect(mockPickDocument).toHaveBeenCalledWith({ type: 'audio/*' });
      expect(mockAddMaterial).toHaveBeenCalledWith('nb-1', expect.objectContaining({
        type: 'audio',
        uri: 'file:///audio/lecture.mp3',
        filename: 'lecture.mp3',
      }));
    });

    it('should return null when cancelled', async () => {
      mockPickDocument.mockResolvedValue({ cancelled: true });
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.handleAudioUpload();
      });

      expect(returnValue).toBeNull();
      expect(mockAddMaterial).not.toHaveBeenCalled();
    });
  });

  // --- D. handlePhotoUpload ---

  describe('handlePhotoUpload', () => {
    it('should upload a single image', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///img/photo1.jpg', fileName: 'photo1.jpg' }],
      });
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      await act(async () => {
        await result.current.handlePhotoUpload();
      });

      expect(mockAddMaterial).toHaveBeenCalledTimes(1);
      expect(mockAddMaterial).toHaveBeenCalledWith('nb-1', expect.objectContaining({
        type: 'image',
        uri: 'file:///img/photo1.jpg',
        filename: 'photo1.jpg',
      }));
    });

    it('should upload multiple images', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [
          { uri: 'file:///img/a.jpg', fileName: 'a.jpg' },
          { uri: 'file:///img/b.jpg', fileName: 'b.jpg' },
          { uri: 'file:///img/c.jpg', fileName: 'c.jpg' },
        ],
      });
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      await act(async () => {
        await result.current.handlePhotoUpload();
      });

      expect(mockAddMaterial).toHaveBeenCalledTimes(3);
    });

    it('should show alert when permission denied', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      await act(async () => {
        await result.current.handlePhotoUpload();
      });

      expect(Alert.alert).toHaveBeenCalledWith('Permission Required', expect.any(String));
      expect(mockAddMaterial).not.toHaveBeenCalled();
    });

    it('should return null when picker cancelled', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: true,
        assets: [],
      });
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.handlePhotoUpload();
      });

      expect(returnValue).toBeNull();
      expect(mockAddMaterial).not.toHaveBeenCalled();
    });
  });

  // --- E. handleCameraUpload ---

  describe('handleCameraUpload', () => {
    it('should upload camera photo on happy path', async () => {
      mockTakePhoto.mockResolvedValue({
        uri: 'file:///camera/snap.jpg',
        width: 1920,
        height: 1080,
        cancelled: false,
      });
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      await act(async () => {
        await result.current.handleCameraUpload();
      });

      expect(mockAddMaterial).toHaveBeenCalledWith('nb-1', expect.objectContaining({
        type: 'image',
        uri: 'file:///camera/snap.jpg',
        title: 'Camera Photo',
      }));
    });

    it('should return null when cancelled', async () => {
      mockTakePhoto.mockResolvedValue({ cancelled: true });
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.handleCameraUpload();
      });

      expect(returnValue).toBeNull();
      expect(mockAddMaterial).not.toHaveBeenCalled();
    });
  });

  // --- F. handleTextSave ---

  describe('handleTextSave', () => {
    it('should save text material', async () => {
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      await act(async () => {
        await result.current.handleTextSave('My Notes', 'Some content here', 'text');
      });

      expect(mockAddMaterial).toHaveBeenCalledWith('nb-1', expect.objectContaining({
        type: 'text',
        content: 'Some content here',
        title: 'My Notes',
      }));
    });

    it('should save note material', async () => {
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      await act(async () => {
        await result.current.handleTextSave('Quick Note', 'Note body', 'note');
      });

      expect(mockAddMaterial).toHaveBeenCalledWith('nb-1', expect.objectContaining({
        type: 'note',
        content: 'Note body',
        title: 'Quick Note',
      }));
    });
  });

  // --- G. handleYouTubeImport ---

  describe('handleYouTubeImport', () => {
    it('should import valid youtube.com URL', async () => {
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      await act(async () => {
        await result.current.handleYouTubeImport('https://www.youtube.com/watch?v=abc123');
      });

      expect(mockAddMaterial).toHaveBeenCalledWith('nb-1', expect.objectContaining({
        type: 'youtube',
        uri: 'https://www.youtube.com/watch?v=abc123',
      }));
    });

    it('should import valid youtu.be URL', async () => {
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      await act(async () => {
        await result.current.handleYouTubeImport('https://youtu.be/abc123');
      });

      expect(mockAddMaterial).toHaveBeenCalledWith('nb-1', expect.objectContaining({
        type: 'youtube',
        uri: 'https://youtu.be/abc123',
      }));
    });

    it('should reject non-YouTube URLs', async () => {
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      await act(async () => {
        await result.current.handleYouTubeImport('https://vimeo.com/12345');
      });

      expect(mockAddMaterial).not.toHaveBeenCalled();
    });
  });

  // --- H. handleWebsiteImport ---

  describe('handleWebsiteImport', () => {
    it('should import valid https URL', async () => {
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      await act(async () => {
        await result.current.handleWebsiteImport('https://example.com/article');
      });

      expect(mockAddMaterial).toHaveBeenCalledWith('nb-1', expect.objectContaining({
        type: 'website',
        uri: 'https://example.com/article',
      }));
    });

    it('should prepend https:// when protocol missing', async () => {
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      await act(async () => {
        await result.current.handleWebsiteImport('example.com/page');
      });

      expect(mockAddMaterial).toHaveBeenCalledWith('nb-1', expect.objectContaining({
        uri: 'https://example.com/page',
      }));
    });

    it('should block localhost', async () => {
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      await act(async () => {
        await result.current.handleWebsiteImport('http://localhost:3000');
      });

      expect(mockAddMaterial).not.toHaveBeenCalled();
    });

    it('should block 127.0.0.1', async () => {
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      await act(async () => {
        await result.current.handleWebsiteImport('http://127.0.0.1:8080');
      });

      expect(mockAddMaterial).not.toHaveBeenCalled();
    });

    it('should block private IP 192.168.x.x', async () => {
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      await act(async () => {
        await result.current.handleWebsiteImport('http://192.168.1.1');
      });

      expect(mockAddMaterial).not.toHaveBeenCalled();
    });

    it('should block private IP 10.x.x.x', async () => {
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      await act(async () => {
        await result.current.handleWebsiteImport('http://10.0.0.1');
      });

      expect(mockAddMaterial).not.toHaveBeenCalled();
    });

    it('should block private IP 172.16.x.x', async () => {
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      await act(async () => {
        await result.current.handleWebsiteImport('http://172.16.0.1');
      });

      expect(mockAddMaterial).not.toHaveBeenCalled();
    });

    it('should block .local domains', async () => {
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      await act(async () => {
        await result.current.handleWebsiteImport('http://myapp.local');
      });

      expect(mockAddMaterial).not.toHaveBeenCalled();
    });

    it('should block 0.0.0.0', async () => {
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      await act(async () => {
        await result.current.handleWebsiteImport('http://0.0.0.0');
      });

      expect(mockAddMaterial).not.toHaveBeenCalled();
    });

    it('should block link-local 169.254.x.x', async () => {
      const { result } = renderHook(() => useMaterialAddition('nb-1'));

      await act(async () => {
        await result.current.handleWebsiteImport('http://169.254.1.1');
      });

      expect(mockAddMaterial).not.toHaveBeenCalled();
    });
  });

  // --- I. handleRetryMaterial ---

  describe('handleRetryMaterial', () => {
    // handleRetryMaterial uses dynamic import() which requires --experimental-vm-modules
    // The retry logic is tested at the service level in materialService.test.ts
    it.skip('should retry processing and reload notebooks (requires dynamic import support)', () => {});
  });
});
