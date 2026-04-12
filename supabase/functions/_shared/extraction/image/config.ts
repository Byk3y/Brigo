/**
 * Image OCR Configuration
 * Configuration for OCR services (Gemini, Google Vision, Tesseract)
 */

import { getRequiredEnv } from '../../env.ts';

/**
 * Configuration for OCR services
 *
 * Phase B: Gemini API key and model moved to OpenRouter (openrouter.ts).
 * Model and maxTokens are now in the MODELS map ('image_ocr').
 * topP/topK dropped (not supported via OpenRouter).
 * This config retains systemPrompt, temperature, and baseConfidence.
 */
export const OCR_CONFIG = {
  gemini: {
    enabled: true,
    baseConfidence: 90,
    temperature: 0.1,
    systemPrompt:
      'Extract all text from this image. Return only the extracted text without any commentary or explanation. If there is no text, respond with "No text detected".',
  },
  googleVision: {
    enabled: true,
    apiKeyEnvVar: 'GOOGLE_VISION_API_KEY',
    baseConfidence: 85,
  },
  tesseract: {
    enabled: false, // Not compatible with Deno Edge Functions
  },
} as const;

/**
 * Get API key for Google Vision OCR (fallback service)
 */
export function getGoogleVisionApiKey(): string {
  return getRequiredEnv(OCR_CONFIG.googleVision.apiKeyEnvVar);
}
