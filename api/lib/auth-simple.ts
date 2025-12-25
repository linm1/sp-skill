import type { VercelRequest } from '@vercel/node';

/**
 * Simple authentication helpers for Vercel serverless functions
 * Uses secret keys for admin operations during initial setup
 */

export type Role = 'guest' | 'contributor' | 'premier' | 'admin';

export interface AuthContext {
  userId: string;
  role: Role;
}

/**
 * Verify admin access using secret key
 * This is a simplified approach for admin endpoints during initial setup
 *
 * For production, replace with full Clerk authentication
 */
export async function requireAdminKey(req: VercelRequest): Promise<AuthContext> {
  const adminKey = process.env.ADMIN_SECRET_KEY;

  if (!adminKey) {
    throw new Error('Admin authentication not configured');
  }

  // Check for admin key in headers or body
  const providedKey = req.headers['x-admin-key'] ||
                     req.headers['authorization']?.replace('Bearer ', '') ||
                     (req.body as any)?.adminKey;

  if (providedKey !== adminKey) {
    throw new Error('Unauthorized: Invalid admin key');
  }

  return {
    userId: 'admin-system',
    role: 'admin'
  };
}

/**
 * Check if request has valid seed key
 * For one-time database seeding operations
 */
export async function requireSeedKey(req: VercelRequest): Promise<string> {
  const seedKey = process.env.SEED_SECRET_KEY;

  if (!seedKey) {
    throw new Error('Seed key not configured. Set SEED_SECRET_KEY environment variable.');
  }

  const providedKey = req.headers['x-seed-key'] || (req.body as any)?.seedKey;

  if (providedKey !== seedKey) {
    throw new Error('Unauthorized: Invalid seed key');
  }

  return 'seed-system';
}
