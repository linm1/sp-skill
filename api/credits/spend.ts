import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, handleApiError } from '../lib/auth-vercel';
import { spendCredits, createUnlock } from '../lib/credit-service';

/**
 * POST /api/credits/spend
 * Spend credits to unlock premium content
 *
 * Body: {
 *   unlockType: 'pattern' | 'category' | 'lifetime',
 *   targetId: string | null (pattern ID or category code),
 *   cost: number
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = await requireAuth(req);
    const { unlockType, targetId, cost } = req.body;

    if (!unlockType || !cost) {
      return res.status(400).json({ error: 'Missing required fields: unlockType and cost' });
    }

    // Validate unlockType
    if (!['pattern', 'category', 'lifetime'].includes(unlockType)) {
      return res.status(400).json({ error: 'Invalid unlockType. Must be: pattern, category, or lifetime' });
    }

    // Spend credits
    const result = await spendCredits(userId, cost, `${unlockType}_unlock`, {
      unlockType,
      targetId
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    // Create unlock record
    await createUnlock(userId, unlockType, targetId, cost);

    return res.status(200).json({
      success: true,
      newBalance: result.newBalance,
      unlockId: `unlocked-${targetId || 'lifetime'}`
    });
  } catch (error) {
    const { message, statusCode } = handleApiError(error);
    return res.status(statusCode).json({ error: message });
  }
}
