# Archived API Functions - One-Time Setup Scripts

This folder contains serverless functions that were used for **initial database setup and migrations**. These scripts have already been executed in production and are archived here for historical reference and disaster recovery.

## ⚠️ Important Notice

**These functions are NOT deployed to production.** They are kept in the repository for:
- Documentation of setup process
- Disaster recovery scenarios
- Setting up new development/staging environments
- Historical reference for schema evolution

---

## Functions in This Folder

### migrate.ts
**Purpose**: Create initial database tables from SQL file
**Method**: POST
**Security**: Requires `x-migration-token` header
**SQL File**: Reads from `/scripts/create-tables.sql`
**Idempotent**: Safe to run multiple times (uses `IF NOT EXISTS`)

**Tables Created**:
- `users` - User accounts
- `pattern_definitions` - Immutable pattern metadata
- `pattern_implementations` - Mutable pattern code

**Example**:
```bash
curl -X POST \
  -H "x-migration-token: YOUR_SECRET_TOKEN" \
  https://sp-skill.vercel.app/api/migrate
```

**Status**: ✅ Executed successfully on [initial deployment date]

---

### migrate-clerk.ts
**Purpose**: Add Clerk authentication columns to users table
**Method**: POST
**Security**: Requires `x-migration-token` header
**SQL File**: Reads from `/scripts/add-clerk-id-migration.sql`
**Changes**: Adds `clerk_id` column and unique constraint

**Example**:
```bash
curl -X POST \
  -H "x-migration-token: YOUR_SECRET_TOKEN" \
  https://sp-skill.vercel.app/api/migrate-clerk
```

**Status**: ✅ Executed successfully on [Clerk integration date]

---

### seed.ts
**Purpose**: Populate database with 30 sample clinical programming patterns
**Method**: POST
**Security**: Requires `x-migration-token` header
**Data Inserted**:
- 1 System user (default author)
- 15 IMP (Imputation) patterns with SAS/R implementations
- 15 DER (Derivation) patterns with SAS/R implementations

**Pattern Categories Seeded**:
- IMP-001 through IMP-015
- DER-001 through DER-015

**Example**:
```bash
curl -X POST \
  -H "x-migration-token: YOUR_SECRET_TOKEN" \
  https://sp-skill.vercel.app/api/seed
```

**Status**: ✅ Executed successfully on [seeding date]

---

### fix-sequence.ts
**Purpose**: Reset PostgreSQL auto-increment sequence for users table
**Method**: POST
**Security**: Requires `x-migration-token` header
**Problem Solved**: Fixes "duplicate key value violates unique constraint" errors

**What It Does**:
```sql
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
```

**When to Use**:
- After manual INSERT statements with explicit IDs
- After database restore from backup
- When getting sequence-related errors

**Example**:
```bash
curl -X POST \
  -H "x-migration-token: YOUR_SECRET_TOKEN" \
  https://sp-skill.vercel.app/api/fix-sequence
```

**Status**: ✅ Executed as maintenance operation

---

## Running These Scripts

### Prerequisites
1. Set `MIGRATION_TOKEN` environment variable in Vercel
2. Ensure database connection is configured (`POSTGRES_URL`)
3. Verify SQL files exist in `/scripts/` directory

### Local Development
1. Create `.env.local`:
   ```
   POSTGRES_URL=your_local_postgres_url
   MIGRATION_TOKEN=your_secret_token
   ```

2. Move desired script back to `/api/` temporarily:
   ```bash
   cp scripts/archived-api/migrate.ts api/
   ```

3. Run development server:
   ```bash
   npm run dev
   ```

4. Execute the script:
   ```bash
   curl -X POST \
     -H "x-migration-token: your_secret_token" \
     http://localhost:3000/api/migrate
   ```

5. Move script back to archive:
   ```bash
   mv api/migrate.ts scripts/archived-api/
   ```

### Production (Emergency Use Only)
If you need to re-run migrations in production:

1. Move script to `/api/` directory
2. Commit and push to git
3. Deploy to Vercel
4. Execute with production migration token
5. Verify results in database
6. Move script back to archive
7. Commit and redeploy

---

## Security Considerations

All scripts require the `x-migration-token` header to prevent unauthorized execution. This token should:
- Be stored only in Vercel environment variables
- Never be committed to git
- Be rotated periodically
- Have high entropy (use a password generator)

**Example Token Generation**:
```bash
openssl rand -base64 32
```

---

## Disaster Recovery Scenarios

### Scenario 1: Database Corrupted
1. Create new database instance
2. Update `POSTGRES_URL` in Vercel
3. Run `migrate.ts` to create tables
4. Run `migrate-clerk.ts` to add Clerk columns
5. Run `seed.ts` to populate sample data (optional)
6. Restore user data from backup (if available)
7. Run `fix-sequence.ts` if needed

### Scenario 2: New Staging Environment
1. Create staging database
2. Set staging environment variables
3. Execute scripts in order: migrate → migrate-clerk → seed
4. Verify data with `/api/patterns` endpoint

### Scenario 3: Adding New Migration
1. Create new SQL file in `/scripts/`
2. Create new migration function (copy pattern from existing)
3. Test locally first
4. Execute in production
5. Archive the migration function here

---

## Migration History

| Script | Executed Date | Author | Purpose |
|--------|--------------|--------|---------|
| migrate.ts | [Date] | System | Initial schema creation |
| migrate-clerk.ts | [Date] | System | Add Clerk authentication |
| seed.ts | [Date] | System | Seed sample patterns |
| fix-sequence.ts | [Date] | System | Fix ID sequence |

---

## Related Files

- `/scripts/create-tables.sql` - Initial schema
- `/scripts/add-clerk-id-migration.sql` - Clerk column migration
- `/api/sync-user.ts` - Active manual user sync (still in production)
- `/api/webhooks/clerk.ts` - Active webhook sync (still in production)

---

**Last Updated**: 2025-12-29
**Status**: Archived - Not deployed to production
