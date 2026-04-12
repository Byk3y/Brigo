/**
 * Client-side upload size guards for audio and image materials.
 *
 * Mirrors the pdfGuard.ts pattern. These are the first line of defense —
 * the server-side UploadSizeGuard in process-material is the second, so
 * even if this guard is bypassed the upload still gets rejected. But
 * catching it here avoids wasting bandwidth and gives smoother UX.
 */

import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/src/legacy/FileSystem';

// ── Limits ──────────────────────────────────────────────────────────
// Audio: Gemini 2.0 Flash inline_data tops out around 20 MB base64,
// but audio files can be huge. 100 MB raw is a generous ceiling that
// still keeps upload times reasonable on mobile.
export const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
export const MAX_AUDIO_LABEL = '100 MB';

// Image: individual images are compressed client-side (2000px, 80%
// quality) but the user could pick an uncompressed TIFF or RAW file
// from the gallery. 20 MB per image is more than enough.
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_LABEL = '20 MB';

// ── Shared size resolver ────────────────────────────────────────────
/**
 * Resolve a file's size in bytes. Tries the picker-reported size first,
 * then falls back to FileSystem.getInfoAsync.
 *
 * Returns null when the size can't be determined (guard should fail-closed).
 */
async function resolveFileSize(
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
    console.warn('[mediaGuard] Failed to stat file:', err);
  }
  return null;
}

// ── Result type ─────────────────────────────────────────────────────
export type MediaGuardResult =
  | { ok: true; size: number }
  | { ok: false; reason: 'too_large' | 'unknown_size'; size?: number };

// ── Audio guard ─────────────────────────────────────────────────────
export async function enforceAudioSizeGuard(args: {
  uri: string;
  name?: string;
  pickerSize?: number;
}): Promise<MediaGuardResult> {
  const { uri, name, pickerSize } = args;

  console.log(
    `[mediaGuard] audio check name=${name ?? '?'} pickerSize=${pickerSize ?? '?'} MAX=${MAX_AUDIO_LABEL}`
  );

  const resolvedSize = await resolveFileSize(uri, pickerSize);

  if (resolvedSize === null) {
    Alert.alert(
      'Could not read file',
      "We couldn't determine the file size. Please try again or pick a different audio file."
    );
    return { ok: false, reason: 'unknown_size' };
  }

  if (resolvedSize > MAX_AUDIO_BYTES) {
    const sizeMB = (resolvedSize / (1024 * 1024)).toFixed(1);
    Alert.alert(
      'Audio file too large',
      `This file is ${sizeMB} MB. We currently support audio files up to ${MAX_AUDIO_LABEL}. Try trimming the recording or splitting it into smaller segments.`
    );
    return { ok: false, reason: 'too_large', size: resolvedSize };
  }

  return { ok: true, size: resolvedSize };
}

// ── Image guard ─────────────────────────────────────────────────────
export async function enforceImageSizeGuard(args: {
  uri: string;
  name?: string;
  pickerSize?: number;
  fileSize?: number;
}): Promise<MediaGuardResult> {
  const { uri, name, pickerSize, fileSize } = args;

  console.log(
    `[mediaGuard] image check name=${name ?? '?'} pickerSize=${pickerSize ?? fileSize ?? '?'} MAX=${MAX_IMAGE_LABEL}`
  );

  const resolvedSize = await resolveFileSize(uri, pickerSize ?? fileSize);

  if (resolvedSize === null) {
    Alert.alert(
      'Could not read file',
      "We couldn't determine the file size. Please try again or pick a different image."
    );
    return { ok: false, reason: 'unknown_size' };
  }

  if (resolvedSize > MAX_IMAGE_BYTES) {
    const sizeMB = (resolvedSize / (1024 * 1024)).toFixed(1);
    Alert.alert(
      'Image too large',
      `This image is ${sizeMB} MB. We currently support images up to ${MAX_IMAGE_LABEL}. Try using a smaller or more compressed image.`
    );
    return { ok: false, reason: 'too_large', size: resolvedSize };
  }

  return { ok: true, size: resolvedSize };
}
