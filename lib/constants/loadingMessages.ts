/**
 * Playful, concise loading messages for generation stages
 */

export const LOADING_MESSAGES = {
    flashcards: [
        'Synthesizing...',
        'Summarizing...',
        'Shuffling...',
        'Organizing...',
        'Indexing...',
        'Refining...',
        'Drafting...',
        'Finalizing...'
    ],
    quiz: [
        'Analyzing...',
        'Questioning...',
        'Extracting...',
        'Evaluating...',
        'Validating...',
        'Brainstorming...',
        'Curating...',
        'Polishing...'
    ],
    podcast: [
        'Scripting...',
        'Synthesizing...',
        'Recording...',
        'Vocalizing...',
        'Translating...',
        'Directing...',
        'Mixing...',
        'Reviewing...'
    ],
    general: [
        'Thinking...',
        'Generating...',
        'Processing...',
        'Working...',
        'Nearly there...',
        'Reviewing...',
        'Improving...',
        'Refining...'
    ],
    prediction: [
        'Analyzing patterns...',
        'Scanning topics...',
        'Detecting trends...',
        'Predicting questions...',
        'Generating answers...',
        'Calculating confidence...',
        'Ranking likelihood...',
        'Finalizing report...'
    ]
} as const;
