import { pgTable, serial, varchar, text, boolean, timestamp, uuid, index } from 'drizzle-orm/pg-core';

/**
 * Users table - Basic authentication and role management
 */
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  clerkId: varchar('clerk_id', { length: 255 }).unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  role: varchar('role', { length: 50 }).default('contributor'), // guest, contributor, premier, admin
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * Pattern Definitions - Immutable container
 * Defines the problem, when to use, and metadata
 */
export const patternDefinitions = pgTable('pattern_definitions', {
  id: varchar('id', { length: 20 }).primaryKey(), // e.g., 'IMP-001'
  category: varchar('category', { length: 10 }).notNull(), // e.g., 'IMP', 'DER'
  title: varchar('title', { length: 255 }).notNull(),
  problem: text('problem').notNull(),
  whenToUse: text('when_to_use').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  deletedAt: timestamp('deleted_at'),
  deletedBy: varchar('deleted_by', { length: 255 }),  // Clerk user ID
}, (table) => ({
  categoryIdx: index('idx_pattern_definitions_category').on(table.category),
  isDeletedIdx: index('idx_pattern_definitions_is_deleted').on(table.isDeleted),
}));

/**
 * Pattern Implementations - Mutable content
 * Multiple implementations per pattern (different authors/approaches)
 */
export const patternImplementations = pgTable('pattern_implementations', {
  uuid: uuid('uuid').primaryKey().defaultRandom(),
  patternId: varchar('pattern_id', { length: 20 }).notNull().references(() => patternDefinitions.id, { onDelete: 'cascade' }),
  authorId: integer('author_id').references(() => users.id),
  authorName: varchar('author_name', { length: 255 }).notNull(), // Denormalized for display
  sasCode: text('sas_code'),
  rCode: text('r_code'),
  considerations: text('considerations').array(), // Array of strings
  variations: text('variations').array(), // Array of strings
  status: varchar('status', { length: 20 }).default('pending'), // active, pending, rejected
  isPremium: boolean('is_premium').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  deletedAt: timestamp('deleted_at'),
  deletedBy: varchar('deleted_by', { length: 255 }),  // Clerk user ID
}, (table) => ({
  patternIdIdx: index('idx_pattern_implementations_pattern_id').on(table.patternId),
  statusIdx: index('idx_pattern_implementations_status').on(table.status),
  authorIdIdx: index('idx_pattern_implementations_author_id').on(table.authorId),
  isDeletedIdx: index('idx_pattern_implementations_is_deleted').on(table.isDeleted),
}));

// Import integer from drizzle-orm/pg-core
import { integer } from 'drizzle-orm/pg-core';

// Type exports for TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type PatternDefinition = typeof patternDefinitions.$inferSelect;
export type NewPatternDefinition = typeof patternDefinitions.$inferInsert;
export type PatternImplementation = typeof patternImplementations.$inferSelect;
export type NewPatternImplementation = typeof patternImplementations.$inferInsert;
