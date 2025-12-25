import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireContributor, handleApiError } from '../lib/auth-vercel';
import { createContribution } from '../lib/pattern-service';
import { clerkClient } from '@clerk/nextjs/server';

/**
 * POST /api/patterns/contribute
 *
 * Submit a new pattern implementation
 *
 * Authentication: Required (contributor, premier, or admin role)
 *
 * Request Body:
 * {
 *   patternId: "IMP-001",
 *   sasCode: "SAS implementation code",
 *   rCode: "R implementation code",
 *   considerations?: ["Edge case 1", "Edge case 2"],
 *   variations?: ["Alternative approach"]
 * }
 *
 * Response:
 * {
 *   success: true,
 *   status: "approved" | "pending",
 *   message: "Contribution approved" | "Contribution submitted for review",
 *   creditsAwarded?: 25,
 *   implementation: {
 *     uuid: "550e8400-e29b-41d4-a716-446655440000",
 *     patternId: "IMP-001",
 *     authorId: "user_123",
 *     authorName: "John Doe",
 *     status: "approved",
 *     sasCode: "SAS code",
 *     rCode: "R code",
 *     considerations: [],
 *     variations: [],
 *     isPremium: false,
 *     createdAt: "2025-12-25T12:00:00.000Z"
 *   }
 * }
 *
 * Auto-Approval Logic:
 * - Admin and Premier: Auto-approved
 * - Contributor: Pending review
 *
 * Error responses:
 * - 400: Missing required fields
 * - 401: Unauthorized (not authenticated)
 * - 403: Forbidden (insufficient role)
 * - 500: Internal server error
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Require contributor, premier, or admin role
    const { userId, role } = await requireContributor(req);

    // Get user's display name from Clerk
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const userName = user.firstName || user.emailAddresses[0]?.emailAddress || 'Anonymous';

    // Validate request body
    const { patternId, sasCode, rCode, considerations, variations } = req.body;

    if (!patternId || !sasCode || !rCode) {
      return res.status(400).json({
        error: 'Missing required fields: patternId, sasCode, rCode'
      });
    }

    // Create contribution
    const result = await createContribution(userId, userName, role, {
      patternId,
      sasCode,
      rCode,
      considerations,
      variations
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Error creating contribution:', error);
    const { message, statusCode } = handleApiError(error);
    return res.status(statusCode).json({ error: message });
  }
}
