import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { cache } from '../lib/cache.js';

/**
 * Manual User Sync Endpoint
 *
 * POST /api/sync-user
 * Manually creates or updates a user in the database
 *
 * Body:
 * {
 *   clerkId: string,
 *   email: string,
 *   name: string,
 *   role: string
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Security check
  const token = req.headers['x-migration-token'];
  const expectedToken = process.env.MIGRATION_TOKEN;

  if (!expectedToken || token !== expectedToken) {
    return res.status(403).json({ error: 'Forbidden - Invalid or missing migration token' });
  }

  try {
    const { clerkId, email, name, role } = req.body;

    if (!clerkId || !email || !name || !role) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['clerkId', 'email', 'name', 'role']
      });
    }

    // Check if user already exists
    const existing = await db.select()
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing user
      const updated = await db.update(users)
        .set({
          email,
          name,
          role,
          updatedAt: new Date()
        })
        .where(eq(users.clerkId, clerkId))
        .returning();

      // Invalidate user caches
      await cache.del(`user:clerk:${clerkId}`);
      await cache.del(`user:profile:${clerkId}`);
      console.log('[CACHE INVALIDATE] Manual sync cleared cache for:', clerkId);

      return res.status(200).json({
        success: true,
        action: 'updated',
        user: updated[0]
      });
    }

    // Insert new user
    const newUser = await db.insert(users)
      .values({
        clerkId,
        email,
        name,
        role
      })
      .returning();

    // Invalidate user caches (defensive, in case of JIT provisioning race condition)
    await cache.del(`user:clerk:${clerkId}`);
    await cache.del(`user:profile:${clerkId}`);
    console.log('[CACHE INVALIDATE] Manual sync cleared cache for new user:', clerkId);

    return res.status(201).json({
      success: true,
      action: 'created',
      user: newUser[0]
    });

  } catch (error: any) {
    console.error('Error syncing user:', error);
    return res.status(500).json({
      error: 'Failed to sync user',
      message: error.message,
      code: error.code
    });
  }
}
