import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPatternDetail } from '../lib/pattern-service';
import { handleApiError } from '../lib/auth-vercel';

/**
 * GET /api/patterns/get?id={patternId}
 *
 * Returns pattern definition with all approved implementations
 *
 * Authentication: None required (public endpoint)
 *
 * Query Parameters:
 * - id: Pattern ID (e.g., "IMP-001")
 *
 * Response:
 * {
 *   definition: {
 *     id: "IMP-001",
 *     category: "IMP",
 *     title: "LOCF Imputation",
 *     problem: "Fill missing values with last observation",
 *     whenToUse: "When forward-filling makes clinical sense"
 *   },
 *   implementations: [
 *     {
 *       uuid: "550e8400-e29b-41d4-a716-446655440000",
 *       patternId: "IMP-001",
 *       authorId: "user_123",
 *       authorName: "John Doe",
 *       sasCode: "SAS code here",
 *       rCode: "R code here",
 *       considerations: ["Watch for baseline values"],
 *       variations: ["Can be combined with mean imputation"],
 *       status: "approved",
 *       isPremium: false,
 *       createdAt: "2025-12-25T12:00:00.000Z"
 *     }
 *   ]
 * }
 *
 * Error responses:
 * - 400: Missing pattern ID
 * - 404: Pattern not found
 * - 500: Internal server error
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Pattern ID is required' });
    }

    const pattern = await getPatternDetail(id);

    if (!pattern) {
      return res.status(404).json({ error: 'Pattern not found' });
    }

    return res.status(200).json(pattern);
  } catch (error) {
    console.error('Error fetching pattern detail:', error);
    const { message, statusCode } = handleApiError(error);
    return res.status(statusCode).json({ error: message });
  }
}
