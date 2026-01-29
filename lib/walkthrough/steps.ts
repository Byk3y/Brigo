import { TourStep } from 'react-native-spotlight-tour';
import {
    HomeWalkthroughTooltip,
    NotebookWalkthroughTooltip,
    StudioWalkthroughTooltip
} from './WalkthroughTooltip';
import {
    HOME_WALKTHROUGH_STEPS,
    NOTEBOOK_WALKTHROUGH_STEPS,
    STUDIO_WALKTHROUGH_STEPS
} from './constants';

/**
 * Walkthrough Steps - Defines the content for each walkthrough tour
 */

export const HOME_TOUR_STEPS: TourStep[] = Object.values(HOME_WALKTHROUGH_STEPS)
    .sort((a, b) => a.order - b.order)
    .map((_step, index) => ({
        render: HomeWalkthroughTooltip,
        placement: index < 2 ? 'top' : 'bottom', // Steps 0 & 1 are at the bottom
        // Precise shapes: Rectangle for buttons (0,1), Circle for Pet/Streak (2,3)
        shape: index < 2 ? { type: 'rectangle', padding: 8 } : { type: 'circle', padding: 8 },
    }));

// Notebook view walkthrough - shown when first notebook is opened

export const NOTEBOOK_TOUR_STEPS: TourStep[] = Object.values(NOTEBOOK_WALKTHROUGH_STEPS)
    .sort((a, b) => a.order - b.order)
    .map(() => ({
        render: NotebookWalkthroughTooltip,
        placement: 'top',
        // Rectangle shape for tab bar items
        shape: { type: 'rectangle', padding: 8 },
    }));

// Studio tab walkthrough - shown when studio tab is first opened

export const STUDIO_TOUR_STEPS: TourStep[] = Object.values(STUDIO_WALKTHROUGH_STEPS)
    .sort((a, b) => a.order - b.order)
    .map(() => ({
        render: StudioWalkthroughTooltip,
        placement: 'bottom',
        // Rectangle shape for studio options
        shape: { type: 'rectangle', padding: 12 }, // Slightly more padding for the larger option cards
    }));

