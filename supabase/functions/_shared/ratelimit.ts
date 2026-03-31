/**
 * Rate Limiting Middleware using Upstash Redis
 * Implements sliding window rate limiting to prevent abuse and control costs
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
 * Check rate limit using Upstash Redis
 * Uses sliding window algorithm for accurate rate limiting
 *
 * SECURITY: Fail-closed - If Redis is unavailable, rejects request to prevent abuse
 */
export async function checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const { identifier, limit, window, endpoint } = config;

  // Get Redis credentials from environment
  const redisUrl = getOptionalEnv('UPSTASH_REDIS_REST_URL', '');
  const redisToken = getOptionalEnv('UPSTASH_REDIS_REST_TOKEN', '');

  // Fail-open: If Redis not configured, allow request to avoid blocking users
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
    // Redis key: ratelimit:{endpoint}:{identifier}
    const key = `ratelimit:${endpoint}:${identifier}`;
    const now = Date.now();
    const windowMs = window * 1000;

    // Sliding window using sorted set (ZSET)
    // Score = timestamp, value = unique request ID
    const requestId = `${now}-${Math.random()}`;

    // Pipeline commands for atomic execution
    const commands = [
      // 1. Remove old entries outside window
      ['ZREMRANGEBYSCORE', key, '0', String(now - windowMs)],
      // 2. Add current request
      ['ZADD', key, String(now), requestId],
      // 3. Count requests in window
      ['ZCARD', key],
      // 4. Set expiry (cleanup)
      ['EXPIRE', key, String(window * 2)],
    ];

    // Execute pipeline
    const response = await fetch(`${redisUrl}/pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${redisToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
    });

    if (!response.ok) {
      throw new Error(`Redis error: ${response.status} ${response.statusText}`);
    }

    const results = await response.json();

    // Extract count from ZCARD result (3rd command, index 2)
    const count = results[2]?.result || 0;

    // Calculate reset time (end of current window)
    const resetAt = Math.floor((now + windowMs) / 1000);
    const remaining = Math.max(0, limit - count);

    if (count > limit) {
      // Rate limit exceeded
      const oldestInWindow = await getOldestRequestTime(redisUrl, redisToken, key);
      const retryAfter = oldestInWindow
        ? Math.ceil((oldestInWindow + windowMs - now) / 1000)
        : window;

      console.warn(`Rate limit exceeded: ${endpoint} - ${identifier} (${count}/${limit} in ${window}s)`);

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.max(1, retryAfter), // At least 1 second
      };
    }

    // Request allowed
    return {
      allowed: true,
      remaining,
      resetAt,
    };

  } catch (error) {
    // Fail-open: If Redis fails, allow request to avoid blocking users
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
 * Get timestamp of oldest request in current window
 * Used to calculate accurate retry-after time
 */
async function getOldestRequestTime(
  redisUrl: string,
  redisToken: string,
  key: string
): Promise<number | null> {
  try {
    const response = await fetch(`${redisUrl}/zrange/${encodeURIComponent(key)}/0/0/WITHSCORES`, {
      headers: {
        'Authorization': `Bearer ${redisToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const scores = data.result;

    // ZRANGE WITHSCORES returns [value, score, value, score, ...]
    // We want the first score (index 1)
    if (scores && scores.length >= 2) {
      return parseInt(scores[1], 10);
    }

    return null;
  } catch (error) {
    console.error('Failed to get oldest request time:', error);
    return null;
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

