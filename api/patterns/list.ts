import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getPatternsList } from '../lib/pattern-service';
import { handleApiError } from '../lib/auth-vercel';

/**
 * GET /api/patterns/list
 *
 * Returns list of all pattern definitions with implementation counts
 *
 * Authentication: None required (public endpoint)
 *
 * Response:
 * {
 *   patterns: [
 *     {
 *       id: "IMP-001",
 *       category: "IMP",
 *       title: "LOCF Imputation",
 *       problem: "Fill missing values with last observation",
 *       whenToUse: "When forward-filling makes clinical sense",
 *       implementationCount: 3,
 *       approvedCount: 3,
 *       pendingCount: 0
 *     },
 *     ...
 *   ]
 * }
 *
 * Error responses:
 * - 500: Internal server error
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const patterns = await getPatternsList();
    return res.status(200).json({ patterns });
  } catch (error) {
    console.error('Error fetching pattern list:', error);
    const { message, statusCode } = handleApiError(error);
    return res.status(statusCode).json({ error: message });
  }
}
