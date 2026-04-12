import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '@/lib/store';
import { useCamera } from '@/lib/hooks/useCamera';
import { useDocumentPicker } from '@/lib/hooks/useDocumentPicker';
import { useErrorHandler } from './useErrorHandler';
import { checkCanCreateContent } from '@/lib/services/subscriptionService';
import type { LimitReason } from '@/lib/services/subscriptionService';
import { useUpgrade } from '@/lib/hooks/useUpgrade';
import { enforcePdfSizeGuard } from '@/lib/pdfGuard';
import { enforceAudioSizeGuard, enforceImageSizeGuard } from '@/lib/mediaGuard';

export const useMaterialAddition = (notebookId: string) => {
    const { addMaterial, loadNotebooks, user, notebooks, cachedPetState, flashcardsStudied } = useStore();
    const { takePhoto } = useCamera();
    const { pickDocument } = useDocumentPicker();
    const [isAddingMaterial, setIsAddingMaterial] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [limitReason, setLimitReason] = useState<LimitReason>(null);
    const { handleError, withErrorHandling } = useErrorHandler();
    const { trackCreateAttemptBlocked, trackUpgradeModalShown } = useUpgrade();

    // Check if user can add content (based on subscription status)
    // For now reusing notebook creation logic as per MVP rules
    const checkCanAdd = useCallback(() => {
        const { tier, status, isExpired } = useStore.getState();
        const check = checkCanCreateContent(tier, status, isExpired);
        if (!check.canCreate) {
            trackCreateAttemptBlocked('material');
            trackUpgradeModalShown('create_attempt');
            setLimitReason(check.reason);
            setShowUpgradeModal(true);
            return false;
        }
        return true;
    }, [trackCreateAttemptBlocked, trackUpgradeModalShown]);

    const handleAudioUpload = useCallback(async () => {
        if (!checkCanAdd()) return null;

        const wrapped = withErrorHandling(async () => {
            const result = await pickDocument({ type: 'audio/*' });
            if (!result || result.cancelled) return null;

            // Enforce 100 MB client-side guard for audio files
            const guardResult = await enforceAudioSizeGuard({
                uri: result.uri,
                name: result.name,
                pickerSize: result.size,
            });
            if (!guardResult.ok) return null;

            setIsAddingMaterial(true);
            try {
                await addMaterial(notebookId, {
                    type: 'audio',
                    uri: result.uri,
                    title: result.name,
                    fileUri: result.uri,
                    filename: result.name,
                    processed: false,
                    status: 'processing',
                });
                return true;
            } finally {
                setIsAddingMaterial(false);
            }
        }, { operation: 'add_audio' });
        return await wrapped();
    }, [checkCanAdd, pickDocument, addMaterial, notebookId, withErrorHandling]);

    const handlePDFUpload = useCallback(async () => {
        if (!checkCanAdd()) return null;

        const wrapped = withErrorHandling(async () => {
            const result = await pickDocument({ type: 'application/pdf' });
            if (!result || result.cancelled) return null;

            // Enforce the 14 MB client-side guard (shared with useNotebookCreation
            // so both "create new notebook from PDF" and "add PDF to existing
            // notebook" paths use the same logic and limit).
            const guardResult = await enforcePdfSizeGuard({
                uri: result.uri,
                name: result.name,
                pickerSize: result.size,
            });
            if (!guardResult.ok) return null;

            setIsAddingMaterial(true);
            try {
                await addMaterial(notebookId, {
                    type: 'pdf',
                    uri: result.uri,
                    title: result.name,
                    fileUri: result.uri,
                    filename: result.name,
                    processed: false,
                    status: 'processing',
                });
                return true;
            } finally {
                setIsAddingMaterial(false);
            }
        }, { operation: 'add_pdf' });
        return await wrapped();
    }, [checkCanAdd, pickDocument, addMaterial, notebookId, withErrorHandling]);

    const handlePhotoUpload = useCallback(async () => {
        if (!checkCanAdd()) return null;

        const wrapped = withErrorHandling(async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please enable photo library access.');
                return null;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                selectionLimit: 5,
                quality: 1,
            });

            if (result.canceled || !result.assets || result.assets.length === 0) return null;

            // Enforce 20 MB client-side guard on each selected image
            for (const asset of result.assets) {
                const imgGuard = await enforceImageSizeGuard({
                    uri: asset.uri,
                    name: asset.fileName ?? undefined,
                    fileSize: asset.fileSize ?? undefined,
                });
                if (!imgGuard.ok) return null;
            }

            setIsAddingMaterial(true);
            try {
                for (const asset of result.assets) {
                    await addMaterial(notebookId, {
                        type: 'image',
                        uri: asset.uri,
                        title: asset.fileName || 'Image Notes',
                        fileUri: asset.uri,
                        filename: asset.fileName || 'image.jpg',
                        processed: false,
                        status: 'processing',
                    });
                }
                return true;
            } finally {
                setIsAddingMaterial(false);
            }
        }, { operation: 'add_photo' });
        return await wrapped();
    }, [checkCanAdd, addMaterial, notebookId, withErrorHandling]);

    const handleCameraUpload = useCallback(async () => {
        if (!checkCanAdd()) return null;

        const wrapped = withErrorHandling(async () => {
            const result = await takePhoto();
            if (!result || result.cancelled) return null;

            setIsAddingMaterial(true);
            try {
                await addMaterial(notebookId, {
                    type: 'image',
                    uri: result.uri,
                    title: 'Camera Photo',
                    fileUri: result.uri,
                    filename: `photo-${Date.now()}.jpg`,
                    processed: false,
                    status: 'processing',
                });
                return true;
            } finally {
                setIsAddingMaterial(false);
            }
        }, { operation: 'add_camera' });
        return await wrapped();
    }, [checkCanAdd, takePhoto, addMaterial, notebookId, withErrorHandling]);

    const handleTextSave = useCallback(async (title: string, content: string, type: 'note' | 'text') => {
        if (!checkCanAdd()) return null;

        const wrapped = withErrorHandling(async () => {
            setIsAddingMaterial(true);
            try {
                await addMaterial(notebookId, {
                    type: type,
                    content: content,
                    title: title,
                    processed: false,
                    status: 'processing',
                });
                return true;
            } finally {
                setIsAddingMaterial(false);
            }
        }, { operation: 'add_text' });
        return await wrapped();
    }, [checkCanAdd, addMaterial, notebookId, withErrorHandling]);

    const handleYouTubeImport = useCallback(async (url: string) => {
        if (!checkCanAdd()) return null;

        const wrapped = withErrorHandling(async () => {
            let cleanUrl = url.trim();
            if (!cleanUrl.includes('youtube.com') && !cleanUrl.includes('youtu.be')) {
                throw new Error('Invalid YouTube URL');
            }

            setIsAddingMaterial(true);
            try {
                await addMaterial(notebookId, {
                    type: 'youtube',
                    uri: cleanUrl,
                    title: 'YouTube Import',
                    processed: false,
                    status: 'processing',
                });
                return true;
            } finally {
                setIsAddingMaterial(false);
            }
        }, { operation: 'add_youtube' });
        return await wrapped();
    }, [checkCanAdd, addMaterial, notebookId, withErrorHandling]);

    const handleWebsiteImport = useCallback(async (url: string) => {
        if (!checkCanAdd()) return null;

        const wrapped = withErrorHandling(async () => {
            // SECURITY: Comprehensive URL validation
            let cleanUrl = url.trim();

            // Ensure URL has a protocol
            if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
                cleanUrl = 'https://' + cleanUrl;
            }

            // Validate URL format
            let parsedUrl: URL;
            try {
                parsedUrl = new URL(cleanUrl);
            } catch {
                throw new Error('Please provide a valid website URL');
            }

            // SECURITY: Block dangerous protocols
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                throw new Error('Only HTTP and HTTPS URLs are supported');
            }

            // SECURITY: Block localhost and local network
            const hostname = parsedUrl.hostname.toLowerCase();
            if (hostname === 'localhost' ||
                hostname === '127.0.0.1' ||
                hostname === '0.0.0.0' ||
                hostname.endsWith('.local') ||
                hostname.endsWith('.localhost')) {
                throw new Error('Local network URLs are not supported');
            }

            // SECURITY: Block private IP addresses
            const ipPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
            const ipMatch = hostname.match(ipPattern);
            if (ipMatch) {
                const [, a, b] = ipMatch.map(Number);
                if (a === 10 || a === 127 || a === 0 ||
                    (a === 172 && b >= 16 && b <= 31) ||
                    (a === 192 && b === 168) ||
                    (a === 169 && b === 254)) {
                    throw new Error('Private network URLs are not supported');
                }
            }

            setIsAddingMaterial(true);
            try {
                await addMaterial(notebookId, {
                    type: 'website',
                    uri: cleanUrl,
                    title: 'Website Article',
                    processed: false,
                    status: 'processing',
                });
                return true;
            } finally {
                setIsAddingMaterial(false);
            }
        }, { operation: 'add_website' });
        return await wrapped();
    }, [checkCanAdd, addMaterial, notebookId, withErrorHandling]);

    const handleRetryMaterial = useCallback(async (materialId: string) => {
        const { materialService } = await import('@/lib/services/materialService');
        const wrapped = withErrorHandling(async () => {
            setIsAddingMaterial(true);
            try {
                await materialService.retryProcessing(notebookId, materialId);
                // Refresh notebooks to get the new status
                await loadNotebooks();
                return true;
            } finally {
                setIsAddingMaterial(false);
            }
        }, { operation: 'retry_material' });
        return await wrapped();
    }, [notebookId, loadNotebooks, withErrorHandling]);

    return {
        isAddingMaterial,
        handleAudioUpload,
        handlePDFUpload,
        handlePhotoUpload,
        handleCameraUpload,
        handleTextSave,
        handleYouTubeImport,
        handleWebsiteImport,
        handleRetryMaterial,
        showUpgradeModal,
        setShowUpgradeModal,
        limitReason,
    };
};
