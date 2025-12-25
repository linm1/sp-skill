import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

/**
 * List all tables in the database
 *
 * Usage: GET /api/list-tables
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Query to list all tables in the public schema
    const result = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    const tables = result.rows.map(row => row.table_name);

    return res.status(200).json({
      success: true,
      count: tables.length,
      tables: tables,
      message: tables.length > 0
        ? `Found ${tables.length} table(s)`
        : 'No tables found - run migration first'
    });
  } catch (error) {
    console.error('Error listing tables:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
