import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { db } from '../db/index.js';
import { patternDefinitions, patternImplementations } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getAuthenticatedUser } from '../lib/auth.js';
import { cache } from '../lib/cache.js';

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

// Valid pattern categories
const VALID_CATEGORIES = ['IMP', 'DER', 'DAT', 'RSH', 'AGG', 'MRG', 'CAT', 'FLG', 'SRT', 'FMT', 'VAL', 'CDS', 'STA', 'OPT'] as const;

// Zod schema for POST request validation
const createPatternSchema = z.object({
  id: z.string().regex(/^[A-Z]{3}-\d{3}$/, 'Pattern ID must match format XXX-NNN (e.g., IMP-001)'),
  category: z.enum(VALID_CATEGORIES, {
    errorMap: () => ({ message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}` })
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
      if (!user || user.role !== 'admin') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Admin role required to view deleted patterns'
        });
      }
      userRole = user.role;
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
    const cacheTTL = shouldIncludeDeleted ? 300 : 3600; // 5 min for admin, 1 hour for normal

    const cachedData = await cache.get<any>(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    // Base query - get all pattern definitions
    let patterns;

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
      const isColumnError =
        dbError.message?.includes('column') &&
        (dbError.message?.includes('does not exist') || dbError.message?.includes('isDeleted') || dbError.message?.includes('is_deleted'));

      if (isColumnError) {
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
        return res.status(500).json({
          success: false,
          error: 'Database connection failed',
          message: 'Unable to connect to database. Please verify POSTGRES_URL environment variable is set correctly.',
          details: dbError.message
        });
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
        let implementations;
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
          const isColumnError =
            implError.message?.includes('column') &&
            (implError.message?.includes('does not exist') || implError.message?.includes('isDeleted') || implError.message?.includes('is_deleted'));

          if (isColumnError) {
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

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: 'Failed to fetch patterns'
    });
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
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required to create patterns'
      });
    }

    // 2. Validate request body with Zod
    let validated: CreatePatternRequest;
    try {
      validated = createPatternSchema.parse(req.body);
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

    // 3. Validate that pattern ID's category prefix matches the category field
    const idPrefix = validated.id.split('-')[0];
    if (idPrefix !== validated.category) {
      return res.status(400).json({
        error: 'Validation failed',
        message: `Pattern ID prefix '${idPrefix}' must match category '${validated.category}'`
      });
    }

    // 4. Check for duplicate pattern ID
    const existingPattern = await db
      .select()
      .from(patternDefinitions)
      .where(eq(patternDefinitions.id, validated.id))
      .limit(1);

    if (existingPattern.length > 0) {
      return res.status(409).json({
        error: 'Duplicate pattern ID',
        message: `Pattern with ID '${validated.id}' already exists`,
        patternId: validated.id
      });
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
    await cache.invalidatePattern('pattern:catalog:*');

    // 7. Return success response
    return res.status(201).json({
      success: true,
      message: 'Pattern definition created successfully',
      pattern: newPattern[0]
    });

  } catch (error) {
    console.error('[API /patterns] POST error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Failed to create pattern'
    });
  }
}
