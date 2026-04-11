/**
 * Edge Function: Process Material
 *
 * Processes uploaded materials by:
 * 1. Extracting content (PDF→text, image→OCR, audio→transcript)
 * 2. Generating AI title and concise overview (60-85 words - quick, scannable summary)
 * 3. Updating material and notebook records
 * 4. Logging usage for cost tracking
 *
 * Phase 2 Implementation with:
 * - Gemini 2.0 Flash PDF extraction (multimodal AI)
 * - Gemini 2.0 Flash OCR for camera photos (same API as PDFs)
 * - AssemblyAI audio transcription
 * - OpenRouter LLM title and preview generation
 */

import { createClient } from 'supabase';
import { checkQuota } from '../_shared/quota.ts';
import { getRequiredEnv, getOptionalEnv } from '../_shared/env.ts';
import { getCorsHeaders, getCorsPreflightHeaders } from '../_shared/cors.ts';
import { checkRateLimit, RATE_LIMITS } from '../_shared/ratelimit.ts';
import { validateUUID, validateString } from '../_shared/validation.ts';
import { PreviewGenerator } from '../_shared/material-processing/preview-generator.ts';
import { ContentExtractor } from '../_shared/material-processing/content-extractor.ts';
import { LargePDFHandler } from '../_shared/material-processing/large-pdf-handler.ts';
import { MaterialRepository, NotebookRepository, UsageLogger, StorageCleanup } from '../_shared/material-processing/database-operations.ts';
import { initSentry, captureException, setUser } from '../_shared/sentry.ts';

// Initialize Sentry once when the isolate starts
initSentry();

/**
 * Module-level in-flight context. The `beforeunload` and `unhandledrejection`
 * handlers read from this so we can write a forensic breadcrumb to
 * `materials.meta` even when the function is killed by WORKER_LIMIT / timeout
 * before any catch block runs.
 *
 * See: https://supabase.com/docs/guides/functions/background-tasks
 */
interface InFlightCtx {
  supabase: any | null;
  materialId: string | null;
  notebookId: string | null;
  userId: string | null;
  phase: string;
  startedAt: number;
  failurePersisted: boolean;
}
const inflight: InFlightCtx = {
  supabase: null,
  materialId: null,
  notebookId: null,
  userId: null,
  phase: 'idle',
  startedAt: 0,
  failurePersisted: false,
};

const setPhase = (p: string) => {
  inflight.phase = p;
  console.log(`[process-material] phase=${p} t=${Date.now() - inflight.startedAt}ms`);
};

// Forensic breadcrumb on runtime shutdown (OOM / wall-clock / boot error).
// We can't await here reliably, so fire-and-forget a best-effort update.
addEventListener('beforeunload', (ev: any) => {
  const reason = ev?.detail?.reason || 'unknown';
  console.error(`[process-material] beforeunload phase=${inflight.phase} reason=${reason}`);
  if (!inflight.supabase || !inflight.materialId) return;
  try {
    inflight.supabase
      .from('materials')
      .update({
        status: 'failed',
        meta: {
          error: `edge_function_shutdown: ${reason}`,
          error_type: 'WORKER_SHUTDOWN',
          shutdown_reason: reason,
          last_phase: inflight.phase,
          duration_ms: Date.now() - inflight.startedAt,
          failed_at: new Date().toISOString(),
        },
      })
      .eq('id', inflight.materialId)
      .then(() => {})
      .catch((e: any) => console.error('[process-material] beforeunload write failed:', e));
  } catch (e) {
    console.error('[process-material] beforeunload threw:', e);
  }
});

