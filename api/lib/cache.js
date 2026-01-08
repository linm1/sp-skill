import { Redis } from '@upstash/redis';
/**
 * Get or create Redis client
 * Uses globalThis pattern to avoid creating multiple connections
 */
function getRedisClient() {
    try {
        if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
            console.warn('[CACHE] Redis credentials not configured - caching disabled');
            return null;
        }
        if (!global.redisClient) {
            global.redisClient = new Redis({
                url: process.env.KV_REST_API_URL,
                token: process.env.KV_REST_API_TOKEN,
            });
            console.log('[CACHE] Redis client initialized');
        }
        return global.redisClient;
    }
    catch (error) {
        console.error('[CACHE] Failed to initialize Redis client:', error);
        return null;
    }
}
/**
 * Cache Helper Functions
 */
export const cache = {
    /**
     * Get value from cache
     * @param key Cache key
     * @returns Cached value or null if not found/error
     */
    async get(key) {
        try {
            const client = getRedisClient();
            if (!client) {
                return null;
            }
            const value = await client.get(key);
            if (value !== null) {
                console.log(`[CACHE HIT] ${key}`);
            }
            else {
                console.log(`[CACHE MISS] ${key}`);
            }
            return value;
        }
        catch (error) {
            console.error(`[CACHE ERROR] Failed to get key "${key}":`, error);
            return null;
        }
    },
    /**
     * Set value in cache with TTL
     * @param key Cache key
     * @param value Value to cache
     * @param ttl Time-to-live in seconds
     */
    async set(key, value, ttl) {
        try {
            const client = getRedisClient();
            if (!client) {
                return;
            }
            await client.set(key, value, { ex: ttl });
            console.log(`[CACHE SET] ${key} (TTL: ${ttl}s)`);
        }
        catch (error) {
            console.error(`[CACHE ERROR] Failed to set key "${key}":`, error);
        }
    },
    /**
     * Delete a specific cache key
     * @param key Cache key to delete
     */
    async del(key) {
        try {
            const client = getRedisClient();
            if (!client) {
                return;
            }
            await client.del(key);
            console.log(`[CACHE DEL] ${key}`);
        }
        catch (error) {
            console.error(`[CACHE ERROR] Failed to delete key "${key}":`, error);
        }
    },
    /**
     * Invalidate all keys matching a pattern
     * @param pattern Key pattern (e.g., "pattern:catalog:*")
     */
    async invalidatePattern(pattern) {
        try {
            const client = getRedisClient();
            if (!client) {
                return;
            }
            // Use SCAN to find matching keys
            let cursor = 0;
            let deletedCount = 0;
            do {
                const [nextCursor, keys] = await client.scan(cursor, {
                    match: pattern,
                    count: 100,
                });
                cursor = typeof nextCursor === 'string' ? parseInt(nextCursor, 10) : nextCursor;
                if (keys.length > 0) {
                    await client.del(...keys);
                    deletedCount += keys.length;
                }
            } while (cursor !== 0);
            console.log(`[CACHE INVALIDATE] Pattern "${pattern}" - deleted ${deletedCount} keys`);
        }
        catch (error) {
            console.error(`[CACHE ERROR] Failed to invalidate pattern "${pattern}":`, error);
        }
    },
};
