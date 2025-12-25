import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, handleApiError } from '../lib/auth-vercel';
import { getOrCreateUserCredits } from '../lib/credit-service';

/**
 * GET /api/credits/balance
 * Returns user's credit balance, tier, and progression stats
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = await requireAuth(req);
    const credits = await getOrCreateUserCredits(userId);

    // Calculate next tier
    const tiers = ['bronze', 'silver', 'gold', 'platinum'];
    const currentTierIndex = tiers.indexOf(credits.tier);
    const nextTierAt = currentTierIndex < 3 ? [100, 500, 2000][currentTierIndex] : null;

    return res.status(200).json({
      balance: credits.balance,
      lifetimeEarned: credits.lifetime_earned,
      lifetimeSpent: credits.lifetime_spent,
      contributionCount: credits.contribution_count,
      tier: credits.tier,
      badges: credits.badges,
      nextTierAt
    });
  } catch (error) {
    const { message, statusCode } = handleApiError(error);
    return res.status(statusCode).json({ error: message });
  }
}