// Catch floating promise rejections so they also land in materials.meta.
addEventListener('unhandledrejection', (ev: any) => {
  const reason = ev?.reason;
  const message = reason?.message || String(reason);
  console.error(`[process-material] unhandledrejection phase=${inflight.phase}:`, message);
  if (!inflight.supabase || !inflight.materialId) return;
  try {
    inflight.supabase
      .from('materials')
      .update({
        status: 'failed',
        meta: {
          error: `unhandled_rejection: ${message}`,
          error_type: reason?.name || 'UnhandledRejection',
          error_stack: (reason?.stack || '').slice(0, 2000),
          last_phase: inflight.phase,
          duration_ms: Date.now() - inflight.startedAt,
          failed_at: new Date().toISOString(),
        },
      })
      .eq('id', inflight.materialId)
      .then(() => {})
      .catch(() => {});
  } catch {}
  ev?.preventDefault?.();
});

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsPreflightHeaders(req) });
  }

  const corsHeaders = getCorsHeaders(req);
  let notebookId: string | undefined;
  // Hoisted so the outer catch block can reference user.id without a
  // block-scope ReferenceError (which was previously causing the platform
  // to return a plain-text "Internal Server Error" instead of our JSON body).
  let user: any = null;

  // Reset in-flight context for this invocation so the shutdown handler has
  // the current material to write a breadcrumb against.
  inflight.supabase = null;
  inflight.materialId = null;
  inflight.notebookId = null;
  inflight.userId = null;
  inflight.phase = 'init';
  inflight.startedAt = Date.now();
  inflight.failurePersisted = false;

  try {
    setPhase('init');
    // Initialize Supabase client (service role)
    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const supabaseServiceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    inflight.supabase = supabase;

    // Initialize repositories
    const materialRepo = new MaterialRepository(supabase);
    const notebookRepo = new NotebookRepository(supabase);
    const usageLogger = new UsageLogger(supabase);
    const storageCleanup = new StorageCleanup(supabase);

    // AUTHENTICATION: Verify user from JWT token or Internal Secret
    const authHeader = req.headers.get('authorization');
    const isInternalWebhook = req.headers.get('x-internal-webhook') === 'true';

    // `user` is hoisted above — do not re-declare here.
    let isServiceBackdoor = false;

    if (isInternalWebhook) {
      // Internal system-to-system call (Bulletproof Architecture)
      isServiceBackdoor = true;
      console.log('[Auth] Bypassing user JWT for internal webhook call');
    } else {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !authUser) {
        return new Response(JSON.stringify({ error: 'Unauthorized', details: authError }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      user = authUser;
      // Set user context in Sentry for better debugging
      setUser(user.id);
    }

    setPhase('parsing_request');
    // Parse request body
    const body = await req.json();
    let materialId = body.material_id;

    // Handle Database Webhook payload if applicable
    // Webhooks send a payload like { record: { ... }, type: 'INSERT', ... }
    if (body.record && body.table === 'objects' && body.schema === 'storage') {
      const storagePath = body.record.name; // user_id/material_id/filename
      materialId = storagePath.split('/')[1];
      console.log(`[Webhook] Detected storage upload for material: ${materialId}`);
    }

    // Validate material_id
    if (!materialId) {
      return new Response(JSON.stringify({ error: 'Missing material_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const materialIdValidation = validateUUID(materialId, 'material_id');
    if (!materialIdValidation.isValid) {
      return new Response(JSON.stringify({ error: materialIdValidation.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Publish materialId to in-flight context so shutdown handlers can record it
    inflight.materialId = materialId;

    setPhase('fetching_material');
    // Fetch material and verify ownership (if not service backdoor)
    const { data: material, error: materialError } = await materialRepo.findById(materialId);

    if (materialError || !material) {
      return new Response(JSON.stringify({ error: 'Material not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // IDEMPOTENCY: If material is already processed or actively being processed, return early
    if (material.status === 'processed' || material.status === 'processing') {
      console.log(`[Idempotency] Material ${materialId} is already ${material.status}. Returning success.`);
      return new Response(
        JSON.stringify({
          success: true,
          message: `Material already ${material.status}`,
          materialId,
          notebook_id: material.notebook_id,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get notebook from the new notebook_id column
    notebookId = material.notebook_id;
    inflight.notebookId = notebookId ?? null;

    if (!notebookId) {
      return new Response(JSON.stringify({ error: 'Material is not associated with a notebook' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: notebook, error: notebookError } = await notebookRepo.findById(notebookId);

    if (notebookError || !notebook) {
      return new Response(JSON.stringify({ error: 'Notebook not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // AUTHORIZATION: Verify user owns this notebook/material (unless it's an internal webhook)
    if (!isServiceBackdoor) {
      if (!user || notebook.user_id !== user.id) {
        return new Response(
          JSON.stringify({
            error: 'Forbidden: You do not have permission to access this material',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const userId = notebook.user_id;
    inflight.userId = userId;
    const originalTitle = notebook.title; // Store original title for error recovery

    // RATE LIMITING: Check if user is making too many requests
    const rateLimitResult = await checkRateLimit({
      identifier: userId,
      limit: RATE_LIMITS.PROCESS_MATERIAL.limit,
      window: RATE_LIMITS.PROCESS_MATERIAL.window,
      endpoint: 'process-material',
    });

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Too many requests. Please wait before processing more materials.',
          retryAfter: rateLimitResult.retryAfter,
          remaining: 0,
          resetAt: rateLimitResult.resetAt,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimitResult.retryAfter),
            'X-RateLimit-Limit': String(RATE_LIMITS.PROCESS_MATERIAL.limit),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.resetAt),
          },
        }
      );
    }

    // QUOTA NOTE: Preview generation is unlimited for all users (trial + premium)
    // Quota enforcement only applies to:
    //   - Studio jobs (flashcards/quiz generation) - 5 for trial
    //   - Audio jobs (podcast generation) - 3 for trial
    // Quota check will be added in Phase 3 (Studio) and Phase 4 (Audio)

    setPhase('checking_large_pdf');
    // LARGE PDF DETECTION: Route large PDFs to background processing
    const largePDFHandler = new LargePDFHandler(supabase);
    const largePDFCheck = await largePDFHandler.checkAndQueue(material, notebookId, userId);

    // If the PDF was rejected outright (over the hard ceiling), persist a
    // user-facing error and return cleanly. This catches retry / webhook /
    // any path that bypasses the client-side guard.
    if (largePDFCheck.rejectedReason) {
      console.warn(`[process-material] Rejected: ${largePDFCheck.rejectedReason}`);
      await materialRepo.updateWithError(materialId, largePDFCheck.rejectedReason, {
        error_type: 'PDFTooLarge',
        user_facing: true,
        file_size_bytes: largePDFCheck.fileSizeBytes,
        last_phase: 'checking_large_pdf',
        duration_ms: Date.now() - inflight.startedAt,
      });
      inflight.failurePersisted = true;
      await notebookRepo.updateWithError(notebookId, originalTitle, largePDFCheck.rejectedReason);
      return new Response(
        JSON.stringify({
          success: false,
          materialId,
          notebook_id: notebookId,
          rejected: true,
          reason: largePDFCheck.rejectedReason,
          file_size_bytes: largePDFCheck.fileSizeBytes,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (largePDFCheck.shouldProcessInBackground) {
      return new Response(
        JSON.stringify({
          success: true,
          materialId,
          notebook_id: notebookId,
          background_processing: true,
          job_id: largePDFCheck.jobId,
          estimated_pages: largePDFCheck.estimatedPages,
          message: largePDFCheck.message,
        }),
        { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update notebook status to 'extracting' for processing
    await notebookRepo.updateStatus(notebookId, 'extracting');

    try {
      // Mark as processing
      await supabase.from('materials').update({ status: 'processing' }).eq('id', materialId);

      setPhase('extracting');
      // STEP 1: Extract content
      console.log(`Extracting content from ${material.kind}: ${materialId}`);
      const contentExtractor = new ContentExtractor(supabase);
      const { text: extractedContent, metadata: extractMetadata } = await contentExtractor.extract(material);

      console.log(`Extracted ${extractedContent.length} characters`);

      setPhase('saving_content');
      // STEP 2: Save extracted content
      await materialRepo.updateWithExtractedContent(
        materialId,
        extractedContent,
        material.meta || {},
        extractMetadata || {}
      );

      setPhase('checking_pending_materials');
      // STEP 3: Check if other materials are still processing
      // Only generate preview when ALL materials are done (Last Material Triggers Preview pattern)
      const pendingCount = await materialRepo.countPendingMaterials(notebookId, materialId);

      if (pendingCount > 0) {
        // Other materials still processing - defer preview generation to the last one
        console.log(`[Preview Deferred] ${pendingCount} materials still processing. Skipping preview generation.`);

        // Just update notebook status to show progress
        await notebookRepo.updateStatus(notebookId, 'extracting');

        return new Response(
          JSON.stringify({
            success: true,
            materialId,
            notebook_id: notebookId,
            preview_deferred: true,
            pending_materials: pendingCount,
            message: `Material extracted. Preview deferred (${pendingCount} materials still processing).`,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // This is the LAST material - generate final preview for all sources
      console.log('[Preview Generation] This is the last material. Generating combined preview...');

      // STEP 4: Fetch ALL processed materials for this notebook to generate a combined preview
      const allMaterials = await materialRepo.findAllProcessedByNotebook(notebookId);

      let combinedContent = "";
      if (allMaterials && allMaterials.length > 0) {
        combinedContent = allMaterials
          .map((m: any, i: number) => {
            const title = m.meta?.title || m.meta?.filename || `Source ${i + 1}`;
            return `--- SOURCE: ${title} (${m.kind}) ---\n${m.content}\n--- END ---`;
          })
          .join('\n\n');
      } else {
        combinedContent = extractedContent; // Fallback to current
      }

      setPhase('generating_preview');
      // STEP 5: Generate AI title and preview based on COMBINED content
      console.log(`Generating AI title and preview from ${allMaterials?.length || 1} combined sources...`);
      const previewStartTime = Date.now();

      const previewGenerator = new PreviewGenerator();
      const llmResult = await previewGenerator.generate(combinedContent, notebook.title);
      const aiTitle = llmResult.title;
      const preview = llmResult.preview;
      const contentClassification = llmResult.content_classification;

      const previewLatency = Date.now() - previewStartTime;
      console.log(`AI title and preview generated in ${previewLatency}ms`);
      console.log(`Content classified as: ${contentClassification.type} (${contentClassification.exam_relevance} exam relevance)`);

      // STEP 5.5: Build content summary from ALL materials in this notebook for multi-material awareness
      const updatedMaterials = await materialRepo.findAllByNotebook(notebookId);

      const materialClassifications = (updatedMaterials || [])
        .map((m: any) => m.meta?.content_classification)
        .filter(Boolean);

      const contentSummary = {
        material_count: updatedMaterials?.length || 1,
        has_past_paper: materialClassifications.some((c: any) => c.type === 'past_paper'),
        has_notes: materialClassifications.some((c: any) =>
          c.type === 'lecture_notes' || c.type === 'textbook_chapter'
        ),
        has_video: materialClassifications.some((c: any) => c.type === 'video_transcript'),
        material_types: [...new Set(materialClassifications.map((c: any) => c.type))],
        // Use highest exam relevance from any material
        exam_relevance: materialClassifications.some((c: any) => c.exam_relevance === 'high')
          ? 'high'
          : materialClassifications.some((c: any) => c.exam_relevance === 'medium')
            ? 'medium'
            : 'low',
        primary_subject: contentClassification.subject_area, // From latest material
      };

      console.log(`Content summary: ${contentSummary.material_count} materials, has_past_paper: ${contentSummary.has_past_paper}, has_notes: ${contentSummary.has_notes}`);

      setPhase('saving_preview');
      // STEP 6, 7, 8: Update records and log usage in parallel (Turbo-Boost)
      console.log('Finalizing database updates...');
      await Promise.all([
        // Update material with preview
        materialRepo.updateWithPreview(
          materialId,
          preview.overview,
          contentClassification,
          material.meta || {}
        ),

        // Update notebook with AI-generated title, preview, classification, and summary
        notebookRepo.updateWithPreview(notebookId, {
          title: aiTitle,
          emoji: !notebook.emoji ? llmResult.emoji : undefined,
          color: !notebook.color ? llmResult.color : undefined,
          preview,
          contentClassification,
          contentSummary,
        }),

        // Log usage with ACTUAL token counts from LLM API (Non-critical fallback)
        usageLogger.logSuccess(userId, notebookId, 'preview', llmResult)
          .catch(err => console.error('[UsageLogger] Non-critical logging failure:', err))
      ]);

      setPhase('complete');
      console.log('Material processed successfully - Final preview generated');

      return new Response(
        JSON.stringify({
          success: true,
          materialId,
          notebook_id: notebookId,
          preview,
          sources_count: allMaterials?.length || 1,
          message: 'Material processed and final preview generated',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (processingError: any) {
      console.error(`[process-material] Processing error in phase=${inflight.phase}:`, processingError);

      // Capture error in Sentry with context
      await captureException(processingError, {
        material_id: materialId,
        notebook_id: notebookId,
        user_id: user?.id,
        operation: 'process-material-main',
        phase: inflight.phase,
      });

      // Update material with specific error — include forensic extras so the
      // next debugger doesn't have to reverse-engineer what died.
      await materialRepo.updateWithError(materialId, processingError.message, {
        error_type: processingError?.name || 'Error',
        error_stack: String(processingError?.stack || '').slice(0, 2000),
        last_phase: inflight.phase,
        duration_ms: Date.now() - inflight.startedAt,
      });
      inflight.failurePersisted = true;

      // Update notebook metadata (prevent UI freezing but record failure)
      await notebookRepo.updateWithError(notebookId, originalTitle, processingError.message);

      // Log failed usage
      await usageLogger.logError(userId, notebookId, 'preview', processingError.message);

      throw processingError;
    }
  } catch (error: any) {
    console.error(`[process-material] Fatal error in phase=${inflight.phase}:`, error);

    // Capture fatal error in Sentry
    await captureException(error, {
      operation: 'process-material-fatal',
      notebook_id: notebookId,
      user_id: user?.id,
      phase: inflight.phase,
    });

    // Best-effort forensic write. Inner catch already wrote for its own errors,
    // but anything that dies outside the inner try (auth, parse, large-pdf
    // check) lands here — we still want to see it.
    if (inflight.materialId && inflight.supabase && !inflight.failurePersisted) {
      try {
        await inflight.supabase
          .from('materials')
          .update({
            status: 'failed',
            meta: {
              error: error?.message || 'unknown_fatal',
              error_type: error?.name || 'Error',
              error_stack: String(error?.stack || '').slice(0, 2000),
              last_phase: inflight.phase,
              duration_ms: Date.now() - inflight.startedAt,
              failed_at: new Date().toISOString(),
            },
          })
          .eq('id', inflight.materialId);
      } catch (writeErr) {
        console.error('[process-material] Failed to persist fatal error:', writeErr);
      }
    }

    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        stack: getOptionalEnv('DENO_ENV', '') === 'development' ? error.stack : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
