/**
 * Content Extraction Utilities - Barrel Export
 *
 * This file re-exports extraction functions for image OCR, audio
 * transcription, website scraping, and URL security validation. Each
 * implementation lives in extraction/<domain>/.
 *
 * PDF extraction was removed in Phase 2. PDFs now go through
 * `material-processing/pdf-processor.ts` directly (which uses Gemini 2.5
 * Flash via OpenRouter to do extraction + classification + preview in one
 * call). The old SmartPDFExtractor/GeminiService/PdfjsService chain was
 * deleted — `process-material/index.ts` dispatches PDF materials to
 * `PdfProcessor` and everything else to `ContentExtractor`.
 */

// ========================================
// Image OCR
// ========================================

export { extractImageText } from './extraction/image/orchestrator.ts';
export type { OCRResult } from './extraction/common/types.ts';

// ========================================
// Audio Transcription
// ========================================

export { transcribeAudio } from './extraction/audio/transcriber.ts';

// ========================================
// Website Content Extraction
// ========================================

export { extractWebsiteContent } from './extraction/website/orchestrator.ts';
export type { WebsiteExtractionResult } from './extraction/common/types.ts';

// ========================================
// Security Validation
// ========================================

export { validateUrlSecurity } from './extraction/security/url-validator.ts';
export type { UrlValidationResult } from './extraction/security/types.ts';
