# Development Guide - StatPatternHub

## Local Development Setup

### Prerequisites

```bash
# 1. Login to Vercel
vercel login

# 2. Link your local project
vercel link

# 3. Pull environment variables
vercel env pull .env.local
```

---

## Running the Development Server

### Two-Terminal Approach (Recommended)

You need to run **two separate servers** for local development:

#### **Terminal 1: Frontend (Vite)**
```bash
npm run dev
```
→ Runs on **http://localhost:3000**
- Serves React frontend with fast HMR
- Proxies `/api/*` requests to port 3001

#### **Terminal 2: API (Vercel Functions)**
```bash
npm run dev:api
```
→ Runs on **http://localhost:3001**
- Executes serverless functions in `/api/*`
- Loads environment variables from `.env.local`

### Access Your App

- **Frontend**: http://localhost:3000
- **API (via proxy)**: http://localhost:3000/api/*
- **API (direct)**: http://localhost:3001/api/*

---

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser: http://localhost:3000                         │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────┐
│  Vite Dev Server (Port 3000)                           │
│  - Serves React app (index.tsx)                        │
│  - Hot Module Replacement (HMR)                        │
│  - Proxies /api/* → http://localhost:3001              │
└────────────┬───────────────────────────────────────────┘
             │ (API requests only)
             ▼
┌────────────────────────────────────────────────────────┐
│  Vercel Dev Server (Port 3001)                         │
│  - Runs serverless functions (/api/*.ts)               │
│  - Connects to Vercel Postgres                         │
│  - Loads .env.local variables                          │
└────────────────────────────────────────────────────────┘
```

### Configuration Files

**`vite.config.ts`** - Proxy API requests:
```typescript
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,
    },
  },
}
```

**`package.json`** - NPM scripts:
```json
{
  "dev": "vite",
  "dev:api": "vercel dev --listen 3001"
}
```

---

## Testing Database Connection

### Step 1: Ensure Environment Variables Exist

Check that `.env.local` contains database credentials:

```bash
# Windows PowerShell
Get-Content .env.local | Select-String "POSTGRES"

# macOS/Linux/Git Bash
cat .env.local | grep POSTGRES
```

You should see:
```
POSTGRES_URL=postgres://...
POSTGRES_HOST=...
POSTGRES_USER=...
POSTGRES_DATABASE=...
```

If missing, run:
```bash
vercel env pull .env.local
```

### Step 2: Start Both Servers

**Terminal 1:**
```bash
npm run dev
```

**Terminal 2:**
```bash
npm run dev:api
```

Wait for both to show "Ready" messages.

### Step 3: Test Database Connection

Open a **third terminal** or use your browser:

**Option A: cURL (from terminal)**
```bash
curl http://localhost:3000/api/db-test
```

**Option B: Browser**
Open: http://localhost:3000/api/db-test

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
```env
MIGRATION_TOKEN=your-secret-token-12345
```

Choose any random string (e.g., `my-secret-migration-key`).

### Step 2: Restart API Server

Stop Terminal 2 (`Ctrl+C`) and restart:
```bash
npm run dev:api
```

This reloads the new environment variable.

### Step 3: Run Migration

```bash
curl -X POST http://localhost:3000/api/migrate \
  -H "x-migration-token: your-secret-token-12345"
```

**Windows PowerShell:**
```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/migrate `
  -Method POST `
  -Headers @{"x-migration-token"="your-secret-token-12345"}
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

### Step 4: Verify Tables in Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select `sp-skill` project
3. Go to **Storage** → Your database
4. Click **Data** tab
5. You should see 3 tables listed

---

## Common Issues & Solutions

### Issue: `vercel: command not found`

**Solution:**
```bash
npm install -g vercel
```

### Issue: "No existing credentials found"

**Solution:**
```bash
vercel login
vercel link
vercel env pull .env.local
```

### Issue: API returns raw JavaScript code (not JSON)

**Problem**: Vite is serving API files as static assets instead of proxying to Vercel

**Solution:**
1. Make sure **both** servers are running:
   - Terminal 1: `npm run dev` (Vite on port 3000)
   - Terminal 2: `npm run dev:api` (Vercel on port 3001)
2. Verify `vite.config.ts` has proxy configuration
3. Access via port 3000, not 3001: `http://localhost:3000/api/db-test`

### Issue: "Database connection failed"

**Solutions:**

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

4. **Restart API server** (Terminal 2):
   ```bash
   # Ctrl+C to stop
   npm run dev:api
   ```

### Issue: Port 3000 or 3001 already in use

**Windows:**
```powershell
# Find process
netstat -ano | findstr :3000

# Kill process (replace PID with actual number)
taskkill /PID <PID> /F
```

**macOS/Linux:**
```bash
# Find and kill process
lsof -ti:3000 | xargs kill -9
```

### Issue: Changes to API code not reflecting

**Solution**: API functions have caching. Restart the API server (Terminal 2):
```bash
# Stop (Ctrl+C)
npm run dev:api
```

---

## Development Workflow

### 1. Start Development

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run dev:api
```

### 2. Make Code Changes

- **Frontend** (`index.tsx`): Auto-reloads instantly via HMR
- **API** (`api/*.ts`): Restart Terminal 2 (`Ctrl+C` → `npm run dev:api`)
- **Database** (`db/schema.ts`): Restart Terminal 2

### 3. Test API Endpoints

```bash
# Test database connection
curl http://localhost:3000/api/db-test

# Test Gemini AI endpoint (existing)
curl http://localhost:3000/api/analyze \
  -X POST \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"test\"}"
```

### 4. View Logs

- **Frontend logs**: Browser Developer Tools → Console
- **API logs**: Terminal 2 output (Vercel Dev)

---

## Production Deployment

### Deploy to Vercel

```bash
# Deploy preview
vercel

# Deploy to production
vercel --prod
```

### Environment Variables for Production

Set in Vercel Dashboard (Settings → Environment Variables):
- `GEMINI_API_KEY`
- `MIGRATION_TOKEN`
- Database variables (auto-added when you created Postgres DB)

---

## Next Steps After Setup

1. ✅ Test database connection (`/api/db-test`)
2. ✅ Run migration (`/api/migrate`)
3. 🔲 Create seed data script for 172 patterns
4. 🔲 Build CRUD API endpoints
5. 🔲 Update frontend to use database instead of localStorage

---

## Quick Reference

### NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite frontend (port 3000) |
| `npm run dev:api` | Start Vercel API server (port 3001) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/db-test` | GET | Test database connection |
| `/api/migrate` | POST | Create database tables (requires token) |
| `/api/analyze` | POST | AI extraction with Gemini (existing) |

### Ports

| Port | Service |
|------|---------|
| 3000 | Vite Dev Server (frontend + API proxy) |
| 3001 | Vercel Dev Server (serverless functions) |

---

## Resources

- [Vercel CLI Docs](https://vercel.com/docs/cli)
- [Vercel Dev Command](https://vercel.com/docs/cli/dev)
- [Vercel Postgres Docs](https://vercel.com/docs/storage/vercel-postgres)
- [Vite Proxy Config](https://vitejs.dev/config/server-options.html#server-proxy)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
