/**
 * Discover Sources Edge Function
 * Uses Gemini with Google Search grounding to find relevant study sources
 * for a given topic query.
 */

import { createClient } from 'supabase';
import { getRequiredEnv } from '../_shared/env.ts';
import { getCorsHeaders, getCorsPreflightHeaders } from '../_shared/cors.ts';
import { checkRateLimit, RATE_LIMITS } from '../_shared/ratelimit.ts';
import { initSentry, captureException, setUser } from '../_shared/sentry.ts';

// Initialize Sentry
initSentry();

interface DiscoverSourcesRequest {
    query: string;
    max_sources?: number; // default: 5
}

interface DiscoveredSource {
    title: string;
    url: string;
    domain: string;
    snippet: string;
}

interface DiscoverSourcesResponse {
    success: boolean;
    query: string;
    summary: string;
    sources: DiscoveredSource[];
    total_found: number;
}

// Configuration
const CONFIG = {
    gemini: {
        model: 'gemini-2.0-flash',
        apiKeyEnvVar: 'GOOGLE_AI_API_KEY',
        maxSources: 10, // Gemini may return up to this many
        userMaxSources: 5, // User can select up to this many
    },
};

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
    } catch {
        return url;
    }
}

/**
 * Call Gemini with Google Search grounding to discover sources
 */
