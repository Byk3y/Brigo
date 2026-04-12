/**
 * Audio Transcription Configuration
 * Configuration for audio-to-text services (Gemini)
 */

/**
 * Configuration for audio transcription services
 *
 * Phase B: API key management moved to OpenRouter (openrouter.ts).
 * Model and maxTokens are now in the MODELS map ('audio_transcription').
 * This config retains systemPrompt and temperature for the transcriber.
 */
export const AUDIO_CONFIG = {
  gemini: {
    enabled: true,
    temperature: 0.1,
    systemPrompt:
      'You are an expert academic transcriptionist. Provide a precise and cleanly formatted transcription of this audio. Break it into logical paragraphs. Include speaker labels (Speaker A, Speaker B, etc.) if there are multiple people. Return only the transcript text without any commentary.',
  },
} as const;
