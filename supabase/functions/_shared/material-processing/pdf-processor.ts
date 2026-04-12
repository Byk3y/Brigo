/**
 * PdfProcessor
 *
 * Phase 2 single-call PDF processing. Replaces the old two-step flow of
 * GeminiService.extract() (Gemini inline_data) + PreviewGenerator.generate()
 * (OpenRouter 'preview' job type) with ONE structured-output call to
 * google/gemini-2.5-flash via OpenRouter.
 *
 * Given a Material row pointing at a PDF in Supabase Storage, this class:
 *   1. Downloads the file bytes
 *   2. Validates PDF magic bytes
 *   3. Enforces the 14 MB hard ceiling (same as lib/pdfGuard.ts client-side)
 *   4. Base64-encodes the PDF into a data URL
 *   5. Calls Gemini 2.5 Flash with the PDF attachment + a JSON schema that
 *      asks for extracted_text + title + emoji + color + classification +
 *      overview + 3 suggested questions, all in one response
 *   6. Validates + normalizes the structured response
 *   7. Returns a PdfProcessResult that the caller persists to materials +
 *      notebooks
 *
 * This file is self-contained (no pdfjs, no SmartPDFExtractor, no
 * orchestrator). Everything the process-material happy path needs for a PDF
 * material lives here.
 */

import { callLLMWithRetry, type LLMResponseSchema } from '../openrouter.ts';
import { stripMarkdown } from './utils.ts';
import { validateFileMagicBytes, validateString } from '../validation.ts';
import type {
  ContentClassification,
  PreviewGenerationResult,
  Material,
} from './types.ts';

// Supabase client type (loose for compatibility)
// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

/**
 * Hard ceiling. Same 14 MB cap as lib/pdfGuard.ts so the server-side check
 * matches the client-side check. Gemini inline_data via OpenRouter's base64
 * file-block format has a practical ~20 MB request body limit; 14 MB raw
 * PDF + 33% base64 overhead lands at ~19 MB.
 */
const HARD_MAX_PDF_BYTES = 14 * 1024 * 1024;

/**
 * Output constraints for validation. Anything that validates preview content
 * should reuse these.
 */
const PREVIEW_CONFIG = {
  MIN_OVERVIEW_WORDS: 40,
  MAX_OVERVIEW_WORDS: 140,
  MAX_TITLE_LENGTH: 60,
  MAX_QUESTIONS: 3,
  MAX_QUESTION_LENGTH: 300,
  TEMPERATURE: 0.3, // Lower than the old 0.6 because we now also want
  // deterministic extraction, not just creative preview writing.
  MAX_RETRIES: 2,
} as const;

const VALID_COLORS = ['blue', 'green', 'orange', 'purple', 'pink'] as const;
type ValidColor = typeof VALID_COLORS[number];

/**
 * Shape returned by PdfProcessor.process(). Mirrors the old
 * PreviewGenerationResult with one new top-level field (`extractedText`)
 * so the caller can save both in one go.
 */
export interface PdfProcessResult extends PreviewGenerationResult {
  /** Full plain-text content of the PDF, as extracted by Gemini. */
  extractedText: string;
}

/**
 * Raw JSON shape we ask Gemini to return via structured output. We validate
 * this before promoting it to the typed PdfProcessResult above.
 *
 * Nullable fields (`detected_format`, `subject_area`) use plain `string`
 * types instead of `string | null` — see the schema below for why.
 */
interface RawGeminiPdfResponse {
  extracted_text: string;
  title: string;
  emoji: string;
  color: string; // Validated against VALID_COLORS downstream
  content_classification: {
    type: string;
    exam_relevance: string;
    detected_format?: string; // Optional; model can omit when not applicable
    subject_area?: string;    // Optional; model can omit when unclear
  };
  overview: string;
  suggested_questions: string[];
}

/**
 * Structured-output schema enforced on Gemini via OpenRouter's
 * `response_format: { type: 'json_schema', ... }` option.
 *
 * A few non-obvious choices here:
 *
 * - `strict: false` — OpenAI's strict mode requires every property to be in
 *   `required` AND `additionalProperties: false` everywhere. We intentionally
 *   leave some classification fields optional, so we can't use strict. Our
 *   downstream `parseAndValidate` normalizes any oddities.
 *
 * - No `type: ['string', 'null']` and no `null` values in enums. Gemini
 *   models via OpenRouter don't handle nullable-via-array-type or null-in-
 *   enum well (documented gotcha). We express "this field may not apply"
 *   by simply leaving the field out of `required` and letting the model omit
 *   it. The parser treats missing fields the same as null.
 *
 * - `suggested_questions` has loose bounds (1–5 items) even though we want
 *   ideally 3. Gemini sometimes returns 2 or 4 regardless of prompt, and
 *   strict bounds would cause schema rejection. The parser caps at 3.
 */
