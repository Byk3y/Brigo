/**
 * Image OCR Service Implementations
 * Gemini (via OpenRouter) and Google Vision OCR services
 *
 * Phase B: GeminiOCRService migrated from direct Gemini 2.0 Flash API
 * to OpenRouter callLLMWithRetry for automatic retry + fallback.
 */

import type { OCRResult, OCRService } from './types.ts';
import { bufferToBase64, detectImageMimeType } from '../common/utils.ts';
import { OCR_CONFIG, getGoogleVisionApiKey } from './config.ts';
import { callLLMWithRetry } from '../../openrouter.ts';

/**
 * Gemini OCR Service - Multimodal AI text extraction
 * Uses Gemini 2.5 Flash via OpenRouter for high-quality text extraction
 * Same capability as PDF extraction — handles handwriting, watermarks, complex layouts
 */
export class GeminiOCRService implements OCRService {
  name: 'google-vision' = 'google-vision'; // Keep 'google-vision' for backward compatibility

  isAvailable(): boolean {
    // OpenRouter key is checked at call time by callLLMWithRetry
    return true;
  }

  async ocr(fileBuffer: Uint8Array, confidenceThreshold: number): Promise<OCRResult> {
    const startTime = Date.now();

    try {
      // Convert buffer to base64 using shared utility
      const base64Image = bufferToBase64(fileBuffer);

      // Detect MIME type from buffer magic bytes
      const mimeType = detectImageMimeType(fileBuffer);

      // Call Gemini 2.5 Flash via OpenRouter (with retry + fallback)
      const result = await callLLMWithRetry(
        'image_ocr',
        OCR_CONFIG.gemini.systemPrompt,
        'Extract all text from this image.',
        {
          temperature: OCR_CONFIG.gemini.temperature,
          attachments: [{ type: 'image_url', imageUrl: `data:${mimeType};base64,${base64Image}` }],
        }
      );

      const text = result.content;

      if (!text || text.trim() === '' || text.includes('No text detected')) {
        throw new Error('No text detected in image');
      }

      const processingTime = Date.now() - startTime;

      // Estimate confidence based on text length and processing success
      let confidence: number = OCR_CONFIG.gemini.baseConfidence;
      if (text.length < 50) {
        confidence = 75;
      } else if (text.length < 100) {
        confidence = 85;
      }

      return {
        text: text.trim(),
        confidence,
        metadata: {
          engine: 'google-vision', // Keep same engine type for compatibility
          lowQuality: confidence < confidenceThreshold,
          language: 'eng',
          processingTime,
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Gemini OCR error: ${message}`);
    }
  }
}

/**
 * Google Vision OCR Service (fallback option)
 * Premium OCR for handwritten notes and low-quality photos
 */
export class GoogleVisionOCRService implements OCRService {
  name: 'google-vision' = 'google-vision';

  isAvailable(): boolean {
    try {
      getGoogleVisionApiKey();
      return true;
    } catch {
      return false;
    }
  }

  async ocr(fileBuffer: Uint8Array, confidenceThreshold: number): Promise<OCRResult> {
    const apiKey = getGoogleVisionApiKey();
    const startTime = Date.now();

    try {
      // Convert buffer to base64 using shared utility
      const base64Image = bufferToBase64(fileBuffer);

      // Call Google Vision API
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [
              {
                image: { content: base64Image },
                features: [{ type: 'TEXT_DETECTION' }],
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Google Vision API error: ${response.status}`);
      }

      const data = await response.json();
      const textAnnotations = data.responses?.[0]?.textAnnotations;

      if (!textAnnotations || textAnnotations.length === 0) {
        throw new Error('No text detected in image');
      }

      // First annotation contains full text
      const text = textAnnotations[0].description;
      const processingTime = Date.now() - startTime;

      // Google Vision doesn't provide confidence per image, estimate from detection
      const confidence = OCR_CONFIG.googleVision.baseConfidence;

      return {
        text: text.trim(),
        confidence,
        metadata: {
          engine: 'google-vision',
          lowQuality: confidence < confidenceThreshold,
          language: 'eng',
          processingTime,
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Google Vision OCR error: ${message}`);
    }
  }
}
