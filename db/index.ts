import { drizzle } from 'drizzle-orm/vercel-postgres';
import { sql } from '@vercel/postgres';
import * as schema from './schema';

/**
 * Drizzle ORM instance with Vercel Postgres
 * Use this in your serverless functions for type-safe queries
 *
 * Example usage:
 * import { db } from '../db';
 * const patterns = await db.select().from(schema.patternDefinitions);
 */
export const db = drizzle(sql, { schema });