const PDF_PROCESS_SCHEMA: LLMResponseSchema = {
  name: 'pdf_extract_preview',
  strict: false,
  schema: {
    type: 'object',
    properties: {
      extracted_text: {
        type: 'string',
        description:
          'The FULL plain-text content of the PDF document, preserving paragraph structure. Do NOT summarize, abbreviate, or truncate — return the complete extracted text as-is.',
      },
      title: {
        type: 'string',
        description: 'Clear topic title for the notebook (max 60 characters).',
      },
      emoji: {
        type: 'string',
        description: 'A single emoji character representing the subject or topic.',
      },
      color: {
        type: 'string',
        enum: ['blue', 'green', 'orange', 'purple', 'pink'],
      },
      content_classification: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'past_paper',
              'lecture_notes',
              'textbook_chapter',
              'article',
              'video_transcript',
              'general',
            ],
          },
          exam_relevance: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
          },
          detected_format: {
            type: 'string',
            enum: ['multiple_choice', 'short_answer', 'essay', 'mixed'],
            description: 'Only set for past_paper. Omit this field otherwise.',
          },
          subject_area: {
            type: 'string',
            description: 'Academic subject area. Omit if unclear.',
          },
        },
        required: ['type', 'exam_relevance'],
      },
      overview: {
        type: 'string',
        description:
          '80-120 word summary. Bold 2-3 key exam terms using **markdown bold**. End with one concept to research further.',
      },
      suggested_questions: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 5,
      },
    },
    required: [
      'extracted_text',
      'title',
      'emoji',
      'color',
      'content_classification',
      'overview',
      'suggested_questions',
    ],
  },
};

/**
 * Main PdfProcessor class. One instance per request.
 */
