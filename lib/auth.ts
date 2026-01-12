import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { cache } from './cache.js';
import { sendError } from './api-response.js';

// Initialize Clerk client
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY || '',
});

// Get publishable key from environment
const CLERK_PUBLISHABLE_KEY = process.env.VITE_CLERK_PUBLISHABLE_KEY || '';

/**
 * Gets the authenticated user from Clerk JWT token
 * Implements just-in-time (JIT) user provisioning
 *
 * @param req - Vercel request with Authorization header
 * @returns User object or null if not authenticated
 */
export async function getAuthenticatedUser(req: VercelRequest) {
  // 1. Extract JWT token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  // 2. Verify token with Clerk
  try {
    // Verify the JWT token directly using the verifyToken function
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY || '',
    });

    if (!payload || !payload.sub) return null;

    // Get the user ID from the token payload
    const userId = payload.sub;

    // 2.5. Check cache first
    const cacheKey = `user:clerk:${userId}`;
    const cachedUser = await cache.get<typeof users.$inferSelect>(cacheKey);
    if (cachedUser) {
      console.log('[AUTH CACHE HIT]', userId);
      return cachedUser;
    }

    console.log('[AUTH CACHE MISS]', userId);

    // Fetch full user details from Clerk
    const clerkUser = await clerkClient.users.getUser(userId);
    if (!clerkUser) return null;

    // 3. Just-in-time user provisioning
    // Check if user exists in our database
    let dbUser = await db.select()
      .from(users)
      .where(eq(users.clerkId, clerkUser.id))
      .limit(1);

    // 4. Create user in database if doesn't exist
    if (dbUser.length === 0) {
      const role = (clerkUser.publicMetadata?.role as string) || 'contributor';
      const email = clerkUser.emailAddresses[0]?.emailAddress || '';
      const name = clerkUser.firstName || clerkUser.username || email.split('@')[0];

      try {
        const newUser = await db.insert(users).values({
          clerkId: clerkUser.id,
          email: email,
          name: name,
          role: role
        }).returning();
        dbUser = newUser;
      } catch (insertError: any) {
        // Handle duplicate key error (race condition or sequence issue)
        // Error code 23505 = unique constraint violation
        if (insertError.code === '23505') {
          console.warn('User insert conflict, attempting SELECT:', {
            clerkId: clerkUser.id,
            email,
            errorCode: insertError.code
          });

          // Try to SELECT the user again (might have been created by another request)
          dbUser = await db.select()
            .from(users)
            .where(eq(users.clerkId, clerkUser.id))
            .limit(1);

          if (dbUser.length === 0) {
            // User still not found - this is a real error, not a race condition
            console.error('Failed to create or find user after conflict:', insertError);
            throw insertError;
          }

          console.log('User found after conflict, continuing with existing user');
        } else {
          // Some other database error - rethrow
          throw insertError;
        }
      }
    }

    // Store user in cache before returning (TTL: 15 minutes)
    if (dbUser[0]) {
      await cache.set(cacheKey, dbUser[0], 900);
    }

    return dbUser[0];
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

/**
 * Middleware to require authentication
 */
export function requireAuth(handler: (req: VercelRequest & { user?: any }, res: VercelResponse) => Promise<any>) {
  return async (req: VercelRequest & { user?: any }, res: VercelResponse) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = user;
    return handler(req, res);
  };
}

/**
 * Middleware to require specific role
 */
export function requireRole(role: string, handler: (req: VercelRequest & { user?: any }, res: VercelResponse) => Promise<any>) {
  return async (req: VercelRequest & { user?: any }, res: VercelResponse) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (user.role !== role && user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.user = user;
    return handler(req, res);
  };
}

/**
 * Check if user has admin role and send error response if not
 *
 * This is a guard function that validates admin access and automatically sends
 * a standardized error response if the user is not an admin.
 *
 * @param user - Authenticated user object (from getAuthenticatedUser)
 * @param res - Vercel response object
 * @param customMessage - Optional custom error message (defaults to "Admin access required")
 * @returns true if user is admin, false otherwise (error response already sent)
 *
 * @example
 * ```typescript
 * const user = await getAuthenticatedUser(req);
 * if (!requireAdmin(user, res, 'Admin access required to create patterns')) return;
 *
 * // Continue with admin-only logic
 * ```
 */
export function requireAdminGuard(
  user: typeof users.$inferSelect | null,
  res: VercelResponse,
  customMessage?: string
): boolean {
  if (!user || user.role !== 'admin') {
    sendError(
      res,
      403,
      'Forbidden',
      customMessage || 'Admin access required'
    );
    return false;
  }
  return true;
}

/**
 * Check if user is authenticated and send error response if not
 *
 * This is a guard function that validates authentication and automatically sends
 * a standardized error response if the user is not authenticated.
 *
 * @param user - Authenticated user object (from getAuthenticatedUser)
 * @param res - Vercel response object
 * @param customMessage - Optional custom error message (defaults to "Authentication required")
 * @returns true if authenticated, false otherwise (error response already sent)
 *
 * @example
 * ```typescript
 * const user = await getAuthenticatedUser(req);
 * if (!requireAuthGuard(user, res)) return;
 *
 * // Continue with authenticated logic
 * ```
 */
export function requireAuthGuard(
  user: typeof users.$inferSelect | null,
  res: VercelResponse,
  customMessage?: string
): boolean {
  if (!user) {
    sendError(
      res,
      401,
      'Unauthorized',
      customMessage || 'Authentication required'
    );
    return false;
  }
  return true;
}
