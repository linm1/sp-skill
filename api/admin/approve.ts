import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin, handleApiError } from '../lib/auth-vercel';
import { updateImplementationStatus } from '../lib/db';
import { awardCredits } from '../lib/credit-service';
import { sql } from '@vercel/postgres';

/**
 * POST /api/admin/approve
 * Approve a pending contribution and award credits
 * Requires admin role
 *
 * Body: {
 *   contributionId: string (UUID),
 *   qualityScore?: number (optional, 1-5)
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId: adminId } = await requireAdmin(req);
    const { contributionId, qualityScore } = req.body;

    if (!contributionId) {
      return res.status(400).json({ error: 'contributionId is required' });
    }

    // Get contribution
    const result = await sql`
      SELECT * FROM pattern_contributions WHERE id = ${contributionId}
    `;

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contribution not found' });
    }

    const contribution = result.rows[0];

    // Check if already approved or rejected
    if (contribution.status !== 'pending') {
      return res.status(400).json({
        error: `Contribution already ${contribution.status}`
      });
    }

    // Update pattern_implementations status
    await updateImplementationStatus(contribution.impl_uuid, 'approved');

    // Update pattern_contributions
    await sql`
      UPDATE pattern_contributions
      SET
        status = 'approved',
        credits_earned = 25,
        quality_score = ${qualityScore || null},
        reviewed_by = ${adminId},
        reviewed_at = NOW()
      WHERE id = ${contributionId}
    `;

    // Award credits (25 base)
    await awardCredits(contribution.user_id, 25, 'pattern_contribution', {
      patternId: contribution.pattern_id,
      implUuid: contribution.impl_uuid
    });

    return res.status(200).json({
      success: true,
      creditsAwarded: 25,
      userId: contribution.user_id
    });
  } catch (error) {
    const { message, statusCode } = handleApiError(error);
    return res.status(statusCode).json({ error: message });
  }
}
