import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

/**
 * Fix Users Sequence Endpoint
 *
 * POST /api/fix-sequence
 * Resets the users_id_seq sequence to match the current max ID
 *
 * Security: Requires MIGRATION_TOKEN header
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Security check - require migration token
  const token = req.headers['x-migration-token'];
  const expectedToken = process.env.MIGRATION_TOKEN;

  if (!expectedToken || token !== expectedToken) {
    return res.status(403).json({
      error: 'Forbidden - Invalid or missing migration token'
    });
  }

  try {
    // Get current max ID and sequence info before fix
    // Use last_value from pg_sequences instead of currval to avoid session dependency
    const beforeResult = await sql`
      SELECT
        last_value as current_sequence,
        (SELECT MAX(id) FROM users) as max_id
      FROM pg_sequences
      WHERE schemaname = 'public' AND sequencename = 'users_id_seq'
    `;

    console.log('Before fix:', beforeResult.rows[0]);

    // Fix the sequence - set it to the current max ID
    const fixResult = await sql`SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1))`;

    // Verify the fix using the same approach
    const afterResult = await sql`
      SELECT
        last_value as current_sequence,
        (SELECT MAX(id) FROM users) as max_id
      FROM pg_sequences
      WHERE schemaname = 'public' AND sequencename = 'users_id_seq'
    `;

    console.log('After fix:', afterResult.rows[0]);

    const nextId = parseInt(afterResult.rows[0].current_sequence) + 1;

    return res.status(200).json({
      success: true,
      message: 'Users sequence reset successfully',
      before: beforeResult.rows[0],
      after: afterResult.rows[0],
      note: `Next auto-inserted user will get id=${nextId}`
    });

  } catch (error) {
    console.error('Error fixing sequence:', error);
    return res.status(500).json({
      error: 'Failed to fix sequence',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}
