# Database Setup Guide - StatPatternHub

## Overview

This guide walks you through setting up Vercel Postgres (powered by Neon) for StatPatternHub's Phase 2 implementation.

**What you'll achieve:**
- ✅ Vercel Postgres database (free tier)
- ✅ Local development connected to Vercel database
- ✅ Type-safe queries with Drizzle ORM
- ✅ Database schema for patterns and users

---

## Prerequisites

- [x] Vercel account (free tier)
- [x] StatPatternHub project deployed on Vercel
- [x] Node.js installed locally

---

## Step 1: Create Database on Vercel Dashboard

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard
2. **Select your project**: Click on `sp-skill`
3. **Navigate to Storage tab**
4. **Click "Create Database"**
5. **Select "Neon"** (Serverless Postgres)
6. **Configure database**:
   - **Name**: `statpatternhub-db`
   - **Region**: Choose closest to your users (e.g., `us-east-1`)
   - **Plan**: Neon Free (automatically selected)
7. **Click "Create"**
8. **Connect to project**: Select `sp-skill` when prompted

Vercel will automatically add these environment variables:
- `POSTGRES_URL` - Main connection string (with pooling)
- `POSTGRES_PRISMA_URL` - Optimized for ORMs
- `POSTGRES_URL_NON_POOLING` - Direct connection
- `POSTGRES_USER`, `POSTGRES_HOST`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`

---

## Step 2: Set Up Local Development

### 2.1 Install Vercel CLI (if not already installed)

```bash
npm install -g vercel
```

### 2.2 Login to Vercel

```bash
vercel login
```

This will open a browser for authentication.

### 2.3 Link Your Local Project

```bash
cd /home/user/sp-skill
vercel link
```

When prompted:
- **Scope**: Select your Vercel account
- **Link to existing project?**: Yes
- **Project name**: `sp-skill`

### 2.4 Pull Environment Variables

```bash
vercel env pull .env.local
```

This creates a `.env.local` file with your database credentials:

```bash
# .env.local (auto-generated)
POSTGRES_URL="postgres://username:password@host/database?sslmode=require"
POSTGRES_PRISMA_URL="postgres://username:password@host/database?sslmode=require&pgbouncer=true"
POSTGRES_URL_NON_POOLING="postgres://username:password@host/database?sslmode=require"
POSTGRES_USER="username"
POSTGRES_HOST="host.region.neon.tech"
POSTGRES_PASSWORD="password"
POSTGRES_DATABASE="database_name"

# Your existing API key
GEMINI_API_KEY=your_api_key_here
```

**Important**: `.env.local` is already in `.gitignore` - never commit it!

---

## Step 3: Test Database Connection

### 3.1 Start Development Server

```bash
npm run dev
```

### 3.2 Test Connection Endpoint

Open a new terminal and run:

```bash
curl http://localhost:5173/api/db-test
```

Expected response:
```json
{
  "connected": true,
  "timestamp": "2025-01-15T10:30:00.000Z",
  "dbVersion": "PostgreSQL 16.x ...",
  "environment": {
    "POSTGRES_URL": true,
    "POSTGRES_HOST": true,
    "POSTGRES_USER": true,
    "POSTGRES_DATABASE": true
  },
  "message": "Database connection successful!"
}
```

If you see `"connected": true`, your local environment is successfully connected to Vercel Postgres! 🎉

---

## Step 4: Run Database Migration

### 4.1 Set Migration Token

Add this to your `.env.local`:

```bash
MIGRATION_TOKEN=your-secret-token-here-12345
```

Choose a random string for the token (e.g., `openssl rand -hex 32` on macOS/Linux).

### 4.2 Run Migration Locally

```bash
curl -X POST http://localhost:5173/api/migrate \
  -H "x-migration-token: your-secret-token-here-12345"
