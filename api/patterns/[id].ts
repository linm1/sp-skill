import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../db';
import { patternDefinitions, patternImplementations } from '../../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Pattern Detail API - Single Pattern Endpoint
 *
 * Returns a single pattern with all its implementations (active and pending)
 *
 * Usage:
 * GET /api/patterns/IMP-001 - Returns pattern IMP-001 with all implementations
 *
 * Response Schema:
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

    return res.status(200).json({
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
    });

  } catch (error) {
    console.error('Error fetching pattern detail:', error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: 'Failed to fetch pattern details'
    });
  }
}
