import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from '@clerk/backend';

/**
 * Debug Auth Endpoint
 *
 * GET /api/debug-auth
 * Tests if Clerk token verification is working
 *
 * Send Authorization header with Bearer token
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(400).json({
      error: 'Missing Authorization header',
      hint: 'Send: Authorization: Bearer <token>'
    });
  }

  const token = authHeader.substring(7);

  try {
    console.log('Testing Clerk token verification...');
    console.log('Token preview:', token.substring(0, 20) + '...');
    console.log('CLERK_SECRET_KEY exists:', !!process.env.CLERK_SECRET_KEY);
    console.log('CLERK_SECRET_KEY length:', process.env.CLERK_SECRET_KEY?.length || 0);

    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY || '',
    });

    console.log('Token verified successfully!');
    console.log('Payload:', payload);

    return res.status(200).json({
      success: true,
      message: 'Token verification successful',
      payload: {
        sub: payload.sub,
        iat: payload.iat,
        exp: payload.exp,
        iss: payload.iss,
      }
    });

  } catch (error: any) {
    console.error('Token verification failed:', error);

    return res.status(401).json({
      success: false,
      error: 'Token verification failed',
      message: error.message,
      name: error.name,
      hint: 'Check CLERK_SECRET_KEY environment variable'
    });
  }
}
