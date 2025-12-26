import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Clerk ID Migration Endpoint
 *
 * Security: Protected by MIGRATION_TOKEN environment variable
 *
 * Usage:
 * POST to /api/migrate-clerk with header: x-migration-token: <your-token>
 *
 * Example:
 * curl -X POST http://localhost:3000/api/migrate-clerk \
 *   -H "x-migration-token: sp-skill-secure-token-2025"
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Security check: Verify migration token
  const token = req.headers['x-migration-token'];
  const expectedToken = process.env.MIGRATION_TOKEN;

  if (!expectedToken) {
    return res.status(500).json({
      error: 'MIGRATION_TOKEN not configured in environment variables'
    });
  }

  if (token !== expectedToken) {
    return res.status(403).json({ error: 'Forbidden: Invalid migration token' });
  }

  try {
    console.log('Starting Clerk ID migration...');

    // Read migration SQL file
    const migrationSQL = readFileSync(
      join(process.cwd(), 'scripts', 'add-clerk-id-migration.sql'),
      'utf-8'
    );

    // Execute migration (this is idempotent - safe to run multiple times)
    await sql.query(migrationSQL);

    console.log('Clerk ID migration completed successfully');

    return res.status(200).json({
      success: true,
      message: 'clerk_id column added successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Migration error:', error);
    return res.status(500).json({
      success: false,
      error: 'Migration failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
