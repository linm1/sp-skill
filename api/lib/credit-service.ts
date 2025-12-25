import { sql } from '@vercel/postgres';
import { getUserCredits, createUserCredits, getUserUnlocks } from './db';

/**
 * Credit Service for StatPatternHub
 * Handles credit economy: earning, spending, tiers, and premium unlocks
 */

const TIER_THRESHOLDS = {
  bronze: 0,
  silver: 100,
  gold: 500,
  platinum: 2000
};

/**
 * Get user credits or create if doesn't exist
 */
export async function getOrCreateUserCredits(userId: string) {
  let credits = await getUserCredits(userId);
  if (!credits) {
    credits = await createUserCredits(userId);
  }
  return credits;
}

/**
 * Award credits to a user
 * Handles tier progression and transaction logging
 * Uses ACID-compliant transaction
 */
export async function awardCredits(
  userId: string,
  amount: number,
  source: string,
  metadata: any = {}
): Promise<{ newBalance: number; newTier: string }> {
  const client = await sql.connect();
  try {
    await client.query('BEGIN');

    // Update user_credits
    const updateResult = await client.query(`
      UPDATE user_credits
      SET
        balance = balance + $1,
        lifetime_earned = lifetime_earned + $1,
        contribution_count = contribution_count + 1,
        updated_at = NOW()
      WHERE user_id = $2
      RETURNING balance, lifetime_earned
    `, [amount, userId]);

    if (updateResult.rows.length === 0) {
      // User doesn't exist, create first
      await client.query('ROLLBACK');
      await createUserCredits(userId);
      return awardCredits(userId, amount, source, metadata);
    }

    const { balance, lifetime_earned } = updateResult.rows[0];

    // Calculate new tier
    const newTier = Object.entries(TIER_THRESHOLDS)
      .reverse()
      .find(([_, threshold]) => lifetime_earned >= threshold)?.[0] || 'bronze';

    // Update tier
    await client.query(`
      UPDATE user_credits SET tier = $1 WHERE user_id = $2
    `, [newTier, userId]);

    // Log transaction
    await client.query(`
      INSERT INTO credit_transactions (user_id, amount, type, source, metadata, balance_after)
      VALUES ($1, $2, 'earn', $3, $4, $5)
    `, [userId, amount, source, JSON.stringify(metadata), balance]);

    await client.query('COMMIT');
    return { newBalance: balance, newTier };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Spend credits for premium unlocks
 * Validates balance and creates transaction atomically
 */
export async function spendCredits(
  userId: string,
  amount: number,
  source: string,
  metadata: any = {}
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  const client = await sql.connect();
  try {
    await client.query('BEGIN');

    // Check balance with row lock
    const balanceResult = await client.query(`
      SELECT balance FROM user_credits WHERE user_id = $1 FOR UPDATE
    `, [userId]);

    if (balanceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'User credits not found' };
    }

    const currentBalance = balanceResult.rows[0].balance;

    if (currentBalance < amount) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: `Insufficient credits. Required: ${amount}, Available: ${currentBalance}`
      };
    }

    // Deduct credits
    const updateResult = await client.query(`
      UPDATE user_credits
      SET
        balance = balance - $1,
        lifetime_spent = lifetime_spent + $1,
        updated_at = NOW()
      WHERE user_id = $2
      RETURNING balance
    `, [amount, userId]);

    const newBalance = updateResult.rows[0].balance;

    // Log transaction
    await client.query(`
      INSERT INTO credit_transactions (user_id, amount, type, source, metadata, balance_after)
      VALUES ($1, $2, 'spend', $3, $4, $5)
    `, [userId, -amount, source, JSON.stringify(metadata), newBalance]);

    await client.query('COMMIT');
    return { success: true, newBalance };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Check if user has unlocked premium content
 * Supports pattern-level, category-level, and lifetime unlocks
 */
export async function hasUnlockedPremium(
  userId: string,
  patternId?: string,
  category?: string
): Promise<boolean> {
  const unlocks = await getUserUnlocks(userId);

  // Check lifetime access
  if (unlocks.some(u => u.unlock_type === 'lifetime')) {
    return true;
  }

  // Check category unlock
  if (category && unlocks.some(u => u.unlock_type === 'category' && u.category === category)) {
    return true;
  }

  // Check pattern unlock
  if (patternId && unlocks.some(u => u.unlock_type === 'pattern' && u.pattern_id === patternId)) {
    return true;
  }

  return false;
}

/**
 * Create premium unlock record
 */
export async function createUnlock(
  userId: string,
  unlockType: 'pattern' | 'category' | 'lifetime',
  targetId: string | null,
  creditsSpent: number
): Promise<void> {
  if (unlockType === 'pattern') {
    await sql`
      INSERT INTO premium_unlocks (user_id, pattern_id, unlock_type, credits_spent)
      VALUES (${userId}, ${targetId}, ${unlockType}, ${creditsSpent})
    `;
  } else if (unlockType === 'category') {
    await sql`
      INSERT INTO premium_unlocks (user_id, category, unlock_type, credits_spent)
      VALUES (${userId}, ${targetId}, ${unlockType}, ${creditsSpent})
    `;
  } else {
    await sql`
      INSERT INTO premium_unlocks (user_id, unlock_type, credits_spent)
      VALUES (${userId}, ${unlockType}, ${creditsSpent})
    `;
  }
}
