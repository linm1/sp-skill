import type { Config } from 'drizzle-kit';

/**
 * Drizzle Kit Configuration
 *
 * Used for generating migrations and introspecting the database
 *
 * Usage:
 * - npx drizzle-kit generate:pg - Generate migration files
 * - npx drizzle-kit push:pg - Push schema changes to database
 * - npx drizzle-kit studio - Open Drizzle Studio (database GUI)
 */
export default {
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL || '',
  },
} satisfies Config;
