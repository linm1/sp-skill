<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# StatPatternHub - Clinical Programming Pattern Library

A knowledge management platform and ETL engine for clinical programming patterns. Aggregates, standardizes, and serves SAS and R code patterns for clinical statistical programmers, data scientists, and AI coding agents.

**Live Demo**: https://sp-skill.vercel.app/

View in AI Studio: https://ai.studio/apps/drive/1Z1tYsu-VI85piqEJB8VTMMsFHCKgyng3

## Features

- **Pattern Catalog**: Browse 172+ SAS/R code patterns across 14 categories (Imputation, Derivations, CDISC, etc.)
- **Smart ETL**: AI-powered pattern extraction using Google Gemini
- **Skill Basket**: Curate and export patterns as Agent-compatible skill packages
- **User Authentication**: Secure sign-up/sign-in with Clerk
- **Contribution System**: Authenticated users can submit alternative implementations

## Quick Start

**Prerequisites**: Node.js 18+

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:

   Create a `.env.local` file in the project root:
   ```bash
   # Clerk Authentication (Required for user sign-up/sign-in)
   VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key_here

   # Google Gemini API (Required for AI pattern extraction)
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Set up Clerk authentication**:
   - Go to [https://clerk.com](https://clerk.com) and create a free account
   - Create a new application
   - Copy your **Publishable Key** (starts with `pk_test_...`)
   - Paste it into `.env.local`

   📖 See detailed instructions in [CLERK_SETUP.md](./CLERK_SETUP.md)

4. **Get Gemini API key** (optional, for AI features):
   - Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Create an API key
   - Add it to `.env.local`

5. **Run the development server**:
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
sp-skill/
├── index.tsx           # Main React application (single-file architecture)
├── index.html          # Entry HTML
├── package.json        # Dependencies and scripts
├── vite.config.ts      # Vite build configuration
├── vercel.json         # Vercel deployment configuration
├── .env.local          # Environment variables (not committed)
├── CLAUDE.md           # Project guide and architecture documentation
├── CLERK_SETUP.md      # Detailed Clerk authentication setup guide
└── api/
    └── analyze.ts      # Serverless function for Gemini API calls
```

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite 6
- **Styling**: Tailwind CSS (inline classes)
- **Authentication**: Clerk (user management & sessions)
- **AI**: Google Gemini API (server-side pattern extraction)
- **Backend**: Vercel Serverless Functions
- **Deployment**: Vercel

## Available Scripts

```bash
npm run dev      # Start development server (port 3000)
npm run build    # Build for production
npm run preview  # Preview production build locally
```

## Authentication Features

- **Guest Users**: Read-only access to pattern catalog
- **Authenticated Users**:
  - Contribute alternative implementations
  - Save basket preferences (coming soon)
  - Access premium patterns (coming soon)
- **Admin Users**:
  - Approve/reject contributions (coming soon)
  - Manage patterns and users (coming soon)

## Documentation

- **[CLAUDE.md](./CLAUDE.md)**: Complete project guide, architecture, and development guidelines
- **[CLERK_SETUP.md](./CLERK_SETUP.md)**: Step-by-step Clerk authentication setup
- **[SPRINT1_FRONTEND_REPORT.md](./SPRINT1_FRONTEND_REPORT.md)**: Sprint 1 completion report

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import project in [Vercel Dashboard](https://vercel.com/new)
3. Add environment variables:
   - `VITE_CLERK_PUBLISHABLE_KEY` (production key from Clerk)
   - `GEMINI_API_KEY` (from Google AI Studio)
4. Deploy!

### Environment Variables for Production

In Vercel Dashboard → Settings → Environment Variables:
- Use **production** Clerk key (starts with `pk_live_...`)
- Add all environment variables to "Production" environment

## Security

- **API keys are never exposed** to the client
- Gemini API calls happen server-side via `/api/analyze`
- Clerk handles all authentication securely
- `.env.local` is excluded from version control

## Development Status

**Sprint 1 - Priority 1**: ✅ Complete
- Clerk authentication integrated
- Sign up, sign in, sign out flows working
- Conditional UI for authenticated users

**Sprint 1 - Priority 2**: 🔄 In Progress
- Backend API integration
- Database persistence
- Contribution workflow

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

- Report issues on GitHub Issues
- See [CLERK_SETUP.md](./CLERK_SETUP.md) for authentication troubleshooting
- Check [CLAUDE.md](./CLAUDE.md) for development guidelines

## License

MIT License - See LICENSE file for details

---

Built with ❤️ for clinical statistical programmers
