# StatPatternHub - Project Guide

## Project Overview

**StatPatternHub** is a knowledge management platform and ETL engine for clinical programming patterns. It aggregates, standardizes, and serves SAS and R code patterns for clinical statistical programmers, data scientists, and AI coding agents.

The system functions as a **Data Warehouse for code logic** - ingesting unstructured data (blogs, scripts, documentation) and transforming it into a strict **Agent Skill-Compliant** Markdown structure.

## Tech Stack

- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite 6
- **AI Integration**: Google Gemini API (`@google/genai`)
- **Styling**: Tailwind CSS (inline classes)
- **Icons**: Font Awesome (CDN)

## Quick Start

```bash
npm install
npm run dev    # Starts dev server on http://localhost:3000
npm run build  # Production build
```

**Environment**: Set `GEMINI_API_KEY` in `.env.local` for AI-powered Smart ETL features.

## Project Structure

```
sp-skill/
├── CLAUDE.md           # This file - project guide
├── index.html          # Entry HTML
├── index.tsx           # Main React application (single-file architecture)
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
├── vite.config.ts      # Vite build configuration
└── metadata.json       # App metadata
```

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

### Phase 2: Smart ETL & Gamification
- AI-powered ingestion from URLs/text
- Credit system for contributions
- Tiered access enforcement

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

## External Resources

- [SKILL_MANIFEST.md](./docs/SKILL_MANIFEST.md) - Full folder structure reference
- Google AI Studio: https://ai.studio/apps/drive/1Z1tYsu-VI85piqEJB8VTMMsFHCKgyng3
