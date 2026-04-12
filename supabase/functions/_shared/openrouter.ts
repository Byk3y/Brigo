/**
 * OpenRouter LLM Client with Cost Tracking
 * Unified interface for calling any LLM model with automatic cost calculation
 */

import { getRequiredEnv } from './env.ts';

interface ModelConfig {
  name: string;
  maxTokens: number;
  costPer1kInput: number; // USD
  costPer1kOutput: number; // USD
}

interface LLMResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  costCents: number;
  latency: number;
  model: string;
}

// Model configurations for different job types
const MODELS: Record<string, ModelConfig> = {
  preview: {
    // Phase 2: bumped from 2.0-flash:free to paid 2.5 Flash for better JSON
    // reliability and no free-tier rate limits. Cost at our volume is pennies.
    name: 'google/gemini-2.5-flash',
    maxTokens: 2048,
    costPer1kInput: 0.0003,
    costPer1kOutput: 0.0025,
  },
  pdf_extract_preview: {
    // Phase 2: single-call merged extraction + classification + preview via
    // Gemini 2.5 Flash with structured output. Replaces the old two-step flow
    // of GeminiService.extract() (inline_data) + PreviewGenerator.generate()
    // (OpenRouter preview). Accepts PDF as a `file` content block attachment.
    //
    // maxTokens needs to accommodate the full extracted_text plus preview
    // metadata. A dense 14 MB PDF can legitimately contain 20k+ tokens of
    // actual text. Gemini 2.5 Flash supports up to 65536 output tokens, and
    // OpenRouter bills per-token actually-used, so we pick a generous ceiling
    // that leaves headroom for the worst case without affecting typical-PDF
    // cost. Undersizing this silently truncates extracted_text.
    name: 'google/gemini-2.5-flash',
    maxTokens: 32000,
    costPer1kInput: 0.0003,
    costPer1kOutput: 0.0025,
  },
  studio: {
    name: 'google/gemini-2.0-flash', // Consistent JSON generation for tools
    maxTokens: 4000,
    costPer1kInput: 0.0001, // Very cheap
    costPer1kOutput: 0.0004,
  },
  audio_script: {
    name: 'x-ai/grok-4.1-fast', // Ultra-fast creative dialogue
    maxTokens: 1500,
    costPer1kInput: 0.0005, // Pricing estimate for Grok Fast
    costPer1kOutput: 0.0015,
  },
  notebook_chat: {
    name: 'x-ai/grok-4.1-fast', // Omniscient chat with 2M context
    maxTokens: 2000,
    costPer1kInput: 0.0005,
    costPer1kOutput: 0.0015,
  },
};

// Fallback models if primary fails
const FALLBACK_MODELS: Record<string, string[]> = {
  preview: ['deepseek/deepseek-chat', 'meta-llama/llama-3.3-70b-instruct:free', 'mistralai/mistral-small'],
  // pdf_extract_preview has no text-only fallbacks because all fallbacks
  // would need to accept PDF file inputs. If Gemini 2.5 Flash is down via
  // OpenRouter, we fail fast and surface a clean error.
  pdf_extract_preview: [],
  studio: ['x-ai/grok-4.1-fast', 'openai/gpt-4o'],
  audio_script: ['openai/gpt-4o-mini'],
  notebook_chat: ['x-ai/grok-4.1-fast', 'meta-llama/llama-3.3-70b-instruct:free', 'openai/gpt-4o'],
};

/**
 * Job type identifier for model selection + cost tracking.
 * Add new entries in MODELS and FALLBACK_MODELS when extending.
 */
export type LLMJobType =
  | 'preview'
  | 'pdf_extract_preview'
  | 'studio'
  | 'audio_script'
  | 'notebook_chat';

/**
 * File attachment for multimodal models (PDF, image, etc.) using the
 * OpenAI chat-completions `file` content-block format. `fileData` should
 * be a `data:application/pdf;base64,...` URL or a publicly fetchable URL.
 */
export interface LLMAttachment {
  filename: string;
  fileData: string;
}

/**
 * Structured-output schema passed through to OpenRouter as `response_format`.
 * Uses the OpenAI json_schema variant which Gemini 2.5 Flash supports via
 * OpenRouter (see https://openrouter.ai/docs/guides/features/structured-outputs).
 */
export interface LLMResponseSchema {
  name: string;
  // The actual schema (OpenAPI subset). Kept as `any` because the shape is
  // intentionally flexible and validated downstream.
  // deno-lint-ignore no-explicit-any
  schema: any;
  strict?: boolean;
}

/**
 * Call LLM model via OpenRouter with automatic cost tracking
 */
