/**
 * Validation Utilities
 *
 * Provides standardized validation helpers for API endpoints, including Zod schema
 * validation with automatic error response formatting.
 */

import type { VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { sendError, type ErrorDetail } from './api-response.js';

/**
 * Pattern ID validation regex
 * Format: XXX-NNN (e.g., IMP-001, DER-020)
 */
export const PATTERN_ID_REGEX = /^[A-Z]{3}-\d{3}$/;

/**
 * Pattern ID validation error message
 */
export const PATTERN_ID_ERROR_MESSAGE = 'Pattern ID must match format XXX-NNN (e.g., IMP-001)';

/**
 * Converts Zod validation errors into standardized ErrorDetail array
 *
 * @param zodError - The Zod validation error object
 * @returns Array of ErrorDetail objects with field paths and messages
 *
 * @example
 * ```typescript
 * try {
 *   schema.parse(data);
 * } catch (error) {
 *   if (error instanceof z.ZodError) {
 *     const details = formatZodError(error);
 *     // details = [{ field: 'email', message: 'Email is required' }]
 *   }
 * }
 * ```
 */
export function formatZodError(zodError: z.ZodError): ErrorDetail[] {
  return zodError.issues.map(issue => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * Validates data against a Zod schema and automatically sends error response if invalid
 *
 * This is a convenience function that combines Zod validation with error response
 * formatting. If validation fails, it sends a standardized error response and returns null.
 * If validation succeeds, it returns the typed, validated data.
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @param res - Vercel response object (for sending error response)
 * @returns Validated data of type T, or null if validation failed (error already sent)
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   email: z.string().email(),
 *   age: z.number().min(18)
 * });
 *
 * const validated = validateWithZod(schema, req.body, res);
 * if (!validated) return; // Error response already sent
 *
 * // TypeScript knows validated is { email: string; age: number }
 * console.log(validated.email);
 * ```
 */
export function validateWithZod<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  res: VercelResponse
): T | null {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const details = formatZodError(error);
      sendError(res, 400, 'Validation failed', 'Request validation failed', details);
      return null;
    }
    // Re-throw non-Zod errors
    throw error;
  }
}
