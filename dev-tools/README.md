# Development & Debug Tools

This folder contains serverless functions that are **NOT deployed to production**. These are development and debugging utilities.

## Functions in This Folder

### debug-auth.ts
**Purpose**: Debug Clerk JWT token verification
**Method**: GET
**Usage**: Send request with `Authorization: Bearer <token>` header
**Response**: Token payload and verification status

**Example**:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/debug-auth
```

**When to Use**:
- Troubleshooting authentication issues
- Verifying token structure during development
- Testing Clerk integration locally

---

### db-test.ts
**Purpose**: Test Vercel Postgres database connection
**Method**: GET
**Response**: Connection status, server time, database version

**Example**:
```bash
curl http://localhost:3000/api/db-test
```

**When to Use**:
- Initial database setup verification
- Confirming environment variables are configured
- Debugging connection issues

---

### list-tables.ts
**Purpose**: List all tables in the PostgreSQL public schema
**Method**: GET
**Response**: Array of table names and count

**Example**:
```bash
curl http://localhost:3000/api/list-tables
```

**When to Use**:
- Verifying migrations ran successfully
- Quick schema inspection
- Debugging table structure issues

---

## Running These Functions Locally

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Access functions at:
   - `http://localhost:3000/api/debug-auth`
   - `http://localhost:3000/api/db-test`
   - `http://localhost:3000/api/list-tables`

## Why These Are Not in Production

- **Security**: Debug endpoints expose internal system state
- **Performance**: Unnecessary cold start overhead
- **Cost**: Each function counts toward Vercel quota
- **Maintenance**: Dev tools don't need production uptime guarantees

## Moving Back to Production

If you need to temporarily deploy these for production debugging:

1. Move the file back to `/api/` directory
2. Deploy to Vercel
3. Access at `https://sp-skill.vercel.app/api/[function-name]`
4. Remember to move it back after debugging

---

**Last Updated**: 2025-12-29
