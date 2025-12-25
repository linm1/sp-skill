import type { VercelRequest } from '@vercel/node';
import { clerkClient } from '@clerk/nextjs/server';

/**
 * Vercel-compatible authentication helpers for StatPatternHub
 * Uses Clerk SDK directly (not Next.js middleware)
 */

export type Role = 'guest' | 'contributor' | 'premier' | 'admin';

export interface AuthContext {
  userId: string;
  role: Role;
  user: any;
}

/**
 * Extract Bearer token from Authorization header
 */
function getBearerToken(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Get auth context from Clerk session token
 * Returns null if not authenticated
 */
export async function getAuthContext(req: VercelRequest): Promise<AuthContext | null> {
  try {
    // Get session token from Authorization header
    const sessionToken = getBearerToken(req);

    if (!sessionToken) {
      return null;
    }

    // Get the Clerk client instance
    const client = await clerkClient();

    // Verify the session token with Clerk
    const session = await client.sessions.verifySession(sessionToken, sessionToken);

    if (!session || !session.userId) {
      return null;
    }

    // Get user details
    const user = await client.users.getUser(session.userId);
    const role = (user.publicMetadata?.role as Role) || 'guest';

    return {
      userId: session.userId,
      role,
      user
    };
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

/**
 * Require authentication (any authenticated user)
 * Returns user ID if authenticated
 * Throws error if not authenticated
 */
export async function requireAuth(req: VercelRequest): Promise<string> {
  const authContext = await getAuthContext(req);

  if (!authContext) {
    throw new Error('Unauthorized: Authentication required');
  }

  return authContext.userId;
}

/**
 * Require admin role for endpoint
 * Throws error with appropriate message if not authorized
 */
export async function requireAdmin(req: VercelRequest): Promise<AuthContext> {
  const authContext = await getAuthContext(req);

  if (!authContext) {
    throw new Error('Unauthorized: Authentication required');
  }

  if (authContext.role !== 'admin') {
    throw new Error(
      `Forbidden: Admin role required. Current role: ${authContext.role}`
    );
  }

  return authContext;
}

/**
 * Require contributor, premier, or admin role
 */
export async function requireContributor(req: VercelRequest): Promise<AuthContext> {
  const authContext = await getAuthContext(req);

  if (!authContext) {
    throw new Error('Unauthorized: Authentication required');
  }

  const allowedRoles: Role[] = ['contributor', 'premier', 'admin'];

  if (!allowedRoles.includes(authContext.role)) {
    throw new Error(
      `Forbidden: Contributor role required. Current role: ${authContext.role}`
    );
  }

  return authContext;
}

/**
 * Handle API errors consistently
 * Maps common error types to appropriate HTTP status codes
 */
export function handleApiError(error: unknown): { message: string; statusCode: number } {
  if (error instanceof Error) {
    // Map common error messages to status codes
    if (error.message.includes('Unauthorized')) {
      return { message: error.message, statusCode: 401 };
    }
    if (error.message.includes('Forbidden')) {
      return { message: error.message, statusCode: 403 };
    }
    if (error.message.includes('Not found') || error.message.includes('not found')) {
      return { message: error.message, statusCode: 404 };
    }

    return { message: error.message, statusCode: 500 };
  }

  return { message: 'Internal server error', statusCode: 500 };
}
