import { useState, useRef, useEffect, useCallback } from 'react';
import { Alert, AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { podcastService } from '@/lib/services/podcastService';
import { examPredictionService } from '@/lib/services/examPredictionService';
import { useStore } from '@/lib/store';
import { useErrorHandler } from './useErrorHandler';

export const usePodcastGeneration = (
    notebookId: string,
    notebookName: string,
    onGenerationComplete: () => void
) => {
    const router = useRouter();
    const { checkAndAwardTask, notify } = useStore();
    const { handleError } = useErrorHandler();
    const [generatingType, setGeneratingType] = useState<'flashcards' | 'quiz' | 'audio' | 'prediction' | null>(null);
    const [generatingPodcastId, setGeneratingPodcastId] = useState<string | null>(null);
    const [podcastProgress, setPodcastProgress] = useState({ stage: '', percent: 0 });
    const [showPodcastNotification, setShowPodcastNotification] = useState(false);
    const [completedPodcastId, setCompletedPodcastId] = useState<string | null>(null);

    const pollIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
    const [activeJobs, setActiveJobs] = useState<Set<string>>(new Set());

    const stopPolling = useCallback((id?: string) => {
        if (id) {
            const interval = pollIntervalsRef.current.get(id);
            if (interval) {
                clearInterval(interval);
                pollIntervalsRef.current.delete(id);
            }
            setActiveJobs(prev => {
                const updated = new Set(prev);
                updated.delete(id);

                // Update generating type based on remaining jobs
                const hasPodcast = Array.from(updated).some(jid => jid.startsWith('podcast_'));
                const hasPred = Array.from(updated).some(jid => jid.startsWith('pred_'));

                if (hasPodcast) setGeneratingType('audio');
                else if (hasPred) setGeneratingType('prediction');
                else setGeneratingType(null);

                return updated;
            });
        } else {
            // Stop all
            pollIntervalsRef.current.forEach(interval => clearInterval(interval));
            pollIntervalsRef.current.clear();
            setActiveJobs(new Set());
            setGeneratingType(null);
        }
    }, []);

    // Helper to check if any job of a certain type is running
    const isJobTypeRunning = useCallback((type: 'podcast' | 'prediction') => {
        return Array.from(activeJobs).some(id =>
            type === 'podcast' ? id.startsWith('podcast_') : id.startsWith('pred_')
        );
    }, [activeJobs]);

    // sync generatingType with activeJobs (Addition only, cleanup is handled in stopPolling)
    useEffect(() => {
        if (activeJobs.size === 0) return;

        const hasPodcast = isJobTypeRunning('podcast');
        const hasPred = isJobTypeRunning('prediction');

        if (hasPodcast) setGeneratingType('audio');
        else if (hasPred) setGeneratingType('prediction');
    }, [activeJobs, isJobTypeRunning]);

    const startPodcastPolling = useCallback((overviewId: string) => {
        const jobId = `podcast_${overviewId}`;
        if (pollIntervalsRef.current.has(jobId)) return;

        setActiveJobs(prev => new Set(prev).add(jobId));

        const interval = setInterval(async () => {
            try {
                const status = await podcastService.getStatus(overviewId);

                if (status.status === 'completed') {
                    stopPolling(jobId);
                    setGeneratingPodcastId(null);
                    setCompletedPodcastId(overviewId);
                    setShowPodcastNotification(true);

                    // Global notification
                    notify({
                        type: 'audio',
                        title: 'Podcast Ready!',
                        message: `${notebookName} is ready to play`,
                        data: { overviewId, notebookId }
                    });

                    // Trigger "Generate first podcast" task
                    if (checkAndAwardTask) {
                        checkAndAwardTask('generate_audio_overview');
                    }

                    onGenerationComplete();
                } else if (status.status === 'failed') {
                    stopPolling(jobId);
                    setGeneratingPodcastId(null);

                    // Show error via centralized system
                    const error = new Error(status.error_message || 'Failed to generate podcast');
                    await handleError(error, {
                        operation: 'podcast_generation_failed',
                        component: 'podcast-generation',
                        metadata: { overviewId, status: status.status }
                    });
                } else {
                    // Update progress
                    const stageText = {
                        'pending': 'Starting...',
                        'generating_script': 'Writing podcast script...',
                        'generating_audio': 'Creating audio...',
                    }[status.status] || 'Processing...';

                    setPodcastProgress({
                        stage: stageText,
                        percent: status.progress || 0,
                    });
                }
            } catch (error: any) {
                // Ignore network errors from app backgrounding - generation continues on server
                const isNetworkError = error?.message?.includes('Network request failed') ||
                    error?.message?.includes('network') ||
                    error?.name === 'AbortError';

                if (isNetworkError) {
                    return; // Transient network error, will retry on next poll
                }

                // Use centralized error handling
                await handleError(error, {
                    operation: 'poll_podcast_status',
                    component: 'podcast-generation',
                    metadata: { overviewId, notebookId }
                });

                stopPolling(jobId);
                setGeneratingPodcastId(null);
            }
        }, 2000); // Poll every 2 seconds

        pollIntervalsRef.current.set(jobId, interval);
    }, [router, onGenerationComplete, stopPolling, checkAndAwardTask, notebookName, notebookId, notify, handleError]);

    const startPredictionPolling = useCallback((predictionId: string) => {
        const jobId = `pred_${predictionId}`;
        if (pollIntervalsRef.current.has(jobId)) return;

        setActiveJobs(prev => new Set(prev).add(jobId));

        const interval = setInterval(async () => {
            try {
                const status = await examPredictionService.getStatus(predictionId);

                if (status.status === 'completed') {
                    stopPolling(jobId);

                    // Global notification with specific title if available
                    notify({
                        type: 'prediction',
                        title: status.title || 'Predictions Ready!',
                        message: `Your new predictions for ${notebookName} are ready`,
                        data: { predictionId, notebookId }
                    });

                    onGenerationComplete();
                } else if (status.status === 'failed') {
                    stopPolling(jobId);

                    // Show error via centralized system
                    const error = new Error(status.error_message || 'Failed to generate exam predictions');
                    await handleError(error, {
                        operation: 'prediction_generation_failed',
                        component: 'prediction-generation',
                        metadata: { predictionId, status: status.status }
                    });
                }
                // 'processing' stays in interval
            } catch (error: any) {
                // Ignore network errors from app backgrounding
                const isNetworkError = error?.message?.includes('Network request failed') ||
                    error?.message?.includes('network') ||
                    error?.name === 'AbortError';

                if (isNetworkError) {
                    return;
                }

                await handleError(error, {
                    operation: 'poll_prediction_status',
                    component: 'prediction-generation',
                    metadata: { predictionId, notebookId }
                });

                stopPolling(jobId);
            }
        }, 3000); // Poll every 3 seconds

        pollIntervalsRef.current.set(jobId, interval);
    }, [onGenerationComplete, stopPolling, notebookName, notebookId, notify, handleError]);

    const checkForPendingPodcast = useCallback(async () => {
        try {
            // Check for pending/generating podcast first
            const pendingAudio = await podcastService.findPending(notebookId);

            if (pendingAudio) {
                setGeneratingPodcastId(pendingAudio.id);
                startPodcastPolling(pendingAudio.id);
            } else {
                // Recovery: Check for completed podcasts that might have missed task award
                const { data: { user } } = await supabase.auth.getUser();
                if (user && checkAndAwardTask) {
                    const hasCompleted = await podcastService.hasCompleted(user.id);

                    if (hasCompleted) {
                        await checkAndAwardTask('generate_audio_overview', true);
                    }
                }
            }
        } catch (error) {
            // Non-critical
        }
    }, [notebookId, startPodcastPolling, checkAndAwardTask]);

    const checkForPendingPrediction = useCallback(async () => {
        try {
            const pending = await examPredictionService.findPending(notebookId);
            if (pending) {
                startPredictionPolling(pending.id);
            }
        } catch (error) {
            // Ignore
        }
    }, [notebookId, startPredictionPolling]);

    // Restart polling when app comes to foreground (if we have a pending podcast or prediction)
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active' && pollIntervalsRef.current.size === 0) {
                if (generatingPodcastId) {
                    startPodcastPolling(generatingPodcastId);
                } else if (generatingType === 'prediction') {
                    checkForPendingPodcast();
                    checkForPendingPrediction();
                }
            }
        });

        return () => {
            subscription.remove();
        };
    }, [generatingPodcastId, generatingType, startPodcastPolling, checkForPendingPodcast, checkForPendingPrediction]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopPolling();
        };
    }, [stopPolling]);

    const dismissNotification = useCallback(() => {
        setShowPodcastNotification(false);
        setCompletedPodcastId(null);
    }, []);

    const handleListenNow = useCallback(() => {
        setShowPodcastNotification(false);
        setCompletedPodcastId(null);
    }, []);

    return {
        generatingType,
        setGeneratingType,
        generatingAudioId: generatingPodcastId,
        setGeneratingAudioId: setGeneratingPodcastId,
        audioProgress: podcastProgress,
        setAudioProgress: setPodcastProgress,
        startAudioPolling: startPodcastPolling,
        startPredictionPolling,
        checkForPendingAudio: checkForPendingPodcast,
        checkForPendingPrediction,
        // Notification state
        showAudioNotification: showPodcastNotification,
        completedAudioId: completedPodcastId,
        notebookName,
        dismissNotification,
        handleListenNow,
    };
};
