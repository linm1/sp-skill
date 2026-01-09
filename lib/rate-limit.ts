/**
 * Rate limiting utilities using Vercel KV (Redis)
 *
 * Implements sliding window rate limiting for API endpoints
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { RATE_LIMITS } from './constants.js';

/**
 * Get or create Redis client for rate limiting
 * Uses globalThis pattern to avoid creating multiple connections
 */
function getRedisClient(): Redis | null {
  try {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      console.warn('[RATE LIMIT] Redis credentials not configured - rate limiting disabled');
      return null;
    }

    // Use the same global client pattern as cache.ts
    if (!global.redisClient) {
      global.redisClient = new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      });
      console.log('[RATE LIMIT] Redis client initialized');
    }

    return global.redisClient;
  } catch (error) {
    console.error('[RATE LIMIT] Failed to initialize Redis client:', error);
    return null;
  }
}

/**
 * Check rate limit for a user
 *
 * @param userId - Clerk user ID
 * @param userRole - User role (contributor, premier, admin)
 * @returns Rate limit check result with remaining count
 */
export async function checkRateLimit(
  userId: string,
  userRole: 'contributor' | 'premier' | 'admin'
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  // Admin users bypass rate limiting
  if (userRole === 'admin') {
    return {
      success: true,
      limit: RATE_LIMITS.ADMIN_DAILY,
      remaining: RATE_LIMITS.ADMIN_DAILY,
      reset: 0,
    };
  }

  // Get Redis client
  const redis = getRedisClient();

  // Graceful degradation: if Redis is unavailable, allow the request
  if (!redis) {
    console.warn('[RATE LIMIT] Redis unavailable - allowing request (graceful degradation)');
    return {
      success: true,
      limit: userRole === 'premier' ? RATE_LIMITS.PREMIER_DAILY : RATE_LIMITS.CONTRIBUTOR_DAILY,
      remaining: 999,
      reset: 0,
    };
  }

  try {
    // Determine limit based on role
    const limit = userRole === 'premier'
      ? RATE_LIMITS.PREMIER_DAILY
      : RATE_LIMITS.CONTRIBUTOR_DAILY;

    // Create role-specific rate limiter
    const limiter = new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(limit, '1 d'),
      analytics: true,
      prefix: `@ratelimit/extract-code/${userRole}`,
    });

    // Check rate limit
    const { success, limit: limitCount, remaining, reset } = await limiter.limit(userId);

    console.log(`[RATE LIMIT] User ${userId} (${userRole}): ${remaining}/${limitCount} remaining`);

    return {
      success,
      limit: limitCount,
      remaining,
      reset,
    };
  } catch (error) {
    // Graceful degradation: if rate limit check fails, allow the request
    console.error('[RATE LIMIT] Check failed, allowing request (graceful degradation):', error);
    return {
      success: true,
      limit: userRole === 'premier' ? RATE_LIMITS.PREMIER_DAILY : RATE_LIMITS.CONTRIBUTOR_DAILY,
      remaining: 999,
      reset: 0,
    };
  }
}
