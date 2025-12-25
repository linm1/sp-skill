import { sql } from '@vercel/postgres';

/**
 * Database client for StatPatternHub
 * Provides Postgres connection and schema management
 */

// Types matching the database schema
export interface PatternDefinitionRow {
  id: string;
  category: string;
  title: string;
  problem: string;
  when_to_use: string;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PatternImplementationRow {
  uuid: string;
  pattern_id: string;
  author_id: string | null;
  author_name: string;
  sas_code: string;
  r_code: string;
  considerations: string[];
  variations: string[];
  status: string;
  is_premium: boolean;
  created_at: Date;
  updated_at: Date;
}

// Credit System Types
export interface UserCreditsRow {
  user_id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  contribution_count: number;
  tier: string;
  badges: string[];
  created_at: Date;
  updated_at: Date;
}

export interface CreditTransactionRow {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  source: string;
  metadata: any;
  balance_after: number;
  created_at: Date;
}

export interface PatternContributionRow {
  id: string;
  user_id: string;
  pattern_id: string;
  impl_uuid: string;
  status: string;
  credits_earned: number;
  quality_score: number | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_at: Date;
}

export interface PremiumUnlockRow {
  id: string;
  user_id: string;
  pattern_id: string | null;
  category: string | null;
  credits_spent: number;
  unlock_type: string;
  created_at: Date;
}

/**
 * Initialize database schema
 * Creates tables if they don't exist
 * Safe to call multiple times (idempotent)
 */
export async function initSchema(): Promise<void> {
  try {
    // Create pattern_definitions table
    await sql`
      CREATE TABLE IF NOT EXISTS pattern_definitions (
        id VARCHAR(50) PRIMARY KEY,
        category VARCHAR(10) NOT NULL,
        title VARCHAR(255) NOT NULL,
        problem TEXT NOT NULL,
        when_to_use TEXT NOT NULL,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create index on category
    await sql`
      CREATE INDEX IF NOT EXISTS idx_category ON pattern_definitions(category)
    `;

    // Create pattern_implementations table
    await sql`
      CREATE TABLE IF NOT EXISTS pattern_implementations (
        uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pattern_id VARCHAR(50) NOT NULL REFERENCES pattern_definitions(id) ON DELETE CASCADE,
        author_id VARCHAR(255),
        author_name VARCHAR(255) NOT NULL,
        sas_code TEXT NOT NULL,
        r_code TEXT NOT NULL,
        considerations TEXT[] DEFAULT '{}',
        variations TEXT[] DEFAULT '{}',
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        is_premium BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create indexes on pattern_implementations
    await sql`
      CREATE INDEX IF NOT EXISTS idx_pattern_status ON pattern_implementations(pattern_id, status)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_author ON pattern_implementations(author_id)
    `;

    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Error initializing database schema:', error);
    throw error;
  }
}

/**
 * Get all pattern definitions
 */
export async function getAllPatternDefinitions(): Promise<PatternDefinitionRow[]> {
  try {
    const result = await sql<PatternDefinitionRow>`
      SELECT * FROM pattern_definitions
      ORDER BY category, id
    `;
    return result.rows;
  } catch (error) {
    console.error('Error fetching pattern definitions:', error);
    throw error;
  }
}

/**
 * Get a single pattern definition by ID
 */
export async function getPatternDefinitionById(id: string): Promise<PatternDefinitionRow | null> {
  try {
    const result = await sql<PatternDefinitionRow>`
      SELECT * FROM pattern_definitions
      WHERE id = ${id}
      LIMIT 1
    `;
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching pattern definition:', error);
    throw error;
  }
}

/**
 * Get implementations for a specific pattern
 */
export async function getImplementationsByPatternId(
  patternId: string,
  status?: string
): Promise<PatternImplementationRow[]> {
  try {
    const result = status
      ? await sql<PatternImplementationRow>`
          SELECT * FROM pattern_implementations
          WHERE pattern_id = ${patternId} AND status = ${status}
          ORDER BY created_at DESC
        `
      : await sql<PatternImplementationRow>`
          SELECT * FROM pattern_implementations
          WHERE pattern_id = ${patternId}
          ORDER BY created_at DESC
        `;
    return result.rows;
  } catch (error) {
    console.error('Error fetching pattern implementations:', error);
    throw error;
  }
}

/**
 * Insert a pattern definition
 */
export async function insertPatternDefinition(
  def: Omit<PatternDefinitionRow, 'created_at' | 'updated_at'>
): Promise<PatternDefinitionRow> {
  try {
    const result = await sql<PatternDefinitionRow>`
      INSERT INTO pattern_definitions (id, category, title, problem, when_to_use, created_by)
      VALUES (${def.id}, ${def.category}, ${def.title}, ${def.problem}, ${def.when_to_use}, ${def.created_by})
      ON CONFLICT (id) DO UPDATE SET
        category = EXCLUDED.category,
        title = EXCLUDED.title,
        problem = EXCLUDED.problem,
        when_to_use = EXCLUDED.when_to_use,
        updated_at = NOW()
      RETURNING *
    `;
    return result.rows[0];
  } catch (error) {
    console.error('Error inserting pattern definition:', error);
    throw error;
  }
}

/**
 * Insert a pattern implementation
 */
export async function insertPatternImplementation(
  impl: Omit<PatternImplementationRow, 'uuid' | 'created_at' | 'updated_at'>
): Promise<PatternImplementationRow> {
  try {
    const result = await sql<PatternImplementationRow>`
      INSERT INTO pattern_implementations (
        pattern_id, author_id, author_name, sas_code, r_code,
        considerations, variations, status, is_premium
      )
      VALUES (
        ${impl.pattern_id},
        ${impl.author_id},
        ${impl.author_name},
        ${impl.sas_code},
        ${impl.r_code},
        ${impl.considerations}::text[],
        ${impl.variations}::text[],
        ${impl.status},
        ${impl.is_premium}
      )
      RETURNING *
    `;
    return result.rows[0];
  } catch (error) {
    console.error('Error inserting pattern implementation:', error);
    throw error;
  }
}

/**
 * Update pattern implementation status
 */
export async function updateImplementationStatus(
  uuid: string,
  status: string
): Promise<PatternImplementationRow> {
  try {
    const result = await sql<PatternImplementationRow>`
      UPDATE pattern_implementations
      SET status = ${status}, updated_at = NOW()
      WHERE uuid = ${uuid}
      RETURNING *
    `;
    return result.rows[0];
  } catch (error) {
    console.error('Error updating implementation status:', error);
    throw error;
  }
}

/**
 * Count pattern definitions
 * Useful for checking if database is seeded
 */
export async function countPatternDefinitions(): Promise<number> {
  try {
    const result = await sql`
      SELECT COUNT(*) as count FROM pattern_definitions
    `;
    return parseInt(result.rows[0].count as string, 10);
  } catch (error) {
    console.error('Error counting pattern definitions:', error);
    throw error;
  }
}

/**
 * Get pattern with implementation counts
 */
export async function getPatternsWithCounts() {
  try {
    const result = await sql`
      SELECT
        pd.id,
        pd.category,
        pd.title,
        pd.problem,
        pd.when_to_use,
        COUNT(pi.uuid) as implementation_count,
        COUNT(CASE WHEN pi.status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN pi.status = 'pending' THEN 1 END) as pending_count
      FROM pattern_definitions pd
      LEFT JOIN pattern_implementations pi ON pd.id = pi.pattern_id
      GROUP BY pd.id, pd.category, pd.title, pd.problem, pd.when_to_use
      ORDER BY pd.category, pd.id
    `;
    return result.rows;
  } catch (error) {
    console.error('Error fetching patterns with counts:', error);
    throw error;
  }
}

/**
 * Bulk insert pattern definitions
 * More efficient than individual inserts
 */
export async function bulkInsertDefinitions(
  definitions: Omit<PatternDefinitionRow, 'created_at' | 'updated_at'>[]
): Promise<void> {
  try {
    for (const def of definitions) {
      await insertPatternDefinition(def);
    }
    console.log(`Bulk inserted ${definitions.length} pattern definitions`);
  } catch (error) {
    console.error('Error bulk inserting definitions:', error);
    throw error;
  }
}

/**
 * Bulk insert pattern implementations
 * More efficient than individual inserts
 */
export async function bulkInsertImplementations(
  implementations: Omit<PatternImplementationRow, 'uuid' | 'created_at' | 'updated_at'>[]
): Promise<void> {
  try {
    for (const impl of implementations) {
      await insertPatternImplementation(impl);
    }
    console.log(`Bulk inserted ${implementations.length} pattern implementations`);
  } catch (error) {
    console.error('Error bulk inserting implementations:', error);
    throw error;
  }
}

/**
 * Initialize credit system schema
 * Creates credit-related tables if they don't exist
 * Safe to call multiple times (idempotent)
 */
export async function initCreditSchema(): Promise<void> {
  try {
    // user_credits table
    await sql`
      CREATE TABLE IF NOT EXISTS user_credits (
        user_id VARCHAR(255) PRIMARY KEY,
        balance INTEGER NOT NULL DEFAULT 0,
        lifetime_earned INTEGER NOT NULL DEFAULT 0,
        lifetime_spent INTEGER NOT NULL DEFAULT 0,
        contribution_count INTEGER NOT NULL DEFAULT 0,
        tier VARCHAR(50) NOT NULL DEFAULT 'bronze',
        badges TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT balance_non_negative CHECK (balance >= 0)
      )
    `;

    // credit_transactions table
    await sql`
      CREATE TABLE IF NOT EXISTS credit_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        amount INTEGER NOT NULL,
        type VARCHAR(50) NOT NULL,
        source VARCHAR(100) NOT NULL,
        metadata JSONB DEFAULT '{}',
        balance_after INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_transactions ON credit_transactions(user_id, created_at DESC)
    `;

    // pattern_contributions table
    await sql`
      CREATE TABLE IF NOT EXISTS pattern_contributions (
        id UUID PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        pattern_id VARCHAR(50) NOT NULL,
        impl_uuid UUID NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        credits_earned INTEGER NOT NULL DEFAULT 0,
        quality_score INTEGER,
        reviewed_by VARCHAR(255),
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_contributions_status ON pattern_contributions(status)
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_one_per_pattern
      ON pattern_contributions(user_id, pattern_id)
      WHERE status = 'approved'
    `;

    // premium_unlocks table
    await sql`
      CREATE TABLE IF NOT EXISTS premium_unlocks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        pattern_id VARCHAR(50),
        category VARCHAR(10),
        credits_spent INTEGER NOT NULL,
        unlock_type VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_unlocks ON premium_unlocks(user_id)
    `;

    console.log('Credit schema initialized successfully');
  } catch (error) {
    console.error('Error initializing credit schema:', error);
    throw error;
  }
}

/**
 * Get user credits record
 */
export async function getUserCredits(userId: string): Promise<UserCreditsRow | null> {
  const result = await sql<UserCreditsRow>`
    SELECT * FROM user_credits WHERE user_id = ${userId}
  `;
  return result.rows[0] || null;
}

/**
 * Create user credits record
 */
export async function createUserCredits(userId: string): Promise<UserCreditsRow> {
  const result = await sql<UserCreditsRow>`
    INSERT INTO user_credits (user_id) VALUES (${userId})
    ON CONFLICT (user_id) DO NOTHING
    RETURNING *
  `;
  return result.rows[0];
}

/**
 * Get user premium unlocks
 */
export async function getUserUnlocks(userId: string): Promise<PremiumUnlockRow[]> {
  const result = await sql<PremiumUnlockRow>`
    SELECT * FROM premium_unlocks WHERE user_id = ${userId}
  `;
  return result.rows;
}

/**
 * Get pending contributions for admin review
 */
export async function getPendingContributions(): Promise<any[]> {
  const result = await sql`
    SELECT
      pc.*,
      pd.title as pattern_title,
      pi.sas_code,
      pi.r_code,
      pi.considerations,
      pi.variations
    FROM pattern_contributions pc
    JOIN pattern_definitions pd ON pc.pattern_id = pd.id
    JOIN pattern_implementations pi ON pc.impl_uuid = pi.uuid
    WHERE pc.status = 'pending'
    ORDER BY pc.created_at DESC
  `;
  return result.rows;
}

// Export the sql client for direct queries if needed
export { sql };
