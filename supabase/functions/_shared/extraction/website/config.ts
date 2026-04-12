/**
 * Website Content Extraction Configuration
 * Configuration for website extraction services
 */

import { getOptionalEnv } from '../../env.ts';

/**
 * Configuration for website extraction services
 *
 * Phase B: Gemini API key and model moved to OpenRouter (openrouter.ts).
 * Model and maxTokens are now in the MODELS map ('website_cleanup').
 * This config retains systemPrompt, temperature, maxHtmlLength, and
 * Jina/directFetch settings.
 */
export const WEBSITE_CONFIG = {
  jinaReader: {
    enabled: true,
    baseUrl: 'https://r.jina.ai',
    apiKeyEnvVar: 'JINA_API_KEY',
    headers: {
      accept: 'application/json',
      retainImages: 'none', // Don't include images to save tokens
    },
  },
  gemini: {
    enabled: true,
    temperature: 0.1,
    maxHtmlLength: 100000, // ~25k tokens
    systemPrompt:
      'Extract the main article/content from this HTML page. Return only the extracted content in clean markdown format. Remove navigation, ads, footers, and other non-content elements. Preserve headings, lists, and important formatting.',
  },
  directFetch: {
    userAgent: 'Mozilla/5.0 (compatible; BrigoBot/1.0; +https://brigo.app)',
    acceptHeader: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
} as const;

/**
 * Get optional Jina API key
 * Works without API key but has lower rate limits
 */
export function getJinaApiKey(): string {
  return getOptionalEnv(WEBSITE_CONFIG.jinaReader.apiKeyEnvVar, '');
}
