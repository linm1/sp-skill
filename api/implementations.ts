import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { db } from '../db/index.js';
import { patternDefinitions, patternImplementations } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getAuthenticatedUser } from '../lib/auth.js';
import { sendAdminNotification } from '../lib/email.js';

/**
 * Pattern Implementations API
 *
 * POST /api/implementations - Create a new pattern implementation
 * GET /api/implementations?author_id=me - List user's implementations (excludes soft-deleted)
 * GET /api/implementations?status=pending - List pending implementations (admin only, excludes soft-deleted)
 * GET /api/implementations?includeDeleted=true - Include soft-deleted records (admin-only)
 *
 * Purpose: Allows contributors to submit their own implementations for existing patterns
 *          and enables admins to review pending submissions
 *
 * Authentication: Required (Clerk JWT)
 *
 * Business Rules:
 * - At least one of sasCode or rCode must be provided
 * - Pattern ID must exist in pattern_definitions table
 * - New implementations default to 'pending' status
 * - Author ID is automatically extracted from authenticated user
 * - Admin role required to query pending implementations
 * - By default, soft-deleted implementations are excluded from all queries
 * - includeDeleted=true parameter shows soft-deleted records (admin-only)
 */

// Zod schema for POST request validation
const createImplementationSchema = z.object({
  patternId: z.string()
    .regex(/^[A-Z]{3}-\d{3}$/, 'Pattern ID must match format XXX-NNN (e.g., IMP-001)'),
  sasCode: z.string().optional(),
  rCode: z.string().optional(),
  considerations: z.array(z.string()).optional().default([]),
  variations: z.array(z.string()).optional().default([]),
}).refine(
  (data) => {
    // At least one of sasCode or rCode must be non-empty
    const hasSasCode = data.sasCode && data.sasCode.trim().length > 0;
    const hasRCode = data.rCode && data.rCode.trim().length > 0;
    return hasSasCode || hasRCode;
  },
  {
    message: 'At least one of sasCode or rCode must be provided',
  }
);

type CreateImplementationRequest = z.infer<typeof createImplementationSchema>;

/**
 * Main handler - routes to POST or GET based on HTTP method
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Route based on HTTP method
  if (req.method === 'POST') {
    return handlePost(req, res);
  } else if (req.method === 'GET') {
    return handleGet(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * POST /api/implementations
 * Creates a new pattern implementation
 */
async function handlePost(req: VercelRequest, res: VercelResponse) {
  try {
    // 1. Authenticate user
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Please log in to submit an implementation'
      });
    }

    // 2. Validate request body with Zod
    let validated: CreateImplementationRequest;
    try {
      validated = createImplementationSchema.parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.issues.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      throw error;
    }

    // 3. Check that pattern ID exists in pattern_definitions table and fetch pattern details
    const patternExists = await db
      .select({
        id: patternDefinitions.id,
        title: patternDefinitions.title
      })
      .from(patternDefinitions)
      .where(eq(patternDefinitions.id, validated.patternId))
      .limit(1);

    if (patternExists.length === 0) {
      return res.status(404).json({
        error: 'Pattern not found',
        message: `Pattern ID '${validated.patternId}' does not exist`,
        patternId: validated.patternId
      });
    }

    const patternTitle = patternExists[0].title;

    // 4. Insert new implementation into database
    const newImplementation = await db
      .insert(patternImplementations)
      .values({
        patternId: validated.patternId,
        authorId: user.id,
        authorName: user.name || user.email.split('@')[0], // Fallback to email prefix if no name
        sasCode: validated.sasCode || null,
        rCode: validated.rCode || null,
        considerations: validated.considerations || [],
        variations: validated.variations || [],
        status: 'pending', // Default status for new submissions
        isPremium: false, // Default to free tier
      })
      .returning();

    const implementation = newImplementation[0];

    // 5. Send admin notification email (non-blocking)
    // Email failures should not prevent successful submission response
    try {
      const reviewLink = `https://sp-skill.vercel.app/admin/review?uuid=${implementation.uuid}`;

      const emailResult = await sendAdminNotification({
        patternId: implementation.patternId,
        patternTitle: patternTitle,
        contributorName: implementation.authorName,
        reviewLink: reviewLink,
      });

      if (!emailResult.success) {
        // Log email failure but don't block the response
        console.error('[API /implementations] Email notification failed:', emailResult.error);
      } else {
        console.log('[API /implementations] Admin notification sent successfully:', {
          emailId: emailResult.emailId,
          patternId: implementation.patternId,
          uuid: implementation.uuid,
        });
      }
    } catch (emailError) {
      // Catch any unexpected errors from email service
      console.error('[API /implementations] Unexpected error sending email:', emailError);
      // Continue with successful response - email is not critical
    }

    // 6. Return success response with created implementation
    return res.status(201).json({
      success: true,
      message: 'Implementation submitted successfully and is pending review',
      implementation: {
        uuid: implementation.uuid,
        patternId: implementation.patternId,
        authorId: implementation.authorId,
        authorName: implementation.authorName,
        sasCode: implementation.sasCode,
        rCode: implementation.rCode,
        considerations: implementation.considerations,
        variations: implementation.variations,
        status: implementation.status,
        isPremium: implementation.isPremium,
        createdAt: implementation.createdAt,
        updatedAt: implementation.updatedAt,
      }
    });

  } catch (error) {
    console.error('[API /implementations] POST error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to create implementation'
    });
  }
}

