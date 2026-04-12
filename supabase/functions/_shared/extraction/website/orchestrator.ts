/**
 * Website Content Extraction Orchestrator
 * Main entry point for website content extraction with fallback logic
 */

import type { WebsiteExtractionResult } from './types.ts';
import { JinaReaderService, DirectFetchService } from './services.ts';
import { validateUrlSecurityWithDns } from '../security/url-validator.ts';

/**
 * Extract content from a website URL using Jina Reader
 * Primary: Jina Reader API (LLM-optimized markdown extraction)
 * Fallback: Direct fetch + Gemini cleanup
 *
 * @param url - The website URL to extract content from
 * @returns Extracted content in markdown format
 */
export async function extractWebsiteContent(url: string): Promise<WebsiteExtractionResult> {
  console.log('[extractWebsiteContent] START - URL:', url);
  const startTime = Date.now();

  // SECURITY: Validate URL to prevent SSRF attacks (with DNS resolution
  // to close the rebinding gap — e.g. 127.0.0.1.nip.io)
  const securityCheck = await validateUrlSecurityWithDns(url);
  if (!securityCheck.allowed) {
    console.error(`[extractWebsiteContent] SECURITY BLOCK: ${securityCheck.reason}`);
    throw new Error(securityCheck.reason || 'URL blocked for security reasons');
  }

  // Try Jina Reader first (primary method)
  try {
    const jinaService = new JinaReaderService();
    const result = await jinaService.extract(url, startTime);
    return result;
  } catch (jinaError: unknown) {
    const jinaMsg = jinaError instanceof Error ? jinaError.message : String(jinaError);
    console.warn(`[extractWebsiteContent] Jina Reader failed: ${jinaMsg}`);

    // Fallback to direct fetch + basic extraction
    try {
      const directService = new DirectFetchService();
      const result = await directService.extract(url, startTime);
      return result;
    } catch (directError: unknown) {
      const directMsg = directError instanceof Error ? directError.message : String(directError);
      console.error(`[extractWebsiteContent] Direct fetch also failed: ${directMsg}`);
      throw new Error(
        `Website extraction failed: ${jinaMsg}. Fallback also failed: ${directMsg}`
      );
    }
  }
}
