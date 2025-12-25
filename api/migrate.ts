import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Database Migration Endpoint
 *
 * Security: Protected by MIGRATION_TOKEN environment variable
 *
 * Usage:
 * 1. Set MIGRATION_TOKEN in .env.local or Vercel Dashboard
 * 2. POST to /api/migrate with header: x-migration-token: <your-token>
 *
 * Example:
 * curl -X POST https://sp-skill.vercel.app/api/migrate \
 *   -H "x-migration-token: your-secret-token"
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
    console.log('Starting database migration...');

    // Read migration SQL file
    const migrationSQL = readFileSync(
      join(process.cwd(), 'scripts', 'create-tables.sql'),
      'utf-8'
    );

    // Execute migration (this is idempotent - safe to run multiple times)
    await sql.query(migrationSQL);

    console.log('Database migration completed successfully');

    return res.status(200).json({
      success: true,
      message: 'Database tables created successfully',
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