/**
 * GET /api/implementations?author_id=me
 * GET /api/implementations?status=pending (admin only)
 * Lists implementations based on query parameters
 */
async function handleGet(req: VercelRequest, res: VercelResponse) {
  try {
    // 1. Authenticate user
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Please log in to view implementations'
      });
    }

    // 2. Validate query parameters
    const { author_id, status, includeDeleted } = req.query;

    // Check if includeDeleted is requested (admin-only)
    const shouldIncludeDeleted = includeDeleted === 'true';
    if (shouldIncludeDeleted && user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin role required to view deleted implementations'
      });
    }

    // Route 1: Get user's own implementations (author_id=me)
    if (author_id === 'me') {
      const userImplementations = await db
        .select({
          // Implementation fields
          uuid: patternImplementations.uuid,
          patternId: patternImplementations.patternId,
          authorName: patternImplementations.authorName,
          sasCode: patternImplementations.sasCode,
          rCode: patternImplementations.rCode,
          considerations: patternImplementations.considerations,
          variations: patternImplementations.variations,
          status: patternImplementations.status,
          createdAt: patternImplementations.createdAt,
          updatedAt: patternImplementations.updatedAt,
          // Pattern definition fields (joined)
          patternTitle: patternDefinitions.title,
          patternCategory: patternDefinitions.category,
        })
        .from(patternImplementations)
        .innerJoin(
          patternDefinitions,
          eq(patternImplementations.patternId, patternDefinitions.id)
        )
        .where(
          shouldIncludeDeleted
            ? eq(patternImplementations.authorId, user.id)
            : and(
                eq(patternImplementations.authorId, user.id),
                eq(patternImplementations.isDeleted, false)
              )
        );

      return res.status(200).json({
        success: true,
        count: userImplementations.length,
        implementations: userImplementations
      });
    }

    // Route 2: Get pending implementations for admin review (status=pending)
    if (status === 'pending') {
      // Check if user has admin role
      if (user.role !== 'admin') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Admin role required to view pending implementations'
        });
      }

      const pendingImplementations = await db
        .select({
          // Implementation fields
          uuid: patternImplementations.uuid,
          patternId: patternImplementations.patternId,
          authorId: patternImplementations.authorId,
          authorName: patternImplementations.authorName,
          sasCode: patternImplementations.sasCode,
          rCode: patternImplementations.rCode,
          considerations: patternImplementations.considerations,
          variations: patternImplementations.variations,
          status: patternImplementations.status,
          createdAt: patternImplementations.createdAt,
          updatedAt: patternImplementations.updatedAt,
          // Pattern definition fields (joined)
          patternTitle: patternDefinitions.title,
          patternCategory: patternDefinitions.category,
        })
        .from(patternImplementations)
        .innerJoin(
          patternDefinitions,
          eq(patternImplementations.patternId, patternDefinitions.id)
        )
        .where(
          shouldIncludeDeleted
            ? eq(patternImplementations.status, 'pending')
            : and(
                eq(patternImplementations.status, 'pending'),
                eq(patternImplementations.isDeleted, false)
              )
        );

      return res.status(200).json({
        success: true,
        count: pendingImplementations.length,
        implementations: pendingImplementations
      });
    }

    // Invalid query parameters
    return res.status(400).json({
      error: 'Invalid query parameter',
      message: 'Supported query parameters: author_id=me or status=pending (admin only)'
    });

  } catch (error) {
    console.error('[API /implementations] GET error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to fetch implementations'
    });
  }
}
