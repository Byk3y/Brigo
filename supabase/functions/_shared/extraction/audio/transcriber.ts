/**
 * Audio Transcription Service
 * Transcribe audio to text using Gemini 2.5 Flash via OpenRouter
 *
 * Phase B: migrated from direct Gemini 2.0 Flash API to OpenRouter's
 * callLLMWithRetry. This gives automatic retry with exponential backoff
 * (1s, 2s, 4s) and fallback to Gemini 2.0 Flash if 2.5 fails.
 */

import { bufferToBase64, detectAudioMimeTypeFromUrl } from '../common/utils.ts';
import { AUDIO_CONFIG } from './config.ts';
import { callLLMWithRetry } from '../../openrouter.ts';

/**
 * Transcribe audio to text using Gemini 2.5 Flash via OpenRouter
 */
export async function transcribeAudio(audioUrl: string): Promise<string> {
  console.log('[transcribeAudio] START - Fetching audio from:', audioUrl);
  const startTime = Date.now();

  try {
    // Step 1: Fetch audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
    }
    const audioBuffer = new Uint8Array(await audioResponse.arrayBuffer());
    console.log('[transcribeAudio] Downloaded buffer size:', audioBuffer.length);

    // SECURITY: Validate file magic bytes to ensure it's actually audio
    const { validateFileMagicBytes } = await import('../../validation.ts');
    const fileValidation = validateFileMagicBytes(audioBuffer, 'audio');
    if (!fileValidation.isValid) {
      console.error(
        '[transcribeAudio] SECURITY: File magic byte validation failed:',
        fileValidation.error
      );
      throw new Error(fileValidation.error || 'Invalid audio file');
    }
    console.log(
      '[transcribeAudio] File magic bytes validated - confirmed audio:',
      fileValidation.detectedType
    );

    // Step 2: Convert to base64 using shared utility
    const base64Audio = bufferToBase64(audioBuffer);

    // Step 3: Detect MIME type from URL extension
    const mimeType = detectAudioMimeTypeFromUrl(audioUrl);

    // Step 4: Call Gemini 2.5 Flash via OpenRouter (with retry + fallback)
    console.log('[transcribeAudio] Requesting transcription via OpenRouter...');
    const result = await callLLMWithRetry(
      'audio_transcription',
      AUDIO_CONFIG.gemini.systemPrompt,
      'Transcribe this audio recording.',
      {
        temperature: AUDIO_CONFIG.gemini.temperature,
        attachments: [{ type: 'input_audio', mediaType: mimeType, data: base64Audio }],
      }
    );

    const text = result.content;

    if (!text || text.trim() === '') {
      throw new Error('LLM returned an empty transcription');
    }

    const duration = Date.now() - startTime;
    console.log(`[transcribeAudio] SUCCESS: Transcribed in ${duration}ms (model: ${result.model})`);

    return text.trim();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[transcribeAudio] ERROR:', message);
    throw new Error(`Audio transcription error: ${message}`);
  }
}
