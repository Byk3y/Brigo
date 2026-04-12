/**
 * Shared Types for Content Extraction
 * Common types used across extraction modules
 */

/**
 * OCR (Optical Character Recognition) Result
 */
export interface OCRResult {
  text: string;
  confidence: number; // 0-100
  metadata: {
    engine: 'tesseract' | 'google-vision';
    lowQuality: boolean; // true if confidence < threshold or very short text
    language: string;
    processingTime: number;
    warning?: string; // Optional warning message for very short text
  };
}

/**
 * Website Content Extraction Result
 */
export interface WebsiteExtractionResult {
  text: string;
  title: string | null;
  metadata: {
    source: 'jina-reader' | 'direct-fetch' | 'gemini';
    url: string;
    processingTime: number;
    contentLength: number;
    warning?: string;
    content_truncated?: boolean;
  };
}
