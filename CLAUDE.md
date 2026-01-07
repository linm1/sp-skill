# StatPatternHub - Project Guide

## Project Overview

**StatPatternHub** is a knowledge management platform and ETL engine for clinical programming patterns. It aggregates, standardizes, and serves SAS and R code patterns for clinical statistical programmers, data scientists, and AI coding agents.

The system functions as a **Data Warehouse for code logic** - ingesting unstructured data (blogs, scripts, documentation) and transforming it into a strict **Agent Skill-Compliant** Markdown structure.

## Tech Stack

- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite 6
- **Backend**: Vercel Serverless Functions (Node.js)
- **AI Integration**: Google Gemini API (`@google/genai`) - server-side only
- **Styling**: Tailwind CSS v4 (CSS-based configuration via `@theme` directive)
- **Icons**: Font Awesome (CDN)
- **Deployment**: Vercel (https://sp-skill.vercel.app/)

## Tailwind CSS v4 Configuration

This project uses **Tailwind CSS v4**, which has a different configuration system than v3:

### Key Differences from v3
- **v4 uses CSS-based configuration** via the `@theme` directive in `index.css`
- **v3-style `tailwind.config.js` is ignored** (kept for compatibility but not used)
- All design tokens (colors, shadows, fonts) are defined in CSS using CSS variables

### Configuration Location
All Tailwind customization is in **`index.css`** using the `@theme` block:

```css
@theme {
  --color-canvas: #F4EFEA;
  --color-ink: #383838;
  --color-duck-yellow: #FFD700;
  /* ... more custom tokens */
}
```

### Design System
The complete design system is documented in `style.md` (Neo-Brutalist aesthetic):
- High contrast borders (1px solid black)
- Sharp edges (0px border-radius)
- Hard drop shadows (offset without blur)
- Custom color palette: canvas, ink, duck-yellow, link-blue, terminal-red, terminal-green
- Typography: Aeonik Mono (headers) + Inter (body text)

### Important Notes
- **Do not add configuration to `tailwind.config.js`** - it will be ignored
- All custom classes like `text-ink`, `bg-canvas`, `shadow-brutal` are generated from the `@theme` block
- If custom colors/styles aren't applying, check `index.css` `@theme` section
- The Vite plugin (`@tailwindcss/vite`) automatically processes the CSS configuration

## Quick Start

```bash
npm install
npm run dev        # Starts frontend dev server on http://localhost:3000
npm run dev:api    # Starts backend API server on http://localhost:3001
npm run build      # Production build

# Database operations
npm run db:push    # Push schema to database (apply migrations)
npm run db:verify  # Verify database schema is up to date
npm run db:studio  # Open Drizzle Studio (database GUI)
```

### Environment Setup

**Local Development**: Create `.env.local` (not committed to git):
```bash
# Database (required for backend API)
POSTGRES_URL=postgresql://user:password@host:port/database

# AI Integration (required for pattern extraction)
GEMINI_API_KEY=your_gemini_api_key_here

# Authentication (required for user management)
CLERK_SECRET_KEY=your_clerk_secret_key_here
CLERK_WEBHOOK_SECRET=your_clerk_webhook_secret_here
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key_here

# Email Service (required for admin notifications)
RESEND_API_KEY=your_resend_api_key_here
ADMIN_EMAIL=admin@example.com

# Redis Cache (automatically attached by Vercel KV)
KV_REST_API_URL=your_vercel_kv_url
KV_REST_API_TOKEN=your_vercel_kv_token
```

**Getting Environment Variables:**
- **Option 1 (Recommended for Team):** Pull from Vercel project:
  ```bash
  vercel env pull .env.local
  ```

- **Option 2 (Individual Setup):** Manually create `.env.local` and add each variable

**Production (Vercel)**: Set all environment variables in Vercel Dashboard → Settings → Environment Variables

**Important Notes:**
- `.env.local` is gitignored and never committed
- The `dev:api` script uses `dotenv-cli` to ensure environment variables are loaded correctly
- Frontend (Vite) auto-loads `.env.local` variables prefixed with `VITE_`
- Backend API requires explicit env loading (handled by npm script)

## Project Structure

```
sp-skill/
├── CLAUDE.md               # This file - project guide
├── DEPLOYMENT.md           # Production deployment guide
├── index.html              # Entry HTML
├── index.tsx               # Main React application (single-file architecture)
├── index.css               # Tailwind CSS v4 configuration (@theme directive)
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite build configuration
├── vercel.json             # Vercel deployment configuration
├── tailwind.config.js      # Empty (v4 uses CSS config, not JS)
├── style.md                # Complete design system documentation
├── metadata.json           # App metadata
├── api/                    # Serverless functions
│   ├── analyze.ts          # Gemini API integration
│   ├── patterns.ts         # Pattern CRUD operations
│   └── implementations.ts  # Implementation CRUD operations
├── db/                     # Database layer
│   ├── index.ts            # Drizzle ORM instance
│   └── schema.ts           # Database schema definitions
├── drizzle/                # Database migrations
│   └── *.sql               # Migration files
├── lib/                    # Shared utilities
│   └── auth.ts             # Authentication helpers
└── scripts/                # Utility scripts
    └── verify-migration.ts # Database verification
```

## Security

### API Key Protection

The Gemini API key is **never exposed to the client**. All AI operations are handled server-side:

1. **Frontend** (`index.tsx`): Calls `/api/analyze` endpoint
2. **Serverless Function** (`api/analyze.ts`): Reads `GEMINI_API_KEY` from server environment
3. **Vercel Dashboard**: Store the API key in Environment Variables (Settings → Environment Variables)

### Secure API Architecture

```
┌─────────────────┐     POST /api/analyze      ┌──────────────────┐
│   Frontend      │ ─────────────────────────► │  Vercel Function │
│   (Browser)     │                            │  (Server-side)   │
│                 │ ◄───────────────────────── │                  │
│   No API Key    │     JSON response          │  GEMINI_API_KEY  │
└─────────────────┘                            └──────────────────┘
                                                        │
                                                        ▼
                                               ┌──────────────────┐
                                               │   Gemini API     │
                                               └──────────────────┘
```

### Security Best Practices

- **NEVER** expose API keys in client-side code or vite.config.ts
- **NEVER** commit `.env.local` or any file containing secrets
- Set `GEMINI_API_KEY` only in Vercel Dashboard for production
- The API endpoint validates input and limits request size (50KB max)

## Core Domain Concepts

### Data Model

The system uses an **Immutable Container + Mutable Content** architecture:

1. **PatternDefinition** (Immutable Container)
   - `id`: Pattern ID (e.g., `IMP-001`, `DER-020`)
   - `category`: Category code (e.g., `IMP`, `DER`, `DAT`)
   - `title`: Human-readable name
   - `problem`: What the pattern solves
   - `whenToUse`: Usage triggers/scenarios

2. **PatternImplementation** (Mutable Content)
   - `uuid`: Unique implementation ID
   - `patternId`: Links to PatternDefinition
   - `author`: Contributor name
   - `sasCode`: SAS implementation
   - `rCode`: R implementation
   - `considerations`: Edge cases/warnings
   - `variations`: Related patterns
   - `status`: `"active"` | `"pending"`
   - `isPremium`: Access tier flag

### Pattern Categories (14 total, 172 patterns)

| Code | Category | Count |
|------|----------|-------|
| IMP | Imputation | 14 |
| DER | Derivations | 25 |
| DAT | Date/Time | 12 |
| RSH | Reshaping | 10 |
| AGG | Aggregation | 12 |
| MRG | Merging | 12 |
| CAT | Categorization | 10 |
| FLG | Flagging | 10 |
| SRT | Sorting | 9 |
| FMT | Formatting | 15 |
| VAL | Validation | 10 |
| CDS | CDISC | 10 |
| STA | Statistics | 15 |
| OPT | Optimization | 8 |

### User Roles

- `guest`: Read-only access to free patterns
- `contributor`: Can create/edit patterns
- `premier`: Full access, API access, private forking
- `admin`: Approval authority

## Key Features

### 1. Pattern Catalog
Browse and search patterns by category or keyword.

### 2. Pattern Detail View
- View immutable definition (problem, when to use)
- Switch between implementation tabs (multiple authors)
- Select preferred implementation for export

### 3. Skill Basket
- Curate a collection of patterns for AI agent export
- Override system defaults with custom implementations
- Export as JSON for agent consumption

### 4. Smart ETL Form
- AI-powered extraction using Gemini API
- Paste raw text/documentation → auto-fills pattern fields
- Manual entry fallback

## Markdown Output Format (Agent Skill-Compliant)

All patterns must generate this exact structure:

```markdown
# [Pattern Name] ([Pattern ID])
Author: [Author Name]

## Problem
[Description of what the pattern solves]

## When to Use
[Specific scenarios and triggers]

## SAS Implementation
### Method 1
```sas
[SAS code]
```

## R Implementation
### Method 1
```r
[R code]
```

## Key Considerations
- [List of edge cases, dependencies, warnings]

## Common Variations
- [Related patterns or alternatives]
```

## Development Guidelines

### Code Style
- Single-file React architecture in `index.tsx`
- Functional components with hooks
- TypeScript strict mode
- Tailwind CSS for styling (no separate CSS files)

### Component Structure
- `Layout`: Navigation and page wrapper
- `Catalog`: Pattern grid with filtering
- `PatternCard`: Clickable pattern preview
- `PatternDetail`: Full pattern view with tabs
- `SmartEtlForm`: Create/edit implementation form
- `BasketView`: Export curation interface

### State Management
- React `useState` for local state
- `useMemo` for derived/computed values
- Props for data flow between components

### Important Patterns
- Pattern IDs follow format: `{CATEGORY}-{3-digit-number}` (e.g., `IMP-002`)
- System implementations have author = `"System"`
- Basket maps Pattern IDs to Implementation UUIDs

## Development Roadmap (Per PRD)

### Phase 1: Foundation (MVP) - Current
- Manual form input
- Basic search by category
- Markdown preview generation

### Phase 2: Smart ETL & Storage
- AI-powered ingestion from URLs/text
- built up storage for system patterns / contributor's patterns. 


### Phase 3: Agent Integration
- REST API for pattern retrieval
- Claude Skill folder export
- Private pattern forking

### Phase 4: Enterprise
- GitHub/GitLab integration
- Organization subscriptions
- Usage analytics

## API Design (Future)

```
GET /api/v1/agent/context?query="Need to impute missing dates"
```

Response: Vector search → relevant patterns → formatted Markdown

## Testing

Currently no test framework configured. Future additions should include:
- Unit tests for data transformations
- Component tests for UI
- Integration tests for AI extraction

## Common Tasks

### Adding a New Pattern Category
1. Add to `CATEGORIES` array in `index.tsx`
2. Add pattern slugs to `MANIFEST_DATA`
3. Patterns auto-generate with placeholder content

### Pre-loading Pattern Content
Add entries to `PRELOADED_CONTENT` object with pattern ID as key.

### Modifying Pattern Template
Update `generateMarkdown()` function to change output format.

## Troubleshooting

### Custom Tailwind Colors Not Applying

**Symptom**: Classes like `text-ink`, `bg-canvas`, `shadow-brutal` render with default colors instead of custom values. UI elements may have invisible text or wrong colors.

**Cause**: Tailwind CSS v4 uses CSS-based configuration, not JavaScript config files.

**Solution**:
1. Ensure all custom tokens are defined in `index.css` within the `@theme` block:
   ```css
   @theme {
     --color-ink: #383838;
     --color-canvas: #F4EFEA;
     /* ... more tokens */
   }
   ```
2. Do NOT add configuration to `tailwind.config.js` - it's ignored in v4
3. Restart the dev server after modifying `index.css`
4. Verify in browser console:
   ```js
   const test = document.createElement('div');
   test.className = 'text-ink';
   document.body.appendChild(test);
   getComputedStyle(test).color; // Should be "rgb(56, 56, 56)"
   ```

**Reference**: See the "Tailwind CSS v4 Configuration" section above for complete details.

## External Resources

- [SKILL_MANIFEST.md](./docs/SKILL_MANIFEST.md) - Full folder structure reference
- [style.md](./style.md) - Complete design system & style guide
- Google AI Studio: https://ai.studio/apps/drive/1Z1tYsu-VI85piqEJB8VTMMsFHCKgyng3
