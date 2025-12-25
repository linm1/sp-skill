import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireSeedKey } from '../lib/auth-simple';
import {
  initSchema,
  countPatternDefinitions,
  bulkInsertDefinitions,
  bulkInsertImplementations
} from '../lib/db';
import seedData from '../../data/system-patterns.json';

/**
 * Admin-only endpoint to seed the database with 172 system patterns
 *
 * POST /api/admin/seed-patterns
 * Authentication: Requires SEED_SECRET_KEY environment variable
 *
 * Usage:
 *   curl -X POST https://your-app.vercel.app/api/admin/seed-patterns \
 *     -H "x-seed-key: your_secret_key_here"
 *
 * Safety checks:
 * - Only runs if database is empty (count = 0)
 * - Requires secret key authentication
 * - Idempotent (safe to call multiple times)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Require seed key authentication
    const userId = await requireSeedKey(req);

    // Initialize database schema (creates tables if they don't exist)
    await initSchema();

    // Check if already seeded
    const count = await countPatternDefinitions();
    if (count > 0) {
      return res.status(400).json({
        error: 'Database already seeded',
        currentCount: count,
        message: 'Delete existing patterns before re-seeding'
      });
    }

    // Prepare definitions for insertion
    const definitionsToInsert = seedData.definitions.map((def: any) => ({
      id: def.id,
      category: def.category,
      title: def.title,
      problem: def.problem,
      when_to_use: def.whenToUse,
      created_by: userId // Track who seeded the database
    }));

    // Prepare implementations for insertion
    const implementationsToInsert = seedData.implementations.map((impl: any) => ({
      pattern_id: impl.patternId,
      author_id: null, // System patterns have no author_id
      author_name: impl.authorName,
      sas_code: impl.sasCode,
      r_code: impl.rCode,
      considerations: impl.considerations,
      variations: impl.variations,
      status: 'approved', // System patterns are auto-approved
      is_premium: impl.isPremium
    }));

    // Bulk insert definitions
    await bulkInsertDefinitions(definitionsToInsert);

    // Bulk insert implementations
    await bulkInsertImplementations(implementationsToInsert);

    return res.status(200).json({
      success: true,
      definitionsCount: seedData.definitions.length,
      implementationsCount: seedData.implementations.length,
      message: 'Database seeded successfully with all 172 system patterns',
      version: seedData.version,
      seededBy: userId
    });
  } catch (error) {
    console.error('Seed error:', error);

    // Check if this is an auth error
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized')) {
        return res.status(401).json({ error: error.message });
      }
      if (error.message.includes('Forbidden')) {
        return res.status(403).json({ error: error.message });
      }

      return res.status(500).json({
        error: error.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}
