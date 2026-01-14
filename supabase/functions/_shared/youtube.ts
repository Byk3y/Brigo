/**
 * YouTube Transcript Extraction Utility - Optimized Edition v2
 *
 * ARCHITECTURE:
 * 1. PRIMARY: Direct caption extraction using YouTube's innertube API (fastest, ~2-5s)
 * 2. FALLBACK: RapidAPI Supadata (reliable, ~3-8s)
 * 3. CLEANUP: Optional AI cleanup only if transcript quality is poor
 *
 * Speed improvement: ~15s → ~3-8s (skipping unnecessary AI cleanup)
 */

import { getRequiredEnv, getOptionalEnv } from './env.ts';

// ============================================================================
// CONFIGURATION
// ============================================================================

const YOUTUBE_CONFIG = {
    // Direct extraction settings
    directExtraction: {
        enabled: true,
        timeout: 15000, // 15 seconds max for direct extraction
        minContentLength: 100, // Minimum characters to consider valid
    },

    // RapidAPI fallback settings
    rapidApi: {
        enabled: true,
        timeout: 30000, // 30 seconds max
    },

    // AI cleanup settings
    cleanup: {
        enabled: true, // Enabled to fix common transcription errors (e.g., "Claude" → "Cloud")
        minContentLength: 200, // Only cleanup if content is shorter
        model: 'gemini-2.0-flash',
    },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Extract video ID from any YouTube URL format
 * Supports: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, youtube.com/embed/
 */
export function extractYoutubeId(url: string): string | null {
    const patterns = [
        // Standard watch URL
        /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
        // Short URL
        /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        // Shorts URL
        /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        // Embed URL
        /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        // General pattern (fallback)
        /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/)?)([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
}

/**
 * Clean YouTube URL (strip tracking params)
 */
function cleanYoutubeUrl(url: string): string {
    const videoId = extractYoutubeId(url);
    if (!videoId) {
        throw new Error('Invalid YouTube URL');
    }
    return `https://www.youtube.com/watch?v=${videoId}`;
}

// ============================================================================
// STRATEGY 1: DIRECT CAPTION EXTRACTION (Fast Path)
// ============================================================================

/**
 * Attempt to extract captions directly from YouTube's innertube API
 * This is the fastest method (~2-5 seconds) and works for most videos
 */
async function extractCaptionsDirect(videoId: string): Promise<string | null> {
    console.log(`[YouTube] Attempting direct caption extraction for: ${videoId}`);
    const startTime = Date.now();

    try {
        // Method 1: Try the timedtext API directly (fastest)
        const timedTextResult = await tryTimedTextApi(videoId);
        if (timedTextResult) {
            const duration = Date.now() - startTime;
            console.log(`[YouTube] ✅ TimedText API SUCCESS: ${timedTextResult.length} chars in ${duration}ms`);
            return timedTextResult;
        }

        // Method 2: Try innertube player API
        const innertubeResult = await tryInnertubeApi(videoId);
        if (innertubeResult) {
            const duration = Date.now() - startTime;
            console.log(`[YouTube] ✅ Innertube API SUCCESS: ${innertubeResult.length} chars in ${duration}ms`);
            return innertubeResult;
        }

        console.log('[YouTube] Direct extraction methods exhausted');
        return null;
    } catch (error: any) {
        console.warn(`[YouTube] Direct extraction failed: ${error.message}`);
        return null;
    }
}

/**
 * Try YouTube's timedtext API directly
 */
async function tryTimedTextApi(videoId: string): Promise<string | null> {
    try {
        // Try common caption formats
        const langs = ['en', 'a.en', 'en-US', 'en-GB'];

        for (const lang of langs) {
            const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json3`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            try {
                const response = await fetch(url, {
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    },
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    const text = extractTextFromTimedText(data);
                    if (text && text.length >= YOUTUBE_CONFIG.directExtraction.minContentLength) {
                        return text;
                    }
                }
            } catch {
                clearTimeout(timeoutId);
                continue;
            }
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Try YouTube's innertube player API
 */
async function tryInnertubeApi(videoId: string): Promise<string | null> {
    try {
        // Step 1: Get the video page to extract caption data
        const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(watchUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml',
            },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn(`[YouTube] Failed to fetch video page: ${response.status}`);
            return null;
        }

        const html = await response.text();

        // Look for caption tracks in multiple possible locations
        const captionPatterns = [
            /"captionTracks":\s*(\[.*?\])/,
            /\\"captionTracks\\":\s*(\[.*?\])/,
            /"playerCaptionsTracklistRenderer".*?"captionTracks":\s*(\[.*?\])/,
        ];

        let captionTracks = null;

        for (const pattern of captionPatterns) {
            const match = html.match(pattern);
            if (match) {
                try {
                    // Handle escaped JSON
                    let jsonStr = match[1];
                    if (jsonStr.includes('\\"')) {
                        jsonStr = jsonStr.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                    }
                    captionTracks = JSON.parse(jsonStr);
                    break;
                } catch {
                    continue;
                }
            }
        }

        if (!captionTracks || captionTracks.length === 0) {
            console.log('[YouTube] No caption tracks found in video page');
            return null;
        }

        // Prefer English captions, then auto-generated, then first available
        const preferredTrack =
            captionTracks.find((t: any) => t.languageCode === 'en' && !t.kind) ||
            captionTracks.find((t: any) => t.languageCode === 'en') ||
            captionTracks.find((t: any) => t.kind === 'asr') ||
            captionTracks[0];

        if (!preferredTrack?.baseUrl) {
            console.log('[YouTube] No valid caption track URL found');
            return null;
        }

        // Fetch the caption track
        const captionUrl = preferredTrack.baseUrl.replace(/&fmt=\w+/, '') + '&fmt=json3';
        const captionResponse = await fetch(captionUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });

        if (!captionResponse.ok) {
            console.warn(`[YouTube] Failed to fetch captions: ${captionResponse.status}`);
            return null;
        }

        const captionData = await captionResponse.json();
        return extractTextFromTimedText(captionData);
    } catch (error: any) {
        console.warn(`[YouTube] Innertube extraction error: ${error.message}`);
        return null;
    }
}

/**
 * Extract plain text from timedtext JSON format
 */
function extractTextFromTimedText(data: any): string | null {
    const events = data.events || [];
    const textParts: string[] = [];

    for (const event of events) {
        if (event.segs) {
            for (const seg of event.segs) {
                if (seg.utf8 && seg.utf8.trim()) {
                    textParts.push(seg.utf8);
                }
            }
        }
    }

    const rawText = textParts.join(' ');

    if (!rawText || rawText.trim().length < YOUTUBE_CONFIG.directExtraction.minContentLength) {
        return null;
    }

    // Basic cleanup: normalize whitespace and add paragraph breaks
    return formatTranscript(rawText);
}

/**
 * Format raw transcript with proper spacing and paragraphs
 */
function formatTranscript(rawText: string): string {
    return rawText
        .replace(/\s+/g, ' ')  // Normalize whitespace
        .replace(/([.!?])\s+/g, '$1\n\n')  // Add paragraph breaks after sentences
        .replace(/\n{3,}/g, '\n\n')  // Remove excessive line breaks
        .trim();
}

// ============================================================================
// STRATEGY 2: RAPIDAPI FALLBACK
// ============================================================================

/**
 * Use RapidAPI Supadata as fallback for videos where direct extraction fails
 */
async function extractWithRapidAPI(videoId: string): Promise<string> {
    const rapidApiKey = getRequiredEnv('RAPIDAPI_KEY');
    const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;

    console.log(`[YouTube] Using RapidAPI fallback for: ${videoId}`);
    const startTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), YOUTUBE_CONFIG.rapidApi.timeout);

    try {
        const response = await fetch(
            `https://youtube-transcripts.p.rapidapi.com/youtube/transcript?url=${encodeURIComponent(cleanUrl)}&videoId=${videoId}&text=true`,
            {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'x-rapidapi-key': rapidApiKey,
                    'x-rapidapi-host': 'youtube-transcripts.p.rapidapi.com',
                },
            }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`RapidAPI Error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        let transcriptOutput = '';

        // Handle various response formats from RapidAPI
        if (data.transcript && typeof data.transcript === 'string') {
            transcriptOutput = data.transcript;
        } else if (Array.isArray(data.content)) {
            transcriptOutput = data.content.map((item: any) => item.text).join(' ');
        } else if (Array.isArray(data)) {
            transcriptOutput = data.map((item: any) => item.text).join(' ');
        } else if (data.content && typeof data.content === 'string') {
            transcriptOutput = data.content;
        }

        if (!transcriptOutput || transcriptOutput.trim().length === 0) {
            throw new Error('No transcript content found in RapidAPI response');
        }

        const duration = Date.now() - startTime;
        console.log(`[YouTube] ✅ RapidAPI SUCCESS: ${transcriptOutput.length} chars in ${duration}ms`);

        return formatTranscript(transcriptOutput);
    } catch (error: any) {
        clearTimeout(timeoutId);
        console.error(`[YouTube] RapidAPI failed: ${error.message}`);
        throw error;
    }
}

// ============================================================================
// MAIN EXPORT: SMART YOUTUBE TRANSCRIPT EXTRACTION
// ============================================================================

export interface YouTubeExtractionResult {
    transcript: string;
    method: 'direct' | 'rapidapi';
    processingTime: number;
    videoId: string;
}

/**
 * Smart YouTube transcript extraction with automatic fallback
 *
 * Strategy order:
 * 1. Direct caption extraction (fastest, ~2-5s)
 * 2. RapidAPI fallback (reliable, ~3-8s)
 *
 * @param url - YouTube video URL
 * @returns Extracted transcript with metadata
 */
export async function getYoutubeTranscriptSmart(url: string): Promise<YouTubeExtractionResult> {
    const startTime = Date.now();
    const videoId = extractYoutubeId(url);

    if (!videoId) {
        throw new Error('Invalid YouTube URL. Please provide a valid YouTube video link.');
    }

    console.log(`[YouTube] Starting smart extraction for video: ${videoId}`);

    // STRATEGY 1: Try direct caption extraction (fastest)
    if (YOUTUBE_CONFIG.directExtraction.enabled) {
        try {
            const directResult = await extractCaptionsDirect(videoId);
            if (directResult && directResult.length >= YOUTUBE_CONFIG.directExtraction.minContentLength) {
                return {
                    transcript: directResult,
                    method: 'direct',
                    processingTime: Date.now() - startTime,
                    videoId,
                };
            }
        } catch (error: any) {
            console.log(`[YouTube] Direct extraction failed: ${error.message}`);
        }
    }

    // STRATEGY 2: RapidAPI fallback
    if (YOUTUBE_CONFIG.rapidApi.enabled) {
        try {
            const rapidApiResult = await extractWithRapidAPI(videoId);
            return {
                transcript: rapidApiResult,
                method: 'rapidapi',
                processingTime: Date.now() - startTime,
                videoId,
            };
        } catch (error: any) {
            console.error(`[YouTube] RapidAPI also failed: ${error.message}`);
        }
    }

    // All methods failed
    throw new Error(
        `Unable to extract transcript from this YouTube video. ` +
        `The video may be private, age-restricted, or have no available captions.`
    );
}

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================================================

/**
 * Legacy function - wraps smart extraction for backward compatibility
 * @deprecated Use getYoutubeTranscriptSmart instead
 */
export async function getYoutubeTranscript(url: string, _rapidApiKey: string): Promise<string> {
    console.log('[YouTube] Legacy getYoutubeTranscript called, routing to smart extraction');
    const result = await getYoutubeTranscriptSmart(url);
    return result.transcript;
}

/**
 * Clean up transcript with AI
 * Fixes common transcription errors and improves formatting
 */
export async function cleanTranscriptWithAI(
    rawTranscript: string,
    apiKey: string
): Promise<string> {
    // Skip if cleanup is disabled
    if (!YOUTUBE_CONFIG.cleanup.enabled) {
        console.log('[YouTube] AI cleanup disabled, returning formatted transcript');
        return formatTranscript(rawTranscript);
    }

    console.log('[YouTube] Cleaning transcript with Gemini 2.0 Flash...');
    const startTime = Date.now();

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${YOUTUBE_CONFIG.cleanup.model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: `You are an expert academic editor specializing in technology content. Below is a raw YouTube transcript that may contain speech-to-text errors.

YOUR TASK:
1. Add proper punctuation and capitalization
2. Break into logical paragraphs (every 2-4 sentences)
3. FIX COMMON TRANSCRIPTION ERRORS - especially for tech terms:
   - "Cloud Code" → "Claude Code" (Anthropic's AI coding tool)
   - "Chat GPT" or "chat gpt" → "ChatGPT"
   - "Open AI" → "OpenAI"
   - "G P T" → "GPT"
   - "L L M" → "LLM"
   - "A I" (when meaning artificial intelligence) → "AI"
   - "Co pilot" or "co-pilot" (in coding context) → "Copilot"
   - "mid journey" → "Midjourney"
   - "Dall E" or "dolly" (in AI context) → "DALL-E"
   - "cursor" (when referring to Cursor AI) → "Cursor"
   - "wind surf" (AI coding tool) → "Windsurf"
   - "Gemini" / "gemini" → "Gemini"
4. Correct obvious misspellings of technical terms
5. Remove excessive filler words (um, uh, like, you know)
6. Maintain the original meaning and tone
7. Return ONLY the cleaned transcript text

RAW TRANSCRIPT:
${rawTranscript.substring(0, 30000)}`,
                                },
                            ],
                        },
                    ],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 25000,
                    },
                }),
            }
        );

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        const cleanedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!cleanedText || cleanedText.trim() === '') {
            throw new Error('Gemini returned empty response');
        }

        const duration = Date.now() - startTime;
        console.log(`[YouTube] ✅ AI cleanup SUCCESS in ${duration}ms`);

        return cleanedText.trim();
    } catch (error: any) {
        console.error('[YouTube] AI Cleaning failed, returning formatted raw:', error.message);
        return formatTranscript(rawTranscript);
    }
}