async function discoverSourcesWithGemini(
    query: string,
    maxSources: number
): Promise<{ summary: string; sources: DiscoveredSource[] }> {
    const apiKey = getRequiredEnv(CONFIG.gemini.apiKeyEnvVar);

    console.log(`[Discover Sources] Searching for: "${query}"`);

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.gemini.model}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [
                            {
                                text: `Find ${maxSources} high-quality, diverse sources for studying: "${query}".

Prioritize in order:
1. Wikipedia/encyclopedias for overview
2. Academic PDFs from arXiv, SSRN, or .edu sites (include direct PDF links when available)
3. Official documentation or primary sources
4. High-quality educational guides

For each source:
- title: The exact page title
- url: The canonical URL (include .pdf links for papers)
- snippet: Start with "You" describing the student value (e.g., "You will learn...", "You can explore...")

Summary: One intellectual sentence synthesizing the topic.`,
                            },
                        ],
                    },
                ],
                tools: [
                    {
                        google_search: {},
                    },
                ],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 2048,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "object",
                        properties: {
                            summary: {
                                type: "string",
                                description: "A one-sentence intellectual synthesis of the topic"
                            },
                            sources: {
                                type: "array",
                                description: "Array of high-quality study sources",
                                items: {
                                    type: "object",
                                    properties: {
                                        title: {
                                            type: "string",
                                            description: "The exact title of the source page"
                                        },
                                        url: {
                                            type: "string",
                                            description: "The canonical URL of the source"
                                        },
                                        snippet: {
                                            type: "string",
                                            description: "A brief description starting with 'You' explaining the value"
                                        }
                                    },
                                    required: ["title", "url", "snippet"]
                                }
                            }
                        },
                        required: ["summary", "sources"]
                    }
                },
            }),
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[Discover Sources] Gemini API error status:', response.status);
        throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();

    // Safety check for Gemini response structure
    if (!result.candidates || result.candidates.length === 0) {
        console.error('[Discover Sources] No candidates in Gemini response:', JSON.stringify(result));
        throw new Error('AI failed to generate results. Please try again.');
    }

    const textContent = result.candidates[0].content?.parts?.[0]?.text;
    if (!textContent) {
        console.error('[Discover Sources] Empty text in Gemini response:', JSON.stringify(result));
        throw new Error('AI returned an empty response. Please try again.');
    }

    let jsonString = textContent.trim();

    // EXTREME SAFETY: Extract anything between the first { and the last }
    const firstBrace = jsonString.indexOf('{');
    const lastBrace = jsonString.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonString = jsonString.substring(firstBrace, lastBrace + 1);
    }

    let parsed;
    try {
        parsed = JSON.parse(jsonString);
    } catch (e) {
        console.error('[Discover Sources] Failed to parse as JSON:', jsonString);
        throw new Error('AI returned a malformed response. Please try again.');
    }

    console.log('[Discover Sources] Parsed AI response:', JSON.stringify(parsed));

    const groundingMetadata = result.candidates[0].groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks || [];
    console.log(`[Discover Sources] Grounding chunks: ${groundingChunks.length}`);

    const sources: DiscoveredSource[] = [];

    // Create a map of title -> canonical URL from grounding chunks to help fix proxy URLs
    const chunkMap = new Map<string, string>();
    groundingChunks.forEach((c: any) => {
        if (c.web?.title && c.web?.uri) {
            if (!c.web.uri.includes('vertexaisearch') && !c.web.uri.includes('google.com/search')) {
                chunkMap.set(c.web.title.toLowerCase(), c.web.uri);
            }
        }
    });

    // Process sources from the AI's JSON response
    for (const s of parsed.sources || []) {
        if (sources.length >= maxSources) break;
        let finalUrl = s.url;

        // Safety: ensure finalUrl and s.title exist before calling methods
        if (finalUrl && (finalUrl.includes('vertexaisearch') || finalUrl.includes('google.com/search'))) {
            const betterUrl = chunkMap.get(s.title?.toLowerCase() || '');
            if (betterUrl) finalUrl = betterUrl;
        }

        if (finalUrl && !finalUrl.includes('vertexaisearch')) {
            sources.push({
                title: s.title || 'Source',
                url: finalUrl,
                domain: extractDomain(finalUrl),
                snippet: s.snippet || `You can learn more from ${extractDomain(finalUrl)}.`,
            });
        }
    }

    // Fallback: use grounding chunks if AI returned fewer than 4 sources
    if (sources.length < 4) {
        console.log('[Discover Sources] Using grounding fallback, current sources:', sources.length);
        for (const chunk of groundingChunks) {
            if (sources.length >= maxSources) break;
            const uri = chunk.web?.uri;
            // Accept ANY URL including vertexaisearch as a fallback
            if (uri && !sources.some(s => s.url === uri)) {
                sources.push({
                    title: chunk.web.title || 'Source',
                    url: uri,
                    domain: extractDomain(uri),
                    snippet: `You will find valuable information about ${query} here.`,
                });
            }
        }
    }

    console.log(`[Discover Sources] Found ${sources.length} sources`);

    return {
        summary: parsed.summary || `Explores foundational concepts regarding ${query}.`,
        sources,
    };
}

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: getCorsPreflightHeaders(req) });
    }

    const corsHeaders = getCorsHeaders(req);
    let userId: string | undefined;

    try {
        // Initialize Supabase client
        const supabaseUrl = getRequiredEnv('SUPABASE_URL');
        const supabaseServiceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // AUTHENTICATE: Verify JWT token
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        userId = user.id;
        setUser(userId);
        console.log(`[Discover Sources] User authenticated: ${userId}`);

        // Parse request
        let body: DiscoverSourcesRequest;
        try {
            body = await req.json();
        } catch {
            body = { query: '' };
        }

        const rawQuery = body.query;
        // Ensure max_sources is a valid number
        const inputMaxSources = Number(body.max_sources);
        const max_sources = isNaN(inputMaxSources) ? CONFIG.gemini.userMaxSources : inputMaxSources;

        // Validate query
        if (!rawQuery || typeof rawQuery !== 'string' || rawQuery.trim().length < 2) {
            return new Response(
                JSON.stringify({ error: 'Query must be at least 2 characters', success: false }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        let queryStr = rawQuery.trim();

        if (queryStr.length > 200) {
            return new Response(
                JSON.stringify({ error: 'Query too long (max 200 characters)', success: false }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // SECURITY: Sanitize query to prevent prompt injection attacks
        // Based on OWASP Top 10 for LLMs 2025 best practices
        queryStr = queryStr
            // Basic injection patterns
            .replace(/ignore\s+(all\s+)?(previous\s+)?instructions?/gi, '')
            .replace(/disregard\s+(all\s+)?(previous\s+)?instructions?/gi, '')
            .replace(/forget\s+(all\s+)?(previous\s+)?instructions?/gi, '')
            .replace(/override\s+(all\s+)?(previous\s+)?instructions?/gi, '')
            .replace(/bypass\s+(all\s+)?instructions?/gi, '')
            .replace(/new\s+instructions?:/gi, '')

            // System prompt manipulation
            .replace(/system\s*prompt/gi, '')
            .replace(/system\s*message/gi, '')
            .replace(/\bDAN\b/gi, '')  // Common jailbreak persona
            .replace(/\bJAILBREAK\b/gi, '')

            // Roleplay/persona attacks
            .replace(/you\s+are\s+now/gi, '')
            .replace(/act\s+as\s+if/gi, '')
            .replace(/pretend\s+(you\s+are|to\s+be)/gi, '')
            .replace(/roleplay\s+as/gi, '')
            .replace(/imagine\s+you\s+are/gi, '')
            .replace(/from\s+now\s+on/gi, '')
            .replace(/your\s+new\s+role/gi, '')

            // Hidden instruction markers
            .replace(/\[\[.*?\]\]/g, '')  // [[hidden commands]]
            .replace(/\{\{.*?\}\}/g, '')  // {{hidden commands}}
            .replace(/<<<.*?>>>/g, '')   // <<<hidden commands>>>

            // Code and format manipulation
            .replace(/```[\s\S]*?```/g, '')  // Remove code blocks
            .replace(/---+/g, '-')  // Collapse separator injection
            .replace(/===+/g, '=')  // Collapse separator injection

            // Encoding attacks
            .replace(/%[0-9A-Fa-f]{2}/g, '')  // URL encoding attempts
            .replace(/\\x[0-9A-Fa-f]{2}/g, '')  // Hex encoding
            .replace(/\\u[0-9A-Fa-f]{4}/g, '')  // Unicode escape

            // Format cleanup
            .replace(/\n{3,}/g, '\n\n')  // Collapse excessive newlines
            .replace(/[<>{}[\]|\\^~`]/g, '')  // Remove dangerous chars
            .replace(/\s+/g, ' ')  // Normalize whitespace
            .trim();

        // If sanitization reduced query too much, reject
        if (queryStr.length < 2) {
            return new Response(
                JSON.stringify({ error: 'Invalid query format', success: false }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Rate limiting
        const rateLimitResult = await checkRateLimit({
            identifier: userId || 'anonymous',
            limit: 30, // Relaxed limit for testing
            window: 3600,
            endpoint: 'discover-sources',
        });

        if (!rateLimitResult.allowed) {
            return new Response(
                JSON.stringify({
                    error: 'Too many searches. Please wait before searching again.',
                    success: false,
                    retryAfter: rateLimitResult.retryAfter,
                }),
                {
                    status: 429,
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json',
                        'Retry-After': String(rateLimitResult.retryAfter),
                    },
                }
            );
        }

        // Discover sources using Gemini with Google Search grounding
        const effectiveMaxSources = Math.min(max_sources, CONFIG.gemini.userMaxSources);
        console.log(`[Discover Sources] Processing query: "${queryStr}" (max: ${effectiveMaxSources})`);

        const { summary, sources } = await discoverSourcesWithGemini(
            queryStr,
            effectiveMaxSources
        );

        if (userId) {
            // Non-blocking usage log insert
            supabase.from('usage_logs').insert({
                user_id: userId,
                job_type: 'discover_sources',
                model_used: CONFIG.gemini.model,
                input_tokens: queryStr.length,
                output_tokens: JSON.stringify(sources).length,
                status: 'success',
            }).then((res: any) => {
                if (res.error) console.error('[Discover Sources] Usage log error:', res.error);
            });
        }

        const response: DiscoverSourcesResponse = {
            success: true,
            query: queryStr,
            summary,
            sources,
            total_found: sources.length,
        };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('[Discover Sources] Error:', error);

        try {
            await captureException(error, {
                user_id: userId,
                operation: 'discover-sources',
            });
        } catch (sentryError) {
            console.error('[Discover Sources] Sentry failed:', sentryError);
        }

        return new Response(
            JSON.stringify({
                error: error.message || 'Failed to discover sources',
                success: false
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
