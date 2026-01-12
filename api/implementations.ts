import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { db } from '../db/index.js';
import { patternDefinitions, patternImplementations } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getAuthenticatedUser, requireAuthGuard, requireAdminGuard } from '../lib/auth.js';
import { sendAdminNotification } from '../lib/email.js';
import { cache } from '../lib/cache.js';
import { CACHE_TTL, PATTERN_ID_REGEX, PATTERN_ID_ERROR_MESSAGE } from '../lib/constants.js';
import { isSoftDeleteColumnMissing } from '../lib/db-utils.js';
import { IMPLEMENTATION_WITH_PATTERN_FIELDS } from '../lib/db-selects.js';
import { sendError } from '../lib/api-response.js';
import { validateWithZod } from '../lib/validation.js';
import { invalidateAllPatternCaches, invalidatePendingImplementations } from '../lib/cache-invalidation.js';

/**
 * Pattern Implementations API
 *
 * POST /api/implementations - Create a new pattern implementation
 * GET /api/implementations?author_id=me - List user's implementations (excludes soft-deleted)
 * GET /api/implementations?status=pending - List pending implementations (admin only, excludes soft-deleted)
 * GET /api/implementations?patternId=XXX-NNN - List implementations for a specific pattern (admin only, excludes soft-deleted)
 * GET /api/implementations?includeDeleted=true - Include soft-deleted records (admin-only)
 *
 * Purpose: Allows contributors to submit their own implementations for existing patterns
 *          and enables admins to review pending submissions and edit pattern implementations
 *
 * Authentication: Required (Clerk JWT)
 *
 * Business Rules:
 * - At least one of sasCode or rCode must be provided
 * - Pattern ID must exist in pattern_definitions table
 * - New implementations default to 'pending' status
 * - Author ID is automatically extracted from authenticated user
 * - Admin role required to query pending implementations or by pattern ID
 * - By default, soft-deleted implementations are excluded from all queries
 * - includeDeleted=true parameter shows soft-deleted records (admin-only)
 */

