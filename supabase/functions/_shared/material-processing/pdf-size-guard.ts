/**
 * UploadSizeGuard — enforces hard size ceilings on uploaded materials.
 *
 * Per-type limits:
 *   - PDF  (14 MB): Gemini 2.5 Flash via OpenRouter base64 inline — ~20 MB
 *     payload limit, 33% encoding overhead → 14 MB raw max.
 *   - Audio (100 MB): Gemini 2.0 Flash direct API. Large audio files cause
 *     timeouts and waste storage quota if extraction fails.
 *   - Image (20 MB): Gemini 2.0 Flash multimodal. Per-image ceiling; users
 *     can upload up to 5 images per notebook.
 *
 * DEFENSE IN DEPTH. The client-side guards in lib/pdfGuard.ts and
 * lib/mediaGuard.ts catch these first (better UX — no wasted upload).
 * This server-side check catches retries / webhook invocations / any
 * path that bypasses the client.
 *
 * Previously named PdfSizeGuard — expanded in Phase A to cover all
 * file-backed material types.
 */

import type { Material, PdfSizeCheckResult } from './types.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

/** Per-type size ceilings in bytes. Must match client-side guards. */
const SIZE_LIMITS: Record<string, { bytes: number; label: string }> = {
  pdf:   { bytes: 14  * 1024 * 1024, label: '14 MB'  },
  audio: { bytes: 100 * 1024 * 1024, label: '100 MB' },
  image: { bytes: 20  * 1024 * 1024, label: '20 MB'  },
  photo: { bytes: 20  * 1024 * 1024, label: '20 MB'  },
};

const KIND_LABELS: Record<string, string> = {
  pdf: 'PDF',
  audio: 'audio file',
  image: 'image',
  photo: 'image',
};

/**
 * Kept as `PdfSizeGuard` class name for backwards compatibility with
 * process-material/index.ts imports. The class now handles all
 * file-backed material types, not just PDFs.
 */
export class PdfSizeGuard {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Check the uploaded file's size against the per-type hard ceiling.
   *
   * @returns `{ rejectedReason, fileSizeBytes }` if the file is too large —
   *          caller persists a user-facing failure and returns a clean 400.
   *          `{ fileSizeBytes }` otherwise — caller proceeds.
   *
   * Materials without storage_path (website, youtube, text) pass through.
   * Unknown kinds pass through.
   * Fails open on any storage error.
   */
  async check(material: Material): Promise<PdfSizeCheckResult> {
    const limit = SIZE_LIMITS[material.kind];

    // Only check kinds with defined limits that use storage
    if (!limit || !material.storage_path) {
      return {};
    }

    try {
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

      // If size came back as 0 (unknown), let it through — the extractor
      // will catch oversized files when it actually downloads them.
      if (fileSizeBytes > limit.bytes) {
        const sizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(1);
        const kindLabel = KIND_LABELS[material.kind] || material.kind;
        console.warn(
          `[UploadSizeGuard] Rejecting oversized ${material.kind}: ${sizeMB}MB > ${limit.label} ceiling`
        );
        return {
          fileSizeBytes,
          rejectedReason:
            `This ${kindLabel} is ${sizeMB} MB. We currently support ${kindLabel}s up to ${limit.label} — ` +
            `please use a smaller file.`,
        };
      }

      return { fileSizeBytes };
    } catch (error: any) {
      console.warn(
        `[UploadSizeGuard] Could not check ${material.kind} size, allowing processing:`,
        error.message
      );
      return {};
    }
  }
}
