# Clerk Authentication Setup Guide

## Overview

StatPatternHub uses [Clerk](https://clerk.com) for user authentication. This guide will walk you through setting up Clerk for local development and production deployment.

## Step 1: Create a Clerk Account

1. Go to [https://clerk.com](https://clerk.com)
2. Click "Start Building for Free" or "Sign Up"
3. Sign up using your preferred method (Google, GitHub, or email)

## Step 2: Create a New Application

1. Once logged in, you'll be prompted to create a new application
2. Give your application a name (e.g., "StatPatternHub")
3. Select your preferred sign-in methods:
   - **Recommended for development**: Email, Google, GitHub
   - You can change these later in the application settings
4. Click "Create Application"

## Step 3: Get Your Publishable Key

1. After creating the application, you'll be taken to the dashboard
2. Click on "API Keys" in the left sidebar
3. Copy the **Publishable Key** (starts with `pk_test_...` for development)
   - **Important**: Do NOT copy the Secret Key for frontend use
4. The publishable key is safe to use in frontend code

## Step 4: Configure Local Environment

1. Open the `.env.local` file in the project root
2. Replace `your_clerk_publishable_key_here` with your actual publishable key:

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

3. Save the file
4. **Never commit `.env.local` to git** - it's already in `.gitignore`

## Step 5: Start the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Step 6: Test Authentication

1. Open the application in your browser
2. Click "Sign Up" in the navigation bar
3. Create a test account using email or social login
4. Verify you can:
   - Sign up successfully
   - See your name in the navigation
   - Click on the user button to see account options
   - Sign out
   - Sign back in

## Production Deployment (Vercel)

### Option 1: Vercel Dashboard (Recommended)

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new environment variable:
   - **Name**: `VITE_CLERK_PUBLISHABLE_KEY`
   - **Value**: Your production publishable key (starts with `pk_live_...`)
   - **Environment**: Production (and optionally Preview)
4. Click "Save"
5. Redeploy your application

### Option 2: Vercel CLI

```bash
vercel env add VITE_CLERK_PUBLISHABLE_KEY
# Paste your production publishable key when prompted
# Select "Production" environment
```

### Getting Production Keys

1. In Clerk dashboard, go to **API Keys**
2. Toggle from "Development" to "Production" mode
3. Copy the **Production Publishable Key** (starts with `pk_live_...`)
4. Use this key in your Vercel production environment

## Features Enabled

Once Clerk is configured, the following features are active:

### For All Users
- Sign up with email or social providers
- Sign in / Sign out
- View profile via UserButton
- Secure session management

### For Authenticated Users
- Contribute new pattern implementations
- Edit their own contributions
- Access premium patterns (when roles are implemented)

### Admin Features (Future)
- Approve/reject contributions
- Manage users
- Access analytics

## Customizing Clerk

### Appearance

You can customize the appearance of Clerk components in the code. Example in `index.tsx`:

```tsx
<UserButton
  appearance={{
    elements: {
      avatarBox: "w-8 h-8",
      userButtonPopoverCard: "shadow-xl"
    }
  }}
/>
```

### Sign-in Methods

To add or remove sign-in methods:

1. Go to Clerk Dashboard → **User & Authentication** → **Email, Phone, Username**
2. Toggle the methods you want to enable/disable
3. Configure social providers under **Social Connections**

### User Metadata

To store additional user data (like role, subscription tier):

1. Go to **User & Authentication** → **Metadata**
2. Add custom fields (e.g., `role`, `subscription`)
3. Access in code via `user.publicMetadata` or `user.privateMetadata`

## Troubleshooting

### "Missing VITE_CLERK_PUBLISHABLE_KEY" Error

- Check that `.env.local` exists and contains the key
- Restart the dev server after adding environment variables
- Ensure the key starts with `pk_test_` or `pk_live_`

### Sign-in Modal Not Appearing

- Check browser console for errors
- Verify Clerk is properly initialized with `ClerkProvider`
- Make sure the publishable key is valid

### User Button Not Showing

- User must be signed in for `<UserButton />` to appear
- Check `isSignedIn` state using `useAuth()` hook

### Production Deployment Issues

- Verify production publishable key is set in Vercel
- Check that you're using `pk_live_...` not `pk_test_...` in production
- Ensure environment variable name matches exactly: `VITE_CLERK_PUBLISHABLE_KEY`

## Security Best Practices

✅ **DO**:
- Use publishable keys in frontend code
- Store secret keys only in backend/server environments
- Use different keys for development and production
- Keep `.env.local` in `.gitignore`

❌ **DON'T**:
- Commit API keys to version control
- Use secret keys in frontend code
- Share keys in public forums or screenshots
- Use production keys in development

## Next Steps

After Clerk is working:

1. **Backend Integration**: Add Clerk webhook handlers for user events
2. **Role-Based Access**: Implement role-based authorization using Clerk metadata
3. **Backend API Protection**: Use Clerk's JWT verification in API routes
4. **User Profiles**: Add user profile pages showing contribution history

## Resources

- [Clerk Documentation](https://clerk.com/docs)
- [Clerk React SDK](https://clerk.com/docs/references/react/overview)
- [Clerk + Vite Guide](https://clerk.com/docs/quickstarts/vite)
- [Environment Variables in Vite](https://vitejs.dev/guide/env-and-mode.html)

## Support

- Clerk Support: [https://clerk.com/support](https://clerk.com/support)
- Clerk Discord: [https://clerk.com/discord](https://clerk.com/discord)
- StatPatternHub Issues: GitHub Issues (when available)
