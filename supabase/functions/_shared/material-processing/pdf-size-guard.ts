/**
 * PdfSizeGuard — enforces the 14 MB hard ceiling on uploaded PDFs.
 *
 * Why 14 MB:
 *   - Gemini 2.5 Flash via OpenRouter accepts PDFs as base64 data URLs
 *     embedded in the chat completions request body
 *   - OpenRouter's practical request size limit is ~20 MB
 *   - Base64 encoding adds ~33% overhead (14 MB raw ≈ 19 MB encoded)
 *   - So 14 MB is the max raw PDF size that reliably fits
 *
 * This is a DEFENSE IN DEPTH check. The client-side guard in
 * `lib/pdfGuard.ts` catches this first (better UX — no wasted upload).
 * This server-side check catches retries / webhook invocations / any
 * path that bypasses the client.
 *
 * Renamed from `LargePDFHandler` in Phase 3. The previous name was a
 * holdover from the pre-Phase-2 pipeline that routed large PDFs to a
 * background worker — that path is gone. Now it's just a size gate.
 */

import type { Material, PdfSizeCheckResult } from './types.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

/**
 * Hard ceiling. Must match `MAX_PDF_BYTES` in lib/pdfGuard.ts on the client.
 */
const HARD_MAX_PDF_BYTES = 14 * 1024 * 1024;

export class PdfSizeGuard {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Check the uploaded PDF's file size against the 14 MB hard ceiling.
   *
   * @returns `{ rejectedReason, fileSizeBytes }` if the file is too large —
   *          caller persists a user-facing failure and returns a clean 400.
   *          `{ fileSizeBytes }` otherwise — caller proceeds.
   *
   * Fails open on any storage error: if we can't read the file size, we let
   * the PDF through and `PdfProcessor` will catch oversized files when it
   * actually downloads them.
   */
  async check(material: Material): Promise<PdfSizeCheckResult> {
    // Only check PDFs — other material types pass through.
    if (material.kind !== 'pdf' || !material.storage_path) {
      return {};
    }

    try {
      // Look up the file size in storage. We list the parent directory and
      // filter to the specific filename to get the metadata.
      const lastSlash = material.storage_path.lastIndexOf('/');
      const parentPath = material.storage_path.substring(0, lastSlash);
      const fileName = material.storage_path.substring(lastSlash + 1);

      const { data: fileList } = await this.supabase.storage
        .from('uploads')
        .list(parentPath, { search: fileName });

      let fileSizeBytes = 0;
      if (fileList && fileList.length > 0) {
        fileSizeBytes = fileList[0].metadata?.size || 0;
      }

      // Hard ceiling check. If the file size came back as 0 (unknown), we
      // let it through — the PdfProcessor will catch oversized files when
      // it actually downloads them.
      if (fileSizeBytes > HARD_MAX_PDF_BYTES) {
        const sizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(1);
        const limitMB = (HARD_MAX_PDF_BYTES / (1024 * 1024)).toFixed(0);
        console.warn(
          `[PdfSizeGuard] Rejecting oversized PDF: ${sizeMB}MB > ${limitMB}MB ceiling`
        );
        return {
          fileSizeBytes,
          rejectedReason:
            `This PDF is ${sizeMB} MB. We currently support PDFs up to ${limitMB} MB — ` +
            `please split the document into smaller sections and upload each part separately.`,
        };
      }

      return { fileSizeBytes };
    } catch (error: any) {
      console.warn(
        '[PdfSizeGuard] Could not check PDF size, allowing sync processing:',
        error.message
      );
      return {};
    }
  }
}
