import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin, handleApiError } from '../lib/auth-vercel';
import { updateImplementationStatus } from '../lib/db';
import { sql } from '@vercel/postgres';

/**
 * POST /api/admin/reject
 * Reject a pending contribution
 * Requires admin role
 *
 * Body: {
 *   contributionId: string (UUID),
 *   reason?: string (optional rejection reason)
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId: adminId } = await requireAdmin(req);
    const { contributionId, reason } = req.body;

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
    await updateImplementationStatus(contribution.impl_uuid, 'rejected');

    // Update pattern_contributions
    await sql`
      UPDATE pattern_contributions
      SET
        status = 'rejected',
        reviewed_by = ${adminId},
        reviewed_at = NOW()
      WHERE id = ${contributionId}
    `;

    return res.status(200).json({
      success: true,
      userId: contribution.user_id,
      reason: reason || 'No reason provided'
    });
  } catch (error) {
    const { message, statusCode } = handleApiError(error);
    return res.status(statusCode).json({ error: message });
  }
}
