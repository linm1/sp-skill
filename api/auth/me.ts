import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthenticatedUser } from '../../lib/auth.js';
import { cache } from '../../lib/cache.js';
import { verifyToken } from '@clerk/backend';

/**
 * GET /api/auth/me
 * Returns the current authenticated user's profile
 *
 * Headers:
 *   Authorization: Bearer <clerk-jwt-token>
 *
 * Response:
 *   200: { success: true, user: { id, email, name, role, createdAt } }
 *   401: { error: "Unauthorized" }
 *   405: { error: "Method not allowed" }
 *
 * Caching:
 *   - Cache Key: user:profile:{clerkId}
 *   - TTL: 900 seconds (15 minutes)
 *   - Invalidated by: T-011 webhook handlers (user.updated, user.deleted)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract JWT token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);

  try {
    // Verify token to get Clerk user ID
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY || '',
    });

    if (!payload || !payload.sub) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const clerkId = payload.sub;

    // Check cache first (Layer 1 - API Endpoint Cache)
    const cacheKey = `user:profile:${clerkId}`;
    const cachedProfile = await cache.get<any>(cacheKey);

    if (cachedProfile) {
      console.log('[PROFILE CACHE HIT]', clerkId);
      return res.status(200).json(cachedProfile);
    }

    console.log('[PROFILE CACHE MISS]', clerkId);

    // Cache miss - fetch from database via getAuthenticatedUser() (Layer 2)
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Build response object
    const response = {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt
      }
    };

    // Store in cache before returning (TTL: 15 minutes)
    await cache.set(cacheKey, response, 900);

    return res.status(200).json(response);
  } catch (error) {
    console.error('[PROFILE AUTH ERROR]', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
