/**
 * Client-side PDF upload guard.
 *
 * This is the first line of defense against oversized PDFs. The server-side
 * `LargePDFHandler.checkAndQueue` in `process-material` is the second line,
 * so even if this guard is bypassed (e.g. stale client bundle, unknown upload
 * path) the upload still gets rejected — but:
 *   - the file wastes bandwidth on the way to storage
 *   - the user briefly sees a "processing" card before it flips to failed
 *
 * Running this guard pre-picker is noticeably smoother UX.
 */

import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/src/legacy/FileSystem';

// Effective server-side ceiling for PDF extraction today:
// - Gemini 2.0 Flash inline_data accepts payloads up to 20 MB
// - Base64 encoding adds ~33% overhead (raw * 1.37 ≈ base64)
// - So max safe RAW PDF size is ~14 MB to stay under the 20 MB inline limit
// - Chunked extraction (which would handle larger files) is currently broken
//   due to pdfjs-dist worker setup issues in Deno edge functions
//
// Phase 2 will switch to Gemini File API and remove this limit.
export const MAX_PDF_BYTES = 14 * 1024 * 1024;
export const MAX_PDF_LABEL = '14 MB';

/**
 * Resolve a PDF's size in bytes with a fail-closed fallback.
 *
 * DocumentPicker sometimes returns `undefined` for `size` on iOS; in that
 * case we probe the file via FileSystem.getInfoAsync so we don't silently
 * let oversize files through the guard.
 *
 * Returns:
 *   - a number when the size is known
 *   - `null` when the size couldn't be determined at all (guard should fail-closed)
 */
export async function resolvePdfSize(
    uri: string,
    pickerSize?: number
): Promise<number | null> {
    if (typeof pickerSize === 'number' && pickerSize > 0) return pickerSize;
    try {
        const info = await FileSystem.getInfoAsync(uri, { size: true });
        if (info.exists && typeof (info as any).size === 'number') {
            return (info as any).size as number;
        }
    } catch (err) {
        console.warn('[pdfGuard] Failed to stat PDF file:', err);
    }
    return null;
}

export type PdfGuardResult =
    | { ok: true; size: number }
    | { ok: false; reason: 'too_large' | 'unknown_size'; size?: number };

/**
 * Enforce the client-side PDF size ceiling.
 *
 * Shows a user-facing Alert and returns a typed result describing what
 * happened. Callers should early-return on `!ok`.
 *
 * Logs a debug marker at the start so we can verify the latest client
 * bundle is actually loaded — if you don't see `[pdfGuard] check...` in
 * Metro, you need a cold reload (`npx expo start -c`).
 */
export async function enforcePdfSizeGuard(args: {
    uri: string;
    name?: string;
    pickerSize?: number;
}): Promise<PdfGuardResult> {
    const { uri, name, pickerSize } = args;

    // Debug marker — if this line doesn't show up in Metro logs when you
    // tap upload, the JS bundle is stale. HMR sometimes fails to update
    // files that introduce new module-level imports.
    console.log(
        `[pdfGuard] check name=${name ?? '?'} pickerSize=${pickerSize ?? '?'} MAX=${MAX_PDF_LABEL} (${MAX_PDF_BYTES} bytes)`
    );

    const resolvedSize = await resolvePdfSize(uri, pickerSize);

    if (resolvedSize === null) {
        Alert.alert(
            'Could not read file',
            "We couldn't determine the file size. Please try again or pick a different PDF."
        );
        return { ok: false, reason: 'unknown_size' };
    }

    if (resolvedSize > MAX_PDF_BYTES) {
        const sizeMB = (resolvedSize / (1024 * 1024)).toFixed(1);
        Alert.alert(
            'PDF too large',
            `This PDF is ${sizeMB} MB. We currently support PDFs up to ${MAX_PDF_LABEL} — try splitting the document into smaller sections.`
        );
        return { ok: false, reason: 'too_large', size: resolvedSize };
    }

    return { ok: true, size: resolvedSize };
}
