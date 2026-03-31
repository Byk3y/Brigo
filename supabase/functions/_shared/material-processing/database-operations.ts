/**
 * Database Operations
 * Repository classes for centralized database access in material processing
 */

import type { Material, ContentClassification } from './types.ts';

/**
 * Supabase client type (loose typing for compatibility)
 */
type SupabaseClient = any;

/**
 * MaterialRepository
 * Handles all database operations for materials
 */
export class MaterialRepository {
  constructor(private supabase: SupabaseClient) { }

  /**
   * Find material by ID
   */
  async findById(materialId: string): Promise<{ data: Material | null; error: any }> {
    const { data, error } = await this.supabase
      .from('materials')
      .select('*')
      .eq('id', materialId)
      .single();

    return { data, error };
  }

  /**
   * Update material with extracted content
   */
  async updateWithExtractedContent(
    materialId: string,
    content: string,
    existingMeta: Record<string, any> = {},
    extractMetadata: Record<string, any> = {}
  ): Promise<void> {
    await this.supabase
      .from('materials')
      .update({
        content,
        processed: true, // Keep for compatibility
        status: 'processed',
        processed_at: new Date().toISOString(),
        meta: {
          ...existingMeta,
          ...extractMetadata,
        },
      })
      .eq('id', materialId);
  }

  /**
   * Update material with preview text and content classification
   */
  async updateWithPreview(
    materialId: string,
    previewText: string,
    contentClassification: ContentClassification,
    existingMeta: Record<string, any> = {}
  ): Promise<void> {
    await this.supabase
      .from('materials')
      .update({
        preview_text: previewText.substring(0, 500), // Scannable preview
        meta: {
          ...existingMeta,
          content_classification: contentClassification,
        },
      })
      .eq('id', materialId);
  }

  /**
   * Find all processed materials for a notebook
   */
  async findAllProcessedByNotebook(notebookId: string): Promise<any[]> {
    const { data } = await this.supabase
      .from('materials')
      .select('content, meta, kind')
      .eq('notebook_id', notebookId)
      .eq('processed', true);

    return data || [];
  }

  /**
   * Update material status to failed with error message
   */
  async updateWithError(materialId: string, errorMessage: string): Promise<void> {
    const { data: existing } = await this.findById(materialId);
    const existingMeta = existing?.meta || {};

    await this.supabase
      .from('materials')
      .update({
        status: 'failed',
        meta: {
          ...existingMeta,
          error: errorMessage,
          failed_at: new Date().toISOString(),
        },
      })
      .eq('id', materialId);
  }

  /**
   * Find all materials for a notebook (for building content summary)
   */
  async findAllByNotebook(notebookId: string): Promise<any[]> {
    const { data } = await this.supabase
      .from('materials')
      .select('id, meta, kind, status, title, filename, created_at')
      .eq('notebook_id', notebookId);

    return data || [];
  }

  /**
   * Count materials that are still processing (not yet completed)
   * Used to determine if this is the last material in a batch
   * 
   * @param notebookId - The notebook ID to check
   * @param excludeMaterialId - Optional material ID to exclude from count (current material)
   * @returns Number of materials still processing
   */
  async countPendingMaterials(notebookId: string, excludeMaterialId?: string): Promise<number> {
    let query = this.supabase
      .from('materials')
      .select('id', { count: 'exact', head: true })
      .eq('notebook_id', notebookId)
      .in('status', ['processing', 'pending']);

    if (excludeMaterialId) {
      query = query.neq('id', excludeMaterialId);
    }

    const { count, error } = await query;

    if (error) {
      console.error('[MaterialRepository] Error counting pending materials:', error);
      return 0; // Default to 0 to allow preview generation on error
    }

    return count || 0;
  }
}

/**
 * NotebookRepository
 * Handles all database operations for notebooks
 */
export class NotebookRepository {
  constructor(private supabase: SupabaseClient) { }

  /**
   * Find notebook by ID
   */
  async findById(notebookId: string): Promise<{ data: any; error: any }> {
    const { data, error } = await this.supabase
      .from('notebooks')
      .select('id, user_id, title, emoji, color')
      .eq('id', notebookId)
      .single();

    return { data, error };
  }

