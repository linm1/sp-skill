import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { db } from '../db/index.js';
import { patternDefinitions, patternImplementations } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getAuthenticatedUser, requireAdminGuard } from '../lib/auth.js';
import { cache } from '../lib/cache.js';
import { CACHE_TTL, PATTERN_ID_REGEX, PATTERN_ID_ERROR_MESSAGE, VALID_CATEGORIES } from '../lib/constants.js';
import { isSoftDeleteColumnMissing } from '../lib/db-utils.js';
import { sendError, sendSuccess } from '../lib/api-response.js';
import { validateWithZod } from '../lib/validation.js';
import { invalidatePatternCatalog } from '../lib/cache-invalidation.js';

/**
 * Pattern Catalog API
 *
 * GET /api/patterns - Returns all patterns (excludes soft-deleted)
 * GET /api/patterns?category=IMP - Returns only IMP category patterns
 * GET /api/patterns?category=DER - Returns only DER category patterns
 * GET /api/patterns?includeDeleted=true - Returns all patterns including soft-deleted (admin-only)
 * POST /api/patterns - Create a new pattern definition (admin-only)
 *
 * Response Schema (GET):
 * {
 *   success: true,
 *   count: number,
 *   patterns: [
 *     {
 *       id: string,
 *       category: string,
 *       title: string,
 *       problem: string,
 *       whenToUse: string,
 *       implementationCount: number,
 *       authors: string[],
 *       latestUpdate: string
 *     }
 *   ]
 * }
 */

