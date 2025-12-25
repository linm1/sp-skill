# Development Guide - StatPatternHub

## Local Development Setup

### Quick Start

```bash
# Make sure you've already run:
# vercel login
# vercel link
# vercel env pull .env.local

# Start development server (runs both Vite + API endpoints)
vercel dev
```

This will start the development server at **http://localhost:3000**

- **Frontend**: http://localhost:3000
- **API endpoints**: http://localhost:3000/api/*

---

## How It Works

`vercel dev` does two things:
1. Runs `vite --port 3000` (your React frontend)
2. Runs serverless functions in `/api/*` folder

The `devCommand` in `vercel.json` tells Vercel to start Vite:
```json
"devCommand": "vite --port 3000"
```

---

## Testing Database Connection

### Step 1: Ensure Environment Variables Exist

Check that `.env.local` contains database credentials:

```bash
cat .env.local | grep POSTGRES
```

You should see:
```
POSTGRES_URL=postgres://...
POSTGRES_HOST=...
POSTGRES_USER=...
```

If not, run:
```bash
vercel env pull .env.local
```

### Step 2: Start Development Server

```bash
vercel dev
```

Wait for:
```
> Ready! Available at http://localhost:3000
```

### Step 3: Test Database Connection

In a new terminal:

```bash
curl http://localhost:3000/api/db-test
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

✅ If you see `"connected": true`, your setup is working!

---

## Running Database Migration

### Step 1: Add Migration Token

Add to `.env.local`:
```bash
MIGRATION_TOKEN=your-secret-token-12345
```

### Step 2: Run Migration

```bash
curl -X POST http://localhost:3000/api/migrate \
  -H "x-migration-token: your-secret-token-12345"
```

Expected response:
```json
{
  "success": true,
  "message": "Database tables created successfully",
  "timestamp": "2025-01-15T10:35:00.000Z"
}
```

This creates:
- `users` table
- `pattern_definitions` table
- `pattern_implementations` table

---

## Common Issues & Solutions

### Issue: `vercel: command not found`

**Solution**:
```bash
npm install -g vercel
```

### Issue: "No existing credentials found"

**Solution**:
```bash
vercel login
vercel link
vercel env pull .env.local
```

### Issue: API endpoints return 404

**Problem**: `vercel dev` not running or crashed

**Solution**:
1. Stop `vercel dev` (Ctrl+C)
2. Restart: `vercel dev`
3. Wait for "Ready! Available at http://localhost:3000"

### Issue: "Database connection failed"

**Solutions**:

1. **Check environment variables**:
   ```bash
   cat .env.local | grep POSTGRES_URL
   ```

2. **Re-pull credentials**:
   ```bash
   vercel env pull .env.local
   ```

3. **Verify database exists** in Vercel Dashboard:
   - https://vercel.com/dashboard → sp-skill → Storage
   - Should see your database listed

4. **Restart dev server**:
   ```bash
   # Stop vercel dev (Ctrl+C)
   vercel dev
   ```

### Issue: Port 3000 already in use

**Solution**:
```bash
# Stop process on port 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux:
lsof -ti:3000 | xargs kill -9

# Then restart
vercel dev
```

---

## Development Workflow

### 1. Start Development

```bash
vercel dev
```

### 2. Make Code Changes

- **Frontend**: Edit `index.tsx` → Auto-reloads
- **API**: Edit `api/*.ts` → Auto-reloads
- **Database**: Edit `db/schema.ts` → Restart `vercel dev`

### 3. Test API Endpoints

```bash
# Test connection
curl http://localhost:3000/api/db-test

# Test other endpoints
curl http://localhost:3000/api/analyze -X POST -H "Content-Type: application/json" -d '{"content":"test"}'
```

### 4. View Logs

- **Browser console**: Frontend logs
- **Terminal**: API logs appear in `vercel dev` output

---

## Alternative: Run Frontend and API Separately

If `vercel dev` has issues, you can run them separately:

### Terminal 1: Frontend (Vite)
```bash
npm run dev
# Runs on http://localhost:5173
```

### Terminal 2: API (Vercel)
```bash
vercel dev --listen 3000
# Runs on http://localhost:3000
```

Then update frontend API calls to point to `http://localhost:3000/api/*`

---

## Production Deployment

### Deploy to Vercel

```bash
# Deploy to production
vercel --prod

# Deploy preview
vercel
```

### Environment Variables for Production

Set in Vercel Dashboard (Settings → Environment Variables):
- `GEMINI_API_KEY`
- `MIGRATION_TOKEN`
- Database variables (auto-added when you created Postgres DB)

---

## Next Steps

After successful local setup:

1. ✅ Test database connection (`/api/db-test`)
2. ✅ Run migration (`/api/migrate`)
3. 🔲 Create seed data script for 172 patterns
4. 🔲 Build CRUD API endpoints
5. 🔲 Update frontend to use database instead of localStorage

---

## Resources

- [Vercel CLI Docs](https://vercel.com/docs/cli)
- [Vercel Dev Command](https://vercel.com/docs/cli/dev)
- [Vercel Postgres Docs](https://vercel.com/docs/storage/vercel-postgres)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
