/**
 * Database Utility Functions
 *
 * Shared utilities for database operations and error handling.
 * Compatible with Vercel serverless functions and Drizzle ORM.
 */

/**
 * Checks if an error is related to a missing soft-delete column in the database.
 *
 * This function is used to detect schema migration issues where the `isDeleted`
 * or `is_deleted` column has not been added to a table yet.
 *
 * @param error - The error object to check (typically from a database query)
 * @returns `true` if the error indicates a missing soft-delete column, `false` otherwise
 *
 * @example
 * ```typescript
 * try {
 *   const result = await db.select().from(patterns).where(eq(patterns.isDeleted, false));
 * } catch (error) {
 *   if (isSoftDeleteColumnMissing(error)) {
 *     console.warn('Soft-delete column not found, falling back to legacy query');
 *     // Fallback to query without soft-delete filter
 *     const result = await db.select().from(patterns);
 *   }
 * }
 * ```
 */
export function isSoftDeleteColumnMissing(error: unknown): boolean {
  if (!error) {
    return false;
  }

  // Extract error message from various error types
  let errorMessage = '';

  if (error instanceof Error) {
    errorMessage = error.message.toLowerCase();
  } else if (typeof error === 'string') {
    errorMessage = error.toLowerCase();
  } else if (typeof error === 'object' && 'message' in error) {
    errorMessage = String((error as { message: unknown }).message).toLowerCase();
  }

  // Check if error message indicates a missing column related to soft-delete
  const hasColumnError = errorMessage.includes('column');
  const hasDoesNotExist = errorMessage.includes('does not exist');
  const hasSoftDeleteColumn =
    errorMessage.includes('isdeleted') ||
    errorMessage.includes('is_deleted');

  return hasColumnError && (hasDoesNotExist || hasSoftDeleteColumn);
}
