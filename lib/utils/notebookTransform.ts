/**
 * Notebook Mapper
 * Centralized transformation utilities for Supabase -> App Model conversions.
 * This module is the single source of truth for all notebook-related type transformations.
 */

import type { Notebook, Material, ChatMessage } from '@/lib/store/types';
import { getFilenameFromPath } from '@/lib/utils';

/**
 * Transform a raw Supabase material record to the app's Material type.
 * @param m - Raw material data from Supabase
 * @param fallbackTitle - Fallback title (usually notebook title)
 * @returns Transformed Material object
 */
export function mapSupabaseMaterialToModel(m: any, fallbackTitle?: string): Material {
  return {
    id: m.id,
    type: m.kind as Material['type'],
    uri: m.storage_path || m.external_url || undefined,
    filename: m.meta?.filename || getFilenameFromPath(m.storage_path || undefined),
    content: m.content || undefined,
    preview_text: m.preview_text || undefined,
    title: m.meta?.title || fallbackTitle || 'Source',
    createdAt: m.created_at || new Date().toISOString(),
    processed: !!m.processed,
    status: (m.status as Material['status']) || 'processing',
    thumbnail: m.thumbnail || undefined,
    meta: m.meta,
  };
}

/**
 * Transform raw Supabase notebook data to Notebook format.
 * @param nb - Raw notebook data from Supabase
 * @param existingMaterials - Optional existing materials to preserve (for partial updates)
 * @returns Transformed Notebook object
 */
export function mapSupabaseNotebookToModel(nb: any, existingMaterials?: Material[]): Notebook {
  const rawMaterials = nb.materials
    ? (Array.isArray(nb.materials) ? nb.materials : [nb.materials])
    : [];

  return {
    id: nb.id,
    title: nb.title,
    emoji: nb.emoji,
    flashcardCount: nb.flashcard_count || 0,
    lastStudied: nb.last_studied || undefined,
    progress: nb.progress || 0,
    createdAt: nb.created_at || new Date().toISOString(),
    color: nb.color as Notebook['color'],
    status: nb.status as Notebook['status'],
    meta: nb.meta || {},
    materials: existingMaterials || rawMaterials.map((m: any) => mapSupabaseMaterialToModel(m, nb.title)),
  };
}

/**
 * Transform raw Supabase chat message to ChatMessage format.
 * @param msg - Raw chat message from Supabase
 * @returns Transformed ChatMessage object
 */
export function mapSupabaseChatMessageToModel(msg: any): ChatMessage {
  return {
    id: msg.id,
    notebook_id: msg.notebook_id,
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
    sources: Array.isArray(msg.sources) ? msg.sources : [],
    created_at: msg.created_at,
  };
}

// Backward compatibility export
export const transformNotebook = mapSupabaseNotebookToModel;