// Zod schema for POST request validation
const createImplementationSchema = z.object({
  patternId: z.string().regex(PATTERN_ID_REGEX, PATTERN_ID_ERROR_MESSAGE),
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
    if (!requireAuthGuard(user, res, 'Please log in to submit an implementation')) return;

    // 2. Validate request body with Zod
    const validated = validateWithZod(createImplementationSchema, req.body, res);
    if (!validated) return; // Error already sent

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
        authorId: user!.id, // Safe after guard check
        authorName: user!.name || user!.email.split('@')[0], // Fallback to email prefix if no name
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

    // 6. Invalidate caches
    await invalidateAllPatternCaches(implementation.patternId);
    await invalidatePendingImplementations();

    // 7. Return success response with created implementation
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
 * GET /api/implementations?patternId=XXX-NNN (admin only)
 * Lists implementations based on query parameters
 */
async function handleGet(req: VercelRequest, res: VercelResponse) {
  try {
    // 1. Authenticate user
    const user = await getAuthenticatedUser(req);
    if (!requireAuthGuard(user, res, 'Please log in to view implementations')) return;

    // 2. Validate query parameters
    const { author_id, status, patternId, includeDeleted } = req.query;

    // Check if includeDeleted is requested (admin-only)
    const shouldIncludeDeleted = includeDeleted === 'true';
    if (shouldIncludeDeleted && !requireAdminGuard(user, res, 'Admin role required to view deleted implementations')) return;

    // Route 1: Get user's own implementations (author_id=me)
    if (author_id === 'me') {
      // Check cache before DB query
      const cacheKey = `impl:user:${user!.id}:${shouldIncludeDeleted}`; // Safe after guard check
      const cachedData = await cache.get<any>(cacheKey);
      if (cachedData) {
        return res.status(200).json(cachedData);
      }

      let userImplementations;

      try {
        userImplementations = await db
          .select(IMPLEMENTATION_WITH_PATTERN_FIELDS)
          .from(patternImplementations)
          .innerJoin(
            patternDefinitions,
            eq(patternImplementations.patternId, patternDefinitions.id)
          )
          .where(
            shouldIncludeDeleted
              ? eq(patternImplementations.authorId, user!.id) // Safe after guard check
              : and(
                  eq(patternImplementations.authorId, user!.id), // Safe after guard check
                  eq(patternImplementations.isDeleted, false)
                )
          );
      } catch (dbError: any) {
        console.error('Database query error for user implementations:', dbError);

        // Check if it's a column missing error (migration not applied)
        if (isSoftDeleteColumnMissing(dbError)) {
          console.warn('Soft-delete columns not found in implementations table, querying without isDeleted filter');

          // Retry without soft-delete filter
          userImplementations = await db
            .select(IMPLEMENTATION_WITH_PATTERN_FIELDS)
            .from(patternImplementations)
            .innerJoin(
              patternDefinitions,
              eq(patternImplementations.patternId, patternDefinitions.id)
            )
            .where(eq(patternImplementations.authorId, user!.id)); // Safe after guard check
        } else {
          // Re-throw if different error
          throw dbError;
        }
      }

      // Prepare response
      const response = {
        success: true,
        count: userImplementations.length,
        implementations: userImplementations
      };

      // Store in cache (TTL: 10 minutes)
      await cache.set(cacheKey, response, CACHE_TTL.IMPLEMENTATION_QUERIES);

      return res.status(200).json(response);
    }

    // Route 2: Get pending implementations for admin review (status=pending)
    if (status === 'pending') {
      // Check if user has admin role
      if (!requireAdminGuard(user, res, 'Admin role required to view pending implementations')) return;

      // Check cache before DB query
      const cacheKey = `impl:pending:${shouldIncludeDeleted}`;
      const cachedData = await cache.get<any>(cacheKey);
      if (cachedData) {
        return res.status(200).json(cachedData);
      }

      let pendingImplementations;

      try {
        pendingImplementations = await db
          .select(IMPLEMENTATION_WITH_PATTERN_FIELDS)
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
      } catch (dbError: any) {
        console.error('Database query error for pending implementations:', dbError);

        // Check if it's a column missing error (migration not applied)
        if (isSoftDeleteColumnMissing(dbError)) {
          console.warn('Soft-delete columns not found in implementations table, querying without isDeleted filter');

          // Retry without soft-delete filter
          pendingImplementations = await db
            .select(IMPLEMENTATION_WITH_PATTERN_FIELDS)
            .from(patternImplementations)
            .innerJoin(
              patternDefinitions,
              eq(patternImplementations.patternId, patternDefinitions.id)
            )
            .where(eq(patternImplementations.status, 'pending'));
        } else {
          // Re-throw if different error
          throw dbError;
        }
      }

      // Prepare response
      const response = {
        success: true,
        count: pendingImplementations.length,
        implementations: pendingImplementations
      };

      // Store in cache (TTL: 2 minutes for pending items)
      await cache.set(cacheKey, response, CACHE_TTL.PENDING_IMPLEMENTATIONS);

      return res.status(200).json(response);
    }

    // Route 3: Get implementations by pattern ID (admin only)
    if (patternId && typeof patternId === 'string') {
      // Check if user has admin role
      if (!requireAdminGuard(user, res, 'Admin role required to query implementations by pattern ID')) return;

      // Check cache before DB query
      const cacheKey = `impl:pattern:${patternId}:${shouldIncludeDeleted}`;
      const cachedData = await cache.get<any>(cacheKey);
      if (cachedData) {
        return res.status(200).json(cachedData);
      }

      let patternImplementationsList;

      try {
        patternImplementationsList = await db
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
            isPremium: patternImplementations.isPremium,
            createdAt: patternImplementations.createdAt,
            updatedAt: patternImplementations.updatedAt,
          })
          .from(patternImplementations)
          .where(
            shouldIncludeDeleted
              ? eq(patternImplementations.patternId, patternId)
              : and(
                  eq(patternImplementations.patternId, patternId),
                  eq(patternImplementations.isDeleted, false)
                )
          );
      } catch (dbError: any) {
        console.error('Database query error for pattern implementations:', dbError);

        // Check if it's a column missing error (migration not applied)
        const isColumnError =
          dbError.message?.includes('column') &&
          (dbError.message?.includes('does not exist') || dbError.message?.includes('isDeleted') || dbError.message?.includes('is_deleted'));

        if (isColumnError) {
          console.warn('Soft-delete columns not found in implementations table, querying without isDeleted filter');

          // Retry without soft-delete filter
          patternImplementationsList = await db
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
              isPremium: patternImplementations.isPremium,
              createdAt: patternImplementations.createdAt,
              updatedAt: patternImplementations.updatedAt,
            })
            .from(patternImplementations)
            .where(eq(patternImplementations.patternId, patternId));
        } else {
          // Re-throw if different error
          throw dbError;
        }
      }

      // Prepare response
      const response = {
        success: true,
        count: patternImplementationsList.length,
        implementations: patternImplementationsList
      };

      // Store in cache (TTL: 10 minutes)
      await cache.set(cacheKey, response, CACHE_TTL.IMPLEMENTATION_QUERIES);

      return res.status(200).json(response);
    }

    // Invalid query parameters
    return res.status(400).json({
      error: 'Invalid query parameter',
      message: 'Supported query parameters: author_id=me, status=pending (admin only), or patternId=XXX-NNN (admin only)'
    });

  } catch (error) {
    console.error('[API /implementations] GET error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to fetch implementations'
    });
  }
}
