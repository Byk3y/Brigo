/**
 * Walkthrough Constants - Shared data for walkthroughs to avoid circular dependencies
 */

export type WalkthroughType = 'home' | 'notebook' | 'studio';

export interface WalkthroughStep {
    order: number;
    title: string;
    text: string;
}

// Home screen walkthrough
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

// Notebook view walkthrough
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

// Studio tab walkthrough
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
