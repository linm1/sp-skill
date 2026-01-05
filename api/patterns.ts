import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { db } from '../db/index.js';
import { patternDefinitions, patternImplementations } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getAuthenticatedUser } from '../lib/auth.js';

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
    if (includeDeleted === 'true') {
      const user = await getAuthenticatedUser(req);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Admin role required to view deleted patterns'
        });
      }
    }

    // Base query - get all pattern definitions
    let patterns;
    const shouldIncludeDeleted = includeDeleted === 'true';

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

    // For each pattern, get implementation details
    const enrichedPatterns = await Promise.all(
      patterns.map(async (pattern) => {
        // Get only active implementations for this pattern (and exclude soft-deleted unless includeDeleted)
        let implementations;
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

    return res.status(200).json({
      success: true,
      count: enrichedPatterns.length,
      category: category ? (Array.isArray(category) ? category[0].toUpperCase() : category.toUpperCase()) : 'ALL',
      patterns: enrichedPatterns
    });

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

    // 6. Return success response
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