  /**
   * Update notebook status (e.g., to 'extracting')
   */
  async updateStatus(notebookId: string, status: string): Promise<void> {
    await this.supabase
      .from('notebooks')
      .update({ status })
      .eq('id', notebookId);
  }

  /**
   * Update notebook with AI-generated preview and metadata
   */
  async updateWithPreview(
    notebookId: string,
    updates: {
      title: string;
      emoji?: string;
      color?: string;
      preview: { overview: string; suggested_questions: string[] };
      contentClassification: ContentClassification;
      contentSummary: Record<string, any>;
    }
  ): Promise<void> {
    const notebookUpdate: any = {
      title: updates.title,
      status: 'preview_ready',
      meta: {
        preview: updates.preview,
        content_classification: updates.contentClassification,
        content_summary: updates.contentSummary,
      },
      preview_generated_at: new Date().toISOString(),
    };

    // Only set emoji and color if provided
    if (updates.emoji) {
      notebookUpdate.emoji = updates.emoji;
    }
    if (updates.color) {
      notebookUpdate.color = updates.color;
    }

    await this.supabase
      .from('notebooks')
      .update(notebookUpdate)
      .eq('id', notebookId);
  }

  /**
   * Update notebook with error information
   * Now less terminal - doesn't necessarily block the whole notebook
   */
  async updateWithError(notebookId: string, originalTitle: string, errorMessage: string): Promise<void> {
    await this.supabase
      .from('notebooks')
      .update({
        title: originalTitle,
        // We still set 'ready_for_studio' even on error if some materials exist,
        // so the notebook isn't completely locked.
        status: 'ready_for_studio',
        meta: {
          error: errorMessage,
          last_failure_at: new Date().toISOString(),
        },
      })
      .eq('id', notebookId);
  }
}

/**
 * UsageLogger
 * Handles usage logging for cost tracking and analytics
 */
export class UsageLogger {
  constructor(private supabase: SupabaseClient) { }

  /**
   * Log successful LLM usage
   */
  async logSuccess(
    userId: string,
    notebookId: string,
    jobType: string,
    llmResult: {
      model: string;
      usage: { inputTokens: number; outputTokens: number; totalTokens: number };
      costCents: number;
      latency: number;
    }
  ): Promise<void> {
    await this.supabase.from('usage_logs').insert({
      user_id: userId,
      notebook_id: notebookId,
      job_type: jobType,
      model_used: llmResult.model,
      input_tokens: llmResult.usage.inputTokens,
      output_tokens: llmResult.usage.outputTokens,
      total_tokens: llmResult.usage.totalTokens,
      estimated_cost_cents: llmResult.costCents,
      latency_ms: llmResult.latency,
      status: 'success',
    });
  }

  /**
   * Log failed operation
   */
  async logError(
    userId: string,
    notebookId: string,
    jobType: string,
    errorMessage: string
  ): Promise<void> {
    await this.supabase.from('usage_logs').insert({
      user_id: userId,
      notebook_id: notebookId,
      job_type: jobType,
      model_used: 'error',
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      estimated_cost_cents: 0,
      latency_ms: 0,
      status: 'error',
      error_message: errorMessage,
    });
  }
}

/**
 * StorageCleanup
 * Handles storage cleanup operations
 */
export class StorageCleanup {
  constructor(private supabase: SupabaseClient) { }

  /**
   * Delete a file from storage (best effort, doesn't throw)
   */
  async deleteFile(storagePath: string): Promise<void> {
    console.log(`Cleaning up storage file: ${storagePath}`);
    try {
      const { error: deleteError } = await this.supabase.storage
        .from('uploads')
        .remove([storagePath]);

      if (deleteError) {
        console.error('Failed to clean up storage:', deleteError);
      } else {
        console.log('Storage file cleaned up successfully');
      }
    } catch (cleanupError) {
      console.error('Storage cleanup error:', cleanupError);
      // Don't throw - cleanup is best effort
    }
  }
}