export async function callLLM(
  jobType: LLMJobType,
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[] | string,
  options: {
    temperature?: number;
    model?: string; // Optional: override default model
    stream?: boolean; // Enable streaming
    /**
     * Multimodal file attachments (e.g. PDF) to include in the last user
     * message. When set, the user message `content` is sent as an array of
     * content blocks instead of a plain string.
     */
    attachments?: LLMAttachment[];
    /**
     * Structured-output JSON schema to enforce on the response. When set,
     * the request includes `response_format: { type: 'json_schema', ... }`.
     * Only compatible with models that support structured outputs (Gemini
     * 2.5 Flash, GPT-4o, Claude 4+).
     */
    responseSchema?: LLMResponseSchema;
  } = {}
): Promise<LLMResponse> {
  const config = MODELS[jobType];
  const modelName = options.model || config.name;
  const startTime = Date.now();

  const apiKey = getRequiredEnv('OPENROUTER_API_KEY');

  // Convert string prompt to message format for internal use
  const history = typeof messages === 'string'
    ? [{ role: 'user' as const, content: messages }]
    : messages;

  // If attachments are present, rewrite the LAST user message to use the
  // OpenAI multimodal content-block format: [{type:'text',...},{type:'file',...}]
  // This is how OpenRouter sends files to natively-multimodal models like
  // Gemini (see https://openrouter.ai/docs/guides/overview/multimodal/pdfs).
  let finalMessages: Array<{ role: string; content: any }> = [
    { role: 'system', content: systemPrompt },
    ...history,
  ];
  if (options.attachments && options.attachments.length > 0) {
    const lastIdx = finalMessages.length - 1;
    const last = finalMessages[lastIdx];
    if (last.role === 'user') {
      const textContent = typeof last.content === 'string' ? last.content : '';
      finalMessages[lastIdx] = {
        role: 'user',
        content: [
          { type: 'text', text: textContent },
          ...options.attachments.map((a) => ({
            type: 'file',
            file: { filename: a.filename, file_data: a.fileData },
          })),
        ],
      };
    }
  }

  // Build request body. response_format is only included when a schema is set.
  // deno-lint-ignore no-explicit-any
  const requestBody: any = {
    model: modelName,
    messages: finalMessages,
    max_tokens: config.maxTokens,
    temperature: options.temperature ?? 0.7,
    stream: options.stream ?? false,
  };
  if (options.responseSchema) {
    requestBody.response_format = {
      type: 'json_schema',
      json_schema: {
        name: options.responseSchema.name,
        strict: options.responseSchema.strict ?? true,
        schema: options.responseSchema.schema,
      },
    };
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://brigo.app',
        'X-Title': 'Brigo Study App',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const latency = Date.now() - startTime;

    // Extract usage stats
    const inputTokens = data.usage?.prompt_tokens || 0;
    const outputTokens = data.usage?.completion_tokens || 0;
    const totalTokens = inputTokens + outputTokens;

    // Calculate cost in cents
    const costCents = Math.ceil(
      (inputTokens / 1000) * config.costPer1kInput * 100 +
      (outputTokens / 1000) * config.costPer1kOutput * 100
    );

    // Extract content
    const content = data.choices?.[0]?.message?.content || '';

    if (!content) {
      throw new Error('Empty response from LLM');
    }

    return {
      content,
      usage: { inputTokens, outputTokens, totalTokens },
      costCents,
      latency,
      model: modelName,
    };
  } catch (error: unknown) {
    const latency = Date.now() - startTime;

    // Try fallback models if available
    const fallbacks = FALLBACK_MODELS[jobType];
    if (fallbacks && fallbacks.length > 0 && !options.model) {
      console.warn(`Primary model failed, trying fallback: ${fallbacks[0]}`);
      return callLLM(jobType, systemPrompt, messages, {
        ...options,
        model: fallbacks[0],
      });
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`LLM call failed: ${message} (latency: ${latency}ms)`);
  }
}

/**
 * Simple retry wrapper with exponential backoff
 */
export async function callLLMWithRetry(
  jobType: LLMJobType,
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[] | string,
  options?: {
    temperature?: number;
    maxRetries?: number;
    stream?: boolean;
    attachments?: LLMAttachment[];
    responseSchema?: LLMResponseSchema;
  }
): Promise<LLMResponse> {
  const maxRetries = options?.maxRetries || 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await callLLM(jobType, systemPrompt, messages, options);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;
      console.error(`LLM call attempt ${attempt + 1} failed:`, err.message);

      // Don't retry on certain errors (auth, invalid request)
      if (
        err.message.includes('401') ||
        err.message.includes('400') ||
        err.message.includes('invalid')
      ) {
        throw err;
      }

      // Exponential backoff: 1s, 2s, 4s
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('LLM call failed after retries');
}
