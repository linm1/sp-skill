/**
 * Cache Invalidation Utilities
 *
 * Provides standardized cache invalidation helpers for API endpoints.
 * Encapsulates cache key patterns and ensures consistent invalidation across the application.
 */

import { cache } from './cache.js';

/**
 * Invalidate all pattern catalog caches (all categories, all user roles)
 *
 * This invalidates:
 * - pattern:catalog:ALL:*
 * - pattern:catalog:{CATEGORY}:*
 *
 * Use this when:
 * - A new pattern is created
 * - A pattern definition is updated
 * - A pattern is deleted/restored
 *
 * @example
 * ```typescript
 * // After creating a new pattern
 * await invalidatePatternCatalog();
 * ```
 */
export async function invalidatePatternCatalog(): Promise<void> {
  await cache.invalidatePattern('pattern:catalog:*');
}

/**
 * Invalidate a specific pattern detail cache
 *
 * This invalidates:
 * - pattern:detail:{patternId}
 *
 * Use this when:
 * - A pattern's implementations are modified
 * - A pattern definition is updated
 *
 * @param patternId - Pattern ID (e.g., 'IMP-001')
 *
 * @example
 * ```typescript
 * // After adding an implementation to IMP-001
 * await invalidatePatternDetail('IMP-001');
 * ```
 */
export async function invalidatePatternDetail(patternId: string): Promise<void> {
  await cache.del(`pattern:detail:${patternId}`);
}

/**
 * Invalidate all implementation caches for a specific pattern
 *
 * This invalidates:
 * - impl:pattern:{patternId}:*
 *
 * Use this when:
 * - An implementation is added to a pattern
 * - An implementation is deleted/restored for a pattern
 *
 * @param patternId - Pattern ID (e.g., 'IMP-001')
 *
 * @example
 * ```typescript
 * // After adding a new implementation
 * await invalidatePatternImplementations('IMP-001');
 * ```
 */
export async function invalidatePatternImplementations(patternId: string): Promise<void> {
  await cache.invalidatePattern(`impl:pattern:${patternId}:*`);
}

/**
 * Invalidate pending implementations cache (admin view)
 *
 * This invalidates:
 * - impl:pending:*
 *
 * Use this when:
 * - A new implementation is submitted (status=pending)
 * - An implementation's status changes from pending
 * - A pending implementation is deleted/restored
 *
 * @example
 * ```typescript
 * // After submitting a new implementation
 * await invalidatePendingImplementations();
 * ```
 */
export async function invalidatePendingImplementations(): Promise<void> {
  await cache.invalidatePattern('impl:pending:*');
}

/**
 * Invalidate user-specific implementation cache
 *
 * This invalidates:
 * - impl:user:{userId}:*
 *
 * Use this when:
 * - A user creates a new implementation
 * - A user's implementation is updated
 * - A user's implementation is deleted/restored
 *
 * @param userId - User ID
 *
 * @example
 * ```typescript
 * // After user creates an implementation
 * await invalidateUserImplementations(user.id);
 * ```
 */
export async function invalidateUserImplementations(userId: string): Promise<void> {
  await cache.invalidatePattern(`impl:user:${userId}:*`);
}

/**
 * Invalidate all caches related to a pattern (catalog, detail, implementations)
 *
 * This is a convenience function that combines multiple invalidations:
 * - Pattern catalog (affects pattern list views)
 * - Pattern detail (affects pattern detail page)
 * - Pattern implementations (affects implementation queries)
 *
 * Use this when:
 * - An implementation is added/removed for a pattern
 * - A pattern's status changes
 * - Any change that affects both catalog and detail views
 *
 * @param patternId - Pattern ID (e.g., 'IMP-001')
 *
 * @example
 * ```typescript
 * // After adding a new implementation to IMP-001
 * await invalidateAllPatternCaches('IMP-001');
 * await invalidatePendingImplementations(); // If implementation is pending
 * ```
 */
export async function invalidateAllPatternCaches(patternId: string): Promise<void> {
  await Promise.all([
    invalidatePatternCatalog(),
    invalidatePatternDetail(patternId),
    invalidatePatternImplementations(patternId),
  ]);
}
