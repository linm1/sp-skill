# Clerk Webhook Setup Guide

This guide shows you how to configure Clerk webhooks to automatically sync users to your database.

## Why Use Webhooks?

**Before (JIT Provisioning):**
- User logs in → Frontend calls API → API tries to create user → Sometimes fails
- Error-prone, depends on API calls
- User must trigger API request first

**After (Webhooks):**
- User signs up in Clerk → Clerk calls your webhook → User created in DB automatically
- Happens in background, transparent to user
- More reliable, Clerk handles retries

---

## Step 1: Get Your Webhook Endpoint URL

### For Local Development:
Use a tunneling service to expose your local server:

**Option A: ngrok (Recommended)**
```bash
# Install ngrok: https://ngrok.com/download
ngrok http 3001

# You'll get a URL like: https://abc123.ngrok.io
# Your webhook URL: https://abc123.ngrok.io/api/webhooks/clerk
```

**Option B: localtunnel**
```bash
npx localtunnel --port 3001
```

### For Production:
```
https://sp-skill.vercel.app/api/webhooks/clerk
```

---

## Step 2: Configure Webhook in Clerk Dashboard

1. **Go to Clerk Dashboard**
   - Visit: https://dashboard.clerk.com
   - Select your application (StatPatternHub)

2. **Navigate to Webhooks**
   - Click "Webhooks" in the left sidebar
   - Click "Add Endpoint"

3. **Configure Endpoint**
   - **Endpoint URL**:
     - Development: `https://your-ngrok-url.ngrok.io/api/webhooks/clerk`
     - Production: `https://sp-skill.vercel.app/api/webhooks/clerk`
   - **Description**: "User sync to database"

4. **Select Events** (check these boxes):
   - ✅ `user.created` - When a new user signs up
   - ✅ `user.updated` - When user updates their profile or metadata
   - ✅ `user.deleted` - When user is deleted (optional)

5. **Click "Create"**

6. **Copy the Signing Secret**
   - After creating, you'll see a "Signing Secret" like: `whsec_...`
   - **IMPORTANT**: Copy this secret!

---

## Step 3: Add Webhook Secret to Environment Variables

### Local Development:

**File**: `.env.local`

Add this line:
```
CLERK_WEBHOOK_SECRET=whsec_your_secret_here
```

### Production (Vercel):

1. Go to Vercel Dashboard: https://vercel.com
2. Select your project: sp-skill
3. Go to Settings → Environment Variables
4. Add new variable:
   - **Name**: `CLERK_WEBHOOK_SECRET`
   - **Value**: `whsec_your_secret_here`
   - **Environment**: Production (and Preview if you want)
5. Click "Save"
6. **Redeploy** your app for changes to take effect

---

## Step 4: Test the Webhook

### Test 1: Create a New User

1. **Sign up a new test account** in your app
   - Go to http://localhost:3000 (or production URL)
   - Click "Sign Up"
   - Create a new account with a different email

2. **Check Clerk Dashboard → Webhooks**
   - Should see a successful delivery (green checkmark)
   - Click on the event to see request/response

3. **Check Your Database**
   - Query: `SELECT * FROM users;`
   - Should see the new user with correct `clerk_id`

### Test 2: Update User Metadata (Role Change)

1. **Go to Clerk Dashboard → Users**
2. **Select a user**
3. **Scroll to "Public metadata"**
4. **Click "Edit"**
5. **Add/update role**:
   ```json
   {
     "role": "admin"
   }
   ```
6. **Click "Save"**

7. **Check database**:
   - User's role should be updated to "admin"

### Test 3: Manual Webhook Trigger

In Clerk Dashboard → Webhooks:
1. Click on your endpoint
2. Click "Testing" tab
3. Select event type: `user.created`
4. Click "Send Example"
5. Check if it appears in your database

---

## Step 5: Verify in Your Application

1. **Log out** of your app
2. **Log back in** with the test account
3. **Try to edit a pattern** (if admin role)
4. Should work! No more JIT provisioning errors

---

## Troubleshooting

### Webhook Not Firing

**Check Clerk Dashboard:**
- Go to Webhooks → Your endpoint
- Look at "Recent Deliveries"
- Any red X marks? Click to see error details

**Common Issues:**
- ❌ Wrong URL (typo in endpoint)
- ❌ Webhook secret mismatch
- ❌ Server not reachable (firewall, ngrok stopped)

### Signature Verification Failed

**Error**: `Invalid signature`

**Solution:**
- Double-check `CLERK_WEBHOOK_SECRET` in `.env.local`
- Make sure it matches exactly (including `whsec_` prefix)
- Restart your dev server after adding the secret

### User Not Created in Database

**Check logs:**
```bash
# In your terminal where dev:api is running
# You should see:
# "Received Clerk webhook: user.created"
# "Creating user in database: { clerkId: '...', email: '...', ... }"
# "User created successfully: { id: 2, ... }"
```

**If no logs:**
- Webhook not reaching your server
- Check ngrok is running
- Check URL in Clerk matches ngrok URL

**If error logs:**
- Database connection issue
- Check `POSTGRES_URL` in `.env.local`
- Check users table exists

---

## Production Deployment Checklist

Before deploying webhooks to production:

- ✅ Add `CLERK_WEBHOOK_SECRET` to Vercel environment variables
- ✅ Deploy your app with the webhook endpoint
- ✅ Update Clerk webhook URL to production URL
- ✅ Test with a real signup in production
- ✅ Monitor webhook deliveries in Clerk dashboard
- ✅ Check production database for new users

---

## Security Notes

1. **Always verify webhook signatures**
   - The webhook endpoint verifies signatures using `svix` library
   - Never skip signature verification in production

2. **Use HTTPS**
   - Webhooks must use HTTPS in production
   - Vercel automatically provides HTTPS

3. **Rate limiting**
   - Clerk handles retries automatically
   - Your endpoint should be idempotent (safe to call multiple times)

4. **Logging**
   - Webhook endpoint logs all events for debugging
   - Check Vercel logs for production issues

---

## What Happens Now

**User Signup Flow:**
```
1. User signs up via Clerk UI
2. Clerk creates user account
3. Clerk triggers webhook: user.created
4. Your endpoint receives webhook
5. Endpoint creates user in database
6. User can immediately use the app (already in DB)
```

**Role Management:**
```
1. Admin updates user role in Clerk (public metadata)
2. Clerk triggers webhook: user.updated
3. Your endpoint updates user role in database
4. User's new role is active immediately
```

---

## Removing JIT Provisioning (Optional)

Once webhooks are working, you can remove the JIT provisioning code from `lib/auth.ts`:

**Keep:**
- User lookup by `clerk_id`
- Return user object

**Remove:**
- User creation logic (webhooks handle this)
- Error handling for duplicate keys (not needed)

This simplifies your code and makes it more reliable.

---

## Need Help?

- **Clerk Webhooks Docs**: https://clerk.com/docs/integrations/webhooks/overview
- **Svix (Webhook library)**: https://docs.svix.com/receiving/verifying-payloads/how
- **Vercel Environment Variables**: https://vercel.com/docs/environment-variables

---

**Once webhooks are set up, user synchronization will be automatic and reliable!**
