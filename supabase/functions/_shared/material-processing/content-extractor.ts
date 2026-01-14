/**
 * Content Extractor
 * Extracts content from various material types (PDF, image, audio, website, YouTube, text)
 */

import { extractPDF, extractImageText, transcribeAudio, extractWebsiteContent } from '../extraction.ts';
import type { Material, ContentExtractionResult } from './types.ts';

/**
 * Supabase client type (loose typing for compatibility)
 */
type SupabaseClient = any;

/**
 * ContentExtractor class
 * Handles content extraction for different material types
 */
export class ContentExtractor {
  constructor(private supabase: SupabaseClient) { }

  /**
   * Extract content based on material type
   *
   * @param material - The material object to extract content from
   * @returns Extracted text and optional metadata
   */
  async extract(material: Material): Promise<ContentExtractionResult> {
    const { kind, storage_path, external_url, content } = material;

    // If content already exists (text/note), return it
    if (content && (kind === 'text' || kind === 'note' || kind === 'copied-text')) {
      return { text: content };
    }

    // Route to appropriate extractor based on material kind
    switch (kind) {
      case 'pdf':
        return await this.extractPDF(material);
      case 'image':
      case 'photo':
        return await this.extractImage(material);
      case 'audio':
        return await this.extractAudio(material);
      case 'website':
        return await this.extractWebsite(material);
      case 'youtube':
        return await this.extractYouTube(material);
      default:
        throw new Error(`Unsupported material kind: ${kind}`);
    }
  }

  /**
   * Extract content from PDF
   */
  private async extractPDF(material: Material): Promise<ContentExtractionResult> {
    // Download PDF from storage
    const { data: fileData, error } = await this.supabase.storage
      .from('uploads')
      .download(material.storage_path);

    if (error || !fileData) {
      throw new Error(`Failed to download PDF: ${error?.message || 'Unknown error'}`);
    }

    const fileBuffer = new Uint8Array(await fileData.arrayBuffer());
    const text = await extractPDF(fileBuffer);

    return { text };
  }

  /**
   * Extract content from image (OCR)
   */
  private async extractImage(material: Material): Promise<ContentExtractionResult> {
    // Download image from storage
    const { data: fileData, error } = await this.supabase.storage
      .from('uploads')
      .download(material.storage_path);

    if (error || !fileData) {
      throw new Error(`Failed to download image: ${error?.message || 'Unknown error'}`);
    }

    const fileBuffer = new Uint8Array(await fileData.arrayBuffer());

    // Run OCR using Gemini 2.0 Flash (multimodal AI, same as PDF extraction)
    const ocrResult = await extractImageText(fileBuffer, {
      confidenceThreshold: 70,
    });

    // Note: We process ALL photos, even with very short text
    // Quality warnings are shown in the UI via the ocr_quality metadata

    return {
      text: ocrResult.text,
      metadata: {
        ocr_quality: {
          confidence: ocrResult.confidence,
          lowQuality: ocrResult.metadata.lowQuality,
          engine: ocrResult.metadata.engine,
          processingTime: ocrResult.metadata.processingTime,
        },
      },
    };
  }

  /**
   * Extract content from audio (transcription)
   */
  private async extractAudio(material: Material): Promise<ContentExtractionResult> {
    // Get signed URL for audio file
    const { data: signedUrlData, error } = await this.supabase.storage
      .from('uploads')
      .createSignedUrl(material.storage_path, 3600); // 1 hour

    if (error || !signedUrlData) {
      throw new Error(`Failed to get audio URL: ${error?.message || 'Unknown error'}`);
    }

    const text = await transcribeAudio(signedUrlData.signedUrl);

    return { text };
  }

  /**
   * Extract content from website URL
   */
  private async extractWebsite(material: Material): Promise<ContentExtractionResult> {
    if (!material.external_url) {
      throw new Error('Website material missing external_url');
    }

    const websiteResult = await extractWebsiteContent(material.external_url);

    return {
      text: websiteResult.text,
      metadata: {
        website_extraction: {
          source: websiteResult.metadata.source,
          extractedTitle: websiteResult.title,
          url: websiteResult.metadata.url,
          processingTime: websiteResult.metadata.processingTime,
          contentLength: websiteResult.metadata.contentLength,
          warning: websiteResult.metadata.warning,
        },
      },
    };
  }

  /**
   * Extract content from YouTube video
   * 
   * Uses smart 2-tier extraction + AI cleanup:
   * 1. Direct caption extraction (fastest, ~2-5s)
   * 2. RapidAPI fallback (reliable, ~3-8s)
   * 3. AI cleanup for transcription errors (e.g., "Claude" heard as "Cloud")
   */
  private async extractYouTube(material: Material): Promise<ContentExtractionResult> {
    const { getYoutubeTranscriptSmart, cleanTranscriptWithAI } = await import('../youtube.ts');
    const { getRequiredEnv } = await import('../env.ts');

    if (!material.external_url) {
      throw new Error('YouTube material missing external_url');
    }

    console.log(`[ContentExtractor] Starting YouTube extraction for: ${material.external_url}`);
    const startTime = Date.now();

    try {
      // Step 1: Extract raw transcript (direct or RapidAPI)
      const result = await getYoutubeTranscriptSmart(material.external_url);

      console.log(
        `[ContentExtractor] Raw extraction complete: ` +
        `${result.transcript.length} chars via ${result.method}`
      );

      // Step 2: Clean up transcript with AI (fixes "Cloud Code" → "Claude Code" etc.)
      const apiKey = getRequiredEnv('GOOGLE_AI_API_KEY');
      const cleanedTranscript = await cleanTranscriptWithAI(result.transcript, apiKey);

      const processingTime = Date.now() - startTime;
      console.log(
        `[ContentExtractor] YouTube extraction SUCCESS: ` +
        `${cleanedTranscript.length} chars in ${processingTime}ms (method: ${result.method})`
      );

      return {
        text: cleanedTranscript,
        metadata: {
          youtube_extraction: {
            method: result.method,
            videoId: result.videoId,
            processingTime,
            rawLength: result.transcript.length,
            cleanedLength: cleanedTranscript.length,
          },
        },
      };
    } catch (error: any) {
      console.error(`[ContentExtractor] YouTube extraction FAILED: ${error.message}`);
      throw new Error(`YouTube Import Failed: ${error.message}`);
    }
  }
}
