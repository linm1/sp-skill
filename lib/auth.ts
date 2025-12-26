import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClerkClient } from '@clerk/backend';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// Initialize Clerk client with secret key from environment
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

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
    const verifiedToken = await clerkClient.verifyToken(token);
    if (!verifiedToken) return null;

    // Get the user ID from the token
    const userId = verifiedToken.sub;

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

      const newUser = await db.insert(users).values({
        clerkId: clerkUser.id,
        email: email,
        name: name,
        role: role
      }).returning();
      dbUser = newUser;
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