```

Expected response:
```json
{
  "success": true,
  "message": "Database tables created successfully",
  "timestamp": "2025-01-15T10:35:00.000Z"
}
```

This creates the following tables:
- `users` - User profiles and roles
- `pattern_definitions` - Pattern metadata (immutable)
- `pattern_implementations` - Code implementations (mutable)

### 4.3 Verify Tables Were Created

You can verify in the Vercel Dashboard:
1. Go to **Storage** → Your database
2. Click **Data** tab
3. You should see the 3 tables listed

---

## Step 5: Database Schema Overview

### Tables Created

#### 1. **users**
```sql
id SERIAL PRIMARY KEY
email VARCHAR(255) UNIQUE NOT NULL
name VARCHAR(255)
role VARCHAR(50) DEFAULT 'guest'  -- guest, contributor, premier, admin
created_at TIMESTAMP
updated_at TIMESTAMP
```

#### 2. **pattern_definitions** (Immutable Container)
```sql
id VARCHAR(20) PRIMARY KEY           -- e.g., 'IMP-001'
category VARCHAR(10) NOT NULL        -- e.g., 'IMP', 'DER'
title VARCHAR(255) NOT NULL
problem TEXT NOT NULL
when_to_use TEXT NOT NULL
created_at TIMESTAMP
```

#### 3. **pattern_implementations** (Mutable Content)
```sql
uuid UUID PRIMARY KEY
pattern_id VARCHAR(20) REFERENCES pattern_definitions(id)
author_id INTEGER REFERENCES users(id)
author_name VARCHAR(255) NOT NULL
sas_code TEXT
r_code TEXT
considerations TEXT[]                -- Array of strings
variations TEXT[]                    -- Array of strings
status VARCHAR(20) DEFAULT 'pending' -- active, pending, rejected
is_premium BOOLEAN DEFAULT FALSE
created_at TIMESTAMP
updated_at TIMESTAMP
```

### Default Data

The migration automatically creates:
- **System user** (id: 1, email: system@statpatternhub.com) for default patterns

---

## Step 6: Using the Database in Code

### Example 1: Query with Drizzle ORM (Type-Safe)

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../db';
import { patternDefinitions } from '../db/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Type-safe query
  const patterns = await db
    .select()
    .from(patternDefinitions)
    .where(eq(patternDefinitions.category, 'IMP'));

  return res.json({ patterns });
}
```

### Example 2: Raw SQL Query

```typescript
import { sql } from '@vercel/postgres';

const result = await sql`
  SELECT * FROM pattern_definitions
  WHERE category = ${category}
  LIMIT 10
`;

console.log(result.rows);
```

### Example 3: Insert Data

```typescript
import { db } from '../db';
import { patternDefinitions } from '../db/schema';

await db.insert(patternDefinitions).values({
  id: 'IMP-001',
  category: 'IMP',
  title: 'LOCF Imputation',
  problem: 'Need to carry forward last observation for missing values',
  whenToUse: 'When you have longitudinal data with intermittent missing values'
});
```

---

## Troubleshooting

### Problem: "No existing credentials found"

**Solution**: Run `vercel login` first, then `vercel link`.

### Problem: "Database connection failed"

**Solution**:
1. Check `.env.local` exists and contains `POSTGRES_URL`
2. Verify database is created in Vercel Dashboard
3. Run `vercel env pull .env.local` again
4. Restart dev server (`npm run dev`)

### Problem: Migration returns 403 Forbidden

**Solution**: Verify `MIGRATION_TOKEN` in `.env.local` matches the header value.

### Problem: Tables not visible in Vercel Dashboard

**Solution**:
1. Re-run migration endpoint
2. Check Vercel Dashboard → Storage → Data tab
3. Wait 30 seconds for dashboard to refresh

---

## Security Best Practices

✅ **DO**:
- Keep `.env.local` in `.gitignore`
- Use `POSTGRES_URL` (with pooling) for serverless functions
- Use parameterized queries to prevent SQL injection
- Protect migration endpoint with `MIGRATION_TOKEN`

❌ **DON'T**:
- Expose database credentials in client-side code
- Commit `.env.local` to git
- Use string interpolation in SQL queries
- Leave migration endpoint unprotected in production

---

## Next Steps

Now that your database is set up, you can:

1. **Seed pattern data**: Create an endpoint to populate `pattern_definitions` with your 172 patterns
2. **Build CRUD APIs**: Create endpoints for pattern CRUD operations
3. **Update frontend**: Replace `localStorage` with API calls to Vercel Postgres
4. **Add authentication**: Integrate user authentication (consider Clerk or NextAuth.js)

---

## Resources

- [Vercel Postgres Docs](https://vercel.com/docs/storage/vercel-postgres)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Neon Docs](https://neon.tech/docs)