export class PdfProcessor {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Process a single PDF material end-to-end: download → validate → Gemini
   * call → parse → return. Does NOT write to the database; the caller is
   * responsible for persisting the result (this keeps the class testable
   * and makes the caller's error handling explicit).
   */
  async process(material: Material, notebookTitle: string): Promise<PdfProcessResult> {
    if (!material.storage_path) {
      throw new Error('PdfProcessor: material has no storage_path');
    }

    // 1. Download file bytes from Supabase Storage
    const { data: fileData, error: downloadError } = await this.supabase.storage
      .from('uploads')
      .download(material.storage_path);

    if (downloadError || !fileData) {
      throw new Error(
        `PdfProcessor: failed to download PDF: ${downloadError?.message || 'unknown error'}`
      );
    }

    const fileBuffer = new Uint8Array(await fileData.arrayBuffer());

    // 2. Validate magic bytes — confirms the file is actually a PDF, not
    //    a mislabeled binary or something a user uploaded to storage directly.
    const magicCheck = validateFileMagicBytes(fileBuffer, 'pdf');
    if (!magicCheck.isValid) {
      throw new Error(`PdfProcessor: ${magicCheck.error || 'invalid PDF file'}`);
    }

    // 3. Hard size cap — defensive, the client guard and PdfSizeGuard
    //    should have already caught this, but we don't trust those.
    if (fileBuffer.length > HARD_MAX_PDF_BYTES) {
      const sizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(1);
      const limitMB = (HARD_MAX_PDF_BYTES / (1024 * 1024)).toFixed(0);
      throw new Error(
        `PdfProcessor: PDF too large (${sizeMB} MB > ${limitMB} MB). Please split the document.`
      );
    }

    // 4. Base64-encode into a data URL for OpenRouter's file content block.
    //    Chunked to avoid "Maximum call stack size exceeded" on large buffers.
    const base64 = this.encodeBase64(fileBuffer);
    const dataUrl = `data:application/pdf;base64,${base64}`;
    const filename = this.deriveFilename(material);

    // 5. Build prompts + call Gemini 2.5 Flash with the PDF attachment.
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(notebookTitle);

    console.log(
      `[PdfProcessor] Processing ${filename} (${fileBuffer.length} bytes) via Gemini 2.5 Flash`
    );

    const llmResult = await callLLMWithRetry('pdf_extract_preview', systemPrompt, userPrompt, {
      temperature: PREVIEW_CONFIG.TEMPERATURE,
      maxRetries: PREVIEW_CONFIG.MAX_RETRIES,
      attachments: [{ filename, fileData: dataUrl }],
      responseSchema: PDF_PROCESS_SCHEMA,
    });

    // 6. Parse + validate + normalize
    return this.parseAndValidate(llmResult);
  }

  /**
   * System prompt. Adapted from the old PreviewGenerator.buildSystemPrompt
   * with extraction instructions prepended so the model understands its
   * dual role (extract + classify + preview).
   */
  private buildSystemPrompt(): string {
    return `You are Brigo, an AI Study Coach specializing in exam preparation.

You are processing a PDF document attached to this message. Your job is to do FOUR things in one JSON response:

1. EXTRACT the FULL text content of the PDF. Do not summarize. Do not truncate. Preserve paragraph structure. If the PDF contains images of text (scanned pages), OCR them. If the PDF contains diagrams or tables, describe them inline in the extracted text.

2. CLASSIFY the material:
   - TYPE: one of past_paper, lecture_notes, textbook_chapter, article, video_transcript, general
     • past_paper — exam questions, mark schemes, test papers
     • lecture_notes — class notes, slides, lecture transcripts
     • textbook_chapter — formal educational content from a textbook
     • article — news, blog, or informational article
     • video_transcript — transcribed video content
     • general — anything else
   - EXAM_RELEVANCE: high (actual exam questions / exam-style content), medium (educational content useful for exam prep), low (general info, not exam-related)
   - DETECTED_FORMAT (only for past_paper): multiple_choice, short_answer, essay, or mixed. OMIT this field entirely if the material is not a past paper.
   - SUBJECT_AREA: the academic subject (e.g., "Biology", "Law", "History", "Computer Science"). OMIT this field if the subject is unclear.

3. GENERATE a title (max 60 chars), emoji, color, and an 80-120 word overview. Bold 2-3 key exam terms using **markdown bold**. End the overview with one concept worth researching further.

4. SUGGEST exactly 3 study questions that spark curiosity about the material.

RULES:
- extracted_text MUST be the full document content — do not truncate
- Jump directly into content — never start the overview with "This text discusses..." or similar filler
- Focus on exam-relevant concepts
- For past papers, mention what topics are being tested
- Return ONLY valid JSON that conforms to the provided schema`;
  }

  /**
   * User prompt. The PDF itself is attached via the file content block, so
   * this is just context-setting text.
   */
  private buildUserPrompt(notebookTitle: string): string {
    const sanitizedTitle = (notebookTitle || 'Untitled').slice(0, 100);
    return `Existing Notebook Title: ${sanitizedTitle}

Process the attached PDF and return the full structured response.`;
  }

  /**
   * Parse the structured-output JSON from Gemini and normalize into a typed
   * PdfProcessResult. Throws on invalid shape so the caller's catch writes
   * forensic meta via Phase 1's updateWithError extras.
   */
  private parseAndValidate(llmResult: {
    content: string;
    usage: { inputTokens: number; outputTokens: number; totalTokens: number };
    costCents: number;
    model: string;
    latency: number;
  }): PdfProcessResult {
    let parsed: RawGeminiPdfResponse;
    try {
      // OpenRouter's Response Healing should give us clean JSON, but strip
      // any residual markdown fences just in case (some providers still wrap).
      let jsonContent = llmResult.content.trim();
      if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, '');
        jsonContent = jsonContent.replace(/\n?```\s*$/, '');
      }
      parsed = JSON.parse(jsonContent);
    } catch (parseErr) {
      console.error('[PdfProcessor] Failed to parse LLM response as JSON:', llmResult.content);
      throw new Error(
        `PdfProcessor: LLM returned invalid JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`
      );
    }

    // extracted_text must be present and non-trivially long
    if (!parsed.extracted_text || typeof parsed.extracted_text !== 'string') {
      throw new Error('PdfProcessor: response missing extracted_text');
    }
    if (parsed.extracted_text.trim().length < 10) {
      throw new Error('PdfProcessor: extracted_text is suspiciously short — PDF may be empty or unreadable');
    }

    // Title
    const titleValidation = validateString(parsed.title, {
      fieldName: 'title',
      required: true,
      maxLength: 120,
      allowNewlines: false,
    });
    if (!titleValidation.isValid) {
      throw new Error(`PdfProcessor: invalid title: ${titleValidation.error}`);
    }
    const cleanedTitle = stripMarkdown(titleValidation.sanitized!).slice(
      0,
      PREVIEW_CONFIG.MAX_TITLE_LENGTH
    );

    // Overview
    const overviewValidation = validateString(parsed.overview, {
      fieldName: 'overview',
      required: true,
      maxLength: 3000,
    });
    if (!overviewValidation.isValid) {
      throw new Error(`PdfProcessor: invalid overview: ${overviewValidation.error}`);
    }
    const trimmedOverview = overviewValidation
      .sanitized!.replace(/\n\s*\n/g, ' ')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const wordCount = trimmedOverview.split(/\s+/).length;
    if (wordCount < PREVIEW_CONFIG.MIN_OVERVIEW_WORDS) {
      throw new Error(
        `PdfProcessor: overview too short (${wordCount} words, need ≥${PREVIEW_CONFIG.MIN_OVERVIEW_WORDS})`
      );
    }
    // Upper bound is soft — log a warning but don't fail, since a slightly
    // long overview is better UX than a failed upload.
    if (wordCount > PREVIEW_CONFIG.MAX_OVERVIEW_WORDS) {
      console.warn(
        `[PdfProcessor] Overview is ${wordCount} words (soft cap ${PREVIEW_CONFIG.MAX_OVERVIEW_WORDS})`
      );
    }

    // Emoji — must be a non-empty string; we don't validate it's a single
    // grapheme because emoji counting is a rabbit hole.
    if (!parsed.emoji || typeof parsed.emoji !== 'string') {
      throw new Error('PdfProcessor: missing or invalid emoji');
    }

    // Classification — normalize with defaults on invalid values
    const classification: ContentClassification = {
      type: this.normalizeClassificationType(parsed.content_classification?.type),
      exam_relevance: this.normalizeExamRelevance(parsed.content_classification?.exam_relevance),
      detected_format: this.normalizeDetectedFormat(parsed.content_classification?.detected_format),
      subject_area: parsed.content_classification?.subject_area || null,
    };

    // Questions — trim, filter, cap
    const questions: string[] = Array.isArray(parsed.suggested_questions)
      ? parsed.suggested_questions
          .slice(0, PREVIEW_CONFIG.MAX_QUESTIONS)
          .filter((q: unknown): q is string => typeof q === 'string' && q.trim().length > 0)
          .map((q: string) => q.trim().slice(0, PREVIEW_CONFIG.MAX_QUESTION_LENGTH))
      : [];

    return {
      extractedText: parsed.extracted_text.trim(),
      title: cleanedTitle,
      emoji: parsed.emoji,
      color: this.normalizeColor(parsed.color),
      content_classification: classification,
      preview: {
        overview: trimmedOverview,
        suggested_questions: questions,
      },
      usage: llmResult.usage,
      costCents: llmResult.costCents,
      model: llmResult.model,
      latency: llmResult.latency,
    };
  }

  /**
   * Normalize the `color` field against our allowed enum. If the model
   * returns something unexpected (empty string, typo, non-enum value),
   * fall back to 'blue'. This matches the normalizer pattern used for the
   * classification fields and prevents invalid colors from flowing into
   * the notebooks table where the UI might choke on them.
   */
  private normalizeColor(value: unknown): ValidColor {
    return (VALID_COLORS as readonly string[]).includes(String(value))
      ? (value as ValidColor)
      : 'blue';
  }

  private normalizeClassificationType(value: unknown): ContentClassification['type'] {
    const valid = [
      'past_paper',
      'lecture_notes',
      'textbook_chapter',
      'article',
      'video_transcript',
      'general',
    ] as const;
    return (valid as readonly string[]).includes(String(value))
      ? (value as ContentClassification['type'])
      : 'general';
  }

  private normalizeExamRelevance(value: unknown): ContentClassification['exam_relevance'] {
    const valid = ['high', 'medium', 'low'] as const;
    return (valid as readonly string[]).includes(String(value))
      ? (value as ContentClassification['exam_relevance'])
      : 'medium';
  }

  private normalizeDetectedFormat(value: unknown): ContentClassification['detected_format'] {
    if (value === null || value === undefined) return null;
    const valid = ['multiple_choice', 'short_answer', 'essay', 'mixed'] as const;
    return (valid as readonly string[]).includes(String(value))
      ? (value as ContentClassification['detected_format'])
      : null;
  }

  /**
   * Derive a filename to pass to OpenRouter's file content block. We don't
   * use the full storage_path because that exposes the user UUID. The
   * filename is cosmetic only — it shows up in OpenRouter logs but doesn't
   * affect how the model processes the file.
   */
  private deriveFilename(material: Material): string {
    const path = material.storage_path || '';
    const tail = path.split('/').pop() || 'document.pdf';
    // Cap length and strip weird characters for log safety
    return tail.slice(0, 120).replace(/[^\w\s.\-()]/g, '_') || 'document.pdf';
  }

  /**
   * Chunked base64 encode — avoids "Maximum call stack size exceeded" that
   * String.fromCharCode(...Array.from(bigBuffer)) can cause on large PDFs.
   */
  private encodeBase64(fileBuffer: Uint8Array): string {
    const CHUNK = 8192;
    const parts: string[] = [];
    for (let i = 0; i < fileBuffer.length; i += CHUNK) {
      const slice = fileBuffer.slice(i, i + CHUNK);
      parts.push(String.fromCharCode.apply(null, Array.from(slice)));
    }
    return btoa(parts.join(''));
  }
}
