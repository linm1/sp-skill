import { clerkClient, getAuth } from '@clerk/nextjs/server';
import type { NextApiRequest } from 'next';

/**
 * Authentication middleware for StatPatternHub API endpoints
 * Uses Clerk for user authentication and role-based access control
 */

export type Role = 'guest' | 'contributor' | 'premier' | 'admin';

export interface AuthContext {
  userId: string;
  role: Role;
  user: any;
}

/**
 * Require authentication for API endpoint
 * Throws error if user is not authenticated
 *
 * @param req - Next.js API request object
 * @returns userId of authenticated user
 * @throws Error if user is not authenticated
 */
export async function requireAuth(req: NextApiRequest): Promise<string> {
  const { userId } = getAuth(req);

  if (!userId) {
    throw new Error('Unauthorized: Authentication required');
  }

  return userId;
}

/**
 * Get user role from Clerk metadata
 * Role is stored in user.publicMetadata.role
 * Defaults to 'guest' if not set
 *
 * @param userId - Clerk user ID
 * @returns User role
 */
export async function getUserRole(userId: string): Promise<Role> {
  try {
    const user = await clerkClient.users.getUser(userId);
    const role = (user.publicMetadata?.role as Role) || 'guest';
    return role;
  } catch (error) {
    console.error('Error fetching user role:', error);
    // Default to guest on error
    return 'guest';
  }
}

/**
 * Require specific role(s) for API endpoint
 * Checks authentication and role authorization
 *
 * @param req - Next.js API request object
 * @param allowedRoles - Array of roles that are allowed to access the endpoint
 * @returns AuthContext with userId, role, and user object
 * @throws Error if user is not authenticated or doesn't have required role
 */
export async function requireRole(
  req: NextApiRequest,
  allowedRoles: Role[]
): Promise<AuthContext> {
  // First check authentication
  const userId = await requireAuth(req);

  // Get full user object and role
  const user = await clerkClient.users.getUser(userId);
  const role = (user.publicMetadata?.role as Role) || 'guest';

  // Check if user has required role
  if (!allowedRoles.includes(role)) {
    throw new Error(
      `Forbidden: Required role(s): ${allowedRoles.join(', ')}. Current role: ${role}`
    );
  }

  return { userId, role, user };
}

/**
 * Require admin role
 * Convenience function for admin-only endpoints
 *
 * @param req - Next.js API request object
 * @returns AuthContext
 * @throws Error if user is not admin
 */
export async function requireAdmin(req: NextApiRequest): Promise<AuthContext> {
  return requireRole(req, ['admin']);
}

/**
 * Require contributor, premier, or admin role
 * For endpoints that allow content contribution
 *
 * @param req - Next.js API request object
 * @returns AuthContext
 * @throws Error if user doesn't have required role
 */
export async function requireContributor(req: NextApiRequest): Promise<AuthContext> {
  return requireRole(req, ['contributor', 'premier', 'admin']);
}

/**
 * Get auth context without requiring authentication
 * Returns null if user is not authenticated
 * Useful for optional authentication scenarios
 *
 * @param req - Next.js API request object
 * @returns AuthContext or null if not authenticated
 */
export async function getAuthContext(req: NextApiRequest): Promise<AuthContext | null> {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return null;
    }

    const user = await clerkClient.users.getUser(userId);
    const role = (user.publicMetadata?.role as Role) || 'guest';

    return { userId, role, user };
  } catch (error) {
    console.error('Error getting auth context:', error);
    return null;
  }
}

/**
 * Check if user has permission to access premium content
 *
 * @param role - User role
 * @returns true if user can access premium content
 */
export function canAccessPremium(role: Role): boolean {
  return role === 'premier' || role === 'admin';
}

/**
 * Check if user can edit a specific implementation
 *
 * @param role - User role
 * @param authorId - Author ID of the implementation
 * @param currentUserId - Current user's ID
 * @returns true if user can edit the implementation
 */
export function canEditImplementation(
  role: Role,
  authorId: string | null,
  currentUserId: string
): boolean {
  // Admins and premiers can edit anything
  if (role === 'admin' || role === 'premier') {
    return true;
  }

  // Contributors can only edit their own implementations
  if (role === 'contributor') {
    return authorId === currentUserId;
  }

  // Guests cannot edit
  return false;
}

/**
 * Check if user can approve implementations
 *
 * @param role - User role
 * @returns true if user can approve implementations
 */
export function canApprove(role: Role): boolean {
  return role === 'admin';
}

/**
 * Error response helper for API endpoints
 * Formats errors consistently
 */
export class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }
}

/**
 * Handle API errors consistently
 * Maps common error types to appropriate HTTP status codes
 */
export function handleApiError(error: unknown): { message: string; statusCode: number } {
  if (error instanceof ApiError) {
    return {
      message: error.message,
      statusCode: error.statusCode
    };
  }

  if (error instanceof Error) {
    // Map common error messages to status codes
    if (error.message.includes('Unauthorized')) {
      return { message: error.message, statusCode: 401 };
    }
    if (error.message.includes('Forbidden')) {
      return { message: error.message, statusCode: 403 };
    }
    if (error.message.includes('Not found')) {
      return { message: error.message, statusCode: 404 };
    }

    return { message: error.message, statusCode: 500 };
  }

  return { message: 'Internal server error', statusCode: 500 };
}
