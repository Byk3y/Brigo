import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '@/lib/store';
import { useCamera } from '@/lib/hooks/useCamera';
import { useDocumentPicker } from '@/lib/hooks/useDocumentPicker';
import { useErrorHandler } from './useErrorHandler';
import { checkCanCreateContent } from '@/lib/services/subscriptionService';
import type { LimitReason } from '@/lib/services/subscriptionService';
import { useUpgrade } from '@/lib/hooks/useUpgrade';
import { enforcePdfSizeGuard } from '@/lib/pdfGuard';

const COLORS: Array<'blue' | 'green' | 'orange' | 'purple' | 'pink'> = ['blue', 'green', 'orange', 'purple', 'pink'];

const getRandomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

export const useNotebookCreation = () => {
    const router = useRouter();
    const { addNotebook, addMaterial, loadNotebooks, user, notebooks, cachedPetState, flashcardsStudied } = useStore();
    const { takePhoto } = useCamera();
    const { pickDocument } = useDocumentPicker();
    const [isAddingNotebook, setIsAddingNotebook] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [limitReason, setLimitReason] = useState<LimitReason>(null);
    const { handleError, withErrorHandling } = useErrorHandler();
    const { trackCreateAttemptBlocked, trackUpgradeModalShown, trackUpgradeModalDismissed, trackUpgradeButtonClicked } = useUpgrade();

    const navigateToNotebook = (notebookId: string) => {
        // We handle navigation in the component or return ID to component?
        // Component has specific navigation logic to prevent flash.
        // Let's keep it simple here and just route push, assuming the component logic for flashing
        // was specific to the list reloading. If we reload then navigate, we might need a small delay or
        // the list reloading logic in the component needs to be aware.
        // The original code passed `isNavigating` state to prevent reload flashes.
        // Here we just return the ID and let the component handle navigation if needed,
        // or we handle basic navigation here.
        router.push(`/notebook/${notebookId}`);
    };

    // Check if user can create content (based on subscription status)
    const checkCanCreate = useCallback(() => {
        const { tier, status, isExpired } = useStore.getState();

        // Check if user can create content with detailed reason
        const check = checkCanCreateContent(tier, status, isExpired);
        if (!check.canCreate) {
            // Track blocked attempt
            trackCreateAttemptBlocked('notebook');
            // Show upgrade modal with specific limit reason
            trackUpgradeModalShown('create_attempt');
            setLimitReason(check.reason);
            setShowUpgradeModal(true);
            return false;
        }

        return true;
    }, [trackCreateAttemptBlocked, trackUpgradeModalShown, setShowUpgradeModal]);

    const handleAudioUpload = useCallback(async () => {
        // Check if user can create content
        if (!checkCanCreate()) {
            return null;
        }

        const wrappedFn = withErrorHandling(async () => {
            const result = await pickDocument({ type: 'audio/*' });
            if (!result || result.cancelled) {
                return null;
            }
            setIsAddingNotebook(true);
            try {
                // SECURITY: Sanitize filename and enforce length limits
                const sanitizedTitle = result.name
                    .replace(/\.(mp3|wav|m4a|aac)$/i, '')
                    .substring(0, 100)
                    .trim() || 'Untitled Audio';

                // Zero-friction: auto-create notebook with audio material
                const notebookId = await addNotebook({
                    title: sanitizedTitle,
                    flashcardCount: 0,
                    progress: 0,
                    color: getRandomColor(),
                    material: {
                        type: 'audio',
                        uri: result.uri,
                        title: result.name,
                        fileUri: result.uri,
                        filename: result.name,
                        processed: false,
                        status: 'processing',
                    },
                });
                // Reload notebooks to show the new one immediately
                await loadNotebooks();
                // Trigger "Add your first study material" task
                const { checkAndAwardTask } = useStore.getState();
                if (checkAndAwardTask) {
                    checkAndAwardTask('add_material_daily');
                }
                return notebookId;
            } finally {
                setIsAddingNotebook(false);
            }
        }, {
            operation: 'upload_audio',
            component: 'notebook-creation',
            metadata: {}
        });
        return await wrappedFn();
    }, [pickDocument, addNotebook, loadNotebooks, withErrorHandling, checkCanCreate]);

    const handlePDFUpload = useCallback(async () => {
        // Check if user can create content
        if (!checkCanCreate()) {
            return null;
        }

        const wrappedFn = withErrorHandling(async () => {
            // Explicitly set PDF type (though it's the default in the hook now, being explicit is better)
            const result = await pickDocument({ type: 'application/pdf' });

            if (!result || result.cancelled) {
                return null;
            }

            // Enforce the 14 MB client-side guard. Anything larger would be
            // rejected server-side anyway (wasting bandwidth + UX) because the
            // current extraction pipeline can't handle it.
            const guardResult = await enforcePdfSizeGuard({
                uri: result.uri,
                name: result.name,
                pickerSize: result.size,
            });
            if (!guardResult.ok) return null;

            setIsAddingNotebook(true);
            try {
                // SECURITY: Sanitize filename and enforce length limits
                const sanitizedTitle = result.name
                    .replace(/\.pdf$/i, '')
                    .substring(0, 100)
                    .trim() || 'Untitled Document';

                // Zero-friction: auto-create notebook with PDF material
                const notebookId = await addNotebook({
                    title: sanitizedTitle,
                    flashcardCount: 0,
                    progress: 0,
                    color: getRandomColor(),
                    material: {
                        type: 'pdf',
                        uri: result.uri,
                        title: result.name,
                        fileUri: result.uri,
                        filename: result.name,
                        processed: false,
                        status: 'processing',
                    },
                });
                // Reload notebooks to show the new one immediately
                await loadNotebooks();
                // Trigger "Add your first study material" task
                const { checkAndAwardTask } = useStore.getState();
                if (checkAndAwardTask) {
                    checkAndAwardTask('add_material_daily');
                }
                return notebookId;
            } finally {
                setIsAddingNotebook(false);
            }
        }, {
            operation: 'upload_pdf',
            component: 'notebook-creation',
            metadata: {}
        });
        return await wrappedFn();
    }, [pickDocument, addNotebook, loadNotebooks, withErrorHandling, checkCanCreate]);

    const handlePhotoUpload = useCallback(async () => {
        // Check if user can create content
        if (!checkCanCreate()) {
            return null;
        }

        const wrappedFn = withErrorHandling(async () => {
            // Request media library permission
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Permission Required',
                    'Please enable photo library access in your device settings to select images.',
                    [{ text: 'OK' }]
                );
                return null;
            }

            // Launch image picker
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                selectionLimit: 5,
                allowsEditing: false,
                quality: 1,
                exif: false,
            });

            if (result.canceled || !result.assets || result.assets.length === 0) {
                return null;
            }

            const assets = result.assets;
            setIsAddingNotebook(true);
            try {
                // 1. Create notebook with the first image
                const firstImage = assets[0];
                const sanitizedTitle = (firstImage.fileName?.replace(/\.[^/.]+$/, '') || 'Image Notes')
                    .substring(0, 100)
                    .trim() || 'Image Notes';

                const notebookId = await addNotebook({
                    title: sanitizedTitle,
                    flashcardCount: 0,
                    progress: 0,
                    color: getRandomColor(),
                    material: {
                        type: 'image',
                        uri: firstImage.uri,
                        title: firstImage.fileName || 'Image',
                        thumbnail: firstImage.uri,
                        fileUri: firstImage.uri,
                        filename: firstImage.fileName || 'image.jpg',
                        processed: false,
                        status: 'processing',
                    },
                });

                // 2. Add remaining images to the same notebook
                if (assets.length > 1) {
                    for (let i = 1; i < assets.length; i++) {
                        const image = assets[i];
                        await addMaterial(notebookId, {
                            type: 'image',
                            uri: image.uri,
                            title: image.fileName || `Image ${i + 1}`,
                            thumbnail: image.uri,
                            fileUri: image.uri,
                            filename: image.fileName || `image-${i + 1}.jpg`,
                            processed: false,
                            status: 'processing',
                        });
                    }
                }

                // Reload notebooks to show the new one immediately
                await loadNotebooks();

                // Trigger "Add your first study material" task
                const { checkAndAwardTask } = useStore.getState();
                if (checkAndAwardTask) {
                    checkAndAwardTask('add_material_daily');
                }

                return notebookId;
            } finally {
                setIsAddingNotebook(false);
            }
        }, {
            operation: 'upload_photo',
            component: 'notebook-creation',
            metadata: {}
        });
        return await wrappedFn();
    }, [addNotebook, loadNotebooks, withErrorHandling, checkCanCreate]);

    const handleCameraUpload = useCallback(async () => {
        // Check if user can create content
        if (!checkCanCreate()) {
            return null;
        }

        const wrappedFn = withErrorHandling(async () => {
            // Use camera hook to take photo
            const result = await takePhoto();

            if (!result || result.cancelled) {
                return null;
            }

            setIsAddingNotebook(true);
            try {
                // Zero-friction: auto-create notebook with camera photo
                const notebookId = await addNotebook({
                    title: 'Camera Photo',
                    flashcardCount: 0,
                    progress: 0,
                    color: getRandomColor(),
                    material: {
                        type: 'image',
                        uri: result.uri,
                        title: 'Camera Photo',
                        thumbnail: result.uri,
                        fileUri: result.uri,
                        filename: `photo-${Date.now()}.jpg`,
                        processed: false,
                        status: 'processing',
                    },
                });
                // Reload notebooks to show the new one immediately
                await loadNotebooks();
                // Trigger "Add your first study material" task
                const { checkAndAwardTask } = useStore.getState();
                if (checkAndAwardTask) {
                    checkAndAwardTask('add_material_daily');
                }

                return notebookId;
            } finally {
                setIsAddingNotebook(false);
            }
        }, {
            operation: 'upload_camera',
            component: 'notebook-creation',
            metadata: {}
        });
        return await wrappedFn();
    }, [takePhoto, addNotebook, loadNotebooks, withErrorHandling, checkCanCreate]);

    const handleTextSave = useCallback(async (title: string, content: string, type: 'note' | 'text') => {
        // Check if user can create content
        if (!checkCanCreate()) {
            return null;
        }

        const wrappedFn = withErrorHandling(async () => {
            setIsAddingNotebook(true);
            try {
                // SECURITY: Sanitize title and enforce length limits
                const sanitizedTitle = title.substring(0, 100).trim() || 'Untitled Note';

                // Zero-friction: auto-create notebook with text/note material (processed=true, status=preview_ready)
                const notebookId = await addNotebook({
                    title: sanitizedTitle,
                    flashcardCount: 0,
                    progress: 0,
                    color: getRandomColor(),
                    material: {
                        type: type,
                        content: content,
                        title: title,
                        processed: false,
                        status: 'processing',
                    },
                });

                // Trigger "Add your first study material" task
                // We use the store via import as this hook uses useStore
                const { checkAndAwardTask } = useStore.getState();
                if (checkAndAwardTask) {
                    checkAndAwardTask('add_material_daily');
                }

                return notebookId;
            } finally {
                setIsAddingNotebook(false);
            }
        }, {
            operation: 'save_text',
            component: 'notebook-creation',
            metadata: { type }
        });
        return await wrappedFn();
    }, [addNotebook, withErrorHandling, checkCanCreate]);

    const handleYouTubeImport = useCallback(async (url: string) => {
        // Check if user can create content
        if (!checkCanCreate()) {
            return null;
        }

        const wrappedFn = withErrorHandling(async () => {
            setIsAddingNotebook(true);
            try {
                // SECURITY: Strict YouTube URL validation to prevent malicious URLs
                let cleanUrl = url.trim();

                // Validate URL is actually a YouTube URL (not youtube.com.attacker.com)
                // Matches: youtube.com/watch?v=..., youtube.com/shorts/..., youtu.be/...
                const youtubeUrlRegex = /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]{11}/;

                if (!youtubeUrlRegex.test(cleanUrl)) {
                    throw new Error('Please provide a valid YouTube URL (e.g., https://youtube.com/watch?v=...)');
                }

                // Zero-friction: auto-create notebook with youtube material
                const notebookId = await addNotebook({
                    title: 'YouTube Import', // Will be updated by Edge Function
                    flashcardCount: 0,
                    progress: 0,
                    color: getRandomColor(),
                    material: {
                        type: 'youtube' as any,
                        uri: cleanUrl,
                        title: 'YouTube Video',
                        processed: false,
                        status: 'processing',
                    },
                });

                // FAST NAVIGATION: Return ID immediately so user can navigate to notebook
                // while background processing continues. Don't wait for loadNotebooks().
                setIsAddingNotebook(false);

                // Trigger background notebook list refresh (non-blocking)
                loadNotebooks().catch(console.error);

                // Trigger "Add your first study material" task (non-blocking)
                const { checkAndAwardTask } = useStore.getState();
                if (checkAndAwardTask) {
                    checkAndAwardTask('add_material_daily');
                }

                return notebookId;
            } catch (error) {
                setIsAddingNotebook(false);
                throw error;
            }
        }, {
            operation: 'youtube_import',
            component: 'notebook-creation',
            metadata: { url }
        });
        return await wrappedFn();
    }, [addNotebook, loadNotebooks, withErrorHandling, checkCanCreate]);

    const handleWebsiteImport = useCallback(async (url: string) => {
        // Check if user can create content
        if (!checkCanCreate()) {
            return null;
        }

        const wrappedFn = withErrorHandling(async () => {
            setIsAddingNotebook(true);

            try {
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

                // Zero-friction: auto-create notebook with website material
                const notebookId = await addNotebook({
                    title: 'Website Import', // Will be updated by Edge Function
                    flashcardCount: 0,
                    progress: 0,
                    color: getRandomColor(),
                    material: {
                        type: 'website' as any,
                        uri: cleanUrl,
                        title: 'Website Article',
                        processed: false,
                        status: 'processing',
                    },
                });

                // Reload notebooks to show the new one immediately
                await loadNotebooks();

                // Trigger "Add your first study material" task
                const { checkAndAwardTask } = useStore.getState();
                if (checkAndAwardTask) {
                    checkAndAwardTask('add_material_daily');
                }

                return notebookId;
            } finally {
                setIsAddingNotebook(false);
            }
        }, {
            operation: 'website_import',
            component: 'notebook-creation',
            metadata: { url }
        });
        return await wrappedFn();
    }, [addNotebook, loadNotebooks, withErrorHandling, checkCanCreate]);

    // Calculate pet level
    const petLevel = Math.floor((cachedPetState?.points || 0) / 50) + 1;
    const petName = cachedPetState?.name || 'Sparky';

    return {
        isAddingNotebook,
        handleAudioUpload,
        handlePDFUpload,
        handlePhotoUpload,
        handleCameraUpload,
        handleTextSave,
        handleYouTubeImport,
        handleWebsiteImport,
        showUpgradeModal,
        setShowUpgradeModal,
        upgradeModalProps: {
            notebooksCount: notebooks.length,
            flashcardsStudied: flashcardsStudied,
            streakDays: user.streak || 0,
            petName,
            petLevel,
            limitReason,
        },
    };
};