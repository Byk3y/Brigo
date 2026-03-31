/**
 * Discover Service
 * Frontend service for discovering and importing web sources
 */

import { supabase } from '@/lib/supabase';

export interface DiscoveredSource {
    title: string;
    url: string;
    domain: string;
    snippet: string;
}

export interface DiscoverSourcesResult {
    success: boolean;
    query: string;
    summary: string;
    sources: DiscoveredSource[];
    total_found: number;
}

/**
 * Discover sources for a given topic using AI-powered search
 */
export async function discoverSources(query: string): Promise<DiscoverSourcesResult> {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    if (!accessToken) {
        throw new Error('Not authenticated');
    }

    const { data, error } = await supabase.functions.invoke('discover-sources', {
        body: { query, max_sources: 5 },
    });

    if (error) {
        console.error('[discoverSources] Error:', error);

        // Try to extract detailed error message from response body
        let detail = error.message;
        if (error.name === 'FunctionsHttpError') {
            try {
                const errBody = await (error as any).context.json();
                if (errBody && errBody.error) {
                    detail = errBody.error;
                }
            } catch (e) {
                // Ignore parsing errors
            }
        }

        throw new Error(detail || 'Failed to discover sources');
    }

    if (!data.success) {
        throw new Error(data.error || 'Failed to discover sources');
    }

    return data as DiscoverSourcesResult;
}

/**
 * Import discovered sources into a notebook
 * Creates materials for each selected source and triggers processing
 */
export async function importDiscoveredSources(
    notebookId: string | null,
    sources: DiscoveredSource[],
    notebookTitle?: string
): Promise<{ notebookId: string; materialIds: string[] }> {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    if (!userId) {
        throw new Error('Not authenticated');
    }

    let targetNotebookId = notebookId;

    // If no notebook provided, create a new one
    if (!targetNotebookId) {
        const title = notebookTitle || `${sources[0]?.title?.slice(0, 50) || 'Web Sources'}`;

        const { data: newNotebook, error: notebookError } = await supabase
            .from('notebooks')
            .insert({
                user_id: userId,
                title,
                status: 'pending',
                meta: {
                    source_type: 'discover_sources',
                    sources_count: sources.length,
                },
            })
            .select()
            .single();

        if (notebookError || !newNotebook) {
            throw new Error('Failed to create notebook');
        }

        targetNotebookId = newNotebook.id;
    } else {
        // Update existing notebook status
        await supabase
            .from('notebooks')
            .update({ status: 'pending' })
            .eq('id', targetNotebookId);
    }

    // Create materials for each source in bulk (Fastest)
    const materialData = sources.map(source => ({
        notebook_id: targetNotebookId,
        user_id: userId,
        kind: 'website',
        external_url: source.url,
        status: 'pending',
        meta: {
            title: source.title,
            filename: source.title,
            url: source.url,
            domain: source.domain,
            snippet: source.snippet,
            source: 'discover_sources',
        },
    }));

    const { data: createdMaterials, error: materialError } = await supabase
        .from('materials')
        .insert(materialData)
        .select();

    if (materialError || !createdMaterials) {
        console.error('[importDiscoveredSources] Failed to create materials:', materialError);
        throw new Error('Failed to create sources');
    }

    const materialIds = createdMaterials.map(m => m.id);

    // Trigger processing in the background (DO NOT AWAIT THE ENTIRE LOOP)
    // This allows the UI to navigate instantly while processing happens
    const triggerProcessing = async () => {
        for (const materialId of materialIds) {
            try {
                // Fire and forget - each material processing can take 10s+
                supabase.functions.invoke('process-material', {
                    body: { material_id: materialId },
                });

                // Very small staggering just to avoid race conditions on the first few logs
                await new Promise((resolve) => setTimeout(resolve, 100));
            } catch (error) {
                console.error('[importDiscoveredSources] Failed to trigger background processing:', error);
            }
        }
    };

    // Start background triggers
    triggerProcessing();

    return {
        notebookId: targetNotebookId,
        materialIds,
    };
}
