import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

/**
 * Database Connection Test Endpoint
 *
 * Simple endpoint to verify Vercel Postgres connection is working
 *
 * Usage:
 * GET /api/db-test
 *
 * Returns:
 * - connected: true/false
 * - timestamp: Current database server time
 * - environment: Environment variable status
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check environment variables
    const envCheck = {
      POSTGRES_URL: !!process.env.POSTGRES_URL,
      POSTGRES_HOST: !!process.env.POSTGRES_HOST,
      POSTGRES_USER: !!process.env.POSTGRES_USER,
      POSTGRES_DATABASE: !!process.env.POSTGRES_DATABASE,
    };

    console.log('Environment variables check:', envCheck);

    // Test database connection
    const result = await sql`SELECT NOW() as current_time, version() as db_version`;
    const row = result.rows[0];

    return res.status(200).json({
      connected: true,
      timestamp: row.current_time,
      dbVersion: row.db_version,
      environment: envCheck,
      message: 'Database connection successful!'
    });
  } catch (error) {
    console.error('Database connection error:', error);

    return res.status(500).json({
      connected: false,
      error: error instanceof Error ? error.message : String(error),
      environment: {
        POSTGRES_URL: !!process.env.POSTGRES_URL,
        POSTGRES_HOST: !!process.env.POSTGRES_HOST,
      },
      message: 'Database connection failed'
    });
  }
}
