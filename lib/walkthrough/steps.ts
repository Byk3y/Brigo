import { TourStep } from 'react-native-spotlight-tour';
import {
    HomeWalkthroughTooltip,
    NotebookWalkthroughTooltip,
    StudioWalkthroughTooltip
} from './WalkthroughTooltip';

/**
 * Walkthrough Steps - Defines the content for each walkthrough tour
 */

export type WalkthroughType = 'home' | 'notebook' | 'studio';

export interface WalkthroughStep {
    order: number;
    title: string;
    text: string;
}

// Home screen walkthrough - shown when user first lands on home
export const HOME_WALKTHROUGH_STEPS: Record<string, WalkthroughStep> = {
    addMaterial: {
        order: 1,
        title: 'Start Here! 📚',
        text: 'Upload a PDF, photo, or paste text to create your first study notebook.',
    },
    camera: {
        order: 2,
        title: 'Capture Notes 📸',
        text: 'Instantly capture handwritten notes or textbook pages with your camera.',
    },
    pet: {
        order: 3,
        title: 'Meet Your Companion! 🐾',
        text: 'Tap your study buddy to see your progress, streak, and daily tasks.',
    },
    streak: {
        order: 4,
        title: 'Your Streak 🔥',
        text: 'Keep your streak alive by studying daily. Streaks unlock rewards!',
    },
};

export const HOME_TOUR_STEPS: TourStep[] = Object.values(HOME_WALKTHROUGH_STEPS)
    .sort((a, b) => a.order - b.order)
    .map((_step, index) => ({
        render: HomeWalkthroughTooltip,
        placement: index < 2 ? 'top' : 'bottom', // Steps 0 & 1 are at the bottom
        // Precise shapes: Rectangle for buttons (0,1), Circle for Pet/Streak (2,3)
        shape: index < 2 ? { type: 'rectangle', padding: 8 } : { type: 'circle', padding: 8 },
    }));

// Notebook view walkthrough - shown when first notebook is opened
export const NOTEBOOK_WALKTHROUGH_STEPS: Record<string, WalkthroughStep> = {
    sources: {
        order: 1,
        title: 'Sources 📄',
        text: 'Your uploaded materials appear here. Tap to preview any source.',
    },
    chat: {
        order: 2,
        title: 'Chat with Brigo 💬',
        text: 'Ask questions about your materials. Brigo knows everything you uploaded!',
    },
    studio: {
        order: 3,
        title: 'The Studio ✨',
        text: 'Generate flashcards, quizzes, podcasts, and exam predictions here.',
    },
};

export const NOTEBOOK_TOUR_STEPS: TourStep[] = Object.values(NOTEBOOK_WALKTHROUGH_STEPS)
    .sort((a, b) => a.order - b.order)
    .map(() => ({
        render: NotebookWalkthroughTooltip,
        placement: 'top',
        // Rectangle shape for tab bar items
        shape: { type: 'rectangle', padding: 8 },
    }));

// Studio tab walkthrough - shown when studio tab is first opened
export const STUDIO_WALKTHROUGH_STEPS: Record<string, WalkthroughStep> = {
    predict: {
        order: 1,
        title: 'Predict Questions 🔮',
        text: 'AI analyzes your materials to predict likely exam questions.',
    },
    podcast: {
        order: 2,
        title: 'Podcast 🎧',
        text: 'Generate an audio summary you can listen to anywhere.',
    },
    flashcards: {
        order: 3,
        title: 'Flashcards 🃏',
        text: 'Create flashcards to test your memory with spaced repetition.',
    },
    quiz: {
        order: 4,
        title: 'Quiz 📝',
        text: 'Practice with auto-generated quizzes based on your content.',
    },
};

export const STUDIO_TOUR_STEPS: TourStep[] = Object.values(STUDIO_WALKTHROUGH_STEPS)
    .sort((a, b) => a.order - b.order)
    .map(() => ({
        render: StudioWalkthroughTooltip,
        placement: 'bottom',
        // Rectangle shape for studio options
        shape: { type: 'rectangle', padding: 12 }, // Slightly more padding for the larger option cards
    }));

