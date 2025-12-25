<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1Z1tYsu-VI85piqEJB8VTMMsFHCKgyng3

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   - Copy `.env.local.example` to `.env.local`
   - Set `VITE_CLERK_PUBLISHABLE_KEY` to your Clerk publishable key (get it from [Clerk Dashboard](https://dashboard.clerk.com))
   - Set `GEMINI_API_KEY` to your Gemini API key (for Smart ETL feature)

3. Run the app:
   ```bash
   npm run dev
   ```

## Authentication Setup

This app uses [Clerk](https://clerk.com) for authentication. To set up:

1. Create a free account at [clerk.com](https://clerk.com)
2. Create a new application in the Clerk Dashboard
3. Copy your **Publishable Key** from the Clerk Dashboard
4. Add it to your `.env.local` file as `VITE_CLERK_PUBLISHABLE_KEY`

### User Roles

User roles are stored in Clerk's `publicMetadata` field. To assign roles:

1. Go to Clerk Dashboard → Users
2. Select a user
3. Click "Metadata"
4. Add to **Public Metadata**:
   ```json
   {
     "role": "contributor"
   }
   ```

Available roles:
- `guest` - Read-only access (default for new users)
- `contributor` - Can create and edit patterns
- `premier` - Full access including premium patterns
- `admin` - Approval authority and full access

## Deployment to Vercel

1. Push your code to GitHub
2. Import project in Vercel Dashboard
3. Add environment variables in Vercel:
   - `VITE_CLERK_PUBLISHABLE_KEY` - Your Clerk publishable key
   - `GEMINI_API_KEY` - Your Gemini API key
4. Deploy
