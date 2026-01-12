/**
 * API Response Utilities
 *
 * Standardized response helpers for Vercel serverless functions.
 * Provides consistent error and success response formatting across all API endpoints.
 */

import type { VercelResponse } from '@vercel/node';

/**
 * Details about a specific error field or validation issue.
 */
export interface ErrorDetail {
  /** The field name that caused the error (e.g., 'email', 'password') */
  field?: string;
  /** Human-readable error message for this specific issue */
  message: string;
  /** Machine-readable error code for programmatic handling */
  code?: string;
}

/**
 * Standard error response structure.
 */
export interface ErrorResponse {
  /** Always 'error' for error responses */
  status: 'error';
  /** Primary error identifier (e.g., 'VALIDATION_ERROR', 'NOT_FOUND') */
  error: string;
  /** Human-readable error message */
  message: string;
  /** Optional array of detailed error information */
  details?: ErrorDetail[];
}

/**
 * Standard success response structure.
 */
export interface SuccessResponse<T = unknown> {
  /** Always 'success' for successful responses */
  status: 'success';
  /** The response payload */
  data: T;
}

/**
 * Sends a standardized error response to the client.
 *
 * @param res - The Vercel response object
 * @param status - HTTP status code (e.g., 400, 404, 500)
 * @param error - Error identifier (e.g., 'VALIDATION_ERROR', 'NOT_FOUND')
 * @param message - Human-readable error message
 * @param details - Optional array of detailed error information
 * @returns The response object (for chaining)
 *
 * @example
 * ```typescript
 * // Simple error
 * return sendError(res, 404, 'NOT_FOUND', 'Pattern not found');
 *
 * // Error with validation details
 * return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input', [
 *   { field: 'email', message: 'Email is required', code: 'REQUIRED' },
 *   { field: 'password', message: 'Password must be at least 8 characters', code: 'MIN_LENGTH' }
 * ]);
 *
 * // Database error
 * return sendError(res, 500, 'DATABASE_ERROR', 'Failed to fetch patterns');
 * ```
 */
export function sendError(
  res: VercelResponse,
  status: number,
  error: string,
  message: string,
  details?: ErrorDetail[]
): VercelResponse {
  const response: ErrorResponse = {
    status: 'error',
    error,
    message,
  };

  if (details && details.length > 0) {
    response.details = details;
  }

  return res.status(status).json(response);
}

/**
 * Sends a standardized success response to the client.
 *
 * @param res - The Vercel response object
 * @param data - The response payload (any JSON-serializable data)
 * @param status - HTTP status code (defaults to 200)
 * @returns The response object (for chaining)
 *
 * @example
 * ```typescript
 * // Simple success
 * return sendSuccess(res, { id: '123', name: 'Pattern Name' });
 *
 * // Success with custom status code
 * return sendSuccess(res, { id: '456' }, 201); // Created
 *
 * // Success with array data
 * return sendSuccess(res, patterns);
 *
 * // Success with typed data
 * interface Pattern { id: string; title: string; }
 * const pattern: Pattern = { id: '789', title: 'New Pattern' };
 * return sendSuccess<Pattern>(res, pattern);
 * ```
 */
export function sendSuccess<T>(
  res: VercelResponse,
  data: T,
  status = 200
): VercelResponse {
  const response: SuccessResponse<T> = {
    status: 'success',
    data,
  };

  return res.status(status).json(response);
}
