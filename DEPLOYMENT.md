# Deployment Guide - StatPatternHub

## Overview

This document covers deployment procedures for StatPatternHub, including database migrations, environment configuration, and deployment verification.

---

## Database Migration Safety

### Pre-Deployment Verification

Before every deployment, the database schema is **automatically verified** to prevent runtime errors caused by schema mismatches.

**Verification Process:**
1. `npm run db:verify` runs before build
2. If schema mismatch detected → Deployment fails immediately
3. Developer must run `npm run db:push` to apply migrations
4. Re-deploy after schema is updated

### Manual Verification

```bash
npm run db:verify
```

**Expected Output:**
```
✅ Migration verification PASSED
   Database schema is up to date!
```

### Apply Migrations

```bash
npm run db:push
```

### View Current Schema

```bash
npm run db:studio
```

Opens Drizzle Studio at http://localhost:4983

---

## Troubleshooting

### Error: "Database schema verification failed"

**Cause:** Local schema (`db/schema.ts`) doesn't match production database schema.

**Solution:**
1. Run `npm run db:verify` locally to confirm mismatch
2. Review pending migrations in `drizzle/` folder
3. Run `npm run db:push` to apply migrations
4. Verify locally: `npm run db:verify`
5. Re-deploy after confirming schema matches

**Prevention:**
- Always run `npm run db:push` after modifying `db/schema.ts`
- Test schema changes locally before deploying
- Use `npm run db:studio` to inspect database structure

---

## Environment Variables

### Required Variables (Vercel Dashboard)

```bash
# Database
POSTGRES_URL=postgresql://user:password@host:port/database

# Authentication
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...
VITE_CLERK_PUBLISHABLE_KEY=pk_...

# AI Integration
GEMINI_API_KEY=AIzaSy...

# Email Service
RESEND_API_KEY=re_...
ADMIN_EMAIL=admin@example.com

# Redis Cache (Vercel KV - automatically attached)
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...
```

### Local Development

Create `.env.local` (gitignored):

```bash
# Option 1: Pull from Vercel (Recommended)
vercel env pull .env.local

# Option 2: Manual setup
# Copy the environment variables above to .env.local
```

---

## Deployment Process

### Automatic Deployment (Recommended)

Push to `main` branch triggers automatic Vercel deployment:

```bash
git checkout main
git merge your-branch
git push origin main
```

**Deployment Steps (Automatic):**
1. Vercel detects push to main
2. Runs `npm install`
3. Runs `npm run db:verify` (validates schema)
4. Runs `vite build` (compiles frontend + API)
5. Deploys to production

### Manual Deployment

```bash
# Login to Vercel CLI
vercel login

# Deploy to production
vercel --prod
```

---

## Verification Checklist

### Post-Deployment Checks

After successful deployment:

- [ ] Visit production URL: https://sp-skill.vercel.app
- [ ] Check build logs in Vercel Dashboard
- [ ] Verify API endpoints respond:
  - `/api/patterns` (pattern catalog)
  - `/api/implementations` (implementations list)
  - `/api/extract-code` (AI extraction - requires auth)
- [ ] Test authentication (Clerk login)
- [ ] Verify database queries return data
- [ ] Check error logs for any issues

### Rollback Procedure

If deployment fails or introduces bugs:

1. **Vercel Dashboard** → Deployments → Previous deployment → Promote to Production
2. Or revert Git commit:
   ```bash
   git revert HEAD
   git push origin main
   ```

---

## Build Configuration

### Vercel Build Settings

**File:** `vercel.json`

```json
{
  "buildCommand": "npm run db:verify && vite build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

**Key Points:**
- `db:verify` runs BEFORE build (fails deployment if schema mismatch)
- `vite build` compiles React frontend and API functions
- Output directory: `dist/`

### Build Optimization

**Production Build:**
- Tree-shaking (removes unused code)
- Minification (reduces bundle size)
- Code splitting (lazy-loaded routes)

**Current Bundle Size:**
- `index.html`: 0.79 KB (gzip: 0.45 KB)
- `index.css`: 33.63 KB (gzip: 6.54 KB)
- `index.js`: 475.84 KB (gzip: 133.10 KB)

---

## Monitoring & Logging

### Vercel Logs

Access logs in Vercel Dashboard:
- **Runtime Logs:** API function executions
- **Build Logs:** Deployment process
- **Error Logs:** Runtime errors and exceptions

### Key Metrics to Monitor

- **API Response Times:** Should be < 200ms (with cache)
- **Rate Limit Hits:** Monitor `X-RateLimit-*` headers
- **Error Rates:** Should be < 1% of requests
- **Database Query Times:** Should be < 100ms

---

## Common Issues

### Issue 1: "Module not found" errors

**Cause:** Missing dependencies or incorrect import paths

**Solution:**
```bash
npm install
npm run build
```

### Issue 2: Environment variables not loading

**Cause:** Variables not configured in Vercel Dashboard

**Solution:**
1. Vercel Dashboard → Settings → Environment Variables
2. Add missing variables
3. Redeploy

### Issue 3: Database connection fails

**Cause:** Incorrect `POSTGRES_URL` or firewall rules

**Solution:**
1. Verify `POSTGRES_URL` format
2. Check database firewall allows Vercel IPs
3. Test connection: `npm run db:verify`

---

## Security Considerations

### API Keys
- Never commit API keys to Git
- Store in Vercel environment variables
- Use different keys for staging/production

### Database Access
- Use read-only credentials where possible
- Rotate database passwords regularly
- Enable SSL connections (included in `POSTGRES_URL`)

### Rate Limiting
- Monitor rate limit abuse patterns
- Adjust limits in `lib/constants.ts` if needed
- Alert on frequent 429 responses

---

## Support & Resources

- **Vercel Documentation:** https://vercel.com/docs
- **Project Repository:** [GitHub link]
- **Support:** [Team Slack/Email]

---

*Last Updated: 2026-01-09*
*Sprint 005 - Phase 3*
