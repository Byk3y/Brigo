import { useState, useCallback, useEffect, useRef } from 'react';
import { studioService } from '@/lib/services/studioService';
import { audioService } from '@/lib/services/audioService';
import { examPredictionService } from '@/lib/services/examPredictionService';
import type { Quiz, AudioOverview, FlashcardSet, ExamPrediction } from '@/lib/store/types';

interface UseStudioContentReturn {
    flashcard_sets: FlashcardSet[];
    quizzes: Quiz[];
    audioOverviews: AudioOverview[];
    setAudioOverviews: React.Dispatch<React.SetStateAction<AudioOverview[]>>;
    examPredictions: ExamPrediction[];
    setExamPredictions: React.Dispatch<React.SetStateAction<ExamPrediction[]>>;
    loading: boolean;
    refreshContent: () => Promise<void>;
}

export const useStudioContent = (notebookId: string): UseStudioContentReturn => {
    const [flashcard_sets, setFlashcardSets] = useState<FlashcardSet[]>([]);
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [audioOverviews, setAudioOverviews] = useState<AudioOverview[]>([]);
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

            const [studioContent, audioOverviewsData, predictionsData] = await Promise.all([
                studioService.fetchAll(notebookId),
                audioService.fetchByNotebook(notebookId),
                examPredictionService.fetchByNotebook(notebookId),
            ]);

            clearTimeout(timeoutId);

            setFlashcardSets(studioContent.flashcard_sets);
            setQuizzes(studioContent.quizzes);
            setAudioOverviews(audioOverviewsData);
            setExamPredictions(predictionsData);
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
        audioOverviews,
        setAudioOverviews,
        examPredictions,
        setExamPredictions,
        loading,
        refreshContent: fetchContent,
    };
};

