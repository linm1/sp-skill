import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendAdminNotification } from '../lib/email.js';

/**
 * Test endpoint for Resend email service
 *
 * This endpoint allows testing the email notification system without
 * creating actual pattern submissions.
 *
 * Usage:
 *   POST /api/test-email
 *   {
 *     "patternId": "IMP-001",  // optional, defaults to "IMP-001"
 *     "patternTitle": "Test Pattern",  // optional
 *     "contributorName": "Test User",  // optional
 *     "reviewLink": "https://..."  // optional
 *   }
 *
 * Response:
 *   {
 *     "success": true,
 *     "emailId": "abc123...",
 *     "message": "Test email sent successfully"
 *   }
 *
 * OR
 *   {
 *     "success": false,
 *     "error": "Error message here"
 *   }
 *
 * Environment Variables Required:
 *   - RESEND_API_KEY
 *   - ADMIN_EMAIL
 *
 * Delete this file before production deployment or add authentication.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST.'
    });
  }

  try {
    // Get test parameters from request body or use defaults
    const {
      patternId = 'IMP-001',
      patternTitle = 'LOCF Imputation - TEST EMAIL',
      contributorName = 'Test User',
      reviewLink = 'https://sp-skill.vercel.app/admin/review/test-12345'
    } = req.body || {};

    console.log('[Test Email] Sending test notification with params:', {
      patternId,
      patternTitle,
      contributorName,
      reviewLink
    });

    // Call the email service
    const result = await sendAdminNotification({
      patternId,
      patternTitle,
      contributorName,
      reviewLink
    });

    // Return the result
    if (result.success) {
      return res.status(200).json({
        success: true,
        emailId: result.emailId,
        message: 'Test email sent successfully',
        params: {
          patternId,
          patternTitle,
          contributorName,
          reviewLink
        }
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error,
        message: 'Failed to send test email'
      });
    }

  } catch (error: any) {
    console.error('[Test Email] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Unknown error',
      message: 'Unexpected error sending test email'
    });
  }
}
