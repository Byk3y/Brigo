/**
 * Rate Limiting Middleware using @upstash/ratelimit SDK
 * Replaces raw REST pipeline with battle-tested SDK for reliability
 */

import { getOptionalEnv } from './env.ts';

export interface RateLimitConfig {
  identifier: string; // user.id or IP address
  limit: number; // Max requests allowed in window
  window: number; // Time window in seconds
  endpoint: string; // Endpoint name for logging
}

export interface RateLimitResult {
  allowed: boolean; // Whether request should be allowed
  remaining: number; // Requests remaining in window
  resetAt: number; // Unix timestamp when limit resets
  retryAfter?: number; // Seconds to wait before retrying (only set if not allowed)
}

/**
 * Check rate limit using @upstash/ratelimit SDK
 * Fail-open: If Redis is unavailable, allows request to avoid blocking users
 */
export async function checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const { identifier, limit, window, endpoint } = config;

  const redisUrl = getOptionalEnv('UPSTASH_REDIS_REST_URL', '');
  const redisToken = getOptionalEnv('UPSTASH_REDIS_REST_TOKEN', '');

  // Fail-open: If Redis not configured, allow request
  if (!redisUrl || !redisToken) {
    console.warn('Rate limiting unavailable: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN not configured');
    console.warn('ALLOWING request due to missing rate limit configuration (fail-open policy)');
    return {
      allowed: true,
      remaining: limit,
      resetAt: Math.floor(Date.now() / 1000) + window,
    };
  }

  try {
    // Dynamic import to avoid crashing the function if SDK fails to load
    const { Redis } = await import('@upstash/redis');
    const { Ratelimit } = await import('@upstash/ratelimit');

    const redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });

    const ratelimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${window} s`),
      prefix: `rl:${endpoint}`,
    });

    const result = await ratelimiter.limit(identifier);

    console.log(`Rate limit check: ${endpoint} - ${identifier} (${result.remaining}/${limit} remaining)`);

    if (!result.success) {
      const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
      console.warn(`Rate limit exceeded: ${endpoint} - ${identifier} (retry after ${retryAfter}s)`);

      return {
        allowed: false,
        remaining: 0,
        resetAt: Math.floor(result.reset / 1000),
        retryAfter,
      };
    }

    return {
      allowed: true,
      remaining: result.remaining,
      resetAt: Math.floor(result.reset / 1000),
    };

  } catch (error) {
    // Fail-open: If anything fails, allow request to avoid blocking users
    console.error(`Rate limit check failed for ${endpoint}:`, error);
    console.warn('ALLOWING request due to rate limit service failure (fail-open policy)');

    return {
      allowed: true,
      remaining: limit,
      resetAt: Math.floor(Date.now() / 1000) + window,
    };
  }
}

/**
 * Preset rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
  PROCESS_MATERIAL: {
    limit: 10,
    window: 300, // 5 minutes
  },
  GENERATE_STUDIO: {
    limit: 5,
    window: 300, // 5 minutes
  },
  GENERATE_AUDIO: {
    limit: 3,
    window: 600, // 10 minutes
  },
  NOTEBOOK_CHAT: {
    limit: 30,   // 30 messages per window
    window: 60,  // 1 minute - more granular for chat
  },
} as const;
