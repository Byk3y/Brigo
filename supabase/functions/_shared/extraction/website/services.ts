/**
 * Website Content Extraction Services
 * Jina Reader and Direct Fetch + Gemini cleanup services
 */

import type { WebsiteExtractionResult, WebsiteExtractor } from './types.ts';
import { WEBSITE_CONFIG, getJinaApiKey } from './config.ts';
import { MIN_WEBSITE_CONTENT_LENGTH } from '../common/constants.ts';
import { callLLMWithRetry } from '../../openrouter.ts';

/**
 * Jina Reader Service
 * Uses Jina's LLM-optimized markdown extraction API
 * https://r.jina.ai/{url} returns clean content optimized for LLMs
 */
export class JinaReaderService implements WebsiteExtractor {
  name: 'jina-reader' = 'jina-reader';

  isAvailable(): boolean {
    return true; // Always available (works without API key, just lower rate limits)
  }

  async extract(url: string, startTime: number): Promise<WebsiteExtractionResult> {
    const jinaApiKey = getJinaApiKey();

    // Jina Reader URL - prepend r.jina.ai to any URL
    const jinaUrl = `${WEBSITE_CONFIG.jinaReader.baseUrl}/${url}`;

    console.log('[extractWithJinaReader] Calling Jina Reader:', jinaUrl);

    // Optimized headers for study content:
    // - JSON response for structured parsing (title, content, url)
    // - No images to save tokens (we only need text for study materials)
    const headers: Record<string, string> = {
      Accept: WEBSITE_CONFIG.jinaReader.headers.accept,
      'X-Retain-Images': WEBSITE_CONFIG.jinaReader.headers.retainImages,
    };

    // Add API key if available (increases rate limits from ~20/min to higher)
    if (jinaApiKey) {
      headers['Authorization'] = `Bearer ${jinaApiKey}`;
    }

    const response = await fetch(jinaUrl, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jina Reader API error: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    const processingTime = Date.now() - startTime;

    // Parse JSON response
    const data = await response.json();

    // Jina JSON response structure:
    // { code: 200, status: 20000, data: { title, url, content, ... } }
    const content = data?.data?.content || data?.content || '';
    const title = data?.data?.title || data?.title || null;
    const responseUrl = data?.data?.url || data?.url || url;

    // Validate content
    if (!content || content.trim().length < MIN_WEBSITE_CONTENT_LENGTH) {
      throw new Error('Jina Reader returned insufficient content');
    }

    console.log(
      `[extractWithJinaReader] SUCCESS: ${content.length} chars extracted in ${processingTime}ms`
    );
    if (title) {
      console.log(`[extractWithJinaReader] Title: "${title}"`);
    }

    return {
      text: content.trim(),
      title: title ? title.trim() : null,
      metadata: {
        source: 'jina-reader',
        url: responseUrl,
        processingTime,
        contentLength: content.length,
      },
    };
  }
}

/**
 * Direct Fetch + Gemini Cleanup Service
 * Fallback when Jina Reader fails
 * Fetches HTML directly and uses Gemini to extract clean content
 */
export class DirectFetchService implements WebsiteExtractor {
  name: 'gemini' = 'gemini';

  isAvailable(): boolean {
    return true; // OpenRouter key checked at call time
  }

  async extract(url: string, startTime: number): Promise<WebsiteExtractionResult> {
    console.log('[extractWithDirectFetch] Fetching URL directly:', url);

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': WEBSITE_CONFIG.directFetch.userAgent,
        Accept: WEBSITE_CONFIG.directFetch.acceptHeader,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const html = await response.text();

    if (!html || html.length < 100) {
      throw new Error('Page returned insufficient content');
    }

    // Basic HTML cleanup - remove scripts, styles, and extract text
    let cleanedHtml = html
      // Remove script and style tags with content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      // Remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Remove SVG content
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
      // Remove navigation and footer (common patterns)
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '');

    // Extract title
    let title: string | null = null;
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    // Truncate HTML if too long (context limits)
    // Phase B: surface a truncation flag so the UI can warn the user
    const maxHtmlLength = WEBSITE_CONFIG.gemini.maxHtmlLength;
    let contentTruncated = false;
    if (cleanedHtml.length > maxHtmlLength) {
      contentTruncated = true;
      cleanedHtml = cleanedHtml.substring(0, maxHtmlLength);
    }

    // Use Gemini 2.5 Flash via OpenRouter to extract and clean content
    // (with retry + fallback — Phase B migration)
    try {
      const result = await callLLMWithRetry(
        'website_cleanup',
        WEBSITE_CONFIG.gemini.systemPrompt,
        `HTML:\n${cleanedHtml}`,
        { temperature: WEBSITE_CONFIG.gemini.temperature }
      );

      const extractedText = result.content;

      if (!extractedText || extractedText.trim().length < MIN_WEBSITE_CONTENT_LENGTH) {
        throw new Error('LLM returned insufficient extracted content');
      }

      const processingTime = Date.now() - startTime;

      console.log(
        `[extractWithDirectFetch] SUCCESS with LLM cleanup: ${extractedText.length} chars in ${processingTime}ms`
      );

      return {
        text: extractedText.trim(),
        title,
        metadata: {
          source: 'gemini',
          url,
          processingTime,
          contentLength: extractedText.length,
          content_truncated: contentTruncated,
        },
      };
    } catch (llmError: unknown) {
      // If LLM fails after retries, return basic text extraction
      const basicText = cleanedHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const processingTime = Date.now() - startTime;

      return {
        text: basicText,
        title,
        metadata: {
          source: 'direct-fetch',
          url,
          processingTime,
          contentLength: basicText.length,
          content_truncated: contentTruncated,
          warning: 'Content extracted with basic HTML parsing (LLM cleanup unavailable)',
        },
      };
    }
  }
}
