import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../db';
import { patternDefinitions, patternImplementations } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Pattern Catalog API - List Endpoint
 *
 * Returns all patterns with their implementation counts and author information
 *
 * Usage:
 * GET /api/patterns - Returns all patterns
 * GET /api/patterns?category=IMP - Returns only IMP category patterns
 * GET /api/patterns?category=DER - Returns only DER category patterns
 *
 * Response Schema:
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { category } = req.query;

    // Base query - get all pattern definitions
    let patterns;
    if (category && typeof category === 'string') {
      // Filter by category
      patterns = await db
        .select()
        .from(patternDefinitions)
        .where(eq(patternDefinitions.category, category.toUpperCase()));
    } else {
      // Get all patterns
      patterns = await db.select().from(patternDefinitions);
    }

    // For each pattern, get implementation details
    const enrichedPatterns = await Promise.all(
      patterns.map(async (pattern) => {
        // Get all implementations for this pattern
        const implementations = await db
          .select({
            uuid: patternImplementations.uuid,
            authorName: patternImplementations.authorName,
            status: patternImplementations.status,
            updatedAt: patternImplementations.updatedAt
          })
          .from(patternImplementations)
          .where(eq(patternImplementations.patternId, pattern.id));

        // Get active implementations only for counts
        const activeImplementations = implementations.filter(
          impl => impl.status === 'active'
        );

        // Extract unique authors
        const authors = [...new Set(activeImplementations.map(impl => impl.authorName))];

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
          implementationCount: activeImplementations.length,
          authors: authors,
          latestUpdate: latestUpdate.toISOString(),
          createdAt: pattern.createdAt
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
      category: category ? category.toUpperCase() : 'ALL',
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
