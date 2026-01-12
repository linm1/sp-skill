// @ts-strict-local

/**
 * Centralized application constants
 *
 * Cache TTL values, rate limits, and other configuration constants
 */

/**
 * Cache Time-To-Live values in seconds
 */
export const CACHE_TTL = {
  /** Pattern catalog cache (public view) - 1 hour */
  PATTERN_CATALOG: 3600,

  /** Pattern catalog cache (admin view with deleted items) - 5 minutes */
  PATTERN_CATALOG_ADMIN: 300,

  /** User profile cache - 30 minutes */
  USER_PROFILE: 1800,

  /** Pattern detail cache - 30 minutes */
  PATTERN_DETAIL: 1800,

  /** Implementation queries cache - 10 minutes */
  IMPLEMENTATION_QUERIES: 600,

  /** Pending implementations cache (admin review) - 2 minutes */
  PENDING_IMPLEMENTATIONS: 120,
} as const;

/**
 * Rate limiting configuration (requests per day)
 */
export const RATE_LIMITS = {
  /** Contributors: 10 code extractions per day */
  CONTRIBUTOR_DAILY: 10,

  /** Premier users: 100 code extractions per day */
  PREMIER_DAILY: 100,

  /** Admin users: unlimited (set high value) */
  ADMIN_DAILY: 999999,
} as const;

/**
 * Pattern ID validation regex
 * Format: XXX-NNN (e.g., IMP-001)
 */
export const PATTERN_ID_REGEX = /^[A-Z]{3}-\d{3}$/;

/**
 * Pattern ID validation error message
 */
export const PATTERN_ID_ERROR_MESSAGE = 'Pattern ID must match format XXX-NNN (e.g., IMP-001)';

/**
 * Valid pattern category codes
 */
export const VALID_CATEGORIES = [
  'IMP', 'DER', 'DAT', 'RSH', 'AGG', 'MRG',
  'CAT', 'FLG', 'SRT', 'FMT', 'VAL', 'CDS',
  'STA', 'OPT'
] as const;

/**
 * Pattern category type derived from VALID_CATEGORIES
 */
export type PatternCategory = typeof VALID_CATEGORIES[number];
