/**
 * Edge Function: Process Material
 *
 * Phase 2: Fire-and-forget processing via EdgeRuntime.waitUntil().
 *
 * Flow:
 *   1. Validate request (auth, rate limit, material/notebook fetch, size guard)
 *   2. Acquire lock (material.status = processing, notebook.status = extracting)
 *   3. Return 200 immediately with { accepted: true } so the client releases
 *      its HTTP connection
 *   4. EdgeRuntime.waitUntil() runs the actual extraction + preview in the
 *      background. Completion is signaled to the client via Realtime updates
 *      on the notebooks table (handled by lib/store/slices/notebookSlice.ts).
 *
 * Why fire-and-forget: Phase 1 discovered that iOS/Expo HTTP stack drops
 * long-running connections around 30-60s, making supabase-js throw
 * FunctionsHttpError with message "Edge Function returned a non-2xx status
 * code" for uploads that were actually succeeding server-side. Returning
 * early means the client's connection lifecycle is decoupled from server
 * processing duration — the class of false failures is gone.
 *
 * Per-material-type handling:
 *   - PDF: single Gemini 2.5 Flash call via PdfProcessor (extraction +
 *          classification + preview in one structured-output response)
 *   - Everything else: traditional two-step via ContentExtractor +
 *                      PreviewGenerator (unchanged from Phase 1 behavior,
 *                      just wrapped in waitUntil)
 *
 * The "last material triggers preview" aggregation pattern was deleted:
 * each material now generates its own preview from its own content. The
 * notebook's top-level preview reflects whichever material completed last.
 * A future "Regenerate from all sources" UX button will cover the combined-
 * preview case for multi-material notebooks.
 */

import { createClient } from 'supabase';
import { checkQuota } from '../_shared/quota.ts';
import { getRequiredEnv, getOptionalEnv } from '../_shared/env.ts';
import { getCorsHeaders, getCorsPreflightHeaders } from '../_shared/cors.ts';
import { checkRateLimit, RATE_LIMITS } from '../_shared/ratelimit.ts';
import { validateUUID, validateString } from '../_shared/validation.ts';
import { PreviewGenerator } from '../_shared/material-processing/preview-generator.ts';
import { ContentExtractor } from '../_shared/material-processing/content-extractor.ts';
import { PdfProcessor } from '../_shared/material-processing/pdf-processor.ts';
import { PdfSizeGuard } from '../_shared/material-processing/pdf-size-guard.ts';
import {
  MaterialRepository,
  NotebookRepository,
  UsageLogger,
  StorageCleanup,
} from '../_shared/material-processing/database-operations.ts';
import { initSentry, captureException, setUser } from '../_shared/sentry.ts';

// Initialize Sentry once when the isolate starts
initSentry();

/**
 * Ambient declaration for the Supabase Edge Runtime global that exposes
 * `waitUntil`. Deno's built-in types don't know about this, but Supabase
 * exposes it as a global inside deployed edge functions. See
 * https://supabase.com/docs/guides/functions/background-tasks.
 */
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

/**
 * Per-request in-flight context. Phase 2 allows multiple concurrent
 * requests in a single isolate (the fire-and-forget pattern means the
 * synchronous handler returns before the background work completes, so a
 * new request can arrive while the previous one's waitUntil task is still
 * running). We track all of them in a Set so the shutdown handler can
 * flush forensic breadcrumbs for every active task at once.
 */
interface InFlightCtx {
  supabase: any | null;
  materialId: string | null;
  notebookId: string | null;
  userId: string | null;
  kind: string | null;
  phase: string;
  startedAt: number;
  failurePersisted: boolean;
}

const inflightRequests = new Set<InFlightCtx>();

/**
 * Phase-breadcrumb helper. Logs to console AND mutates the ctx in place so
 * the shutdown handler can read the current phase.
 */
const setPhase = (ctx: InFlightCtx, p: string) => {
  ctx.phase = p;
  console.log(
    `[process-material] phase=${p} material=${ctx.materialId} t=${Date.now() - ctx.startedAt}ms`
  );
};

/**
 * Forensic breadcrumb on runtime shutdown (OOM / wall-clock / boot error).
 * Iterates every in-flight request and fires a best-effort UPDATE so every
 * active background task gets a failure row even if the isolate is dying.
 */
