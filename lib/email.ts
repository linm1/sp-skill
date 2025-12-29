import { Resend } from 'resend';

/**
 * Email Utility for StatPatternHub Admin Notifications
 *
 * This module provides email functionality using Resend API to notify admins
 * when contributors submit new pattern implementations for review.
 *
 * Environment Variables Required:
 * - RESEND_API_KEY: API key from Resend dashboard (https://resend.com/api-keys)
 * - ADMIN_EMAIL: Email address for admin notifications (e.g., admin@statpatternhub.com)
 *
 * Configuration in Vercel:
 * 1. Go to Vercel Dashboard → Project Settings → Environment Variables
 * 2. Add RESEND_API_KEY with your Resend API key (starts with "re_")
 * 3. Add ADMIN_EMAIL with the admin notification email address
 * 4. Redeploy or restart development server to apply changes
 *
 * Usage Example:
 * ```typescript
 * import { sendAdminNotification } from '../lib/email.js';
 *
 * const result = await sendAdminNotification({
 *   patternId: 'IMP-001',
 *   patternTitle: 'LOCF Imputation',
 *   contributorName: 'John Doe',
 *   reviewLink: 'https://sp-skill.vercel.app/admin/review/12345'
 * });
 *
 * if (!result.success) {
 *   console.error('Email failed:', result.error);
 *   // Handle gracefully - don't block the main operation
 * }
 * ```
 */

// Initialize Resend client
// Note: Will return a client even if API key is missing (fails at send time)
const resend = new Resend(process.env.RESEND_API_KEY || '');

/**
 * Parameters for admin notification email
 */
export interface AdminNotificationParams {
  /** Pattern ID (e.g., "IMP-001", "DER-020") */
  patternId: string;

  /** Human-readable pattern title */
  patternTitle: string;

  /** Name of the contributor who submitted the pattern */
  contributorName: string;

  /** Direct link to review the submission in admin dashboard */
  reviewLink: string;
}

/**
 * Result of email send operation
 */
export interface EmailResult {
  /** Whether the email was sent successfully */
  success: boolean;

  /** Error message if send failed (undefined if successful) */
  error?: string;

  /** Resend email ID if successful (for tracking/debugging) */
  emailId?: string;
}

/**
 * Sends an email notification to admins when a new pattern implementation is submitted
 *
 * This function gracefully handles failures by logging errors without throwing exceptions.
 * The submission workflow should continue even if email notification fails.
 *
 * @param params - Notification parameters
 * @returns Promise with success status and optional error message
 *
 * @example
 * ```typescript
 * const result = await sendAdminNotification({
 *   patternId: 'IMP-001',
 *   patternTitle: 'LOCF Imputation',
 *   contributorName: 'John Doe',
 *   reviewLink: 'https://sp-skill.vercel.app/admin/review/abc123'
 * });
 * ```
 */
export async function sendAdminNotification(
  params: AdminNotificationParams
): Promise<EmailResult> {
  const { patternId, patternTitle, contributorName, reviewLink } = params;

  // Validate environment variables
  const apiKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!apiKey) {
    const error = 'RESEND_API_KEY environment variable is not configured';
    console.error('[Email Service]', error);
    return { success: false, error };
  }

  if (!adminEmail) {
    const error = 'ADMIN_EMAIL environment variable is not configured';
    console.error('[Email Service]', error);
    return { success: false, error };
  }

  // Validate input parameters
  if (!patternId || !patternTitle || !contributorName || !reviewLink) {
    const error = 'Missing required notification parameters';
    console.error('[Email Service]', error, { patternId, patternTitle, contributorName, reviewLink });
    return { success: false, error };
  }

  try {
    // Send email using Resend API
    // Note: Using onboarding@resend.dev for testing. Update to custom domain after verification.
    const { data, error } = await resend.emails.send({
      from: 'StatPatternHub <onboarding@resend.dev>',
      to: [adminEmail],
      subject: `New Pattern Submission: ${patternId} - ${patternTitle}`,
      html: generateEmailHtml(params),
      text: generateEmailText(params),
    });

    if (error) {
      console.error('[Email Service] Resend API error:', error);
      return {
        success: false,
        error: error.message || 'Unknown Resend API error'
      };
    }

    console.log('[Email Service] Admin notification sent successfully:', {
      emailId: data?.id,
      patternId,
      contributorName,
    });

    return {
      success: true,
      emailId: data?.id
    };

  } catch (error: any) {
    // Catch unexpected errors (network issues, etc.)
    const errorMessage = error?.message || 'Unknown error sending email';
    console.error('[Email Service] Unexpected error:', errorMessage, error);

    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Generates HTML email content for admin notification
 *
 * @param params - Notification parameters
 * @returns HTML email body
 */
function generateEmailHtml(params: AdminNotificationParams): string {
  const { patternId, patternTitle, contributorName, reviewLink } = params;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Pattern Submission</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-left: 4px solid #4f46e5; padding: 20px; margin-bottom: 20px;">
    <h2 style="margin: 0 0 10px 0; color: #4f46e5;">New Pattern Implementation Submitted</h2>
    <p style="margin: 0; color: #666;">A contributor has submitted a new pattern for review.</p>
  </div>

  <div style="background-color: #fff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px 0; font-weight: bold; color: #555;">Pattern ID:</td>
        <td style="padding: 10px 0;">${patternId}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; font-weight: bold; color: #555;">Pattern Title:</td>
        <td style="padding: 10px 0;">${patternTitle}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; font-weight: bold; color: #555;">Contributor:</td>
        <td style="padding: 10px 0;">${contributorName}</td>
      </tr>
    </table>

    <div style="margin-top: 30px; text-align: center;">
      <a href="${reviewLink}"
         style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
        Review Submission
      </a>
    </div>
  </div>

  <div style="margin-top: 20px; padding: 15px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
    <p style="margin: 0; font-size: 14px; color: #92400e;">
      <strong>Action Required:</strong> Please review this submission and approve or request changes.
    </p>
  </div>

  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px;">
    <p>StatPatternHub - Clinical Programming Pattern Repository</p>
    <p>This is an automated notification. Please do not reply to this email.</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generates plain text email content for admin notification
 * (Fallback for email clients that don't support HTML)
 *
 * @param params - Notification parameters
 * @returns Plain text email body
 */
function generateEmailText(params: AdminNotificationParams): string {
  const { patternId, patternTitle, contributorName, reviewLink } = params;

  return `
NEW PATTERN IMPLEMENTATION SUBMITTED

A contributor has submitted a new pattern for review.

Pattern Details:
----------------
Pattern ID:     ${patternId}
Pattern Title:  ${patternTitle}
Contributor:    ${contributorName}

Review Link:
${reviewLink}

ACTION REQUIRED: Please review this submission and approve or request changes.

---
StatPatternHub - Clinical Programming Pattern Repository
This is an automated notification. Please do not reply to this email.
  `.trim();
}
