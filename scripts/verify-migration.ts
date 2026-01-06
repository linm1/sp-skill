/**
 * Database Migration Verification Script
 *
 * Verifies that the production database has all required columns
 * for the soft-delete architecture.
 *
 * Usage:
 *   npx tsx scripts/verify-migration.ts
 */

import { sql } from '@vercel/postgres';

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

async function verifyTableColumns(tableName: string, requiredColumns: string[]) {
  console.log(`\nVerifying table: ${tableName}`);
  console.log('='.repeat(50));

  try {
    const result = await sql<ColumnInfo>`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = ${tableName}
      ORDER BY ordinal_position;
    `;

    if (result.rows.length === 0) {
      console.error(`❌ Table '${tableName}' does not exist!`);
      return false;
    }

    const existingColumns = result.rows.map(row => row.column_name);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

    if (missingColumns.length > 0) {
      console.error(`❌ Missing columns in '${tableName}':`, missingColumns);
      return false;
    }

    console.log(`✅ All required columns exist in '${tableName}'`);
    console.log('\nColumns found:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

    return true;
  } catch (error) {
    console.error(`❌ Error checking table '${tableName}':`, error);
    return false;
  }
}

async function verifyMigration() {
  console.log('🔍 StatPatternHub - Database Migration Verification');
  console.log('='.repeat(50));

  const checks = [
    verifyTableColumns('users', [
      'id',
      'clerk_id',
      'email',
      'name',
      'role',
      'created_at',
      'updated_at'
    ]),

    verifyTableColumns('pattern_definitions', [
      'id',
      'category',
      'title',
      'problem',
      'when_to_use',
      'created_at',
      'is_deleted',      // Soft delete
      'deleted_at',      // Soft delete
      'deleted_by'       // Soft delete
    ]),

    verifyTableColumns('pattern_implementations', [
      'uuid',
      'pattern_id',
      'author_id',
      'author_name',
      'sas_code',
      'r_code',
      'considerations',
      'variations',
      'status',
      'is_premium',
      'created_at',
      'updated_at',
      'is_deleted',      // Soft delete
      'deleted_at',      // Soft delete
      'deleted_by'       // Soft delete
    ])
  ];

  const results = await Promise.all(checks);
  const allPassed = results.every(result => result === true);

  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log('✅ Migration verification PASSED');
    console.log('   Database schema is up to date!');
    process.exit(0);
  } else {
    console.log('❌ Migration verification FAILED');
    console.log('   Please run: npx drizzle-kit push');
    process.exit(1);
  }
}

// Run verification
verifyMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