// Zod schema for POST request validation
const createPatternSchema = z.object({
  id: z.string().regex(PATTERN_ID_REGEX, PATTERN_ID_ERROR_MESSAGE),
  category: z.enum(VALID_CATEGORIES, {
    message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}`
  }),
  title: z.string().min(1, 'Title is required'),
  problem: z.string().min(1, 'Problem description is required'),
  whenToUse: z.string().min(1, 'whenToUse description is required'),
});

type CreatePatternRequest = z.infer<typeof createPatternSchema>;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  } else if (req.method === 'POST') {
    return handlePost(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * GET /api/patterns
 * Lists all pattern definitions
 */
async function handleGet(req: VercelRequest, res: VercelResponse) {

  try {
    const { category, includeDeleted } = req.query;

    // Check if includeDeleted is requested (admin-only)
    let userRole = 'guest'; // Default role for non-authenticated users
    if (includeDeleted === 'true') {
      const user = await getAuthenticatedUser(req);
      if (!requireAdminGuard(user, res, 'Admin role required to view deleted patterns')) return;
      userRole = user!.role; // Type assertion safe after guard check
    } else {
      // Try to get user role for cache key (non-blocking)
      try {
        const user = await getAuthenticatedUser(req);
        if (user) {
          userRole = user.role;
        }
      } catch {
        // Ignore auth errors for public queries
      }
    }

    // Check cache before DB query
    const categoryParam = category && typeof category === 'string' ? category.toUpperCase() : 'ALL';
    const shouldIncludeDeleted = includeDeleted === 'true';
    const cacheKey = `pattern:catalog:${categoryParam}:${shouldIncludeDeleted}:${userRole}`;
    const cacheTTL = shouldIncludeDeleted ? CACHE_TTL.PATTERN_CATALOG_ADMIN : CACHE_TTL.PATTERN_CATALOG;

    const cachedData = await cache.get<any>(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    // Base query - get all pattern definitions
    let patterns: any[] = [];

    try {
      // Try to query with soft-delete filter first
      if (category && typeof category === 'string') {
        // Filter by category
        if (shouldIncludeDeleted) {
          patterns = await db
            .select()
            .from(patternDefinitions)
            .where(eq(patternDefinitions.category, category.toUpperCase()));
        } else {
          patterns = await db
            .select()
            .from(patternDefinitions)
            .where(
              and(
                eq(patternDefinitions.category, category.toUpperCase()),
                eq(patternDefinitions.isDeleted, false)
              )
            );
        }
      } else {
        // Get all patterns
        if (shouldIncludeDeleted) {
          patterns = await db.select().from(patternDefinitions);
        } else {
          patterns = await db
            .select()
            .from(patternDefinitions)
            .where(eq(patternDefinitions.isDeleted, false));
        }
      }
    } catch (dbError: any) {
      console.error('Database query error:', dbError);

      // Check if it's a column missing error (migration not applied)
      // If so, retry without soft-delete filtering
      if (isSoftDeleteColumnMissing(dbError)) {
        console.warn('Soft-delete columns not found, querying without isDeleted filter (migration not applied yet)');

        // Retry query without soft-delete filter
        try {
          if (category && typeof category === 'string') {
            patterns = await db
              .select()
              .from(patternDefinitions)
              .where(eq(patternDefinitions.category, category.toUpperCase()));
          } else {
            patterns = await db.select().from(patternDefinitions);
          }
        } catch (retryError: any) {
          console.error('Retry query also failed:', retryError);
          throw retryError;
        }
      } else if (dbError.message?.includes('connection') || dbError.code === 'ECONNREFUSED') {
        // Check if it's a connection error
        return sendError(
          res,
          500,
          'Database connection failed',
          'Unable to connect to database. Please verify POSTGRES_URL environment variable is set correctly.',
          [{ message: dbError.message }]
        );
      } else {
        // Generic database error
        throw dbError;
      }
    }

    // Handle empty results gracefully
    if (!patterns || patterns.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        category: category ? (Array.isArray(category) ? category[0].toUpperCase() : category.toUpperCase()) : 'ALL',
        patterns: [],
        message: 'No patterns found. Database may be empty or migration not applied.'
      });
    }

    // For each pattern, get implementation details
    const enrichedPatterns = await Promise.all(
      patterns.map(async (pattern) => {
        // Get only active implementations for this pattern (and exclude soft-deleted unless includeDeleted)
        let implementations: any[] = [];
        try {
          if (shouldIncludeDeleted) {
            implementations = await db
              .select()
              .from(patternImplementations)
              .where(
                and(
                  eq(patternImplementations.patternId, pattern.id),
                  eq(patternImplementations.status, 'active')
                )
              );
          } else {
            implementations = await db
              .select()
              .from(patternImplementations)
              .where(
                and(
                  eq(patternImplementations.patternId, pattern.id),
                  eq(patternImplementations.status, 'active'),
                  eq(patternImplementations.isDeleted, false)
                )
              );
          }
        } catch (implError: any) {
          console.error(`Error fetching implementations for pattern ${pattern.id}:`, implError);

          // Check if it's a column missing error for isDeleted
          if (isSoftDeleteColumnMissing(implError)) {
            console.warn(`Soft-delete columns not found in implementations table, querying without isDeleted filter`);
            // Retry without soft-delete filter
            try {
              implementations = await db
                .select()
                .from(patternImplementations)
                .where(
                  and(
                    eq(patternImplementations.patternId, pattern.id),
                    eq(patternImplementations.status, 'active')
                  )
                );
            } catch (retryError: any) {
              console.error(`Retry query for implementations also failed:`, retryError);
              // If retry also fails, continue with empty array
              implementations = [];
            }
          } else {
            // If not a column error, continue with empty array
            implementations = [];
          }
        }

        // Extract unique authors
        const authors = [...new Set(implementations.map(impl => impl.authorName))];

        // Get latest update timestamp
        const latestUpdate = implementations.reduce((latest, impl) => {
          const implDate = new Date(impl.updatedAt || 0);
          return implDate > latest ? implDate : latest;
        }, new Date(0));

        return {
          id: pattern.id,
          category: pattern.category,
          title: pattern.title,
          problem: pattern.problem,
          whenToUse: pattern.whenToUse,
          implementationCount: implementations.length,
          authors: authors,
          latestUpdate: latestUpdate.toISOString(),
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
        };
      })
    );

    // Sort by category and ID
    enrichedPatterns.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.id.localeCompare(b.id);
    });

    // Prepare response
    const response = {
      success: true,
      count: enrichedPatterns.length,
      category: category ? (Array.isArray(category) ? category[0].toUpperCase() : category.toUpperCase()) : 'ALL',
      patterns: enrichedPatterns
    };

    // Store in cache (non-blocking)
    await cache.set(cacheKey, response, cacheTTL);

    return res.status(200).json(response);

  } catch (error) {
    console.error('Error fetching patterns:', error);

    return sendError(
      res,
      500,
      error instanceof Error ? error.message : String(error),
      'Failed to fetch patterns'
    );
  }
}

/**
 * POST /api/patterns
 * Creates a new pattern definition (admin-only)
 */
async function handlePost(req: VercelRequest, res: VercelResponse) {
  try {
    // 1. Authenticate user and check admin role
    const user = await getAuthenticatedUser(req);
    if (!requireAdminGuard(user, res, 'Admin access required to create patterns')) return;

    // 2. Validate request body with Zod
    const validated = validateWithZod(createPatternSchema, req.body, res);
    if (!validated) return; // Error already sent

    // 3. Validate that pattern ID's category prefix matches the category field
    const idPrefix = validated.id.split('-')[0];
    if (idPrefix !== validated.category) {
      return sendError(
        res,
        400,
        'Validation failed',
        `Pattern ID prefix '${idPrefix}' must match category '${validated.category}'`
      );
    }

    // 4. Check for duplicate pattern ID
    const existingPattern = await db
      .select()
      .from(patternDefinitions)
      .where(eq(patternDefinitions.id, validated.id))
      .limit(1);

    if (existingPattern.length > 0) {
      return sendError(
        res,
        409,
        'Duplicate pattern ID',
        `Pattern with ID '${validated.id}' already exists`,
        [{ field: 'patternId', message: validated.id }]
      );
    }

    // 5. Insert new pattern definition
    const newPattern = await db
      .insert(patternDefinitions)
      .values({
        id: validated.id,
        category: validated.category,
        title: validated.title,
        problem: validated.problem,
        whenToUse: validated.whenToUse,
      })
      .returning();

    // 6. Invalidate pattern catalog cache
    await invalidatePatternCatalog();

    // 7. Return success response
    return res.status(201).json({
      success: true,
      message: 'Pattern definition created successfully',
      pattern: newPattern[0]
    });

  } catch (error) {
    console.error('[API /patterns] POST error:', error);
    return sendError(
      res,
      500,
      'Internal server error',
      error instanceof Error ? error.message : 'Failed to create pattern'
    );
  }
}
