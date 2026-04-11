/**
 * Large PDF Handler
 * Detects large PDFs and routes them to background processing
 */

import { estimatePageCount } from '../pdf/utils.ts';
import { LARGE_PDF_CONFIG } from './config.ts';
import type { Material, LargePDFCheckResult } from './types.ts';

/**
 * Supabase client type (loose typing for compatibility)
 */
type SupabaseClient = any;

/**
 * Absolute hard ceiling above which we reject the PDF outright.
 *
 * Why 14 MB:
 * - Gemini 2.0 Flash inline_data payload cap is 20 MB
 * - Base64 encoding adds ~33% overhead (14 MB raw ≈ 19 MB base64)
 * - The chunked-extraction path (which would otherwise handle larger files)
 *   is currently broken due to pdfjs-dist@4 worker setup issues in Deno
 *   edge functions. Files routed there fail with "Setting up fake worker failed".
 *
 * Phase 2 will switch to the Gemini File API and remove this ceiling.
 * Until then: any PDF above this size is rejected BEFORE we enqueue a job.
 */
const HARD_MAX_PDF_BYTES = 14 * 1024 * 1024;

/**
 * LargePDFHandler class
 * Handles detection of large PDFs and background job queueing
 */
export class LargePDFHandler {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Check if PDF should be processed in background and queue if needed
   *
   * @param material - The material to check
   * @param notebookId - The notebook ID
   * @param userId - The user ID
   * @returns Result indicating whether to process in background, with optional job ID
   */
  async checkAndQueue(
    material: Material,
    notebookId: string,
    userId: string
  ): Promise<LargePDFCheckResult> {
    // Only check PDFs
    if (material.kind !== 'pdf' || !material.storage_path) {
      return { shouldProcessInBackground: false };
    }

    try {
      // Get file metadata to check size
      const { data: fileList, error: listError } = await this.supabase.storage
        .from('uploads')
        .list(
          material.storage_path.substring(0, material.storage_path.lastIndexOf('/')),
          {
            search: material.storage_path.substring(
              material.storage_path.lastIndexOf('/') + 1
            ),
          }
        );

      let fileSizeBytes = 0;
      if (fileList && fileList.length > 0) {
        fileSizeBytes = fileList[0].metadata?.size || 0;
      }

      // Hard ceiling check — files above this size cannot be processed by the
      // current extraction pipeline (see HARD_MAX_PDF_BYTES comment). Reject
      // cleanly so we don't enqueue a job that's guaranteed to fail and leave
      // the user staring at a spinning "Queued for processing" card.
      if (fileSizeBytes > HARD_MAX_PDF_BYTES) {
        const sizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(1);
        const limitMB = (HARD_MAX_PDF_BYTES / (1024 * 1024)).toFixed(0);
        console.warn(
          `[LargePDFHandler] Rejecting oversized PDF: ${sizeMB}MB > ${limitMB}MB ceiling`
        );
        return {
          shouldProcessInBackground: false,
          fileSizeBytes,
          rejectedReason:
            `This PDF is ${sizeMB} MB. We currently support PDFs up to ${limitMB} MB — ` +
            `please split the document into smaller sections and upload each part separately.`,
        };
      }

      // Check if large by size
      const isLargeBySize = fileSizeBytes > LARGE_PDF_CONFIG.THRESHOLD_BYTES;

      // Estimate page count for PDFs over 2MB or if size unknown
      let estimatedPages = 0;
      if (
        fileSizeBytes > LARGE_PDF_CONFIG.SIZE_CHECK_THRESHOLD_BYTES ||
        fileSizeBytes === 0
      ) {
        estimatedPages = await this.estimatePages(material.storage_path);
      }

      // Determine if this is a large PDF
      const isLargePDF =
        isLargeBySize || estimatedPages > LARGE_PDF_CONFIG.THRESHOLD_PAGES;

      if (isLargePDF) {
        console.log(
          `[LargePDFHandler] Large PDF detected: ${estimatedPages} pages, ` +
            `${(fileSizeBytes / 1024 / 1024).toFixed(2)}MB. Routing to background processing.`
        );

        // Update notebook status to indicate background processing
        await this.supabase
          .from('notebooks')
          .update({
            status: 'extracting',
            meta: {
              background_processing: true,
              estimated_pages: estimatedPages,
              file_size_bytes: fileSizeBytes,
            },
          })
          .eq('id', notebookId);

        // Enqueue job for background processing
        const { data: jobId, error: enqueueError } = await this.supabase.rpc(
          'enqueue_processing_job',
          {
            p_user_id: userId,
            p_material_id: material.id,
            p_notebook_id: notebookId,
            p_job_type: 'pdf_extraction',
            p_estimated_pages: estimatedPages,
            p_file_size_bytes: fileSizeBytes,
            p_priority: 0,
          }
        );

        if (enqueueError) {
          console.error('[LargePDFHandler] Failed to enqueue job:', enqueueError);
          // Fall through to synchronous processing as fallback
          return { shouldProcessInBackground: false };
        }

        // Trigger background worker (fire-and-forget)
        this.supabase.functions
          .invoke('process-large-pdf', {
            body: { job_id: jobId },
          })
          .catch((err: any) => {
            console.warn(
              '[LargePDFHandler] Background worker trigger failed, job will be picked up by scheduler:',
              err.message
            );
          });

        return {
          shouldProcessInBackground: true,
          jobId,
          estimatedPages,
          fileSizeBytes,
          message:
            'Large PDF queued for background processing. Check status via realtime subscription.',
        };
      }

      // Not a large PDF, process synchronously
      return { shouldProcessInBackground: false };
    } catch (error: any) {
      console.warn(
        '[LargePDFHandler] Could not check PDF size, proceeding with sync processing:',
        error.message
      );
      // Continue with synchronous processing on error
      return { shouldProcessInBackground: false };
    }
  }

  /**
   * Estimate page count using range request
   */
  private async estimatePages(storagePath: string): Promise<number> {
    try {
      // Create a signed URL to fetch just the header using Range
      const { data: signedUrlData, error: signedUrlError } =
        await this.supabase.storage.from('uploads').createSignedUrl(storagePath, 60);

      if (signedUrlError || !signedUrlData) {
        console.warn('[LargePDFHandler] Failed to get signed URL for estimation');
        return 0;
      }

      // Fetch only the first 1KB - enough for most PDF headers and metadata
      const response = await fetch(signedUrlData.signedUrl, {
        headers: { Range: `bytes=0-${LARGE_PDF_CONFIG.RANGE_REQUEST_BYTES}` },
      });

      if (response.ok || response.status === 206) {
        const buffer = new Uint8Array(await response.arrayBuffer());
        const estimatedPages = estimatePageCount(buffer);
        console.log(`[LargePDFHandler] Estimated pages from header: ${estimatedPages}`);
        return estimatedPages;
      }

      return 0;
    } catch (error: any) {
      console.warn(
        '[LargePDFHandler] Error estimating pages with range request:',
        error.message
      );
      return 0;
    }
  }
}
