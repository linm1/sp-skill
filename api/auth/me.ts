import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthenticatedUser } from '../../lib/auth.js';

/**
 * GET /api/auth/me
 * Returns the current authenticated user's profile
 *
 * Headers:
 *   Authorization: Bearer <clerk-jwt-token>
 *
 * Response:
 *   200: { success: true, user: { id, email, name, role, createdAt } }
 *   401: { error: "Unauthorized" }
 *   405: { error: "Method not allowed" }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return res.status(200).json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt
    }
  });
}
