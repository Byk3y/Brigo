/**
 * Type definitions for material processing
 */

/**
 * Material kinds supported by the system
 */
export type MaterialKind =
  | 'pdf'
  | 'audio'
  | 'image'
  | 'photo'
  | 'website'
  | 'youtube'
  | 'copied-text'
  | 'text'
  | 'note';

/**
 * Material object structure
 */
export interface Material {
  id: string;
  notebook_id?: string;
  kind: MaterialKind;
  storage_path: string | null;
  external_url: string | null;
  content: string | null;
  processed: boolean;
  status?: 'pending' | 'processing' | 'processed' | 'failed';
  meta?: Record<string, any>;
}

/**
 * Result from content extraction
 */
export interface ContentExtractionResult {
  text: string;
  metadata?: Record<string, any>;
}

/**
 * Content classification types for intelligent prompt adaptation
 */
export interface ContentClassification {
  type: 'past_paper' | 'lecture_notes' | 'textbook_chapter' | 'article' | 'video_transcript' | 'general';
  exam_relevance: 'high' | 'medium' | 'low';
  detected_format: 'multiple_choice' | 'short_answer' | 'essay' | 'mixed' | null;
  subject_area: string | null;
}

/**
 * Preview data structure
 */
export interface PreviewData {
  overview: string;
  suggested_questions: string[];
}

/**
 * Result from preview generation
 */
export interface PreviewGenerationResult {
  title: string;
  emoji: string;
  color: 'blue' | 'green' | 'orange' | 'purple' | 'pink';
  content_classification: ContentClassification;
  preview: PreviewData;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  costCents: number;
  model: string;
  latency: number;
}

/**
 * LLM response structure from preview generation
 */
export interface LLMPreviewResponse {
  title: string;
  emoji: string;
  color: 'blue' | 'green' | 'orange' | 'purple' | 'pink';
  content_classification: {
    type: string;
    exam_relevance: string;
    detected_format: string | null;
    subject_area: string | null;
  };
  overview: string;
  suggested_questions: string[];
}

/**
 * Result from large PDF check
 */
export interface LargePDFCheckResult {
  shouldProcessInBackground: boolean;
  jobId?: string;
  estimatedPages?: number;
  fileSizeBytes?: number;
  message?: string;
}
