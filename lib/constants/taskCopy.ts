export type TaskKind = 'daily' | 'foundational' | 'confetti-only' | 'silent';

export interface TaskCopy {
    title: string;
    kind: TaskKind;
}

export const TASK_COPY: Record<string, TaskCopy> = {
    quiz_5_questions:        { title: 'Answered 5 quiz questions',  kind: 'daily' },
    study_flashcards:        { title: 'Studied 5 flashcards',       kind: 'daily' },
    chat_with_notebook:      { title: 'Chatted with your notebook', kind: 'daily' },
    add_material_daily:      { title: 'Added new study material',   kind: 'daily' },
    study_night_owl:         { title: 'Evening study session',      kind: 'daily' },

    podcast_3_min:           { title: 'Listened to a podcast',      kind: 'silent' },
    study_early_bird:        { title: 'Early-bird bonus',           kind: 'silent' },
    secure_pet:              { title: 'Pet secured',                kind: 'silent' },

    quiz_perfect_score:      { title: 'Aced a quiz',                kind: 'confetti-only' },

    name_pet:                { title: 'Named your pet',                kind: 'foundational' },
    create_notebook:         { title: 'Created your first notebook',   kind: 'foundational' },
    first_notebook_chat:     { title: 'Tried your first AI chat',      kind: 'foundational' },
    generate_flashcards:     { title: 'Made your first flashcard set', kind: 'foundational' },
    generate_quiz:           { title: 'Made your first quiz',          kind: 'foundational' },
    generate_audio_overview: { title: 'Generated your first podcast',  kind: 'foundational' },
    audio_feedback_given:    { title: 'Rated your first podcast',      kind: 'foundational' },
};