addEventListener('beforeunload', (ev: any) => {
  const reason = ev?.detail?.reason || 'unknown';
  console.error(
    `[process-material] beforeunload reason=${reason} inflight=${inflightRequests.size}`
  );
  for (const ctx of inflightRequests) {
    if (!ctx.supabase || !ctx.materialId) continue;
    try {
      ctx.supabase
        .from('materials')
        .update({
          status: 'failed',
          meta: {
            error: `edge_function_shutdown: ${reason}`,
            error_type: 'WORKER_SHUTDOWN',
            shutdown_reason: reason,
            last_phase: ctx.phase,
            duration_ms: Date.now() - ctx.startedAt,
            failed_at: new Date().toISOString(),
          },
        })
        .eq('id', ctx.materialId)
        .then(() => {})
        .catch((e: any) =>
          console.error('[process-material] beforeunload write failed:', e)
        );
    } catch (e) {
      console.error('[process-material] beforeunload threw:', e);
    }
  }
});

/**
 * Catch floating promise rejections in background tasks. Without this,
 * unhandled rejections would silently hit the isolate and leave the
 * material stuck in 'processing'.
 */
addEventListener('unhandledrejection', (ev: any) => {
  const reason = ev?.reason;
  const message = reason?.message || String(reason);
  console.error(`[process-material] unhandledrejection:`, message);
  for (const ctx of inflightRequests) {
    if (!ctx.supabase || !ctx.materialId) continue;
    try {
      ctx.supabase
        .from('materials')
        .update({
          status: 'failed',
          meta: {
            error: `unhandled_rejection: ${message}`,
            error_type: reason?.name || 'UnhandledRejection',
            error_stack: (reason?.stack || '').slice(0, 2000),
            last_phase: ctx.phase,
            duration_ms: Date.now() - ctx.startedAt,
            failed_at: new Date().toISOString(),
          },
        })
        .eq('id', ctx.materialId)
        .then(() => {})
        .catch(() => {});
    } catch {}
  }
  ev?.preventDefault?.();
});

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsPreflightHeaders(req) });
  }

  const corsHeaders = getCorsHeaders(req);

  // Create a per-request context. Hoisted so catch blocks can use it, and
  // registered in the Set so beforeunload can flush breadcrumbs for it.
  const ctx: InFlightCtx = {
    supabase: null,
    materialId: null,
    notebookId: null,
    userId: null,
    kind: null,
    phase: 'init',
    startedAt: Date.now(),
    failurePersisted: false,
  };
  inflightRequests.add(ctx);

  // Hoisted for the outer catch (see Phase 1 fix: the old code had this
  // declared inside the inner try, causing a ReferenceError in the outer
  // catch that made the platform return plain-text "Internal Server Error"
  // instead of our JSON 500 body).
  let user: any = null;
  let originalTitle = '';

  try {
    setPhase(ctx, 'init');

    // Initialize Supabase client (service role)
    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const supabaseServiceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    ctx.supabase = supabase;

    // Initialize repositories
    const materialRepo = new MaterialRepository(supabase);
    const notebookRepo = new NotebookRepository(supabase);
    const usageLogger = new UsageLogger(supabase);
    const storageCleanup = new StorageCleanup(supabase);

    // AUTHENTICATION: Verify user from JWT token or Internal Secret
    const authHeader = req.headers.get('authorization');
    const isInternalWebhook = req.headers.get('x-internal-webhook') === 'true';

    let isServiceBackdoor = false;

    if (isInternalWebhook) {
      isServiceBackdoor = true;
      console.log('[Auth] Bypassing user JWT for internal webhook call');
    } else {
      if (!authHeader) {
        inflightRequests.delete(ctx);
        return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !authUser) {
        inflightRequests.delete(ctx);
        return new Response(JSON.stringify({ error: 'Unauthorized', details: authError }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      user = authUser;
      setUser(user.id);
    }

    setPhase(ctx, 'parsing_request');
    const body = await req.json();
    let materialId = body.material_id;

    // Handle Supabase Database Webhook payload format
    if (body.record && body.table === 'objects' && body.schema === 'storage') {
      const storagePath = body.record.name;
      materialId = storagePath.split('/')[1];
      console.log(`[Webhook] Detected storage upload for material: ${materialId}`);
    }

    if (!materialId) {
      inflightRequests.delete(ctx);
      return new Response(JSON.stringify({ error: 'Missing material_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const materialIdValidation = validateUUID(materialId, 'material_id');
    if (!materialIdValidation.isValid) {
      inflightRequests.delete(ctx);
      return new Response(JSON.stringify({ error: materialIdValidation.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    ctx.materialId = materialId;

    setPhase(ctx, 'fetching_material');
    const { data: material, error: materialError } = await materialRepo.findById(materialId);

    if (materialError || !material) {
      inflightRequests.delete(ctx);
      return new Response(JSON.stringify({ error: 'Material not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // IDEMPOTENCY: if already processed or in-flight, return early
    if (material.status === 'processed' || material.status === 'processing') {
      console.log(`[Idempotency] Material ${materialId} is already ${material.status}.`);
      inflightRequests.delete(ctx);
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

    ctx.kind = material.kind;

    const notebookId = material.notebook_id;
    ctx.notebookId = notebookId ?? null;

    if (!notebookId) {
      inflightRequests.delete(ctx);
      return new Response(
        JSON.stringify({ error: 'Material is not associated with a notebook' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: notebook, error: notebookError } = await notebookRepo.findById(notebookId);

    if (notebookError || !notebook) {
      inflightRequests.delete(ctx);
      return new Response(JSON.stringify({ error: 'Notebook not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // AUTHORIZATION
    if (!isServiceBackdoor) {
      if (!user || notebook.user_id !== user.id) {
        inflightRequests.delete(ctx);
        return new Response(
          JSON.stringify({ error: 'Forbidden: You do not have permission to access this material' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const userId = notebook.user_id;
    ctx.userId = userId;
    originalTitle = notebook.title;

    // RATE LIMITING
    const rateLimitResult = await checkRateLimit({
      identifier: userId,
      limit: RATE_LIMITS.PROCESS_MATERIAL.limit,
      window: RATE_LIMITS.PROCESS_MATERIAL.window,
      endpoint: 'process-material',
    });

    if (!rateLimitResult.allowed) {
      inflightRequests.delete(ctx);
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

    setPhase(ctx, 'checking_upload_size');
    // Hard size ceiling per material type (PDF 14 MB, audio 100 MB,
    // image/photo 20 MB). Materials over the limit are rejected outright
    // so we don't waste bandwidth or leave dead files in storage.
    // Website, YouTube, and text materials pass through (no storage file).
    const pdfSizeGuard = new PdfSizeGuard(supabase);
    const sizeCheck = await pdfSizeGuard.check(material);

    if (sizeCheck.rejectedReason) {
      console.warn(`[process-material] Rejected: ${sizeCheck.rejectedReason}`);
      await materialRepo.updateWithError(materialId, sizeCheck.rejectedReason, {
        error_type: 'UploadTooLarge',
        user_facing: true,
        file_size_bytes: sizeCheck.fileSizeBytes,
        last_phase: 'checking_upload_size',
        duration_ms: Date.now() - ctx.startedAt,
      });
      ctx.failurePersisted = true;
      await notebookRepo.updateWithError(notebookId, originalTitle, sizeCheck.rejectedReason);
      inflightRequests.delete(ctx);
      return new Response(
        JSON.stringify({
          success: false,
          materialId,
          notebook_id: notebookId,
          rejected: true,
          reason: sizeCheck.rejectedReason,
          file_size_bytes: sizeCheck.fileSizeBytes,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ----------------------------------------------------------------
    // LOCK ACQUIRED. Mark as processing, set notebook to extracting, then
    // fire-and-forget the actual work via EdgeRuntime.waitUntil.
    // ----------------------------------------------------------------
    setPhase(ctx, 'lock_acquiring');
    await supabase.from('materials').update({ status: 'processing' }).eq('id', materialId);
    await notebookRepo.updateStatus(notebookId, 'extracting');

    // Spawn the background task. The closure captures everything it needs
    // from the local scope (including `ctx`) so concurrent requests in the
    // same isolate don't step on each other.
    EdgeRuntime.waitUntil(
      (async () => {
        try {
          if (material.kind === 'pdf') {
            // Phase 2 single-call PDF path: extraction + classification +
            // preview all in one Gemini 2.5 Flash call via OpenRouter.
            setPhase(ctx, 'pdf_processing');
            const processor = new PdfProcessor(supabase);
            const result = await processor.process(material, notebook.title);

            setPhase(ctx, 'saving_pdf_results');
            const contentSummary = buildPerMaterialSummary(result.content_classification);

            await Promise.all([
              materialRepo.updateWithExtractedContentAndPreview(
                materialId,
                result.extractedText,
                result.preview.overview,
                result.content_classification,
                material.meta || {}
              ),
              notebookRepo.updateWithPreview(notebookId, {
                title: result.title,
                emoji: !notebook.emoji ? result.emoji : undefined,
                color: !notebook.color ? result.color : undefined,
                preview: result.preview,
                contentClassification: result.content_classification,
                contentSummary,
              }),
              usageLogger.logSuccess(userId, notebookId, 'pdf_extract_preview', result)
                .catch((err) =>
                  console.error('[UsageLogger] Non-critical logging failure:', err)
                ),
            ]);

            // Phase 2.5: delete the original PDF from storage now that the
            // extracted text is safely in materials.content. None of the
            // downstream features (chat, flashcards, quiz, source viewer)
            // read from the original file — they all use materials.content.
            // Keeping the file would just accumulate storage quota forever.
            //
            // Best-effort — StorageCleanup.deleteFile() catches its own errors
            // and never throws, so a storage delete failure won't bubble up
            // and mark the material as failed.
            //
            // Only fires on SUCCESS. Failed/pending/processing materials keep
            // their file so retry can re-download and try again.
            if (material.storage_path) {
              setPhase(ctx, 'deleting_pdf_storage');
              await storageCleanup.deleteFile(material.storage_path);
            }

            setPhase(ctx, 'complete');
            console.log(
              `[process-material] PDF processed: ${materialId} (${result.extractedText.length} chars, ${result.latency}ms)`
            );
          } else {
            // Non-PDF path: traditional two-step (extract then preview) but
            // without the "last material triggers preview" aggregation.
            setPhase(ctx, 'extracting');
            const contentExtractor = new ContentExtractor(supabase);
            const { text: extractedContent, metadata: extractMetadata } =
              await contentExtractor.extract(material);

            setPhase(ctx, 'saving_content');
            await materialRepo.updateWithExtractedContent(
              materialId,
              extractedContent,
              material.meta || {},
              extractMetadata || {}
            );

            setPhase(ctx, 'generating_preview');
            const previewGenerator = new PreviewGenerator();
            const llmResult = await previewGenerator.generate(extractedContent, notebook.title);

            setPhase(ctx, 'saving_preview');
            const contentSummary = buildPerMaterialSummary(llmResult.content_classification);

            await Promise.all([
              materialRepo.updateWithPreview(
                materialId,
                llmResult.preview.overview,
                llmResult.content_classification,
                material.meta || {}
              ),
              notebookRepo.updateWithPreview(notebookId, {
                title: llmResult.title,
                emoji: !notebook.emoji ? llmResult.emoji : undefined,
                color: !notebook.color ? llmResult.color : undefined,
                preview: llmResult.preview,
                contentClassification: llmResult.content_classification,
                contentSummary,
              }),
              usageLogger.logSuccess(userId, notebookId, 'preview', llmResult)
                .catch((err) =>
                  console.error('[UsageLogger] Non-critical logging failure:', err)
                ),
            ]);

            // Phase A: delete original audio/image files from storage now
            // that extracted text is safely in materials.content. Mirrors the
            // PDF cleanup added in Phase 2.5. Website, YouTube, and text
            // materials don't use storage so skip them.
            // Best-effort — StorageCleanup.deleteFile() never throws.
            if (
              material.storage_path &&
              (material.kind === 'audio' || material.kind === 'image' || material.kind === 'photo')
            ) {
              setPhase(ctx, 'deleting_storage');
              await storageCleanup.deleteFile(material.storage_path);
            }

            setPhase(ctx, 'complete');
            console.log(
              `[process-material] ${material.kind} processed: ${materialId} (${extractedContent.length} chars, ${llmResult.latency}ms)`
            );
          }
        } catch (processingError: any) {
          setPhase(ctx, 'error');
          console.error(
            `[process-material] Background task error in phase=${ctx.phase}:`,
            processingError
          );

          await captureException(processingError, {
            material_id: materialId,
            notebook_id: notebookId,
            user_id: user?.id,
            operation: 'process-material-background',
            phase: ctx.phase,
            kind: material.kind,
          });

          const jobType =
            material.kind === 'pdf' ? 'pdf_extract_preview' : 'preview';

          try {
            await materialRepo.updateWithError(materialId, processingError.message, {
              error_type: processingError?.name || 'Error',
              error_stack: String(processingError?.stack || '').slice(0, 2000),
              last_phase: ctx.phase,
              duration_ms: Date.now() - ctx.startedAt,
            });
            ctx.failurePersisted = true;
          } catch (writeErr) {
            console.error(
              '[process-material] Failed to persist material error:',
              writeErr
            );
          }

          try {
            await notebookRepo.updateWithError(
              notebookId,
              originalTitle,
              processingError.message
            );
          } catch (writeErr) {
            console.error(
              '[process-material] Failed to persist notebook error:',
              writeErr
            );
          }

          try {
            await usageLogger.logError(userId, notebookId, jobType, processingError.message);
          } catch (writeErr) {
            console.error('[UsageLogger] Non-critical logging failure:', writeErr);
          }
        } finally {
          // Remove from the in-flight set whether we succeeded or failed,
          // so beforeunload doesn't try to write a breadcrumb for a task
          // that's already finished.
          inflightRequests.delete(ctx);
        }
      })()
    );

    // Return the "accepted" response IMMEDIATELY. Client releases the
    // connection here — Realtime will deliver the final state via
    // notebooks-table UPDATE events once the background task finishes.
    setPhase(ctx, 'returned_accepted');
    return new Response(
      JSON.stringify({
        success: true,
        accepted: true,
        materialId,
        notebook_id: notebookId,
        kind: material.kind,
        message: 'Processing started in background',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    // Outer catch: synchronous setup errors only (auth parse, validation,
    // rate limit, lock acquisition). Background task errors are caught
    // inside the waitUntil closure.
    console.error(`[process-material] Sync setup error in phase=${ctx.phase}:`, error);

    await captureException(error, {
      operation: 'process-material-sync',
      notebook_id: ctx.notebookId,
      user_id: user?.id,
      phase: ctx.phase,
    });

    // Best-effort forensic write if we got far enough to have a materialId
    if (ctx.materialId && ctx.supabase && !ctx.failurePersisted) {
      try {
        await ctx.supabase
          .from('materials')
          .update({
            status: 'failed',
            meta: {
              error: error?.message || 'unknown_sync_error',
              error_type: error?.name || 'Error',
              error_stack: String(error?.stack || '').slice(0, 2000),
              last_phase: ctx.phase,
              duration_ms: Date.now() - ctx.startedAt,
              failed_at: new Date().toISOString(),
            },
          })
          .eq('id', ctx.materialId);
      } catch (writeErr) {
        console.error('[process-material] Failed to persist sync error:', writeErr);
      }
    }

    inflightRequests.delete(ctx);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        stack: getOptionalEnv('DENO_ENV', '') === 'development' ? error.stack : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Build a minimal content_summary for a single material. Phase 2 deletes
 * the old "fetch all materials and aggregate" pattern — the notebook now
 * reflects only the material that most recently completed. For multi-
 * material notebooks, whichever material finishes last "wins" the notebook
 * preview, classification, and summary.
 *
 * A future Phase 3 "Regenerate from all sources" button will recompute this
 * by aggregating across all materials on user demand.
 */
function buildPerMaterialSummary(classification: {
  type?: string | null;
  exam_relevance?: string | null;
  subject_area?: string | null;
}): Record<string, any> {
  const type = classification.type || 'general';
  return {
    material_count: 1,
    has_past_paper: type === 'past_paper',
    has_notes: type === 'lecture_notes' || type === 'textbook_chapter',
    has_video: type === 'video_transcript',
    material_types: [type],
    exam_relevance: classification.exam_relevance || 'medium',
    primary_subject: classification.subject_area || null,
  };
}
