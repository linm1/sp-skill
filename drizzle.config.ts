import { config } from 'dotenv';
import type { Config } from 'drizzle-kit';

// Load environment variables from .env.local
config({ path: '.env.local' });

/**
 * Drizzle Kit Configuration
 *
 * Used for generating migrations and introspecting the database
 *
 * Usage:
 * - npm run db:push - Push schema changes to database
 * - npm run db:studio - Open Drizzle Studio (database GUI)
 * - npm run db:generate - Generate migration files
 *
 * Note: Requires .env.local file with POSTGRES_URL
 * Run `vercel env pull .env.local` to fetch from Vercel
 */
export default {
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL!,
  },
} satisfies Config;
