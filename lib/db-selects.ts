import { patternDefinitions, patternImplementations } from '../db/schema.js';

/**
 * Reusable select field mapping for implementation queries joined with pattern definitions.
 *
 * This object is used in multiple queries across api/implementations.ts when fetching
 * implementation records along with their associated pattern metadata (title, category).
 *
 * Usage:
 * ```typescript
 * const results = await db
 *   .select(IMPLEMENTATION_WITH_PATTERN_FIELDS)
 *   .from(patternImplementations)
 *   .innerJoin(patternDefinitions, eq(patternImplementations.patternId, patternDefinitions.id))
 * ```
 */
export const IMPLEMENTATION_WITH_PATTERN_FIELDS = {
  // Implementation fields
  uuid: patternImplementations.uuid,
  patternId: patternImplementations.patternId,
  authorId: patternImplementations.authorId,
  authorName: patternImplementations.authorName,
  sasCode: patternImplementations.sasCode,
  rCode: patternImplementations.rCode,
  considerations: patternImplementations.considerations,
  variations: patternImplementations.variations,
  status: patternImplementations.status,
  createdAt: patternImplementations.createdAt,
  updatedAt: patternImplementations.updatedAt,
  // Pattern definition fields (joined)
  patternTitle: patternDefinitions.title,
  patternCategory: patternDefinitions.category,
} as const;

/**
 * Reusable select field mapping for standalone implementation queries (no join).
 *
 * This object includes all implementation fields including isPremium, but excludes
 * pattern definition fields. Used when querying implementations by pattern ID.
 *
 * Usage:
 * ```typescript
 * const results = await db
 *   .select(IMPLEMENTATION_FIELDS)
 *   .from(patternImplementations)
 *   .where(eq(patternImplementations.patternId, patternId))
 * ```
 */
export const IMPLEMENTATION_FIELDS = {
  uuid: patternImplementations.uuid,
  patternId: patternImplementations.patternId,
  authorId: patternImplementations.authorId,
  authorName: patternImplementations.authorName,
  sasCode: patternImplementations.sasCode,
  rCode: patternImplementations.rCode,
  considerations: patternImplementations.considerations,
  variations: patternImplementations.variations,
  status: patternImplementations.status,
  isPremium: patternImplementations.isPremium,
  createdAt: patternImplementations.createdAt,
  updatedAt: patternImplementations.updatedAt,
} as const;
