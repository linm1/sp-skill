import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, handleApiError } from '../lib/auth-vercel';
import { getUserUnlocks } from '../lib/db';

/**
 * GET /api/credits/unlocks
 * Returns user's premium unlocks
 *
 * Response: {
 *   hasLifetimeAccess: boolean,
 *   patterns: string[],
 *   categories: string[]
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = await requireAuth(req);
    const unlocks = await getUserUnlocks(userId);

    const hasLifetimeAccess = unlocks.some(u => u.unlock_type === 'lifetime');
    const patterns = unlocks.filter(u => u.pattern_id).map(u => u.pattern_id!);
    const categories = unlocks.filter(u => u.category).map(u => u.category!);

    return res.status(200).json({
      hasLifetimeAccess,
      patterns,
      categories
    });
  } catch (error) {
    const { message, statusCode } = handleApiError(error);
    return res.status(statusCode).json({ error: message });
  }
}
