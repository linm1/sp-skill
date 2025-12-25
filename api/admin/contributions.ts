import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin, handleApiError } from '../lib/auth-vercel';
import { getPendingContributions } from '../lib/db';
import { clerkClient } from '@clerk/nextjs/server';

/**
 * GET /api/admin/contributions
 * Returns pending contributions for admin review
 * Requires admin role
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await requireAdmin(req);

    const pending = await getPendingContributions();

    // Get Clerk client
    const clerk = await clerkClient();

    // Enrich with user data from Clerk
    const contributions = await Promise.all(pending.map(async (c) => {
      try {
        const user = await clerk.users.getUser(c.user_id);
        return {
          id: c.id,
          patternId: c.pattern_id,
          patternTitle: c.pattern_title,
          userId: c.user_id,
          userName: user.firstName || user.emailAddresses[0]?.emailAddress,
          userEmail: user.emailAddresses[0]?.emailAddress,
          implementation: {
            uuid: c.impl_uuid,
            sasCode: c.sas_code,
            rCode: c.r_code,
            considerations: c.considerations,
            variations: c.variations
          },
          createdAt: c.created_at.toISOString()
        };
      } catch (userError) {
        // If user lookup fails, return without user details
        return {
          id: c.id,
          patternId: c.pattern_id,
          patternTitle: c.pattern_title,
          userId: c.user_id,
          userName: 'Unknown',
          userEmail: 'Unknown',
          implementation: {
            uuid: c.impl_uuid,
            sasCode: c.sas_code,
            rCode: c.r_code,
            considerations: c.considerations,
            variations: c.variations
          },
          createdAt: c.created_at.toISOString()
        };
      }
    }));

    return res.status(200).json({
      contributions,
      total: contributions.length
    });
  } catch (error) {
    const { message, statusCode } = handleApiError(error);
    return res.status(statusCode).json({ error: message });
  }
}
