# Clerk Authentication Backend Testing Guide

## Setup Complete ✅

The following has been implemented:

1. ✅ `@clerk/backend` package installed (v2.29.0)
2. ✅ `/lib/auth.ts` created with helper functions
3. ✅ `/api/auth/me.ts` endpoint implemented
4. ✅ Database schema updated with `clerkId` field
5. ✅ Default role changed from 'guest' to 'contributor'
6. ✅ Migration scripts created

## Files Created/Modified

### New Files
- `/lib/auth.ts` - Authentication helper functions
- `/api/auth/me.ts` - User profile endpoint
- `/api/migrate-clerk.ts` - Clerk column migration endpoint
- `/scripts/add-clerk-id-migration.sql` - SQL migration script

### Modified Files
- `/db/schema.ts` - Added `clerkId` field to users table
- `/scripts/create-tables.sql` - Updated schema with clerk_id
- `/.env.local` - Added CLERK_SECRET_KEY placeholder
- `/package.json` - Added @clerk/backend dependency

## Environment Variables Required

Add to `.env.local`:

```bash
CLERK_SECRET_KEY=sk_test_your_actual_clerk_secret_key_here
```

Get this from: [Clerk Dashboard](https://dashboard.clerk.com) → API Keys → Secret Key

## Database Migration

Before testing, run the migration to add `clerk_id` column to existing database:

```bash
curl -X POST http://localhost:3000/api/migrate-clerk \
  -H "x-migration-token: sp-skill-secure-token-2025"
```

Expected response:
```json
{
  "success": true,
  "message": "clerk_id column added successfully",
  "timestamp": "2025-12-26T..."
}
```

## Testing Instructions

### 1. Start Development Server

```bash
npm run dev:api
# Server runs on http://localhost:3001
```

### 2. Test Without Authentication (Should Fail)

```bash
curl http://localhost:3001/api/auth/me
```

**Expected Response:**
```json
{
  "error": "Unauthorized"
}
```

**Status Code:** 401

### 3. Test With Invalid Token (Should Fail)

```bash
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer invalid_token_here"
```

**Expected Response:**
```json
{
  "error": "Unauthorized"
}
```

**Status Code:** 401

### 4. Test With Valid Clerk Token (Should Succeed)

**Step 1: Get a Clerk JWT Token**

Option A - From Frontend (recommended):
1. Sign in to the app at http://localhost:3000
2. Open browser DevTools → Console
3. Run: `await window.Clerk.session.getToken()`
4. Copy the token

Option B - Manual via Clerk Dashboard:
1. Go to Clerk Dashboard → JWT Templates
2. Create a test token

**Step 2: Test the endpoint**

```bash
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer <paste_token_here>"
```

**Expected Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "contributor",
    "createdAt": "2025-12-26T..."
  }
}
```

**Status Code:** 200

### 5. Test JIT (Just-In-Time) User Provisioning

**Scenario:** New user signs up via Clerk UI

1. Sign up a brand new user at http://localhost:3000
2. Call `/api/auth/me` with that user's token
3. Verify:
   - User is created in database
   - Default role is "contributor"
   - `clerkId` field is populated

**Check database:**
```bash
curl http://localhost:3001/api/list-tables
# Look for the new user in the users table
```

### 6. Test Role-Based Access (Future)

The helper functions `requireAuth()` and `requireRole()` are ready for use in protected endpoints:

```typescript
import { requireAuth, requireRole } from '../../lib/auth.js';

// Require any authenticated user
export default requireAuth(async (req, res) => {
  const user = req.user; // Available after auth
  // ... your handler code
});

// Require specific role
export default requireRole('admin', async (req, res) => {
  const user = req.user; // Available after auth, guaranteed to be admin
  // ... your handler code
});
```

## Common Issues & Troubleshooting

### Issue: "CLERK_SECRET_KEY not configured"

**Solution:** Make sure `.env.local` has the correct secret key:
```bash
CLERK_SECRET_KEY=sk_test_...
```

### Issue: Token verification fails

**Possible causes:**
1. Token expired (Clerk tokens expire after 1 hour by default)
2. Wrong secret key in environment
3. Token from different Clerk app

**Solution:** Generate a fresh token from the frontend

### Issue: User not created in database

**Check:**
1. Database migration ran successfully
2. PostgreSQL connection is working
3. Check logs for SQL errors

### Issue: 500 Internal Server Error

**Debug:**
1. Check server logs: `npm run dev:api` output
2. Verify database schema is up to date
3. Ensure all imports are correct (.js extensions in TypeScript)

## API Response Format Reference

### Success Response (200)
```json
{
  "success": true,
  "user": {
    "id": number,
    "email": string,
    "name": string,
    "role": "guest" | "contributor" | "premier" | "admin",
    "createdAt": string (ISO 8601)
  }
}
```

### Unauthorized (401)
```json
{
  "error": "Unauthorized"
}
```

### Forbidden (403)
```json
{
  "error": "Forbidden"
}
```

### Method Not Allowed (405)
```json
{
  "error": "Method not allowed"
}
```

## Integration with Frontend

Frontend team can now:

1. **Get current user profile:**
```typescript
const token = await clerk.session.getToken();
const response = await fetch('/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
```

2. **Add auth to API requests:**
```typescript
async function authenticatedFetch(url: string, options: RequestInit = {}) {
  const token = await clerk.session.getToken();
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  });
}
```

## Next Steps (Day 3)

With authentication working, you can now:

1. ✅ Protect pattern submission endpoints with `requireAuth()`
2. ✅ Implement `/api/patterns/submit` for contributors
3. ✅ Add role-based access for premium patterns
4. ✅ Enable user-specific pattern history

## Security Notes

- ✅ API key never exposed to client (server-side only)
- ✅ JWT tokens verified with Clerk SDK
- ✅ JIT provisioning prevents orphaned users
- ✅ Role-based access control implemented
- ✅ Migration endpoints protected by token

## Coordination Points

**Frontend needs to know:**
- Endpoint: `GET /api/auth/me`
- Header: `Authorization: Bearer <clerk-jwt>`
- Token source: `await clerk.session.getToken()`
- Response format: See reference above
- Error codes: 401 (Unauthorized), 403 (Forbidden), 405 (Method not allowed)

**Backend ready for:**
- Story 4: Pattern contribution submission (Day 3)
- Protected API endpoints
- Role-based feature access
- User-specific data queries
