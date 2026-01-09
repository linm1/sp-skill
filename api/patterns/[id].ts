import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { patternDefinitions, patternImplementations } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getAuthenticatedUser } from '../../lib/auth.js';
import { cache } from '../../lib/cache.js';
import { CACHE_TTL } from '../../lib/constants.js';

/**
 * Pattern Detail API - Single Pattern Endpoint
 *
 * GET /api/patterns/[id] - Returns pattern with all implementations
 * PUT /api/patterns/[id] - Updates pattern definition (admin-only)
 * DELETE /api/patterns/[id] - Soft-deletes pattern (admin-only)
 *
 * Response Schema (GET):
 * {
 *   success: true,
 *   pattern: {
 *     id: string,
 *     category: string,
 *     title: string,
 *     problem: string,
 *     whenToUse: string,
 *     createdAt: string,
 *     implementations: [
 *       {
 *         uuid: string,
 *         authorId: number,
 *         authorName: string,
 *         sasCode: string,
 *         rCode: string,
 *         considerations: string[],
 *         variations: string[],
 *         status: string,
 *         isPremium: boolean,
 *         createdAt: string,
 *         updatedAt: string
 *       }
 *     ]
 *   }
 * }
 */

// Zod schema for PUT request validation (cannot change ID or category)
const updatePatternSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  problem: z.string().min(1, 'Problem description is required').optional(),
  whenToUse: z.string().min(1, 'whenToUse description is required').optional(),
}).refine(
  (data) => {
    // At least one field must be provided
    return data.title || data.problem || data.whenToUse;
  },
  {
    message: 'At least one field (title, problem, or whenToUse) must be provided',
  }
);

