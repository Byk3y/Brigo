import { useState, useCallback, useEffect, useRef } from 'react';
import { studioService } from '@/lib/services/studioService';
import { podcastService } from '@/lib/services/podcastService';
import { examPredictionService } from '@/lib/services/examPredictionService';
import type { Quiz, Podcast, FlashcardSet, ExamPrediction } from '@/lib/store/types';

interface UseStudioContentReturn {
    flashcard_sets: FlashcardSet[];
    quizzes: Quiz[];
    podcasts: Podcast[];
    setPodcasts: React.Dispatch<React.SetStateAction<Podcast[]>>;
    examPredictions: ExamPrediction[];
    setExamPredictions: React.Dispatch<React.SetStateAction<ExamPrediction[]>>;
    loading: boolean;
    refreshContent: () => Promise<void>;
}

export const useStudioContent = (notebookId: string): UseStudioContentReturn => {
    const [flashcard_sets, setFlashcardSets] = useState<FlashcardSet[]>([]);
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [podcasts, setPodcasts] = useState<Podcast[]>([]);
    const [examPredictions, setExamPredictions] = useState<ExamPrediction[]>([]);
    const [loading, setLoading] = useState(true);
    const inFlightRef = useRef<AbortController | null>(null);

    const fetchContent = useCallback(async () => {
        // Abort any previous request to avoid hangs after backgrounding
        if (inFlightRef.current) {
            inFlightRef.current.abort();
        }

        const controller = new AbortController();
        inFlightRef.current = controller;

        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        try {
            setLoading(true);

            // Safety timeout so we never stay stuck loading
            timeoutId = setTimeout(() => controller.abort(), 10000);

            // allSettled so a failure in one fetch doesn't wipe the others'
            // state. A transient network blip on any single fetch used to
            // clear the entire Generated media list — no more.
            const [studioResult, podcastsResult, predictionsResult] = await Promise.allSettled([
                studioService.fetchAll(notebookId),
                podcastService.fetchByNotebook(notebookId),
                examPredictionService.fetchByNotebook(notebookId),
            ]);

            clearTimeout(timeoutId);

            if (studioResult.status === 'fulfilled') {
                setFlashcardSets(studioResult.value.flashcard_sets);
                setQuizzes(studioResult.value.quizzes);
            }
            if (podcastsResult.status === 'fulfilled') {
                setPodcasts(podcastsResult.value);
            }
            if (predictionsResult.status === 'fulfilled') {
                setExamPredictions(predictionsResult.value);
            }
        } catch (error) {
            // Ignore intentional aborts (timeout or new fetch)
            const isAbort =
                controller.signal.aborted ||
                (error instanceof DOMException && error.name === 'AbortError');
            if (isAbort) {
                return;
            }
            console.error('Error fetching studio content:', error);
        } finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            if (inFlightRef.current === controller) {
                inFlightRef.current = null;
            }
            setLoading(false);
        }
    }, [notebookId]);

    // Initial fetch
    useEffect(() => {
        fetchContent();
    }, [fetchContent]);

    return {
        flashcard_sets,
        quizzes,
        podcasts,
        setPodcasts,
        examPredictions,
        setExamPredictions,
        loading,
        refreshContent: fetchContent,
    };
};