type UpdatePatternRequest = z.infer<typeof updatePatternSchema>;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  } else if (req.method === 'PUT') {
    return handlePut(req, res);
  } else if (req.method === 'DELETE') {
    return handleDelete(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * GET /api/patterns/[id]
 * Returns a single pattern with all implementations
 */
async function handleGet(req: VercelRequest, res: VercelResponse) {

  try {
    // Extract pattern ID from query parameters
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Pattern ID is required'
      });
    }

    // Validate pattern ID format (e.g., IMP-001, DER-020)
    const patternIdRegex = /^[A-Z]{3}-\d{3}$/;
    if (!patternIdRegex.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pattern ID format. Expected format: XXX-NNN (e.g., IMP-001)'
      });
    }

    // Check cache before DB query
    const cacheKey = `pattern:detail:${id}`;
    const cachedData = await cache.get<any>(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    // Fetch pattern definition
    const patterns = await db
      .select()
      .from(patternDefinitions)
      .where(eq(patternDefinitions.id, id))
      .limit(1);

    if (patterns.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Pattern ${id} not found`
      });
    }

    const pattern = patterns[0];

    // Fetch all implementations for this pattern
    const implementations = await db
      .select()
      .from(patternImplementations)
      .where(eq(patternImplementations.patternId, id));

    // Sort implementations: active first, then by creation date
    implementations.sort((a, b) => {
      // Active status first
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;

      // System author first within same status
      if (a.authorName === 'System' && b.authorName !== 'System') return -1;
      if (a.authorName !== 'System' && b.authorName === 'System') return 1;

      // Then by creation date (newest first)
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB.getTime() - dateA.getTime();
    });

    // Prepare response
    const response = {
      success: true,
      pattern: {
        id: pattern.id,
        category: pattern.category,
        title: pattern.title,
        problem: pattern.problem,
        whenToUse: pattern.whenToUse,
        createdAt: pattern.createdAt,
        implementations: implementations.map(impl => ({
          uuid: impl.uuid,
          authorId: impl.authorId,
          authorName: impl.authorName,
          sasCode: impl.sasCode,
          rCode: impl.rCode,
          considerations: impl.considerations,
          variations: impl.variations,
          status: impl.status,
          isPremium: impl.isPremium,
          createdAt: impl.createdAt,
          updatedAt: impl.updatedAt
        }))
      }
    };

    // Store in cache (TTL: 30 minutes)
    await cache.set(cacheKey, response, CACHE_TTL.PATTERN_DETAIL);

    return res.status(200).json(response);

  } catch (error) {
    console.error('Error fetching pattern detail:', error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: 'Failed to fetch pattern details'
    });
  }
}

/**
 * PUT /api/patterns/[id]
 * Updates a pattern definition (admin-only)
 */
async function handlePut(req: VercelRequest, res: VercelResponse) {
  try {
    // 1. Authenticate user and check admin role
    const user = await getAuthenticatedUser(req);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required to update patterns'
      });
    }

    // 2. Extract pattern ID from query parameters
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        error: 'Pattern ID is required'
      });
    }

    // Validate pattern ID format
    const patternIdRegex = /^[A-Z]{3}-\d{3}$/;
    if (!patternIdRegex.test(id)) {
      return res.status(400).json({
        error: 'Invalid pattern ID format. Expected format: XXX-NNN (e.g., IMP-001)'
      });
    }

    // 3. Validate request body with Zod
    let validated: UpdatePatternRequest;
    try {
      validated = updatePatternSchema.parse(req.body);
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

    // 4. Check if pattern exists and is not deleted
    let existingPattern;
    try {
      existingPattern = await db
        .select()
        .from(patternDefinitions)
        .where(
          and(
            eq(patternDefinitions.id, id),
            eq(patternDefinitions.isDeleted, false)
          )
        )
        .limit(1);
    } catch (dbError: any) {
      // Check if it's a column missing error (migration not applied)
      const isColumnError =
        dbError.message?.includes('column') &&
        (dbError.message?.includes('does not exist') || dbError.message?.includes('isDeleted') || dbError.message?.includes('is_deleted'));

      if (isColumnError) {
        console.warn('Soft-delete columns not found, querying without isDeleted filter');
        // Retry without soft-delete filter
        existingPattern = await db
          .select()
          .from(patternDefinitions)
          .where(eq(patternDefinitions.id, id))
          .limit(1);
      } else {
        throw dbError;
      }
    }

    if (existingPattern.length === 0) {
      return res.status(404).json({
        error: 'Pattern not found',
        message: `Pattern with ID '${id}' does not exist or has been deleted`
      });
    }

    // 5. Update pattern with only provided fields
    const updateData: any = {};
    if (validated.title !== undefined) updateData.title = validated.title;
    if (validated.problem !== undefined) updateData.problem = validated.problem;
    if (validated.whenToUse !== undefined) updateData.whenToUse = validated.whenToUse;

    const updatedPattern = await db
      .update(patternDefinitions)
      .set(updateData)
      .where(eq(patternDefinitions.id, id))
      .returning();

    // 6. Invalidate caches
    await cache.del(`pattern:detail:${id}`);
    await cache.invalidatePattern('pattern:catalog:*');

    // 7. Return success response
    return res.status(200).json({
      success: true,
      message: 'Pattern updated successfully',
      pattern: updatedPattern[0]
    });

  } catch (error) {
    console.error('[API /patterns/[id]] PUT error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to update pattern'
    });
  }
}

/**
 * DELETE /api/patterns/[id]
 * Soft-deletes a pattern definition (admin-only)
 */
async function handleDelete(req: VercelRequest, res: VercelResponse) {
  try {
    // 1. Authenticate user and check admin role
    const user = await getAuthenticatedUser(req);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required to delete patterns'
      });
    }

    // 2. Extract pattern ID from query parameters
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        error: 'Pattern ID is required'
      });
    }

    // Validate pattern ID format
    const patternIdRegex = /^[A-Z]{3}-\d{3}$/;
    if (!patternIdRegex.test(id)) {
      return res.status(400).json({
        error: 'Invalid pattern ID format. Expected format: XXX-NNN (e.g., IMP-001)'
      });
    }

    // 3. Check if pattern exists and is not already deleted
    let existingPattern;
    let hasIsDeletedColumn = true;

    try {
      existingPattern = await db
        .select()
        .from(patternDefinitions)
        .where(eq(patternDefinitions.id, id))
        .limit(1);
    } catch (dbError: any) {
      console.error('Error querying pattern for deletion:', dbError);
      throw dbError;
    }

    if (existingPattern.length === 0) {
      return res.status(404).json({
        error: 'Pattern not found',
        message: `Pattern with ID '${id}' does not exist`
      });
    }

    // Check if pattern is already deleted (only if column exists)
    try {
      if (existingPattern[0].isDeleted) {
        return res.status(400).json({
          error: 'Pattern already deleted',
          message: `Pattern with ID '${id}' has already been deleted`
        });
      }
    } catch (propError) {
      // isDeleted column doesn't exist yet
      hasIsDeletedColumn = false;
      console.warn('isDeleted column not available - soft-delete feature requires database migration');
    }

    // 4. Soft delete the pattern (or return error if migration not applied)
    if (!hasIsDeletedColumn) {
      return res.status(500).json({
        error: 'Feature not available',
        message: 'Soft-delete feature requires database migration. Please run: npx drizzle-kit push',
        details: 'The isDeleted column does not exist in the database schema'
      });
    }

    const deletedPattern = await db
      .update(patternDefinitions)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: user.clerkId
      })
      .where(eq(patternDefinitions.id, id))
      .returning();

    // 5. Invalidate caches
    await cache.del(`pattern:detail:${id}`);
    await cache.invalidatePattern('pattern:catalog:*');

    // 6. Return success response
    return res.status(200).json({
      success: true,
      message: 'Pattern soft-deleted successfully',
      pattern: {
        id: deletedPattern[0].id,
        isDeleted: deletedPattern[0].isDeleted,
        deletedAt: deletedPattern[0].deletedAt,
        deletedBy: deletedPattern[0].deletedBy
      }
    });

  } catch (error) {
    console.error('[API /patterns/[id]] DELETE error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to delete pattern'
    });
  }
}
