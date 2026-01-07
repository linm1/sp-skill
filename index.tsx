import React, { useState, useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, Type } from "@google/genai";
import JSZip from "jszip";
import { ClerkProvider, SignInButton, SignUpButton, UserButton, useAuth, useUser } from "@clerk/clerk-react";
import { formatRelativeTime } from "./lib/dateFormat";
import "./index.css";

// --- Types & Constants ---

type Role = "guest" | "contributor" | "premier" | "admin";

// The Immutable Container (From Manifest)
interface PatternDefinition {
  id: string;
  category: string;
  title: string;
  problem: string;
  whenToUse: string;
}

// The Mutable Content (The Code)
interface PatternImplementation {
  uuid: string; // Unique ID for this specific implementation
  patternId: string; // Links to PatternDefinition
  author: string;
  sasCode: string;
  rCode: string;
  considerations: string[];
  variations: string[];
  status: "active" | "pending";
  isPremium: boolean;
  timestamp: number;
}

const CURRENT_USER = "Current User";
const SYSTEM_AUTHOR = "System";

const CATEGORIES = [
  { code: "IMP", name: "Imputation", path: "references/imputation/" },
  { code: "DER", name: "Derivations", path: "references/derivations/" },
  { code: "DAT", name: "Date/Time", path: "references/datetime/" },
  { code: "RSH", name: "Reshaping", path: "references/reshaping/" },
  { code: "AGG", name: "Aggregation", path: "references/aggregation/" },
  { code: "MRG", name: "Merging", path: "references/merging/" },
  { code: "CAT", name: "Categorization", path: "references/categorization/" },
  { code: "FLG", name: "Flagging", path: "references/flagging/" },
  { code: "SRT", name: "Sorting", path: "references/sorting/" },
  { code: "FMT", name: "Formatting", path: "references/formatting/" },
  { code: "VAL", name: "Validation", path: "references/validation/" },
  { code: "CDS", name: "CDISC", path: "references/cdisc/" },
  { code: "STA", name: "Statistics", path: "references/statistics/" },
  { code: "OPT", name: "Optimization", path: "references/optimization/" },
];

const MANIFEST_DATA: Record<string, string[]> = {
  IMP: ["missing-category", "locf", "bocf", "wocf", "linear-interpolation", "mean-median", "mi-continuous", "mi-categorical", "pattern-mixture", "tipping-point", "visit-window", "partial-date", "baseline-extension", "control-based"],
  DER: ["trtemfl", "anlfl", "aval", "avalc", "ady", "avisit", "ablfl", "base", "chg", "pchg", "shift", "locfl", "focfl", "wocfl", "bocfl", "tte", "cnsr", "duration", "dose-norm", "bmi", "age", "relative-day", "period", "criterion", "derived-param"],
  DAT: ["iso8601", "partial-date", "date-imputation", "datetime-combine", "date-compare", "study-day", "duration", "visit-window", "period-map", "time-imputation", "relative-time", "overlap"],
  RSH: ["wide-to-long", "long-to-wide", "normalize", "denormalize", "param-transpose", "stack", "rename", "split", "combine", "crosstab-shell"],
  AGG: ["frequency", "descriptive", "big-n", "nested-counts", "cumulative", "weighted", "percentile", "geometric", "rates", "ci", "pooled", "within-subject"],
  MRG: ["one-to-one", "one-to-many", "many-to-many", "join-types", "conditional", "closest-date", "range-based", "self-join", "update", "coalesce", "anti-join", "cross-join"],
  CAT: ["binning", "consolidation", "ct-mapping", "decode", "severity", "ctc-grade", "ref-range", "custom", "hierarchical", "order"],
  FLG: ["population", "record-selection", "subgroup", "deviation", "exclusion", "outlier", "quality", "selection", "subsetting", "distinct"],
  SRT: ["treatment", "visit", "parameter", "category", "alpha-exception", "hierarchical", "frequency", "subject", "pagebreak"],
  FMT: ["n-percent", "mean-sd", "median-iqr", "min-max", "ci", "pvalue", "decimal", "missing", "indent", "headers", "footnotes", "bypage", "continued", "empty-row", "date-display"],
  VAL: ["range", "cross-var", "uniqueness", "referential", "conformance", "dp-compare", "reconciliation", "missing-assess", "ct-validation", "type-check"],
  CDS: ["sdtm-structure", "suppqual", "relrec", "bds-structure", "adsl-structure", "occds-structure", "paramcd", "traceability", "ct", "define"],
  STA: ["ttest-two", "ttest-paired", "anova", "ancova", "chisq", "fisher", "wilcoxon-rs", "wilcoxon-sr", "kruskal", "logrank", "km", "cox", "logistic", "mmrm", "cmh"],
  OPT: ["index-sort", "hash", "format-lookup", "subset-first", "avoid-sort", "bygroup", "temp-mgmt", "macro-vs-data"]
};

// Existing content to preserve/inject into the correct IDs
const PRELOADED_CONTENT: Record<string, Partial<PatternDefinition> & Partial<PatternImplementation>> = {
  "IMP-002": {
    title: "Last Observation Carried Forward (LOCF)",
    problem: "Missing values in longitudinal data need to be filled with the last known value.",
    whenToUse: "When the analysis plan specifies LOCF for missing data handling in safety datasets.",
    sasCode: `data locf;\n  set source;\n  by usubjid;\n  retain last_val;\n  if not missing(aval) then last_val = aval;\n  else aval = last_val;\nrun;`,
    rCode: `library(dplyr)\nlibrary(tidyr)\n\ndf_locf <- df %>%\n  group_by(usubjid) %>%\n  fill(aval, .direction = "down")`,
    considerations: ["Ensure data is sorted by subject and time before applying.", "Do not use for baseline imputation if baseline is missing."],
    variations: ["Baseline Observation Carried Forward (BOCF)", "Worst Observation Carried Forward"],
  },
  "DER-020": {
    title: "Calculate BMI from Height and Weight",
    problem: "Need to derive Body Mass Index (BMI) from raw height and weight variables.",
    whenToUse: "Vital signs domain derivation.",
    sasCode: `if not missing(weight) and not missing(height) then \n  bmi = weight / ((height/100)**2);`,
    rCode: `df <- df %>%\n  mutate(bmi = weight / ((height/100)^2))`,
    considerations: ["Check units! Height is usually cm, weight kg."],
  }
};

// --- API Fetch Hook ---

const usePatterns = (refreshTrigger = 0) => {
  const [patterns, setPatterns] = useState<PatternDefinition[]>([]);
  const [implementations, setImplementations] = useState<PatternImplementation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPatterns = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/patterns');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Transform API response to match current data model
        const defs: PatternDefinition[] = data.patterns.map((p: any) => ({
          id: p.id,
          category: p.category,
          title: p.title,
          problem: p.problem,
          whenToUse: p.whenToUse
        }));

        // Flatten implementations from all patterns
        const impls: PatternImplementation[] = [];
        data.patterns.forEach((p: any) => {
          if (p.implementations) {
            p.implementations.forEach((impl: any) => {
              impls.push({
                uuid: impl.uuid,
                patternId: p.id,
                author: impl.authorName,
                sasCode: impl.sasCode,
                rCode: impl.rCode,
                considerations: impl.considerations || [],
                variations: impl.variations || [],
                status: impl.status,
                isPremium: impl.isPremium || false,
                timestamp: new Date(impl.updatedAt || impl.createdAt).getTime()
              });
            });
          }
        });

        setPatterns(defs);
        setImplementations(impls);
      } catch (err) {
        console.error('Failed to fetch patterns:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch patterns');
      } finally {
        setLoading(false);
      }
    };

    fetchPatterns();
  }, [refreshTrigger]);

  return { patterns, implementations, loading, error };
};

// --- Helper Functions ---

const generateMarkdown = (def: PatternDefinition, impl: PatternImplementation): string => {
  return `# ${def.title} (${def.id})
Author: ${impl.author}

## Problem
${def.problem}

## When to Use
${def.whenToUse}

## SAS Implementation
### Method 1
\`\`\`sas
${impl.sasCode}
\`\`\`

## R Implementation
### Method 1
\`\`\`r
${impl.rCode}
\`\`\`

## Key Considerations
${impl.considerations.map((c) => `- ${c}`).join("\n")}

## Common Variations
${impl.variations.map((v) => `- ${v}`).join("\n")}
`;
};

// Helper to generate filename from pattern ID
const getPatternFilename = (def: PatternDefinition): string => {
  const slug = MANIFEST_DATA[def.category as keyof typeof MANIFEST_DATA].find((_, idx) => {
    const id = `${def.category}-${String(idx + 1).padStart(3, "0")}`;
    return id === def.id;
  });
  return slug ? `${def.id}_${slug}.md` : `${def.id}.md`;
};

// Generate individual pattern markdown file content
const generatePatternMarkdown = (def: PatternDefinition, impl: PatternImplementation): string => {
  return `# ${def.title}

**Pattern ID:** ${def.id}
**Category:** ${def.category}
**Author:** ${impl.author}

## Problem Statement

${def.problem}

## When to Use This Pattern

${def.whenToUse}

## SAS Implementation

\`\`\`sas
${impl.sasCode}
\`\`\`

## R Implementation

\`\`\`r
${impl.rCode}
\`\`\`

## Key Considerations

${impl.considerations.length > 0 ? impl.considerations.map((c) => `- ${c}`).join("\n") : "No specific considerations documented."}

## Common Variations

${impl.variations.length > 0 ? impl.variations.map((v) => `- ${v}`).join("\n") : "No variations documented."}

---

*Last updated: ${new Date(impl.timestamp).toISOString().split('T')[0]}*
`;
};

// Generate customized SKILL.md based on selected patterns
const generateSkillMd = (enrichedItems: { def: PatternDefinition, impl: PatternImplementation }[]): string => {
  // Group patterns by category
  const categorizedPatterns = CATEGORIES.map(cat => {
    const patternsInCat = enrichedItems.filter(item => item.def.category === cat.code);
    return {
      ...cat,
      patterns: patternsInCat
    };
  }).filter(cat => cat.patterns.length > 0);

  // Generate category sections
  const categorySections = categorizedPatterns.map(cat => {
    const categoryTable = cat.patterns.map(({ def }) => {
      const filename = getPatternFilename(def);
      return `| ${def.id} | ${def.title} | [${cat.path}${filename}](${cat.path}${filename}) |`;
    }).join("\n");

    return `### ${cat.name} (${cat.patterns.length} patterns)

| Pattern | Description | Reference |
|---------|-------------|-----------|
${categoryTable}`;
  }).join("\n\n");

  const totalPatterns = enrichedItems.length;

  return `---
name: stat-programming
description: >
  Clinical programming pattern library for generating SAS and R code snippets.
  Provides ${totalPatterns} patterns covering SDTM, ADaM, and TLF development. Use when user
  asks "how do I...", needs derivation logic, imputation code, data manipulation,
  statistical analysis, or is stuck on a clinical programming problem. Patterns
  include: missing data imputation (LOCF, BOCF, MI, zero-count categories),
  variable derivations (TRTEMFL, CHG, PCHG, baseline, analysis flags), date
  handling (ISO 8601, partial dates, study day), data reshaping (wide/long,
  transpose), aggregation (frequency, descriptive stats, Big N), merging
  (one-to-one, closest date, range-based), categorization (binning, CTC grades),
  flagging (population flags, analysis flags), sorting (treatment, visit order),
  output formatting (N%, Mean SD, p-values), validation (range checks, DP compare),
  CDISC compliance (SDTM, ADaM, SUPPQUAL, traceability), statistical methods
  (t-test, ANOVA, ANCOVA, Kaplan-Meier, Cox PH, logistic regression, MMRM),
  and performance optimization (hash lookup, format lookup). Generates
  contextually-adapted code snippets for mid-development challenges.
---

# Clinical Programming Patterns

Generate SAS and R code snippets for common clinical programming challenges.

## How to Use This Skill

This is a **pattern library**, not a script repository. Patterns are templates
that Claude adapts to user's specific context.

**Workflow:**
1. Identify the pattern type from user's question
2. Read the relevant pattern file from \`references/\`
3. Adapt the template to user's context (variable names, data structure, language)
4. Generate contextual code snippet with inline comments

**Key principle:** Never output patterns verbatim. Always adapt to user's specific
variable names, data structure, and requirements.

## Pattern Quick Reference

${categorySections}

## Code Generation Rules

1. **Always ask or infer**: SAS or R? What are the actual variable names?
2. **Adapt, don't copy**: Replace template placeholders with user's context
3. **Include comments**: Explain non-obvious logic inline
4. **Note dependencies**: Mention required macros, packages, or prior datasets
5. **Specify CDISC version**: Note IG version compatibility when relevant
6. **Warn about edge cases**: Flag potential issues (missing data, date comparisons)
`;
};

// --- Components ---

const Layout = ({
  children,
  currentView,
  setView,
  basketCount,
  onContributeClick,
  onRefresh
}: {
  children?: React.ReactNode;
  currentView: string;
  setView: (v: string) => void;
  basketCount: number;
  onContributeClick?: () => void;
  onRefresh?: () => void;
}) => {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();

  // SECURITY: Read role from Clerk metadata - users cannot change this themselves
  const userRole = (user?.publicMetadata?.role as Role) || 'contributor';

  return (
    <div className="min-h-screen flex flex-col font-sans text-ink">
      <nav className="bg-white text-ink border-b border-ink sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center" style={{ height: '70px' }}>
          <div className="flex items-center space-x-4 cursor-pointer" onClick={() => {
            if (currentView === "admin-patterns" || currentView === "admin-review") {
              onRefresh?.();
            }
            setView("catalog");
          }}>
            <div className="w-10 h-10 bg-duck-yellow rounded-full flex items-center justify-center font-bold text-xl border border-ink">
              SPH
            </div>
            <div>
              <h1 className="text-xl font-bold font-mono uppercase tracking-tight-mono">StatPatternHub</h1>
              <p className="text-xs text-ink">Clinical Knowledge Warehouse</p>
            </div>
          </div>
          <div className="flex items-center space-x-6">
            <button
              onClick={() => {
                if (currentView === "admin-patterns" || currentView === "admin-review") {
                  onRefresh?.();
                }
                setView("catalog");
              }}
              className={`font-mono uppercase text-sm font-medium tracking-tight-mono hover:text-link-blue transition-colors duration-brutal ${currentView === "catalog" ? "text-link-blue" : "text-ink"}`}
            >
              Catalog
            </button>
            {isLoaded && isSignedIn && userRole !== 'guest' && (
              <button
                onClick={() => {
                  if (onContributeClick) {
                    onContributeClick();
                  } else {
                    setView("contribute");
                  }
                }}
                className={`font-mono uppercase text-sm font-medium tracking-tight-mono hover:text-link-blue transition-colors duration-brutal flex items-center ${currentView === "contribute" ? "text-link-blue" : "text-ink"}`}
              >
                <i className="fas fa-plus-circle mr-2"></i>
                Contribute
              </button>
            )}
            {isLoaded && isSignedIn && userRole !== 'guest' && (
              <button
                onClick={() => setView("my-contributions")}
                className={`font-mono uppercase text-sm font-medium tracking-tight-mono hover:text-link-blue transition-colors duration-brutal flex items-center ${currentView === "my-contributions" ? "text-link-blue" : "text-ink"}`}
              >
                <i className="fas fa-folder-open mr-2"></i>
                My Contributions
              </button>
            )}
            {isLoaded && isSignedIn && userRole === 'admin' && (
              <>
                <button
                  onClick={() => setView("admin-review")}
                  className={`font-mono uppercase text-sm font-medium tracking-tight-mono hover:text-link-blue transition-colors duration-brutal flex items-center ${currentView === "admin-review" ? "text-link-blue" : "text-ink"}`}
                >
                  <i className="fas fa-clipboard-check mr-2"></i>
                  Admin Review
                </button>
                <button
                  onClick={() => setView("admin-patterns")}
                  className={`font-mono uppercase text-sm font-medium tracking-tight-mono hover:text-link-blue transition-colors duration-brutal flex items-center ${currentView === "admin-patterns" ? "text-link-blue" : "text-ink"}`}
                >
                  <i className="fas fa-cog mr-2"></i>
                  Admin Panel
                </button>
              </>
            )}
            <button
              onClick={() => setView("basket")}
              className={`font-mono uppercase text-sm font-medium tracking-tight-mono hover:text-link-blue transition-colors duration-brutal flex items-center ${currentView === "basket" ? "text-link-blue" : "text-ink"}`}
            >
              <i className="fas fa-suitcase mr-2"></i>
              Skill Basket
              <span className="ml-2 bg-ink text-white text-xs font-bold px-2 py-1 border border-ink">{basketCount}</span>
            </button>
            <div className="border-l border-ink pl-6 flex items-center space-x-4">
              {isLoaded && isSignedIn ? (
                <>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-ink">
                      {user?.firstName || user?.username || "User"}
                    </span>
                    <UserButton
                      afterSignOutUrl="/"
                      appearance={{
                        elements: {
                          avatarBox: "w-8 h-8"
                        }
                      }}
                    />
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-ink uppercase font-mono">Role</span>
                    <span className={`text-sm font-semibold font-mono uppercase ${
                      userRole === 'admin' ? 'text-terminal-red' :
                      userRole === 'premier' ? 'text-link-blue' :
                      userRole === 'contributor' ? 'text-terminal-green' :
                      'text-ink'
                    }`}>
                      {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center space-x-3">
                  <SignInButton mode="modal">
                    <button className="bg-ink hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal text-white px-4 py-2 text-sm font-medium font-mono uppercase transition-all duration-brutal border border-ink">
                      Sign In
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="bg-white hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal text-ink px-4 py-2 text-sm font-medium font-mono uppercase transition-all duration-brutal border border-ink">
                      Sign Up
                    </button>
                  </SignUpButton>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="flex-grow container mx-auto px-6 py-8">{children}</main>
      <footer className="bg-canvas border-t border-ink mt-auto">
        <div className="container mx-auto px-6 py-6 text-center text-sm text-ink font-mono">
          StatPatternHub v1.0.0 | Adheres to SKILL_MANIFEST.md Schema
        </div>
      </footer>
    </div>
  );
};

interface PatternCardProps {
  def: PatternDefinition;
  implCount: number;
  onClick: () => void;
}

const PatternCard: React.FC<PatternCardProps> = ({
  def,
  implCount,
  onClick
}) => {
  return (
    <div
      onClick={onClick}
      className="bg-white border border-black overflow-hidden hover:-translate-y-1 hover:shadow-brutal-lg transition-transform duration-brutal flex flex-col h-full cursor-pointer group"
    >
      <div className="p-8 flex-grow">
        <div className="flex justify-between items-start mb-3">
          <span className="inline-block px-2 py-1 text-xs font-semibold bg-ink text-white font-mono uppercase border border-ink">
            {def.id}
          </span>
          {implCount > 1 && (
             <span className="text-xs bg-white text-ink px-2 py-1 border border-ink font-mono">
                {implCount} Variations
             </span>
          )}
        </div>
        <h3 className="text-lg font-bold text-ink mb-3 leading-tight group-hover:text-link-blue transition-colors duration-brutal">{def.title}</h3>
        <p className="text-sm text-ink line-clamp-2 mb-4">{def.problem}</p>
      </div>
      <div className="px-8 py-3 bg-canvas border-t border-ink flex justify-between items-center text-xs text-ink font-mono uppercase">
          <span>{def.category}</span>
          <span>View Container &rarr;</span>
      </div>
    </div>
  );
};

// --- Admin Card Components ---

interface PatternCardAdminProps {
  def: PatternDefinition & { isDeleted?: boolean };
  implCount: number;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const PatternCardAdmin: React.FC<PatternCardAdminProps> = ({
  def, implCount, onView, onEdit, onDelete
}) => {
  return (
    <div className={`bg-white border border-ink hover:-translate-y-1 hover:shadow-brutal-lg transition-transform duration-brutal h-full flex flex-col ${
      def.isDeleted ? 'opacity-60' : ''
    }`}>
      {/* Header: Pattern ID Badge */}
      <div className="bg-ink text-white px-4 py-2 flex justify-between items-center">
        <span className="font-mono text-xs uppercase tracking-tight-mono">
          {def.id}
        </span>
        {def.isDeleted && (
          <span className="bg-terminal-red text-white px-2 py-1 text-xs font-mono uppercase tracking-tight-mono">
            DELETED
          </span>
        )}
      </div>

      {/* Body: Pattern Info (click to view) */}
      <div className="p-8 flex-grow cursor-pointer" onClick={onView}>
        {/* Category */}
        <div className="text-xs font-mono uppercase tracking-tight-mono text-ink/60 mb-2">
          {def.category}
        </div>

        {/* Title */}
        <h3 className={`text-xl font-sans font-semibold text-ink mb-3 ${def.isDeleted ? 'line-through' : ''}`}>
          {def.title}
        </h3>

        {/* Problem (truncated) */}
        <p className="text-sm font-sans text-ink/80 line-clamp-2 mb-4">
          {def.problem}
        </p>

        {/* Implementation Count */}
        <div className="text-xs font-mono text-ink/60">
          {implCount} implementation{implCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Footer: Action Buttons */}
      {!def.isDeleted && (
        <div className="border-t border-ink bg-canvas flex">
          <button
            onClick={(e) => { e.stopPropagation(); onView(); }}
            className="flex-1 py-3 font-mono uppercase text-xs tracking-tight-mono text-ink hover:bg-link-blue hover:text-white transition-colors duration-brutal border-r border-ink"
          >
            View
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="flex-1 py-3 font-mono uppercase text-xs tracking-tight-mono text-link-blue hover:bg-link-blue hover:text-white transition-colors duration-brutal border-r border-ink"
          >
            Edit
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="flex-1 py-3 font-mono uppercase text-xs tracking-tight-mono text-terminal-red hover:bg-terminal-red hover:text-white transition-colors duration-brutal"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

interface PendingImplementationCardProps {
  impl: {
    uuid: string;
    patternId: string;
    patternTitle: string;
    patternCategory: string;
    authorName: string;
    sasCode: string;
    rCode: string;
  };
  onApprove: () => void;
  onReject: () => void;
  onViewCode: () => void;
}

const PendingImplementationCard: React.FC<PendingImplementationCardProps> = ({
  impl, onApprove, onReject, onViewCode
}) => {
  return (
    <div className="bg-white border-2 border-ink hover:-translate-y-1 hover:shadow-brutal-lg transition-transform duration-brutal h-full flex flex-col">
      {/* Header: Pattern ID + Pending Badge */}
      <div className="flex justify-between items-center px-4 py-2 border-b border-ink">
        <span className="font-mono text-xs uppercase tracking-tight-mono text-ink">
          {impl.patternId}
        </span>
        <span className="bg-duck-yellow text-ink px-3 py-1 font-mono text-xs uppercase tracking-tight-mono">
          PENDING
        </span>
      </div>

      {/* Body: Implementation Info (click to view code) */}
      <div className="p-8 flex-grow cursor-pointer" onClick={onViewCode}>
        {/* Category */}
        <div className="text-xs font-mono uppercase tracking-tight-mono text-ink/60 mb-2">
          {impl.patternCategory}
        </div>

        {/* Title */}
        <h3 className="text-xl font-sans font-semibold text-ink mb-3">
          {impl.patternTitle}
        </h3>

        {/* Author */}
        <div className="text-sm font-mono text-ink/80 mb-3">
          by {impl.authorName}
        </div>

        {/* Code indicators */}
        <div className="flex gap-2 text-xs font-mono text-ink/60">
          {impl.sasCode && <span className="border border-ink px-2 py-1">SAS</span>}
          {impl.rCode && <span className="border border-ink px-2 py-1">R</span>}
        </div>
      </div>

      {/* Footer: Action Buttons */}
      <div className="border-t border-ink bg-canvas flex">
        <button
          onClick={(e) => { e.stopPropagation(); onViewCode(); }}
          className="flex-1 py-3 font-mono uppercase text-xs tracking-tight-mono text-ink hover:bg-link-blue hover:text-white transition-colors duration-brutal border-r border-ink"
        >
          View Code
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onApprove(); }}
          className="flex-1 py-3 font-mono uppercase text-xs tracking-tight-mono text-terminal-green hover:bg-terminal-green hover:text-white transition-colors duration-brutal border-r border-ink"
        >
          Approve
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onReject(); }}
          className="flex-1 py-3 font-mono uppercase text-xs tracking-tight-mono text-terminal-red hover:bg-terminal-red hover:text-white transition-colors duration-brutal"
        >
          Reject
        </button>
      </div>
    </div>
  );
};

interface ImplementationCardAdminProps {
  impl: PatternImplementation & {
    isDeleted?: boolean;
    patternTitle?: string;
    patternCategory?: string;
  };
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus?: () => void;
}

const ImplementationCardAdmin: React.FC<ImplementationCardAdminProps> = ({
  impl, onEdit, onDelete, onToggleStatus
}) => {
  const isActive = impl.status === 'active';

  return (
    <div className={`bg-white border border-ink hover:-translate-y-1 hover:shadow-brutal-lg transition-transform duration-brutal h-full flex flex-col ${
      impl.isDeleted ? 'opacity-60' : ''
    }`}>
      {/* Header: Pattern ID + Status */}
      <div className="flex justify-between items-center px-4 py-2 border-b border-ink">
        <span className="font-mono text-xs uppercase tracking-tight-mono text-ink">
          {impl.patternId}
        </span>
        <div className="flex gap-2 items-center">
          {onToggleStatus && !impl.isDeleted && (
            <button
              onClick={onToggleStatus}
              className={`px-3 py-1 font-mono text-xs uppercase tracking-tight-mono transition-colors duration-brutal ${
                isActive
                  ? 'bg-terminal-green text-white hover:bg-terminal-green/80'
                  : 'bg-duck-yellow text-ink hover:bg-duck-yellow/80'
              }`}
            >
              {isActive ? 'ACTIVE' : 'PENDING'}
            </button>
          )}
          {!onToggleStatus && (
            <span className={`px-3 py-1 font-mono text-xs uppercase tracking-tight-mono ${
              isActive
                ? 'bg-terminal-green text-white'
                : 'bg-duck-yellow text-ink'
            }`}>
              {isActive ? 'ACTIVE' : 'PENDING'}
            </span>
          )}
          {impl.isDeleted && (
            <span className="bg-terminal-red text-white px-2 py-1 text-xs font-mono uppercase tracking-tight-mono">
              DELETED
            </span>
          )}
        </div>
      </div>

      {/* Body: Implementation Info */}
      <div className="p-8 flex-grow">
        {/* Category */}
        <div className="text-xs font-mono uppercase tracking-tight-mono text-ink/60 mb-2">
          {impl.patternCategory || impl.patternId.split('-')[0]}
        </div>

        {/* Title */}
        <h3 className={`text-xl font-sans font-semibold text-ink mb-3 ${impl.isDeleted ? 'line-through' : ''}`}>
          {impl.patternTitle || impl.patternId}
        </h3>

        {/* Author */}
        <div className="text-sm font-mono text-ink/80 mb-3">
          by {impl.author}
        </div>

        {/* Has Code Indicators */}
        <div className="flex gap-2 text-xs font-mono text-ink/60">
          {impl.sasCode && <span className="border border-ink px-2 py-1">SAS</span>}
          {impl.rCode && <span className="border border-ink px-2 py-1">R</span>}
        </div>
      </div>

      {/* Footer: Action Buttons */}
      {!impl.isDeleted && (
        <div className="border-t border-ink bg-canvas flex">
          <button
            onClick={onEdit}
            className="flex-1 py-3 font-mono uppercase text-xs tracking-tight-mono text-link-blue hover:bg-link-blue hover:text-white transition-colors duration-brutal border-r border-ink"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="flex-1 py-3 font-mono uppercase text-xs tracking-tight-mono text-terminal-red hover:bg-terminal-red hover:text-white transition-colors duration-brutal"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

const PatternDetail = ({
  def,
  impls,
  basketSelectedUuid,
  onBack,
  onAddToBasket,
  onAddImplementation,
  onEditImplementation,
  role
}: {
  def: PatternDefinition;
  impls: PatternImplementation[];
  basketSelectedUuid: string; // The UUID currently active in the basket for this Pattern ID
  onBack: () => void;
  onAddToBasket: (implUuid: string) => void;
  onAddImplementation: () => void;
  onEditImplementation: (impl: PatternImplementation) => void;
  role: Role;
}) => {
  const { isSignedIn } = useAuth();

  // State for the active tab (local UI state)
  // Default to the one selected in the basket, or the first one if not selected
  const [activeImplUuid, setActiveImplUuid] = useState<string>(basketSelectedUuid);

  // Update local state if basket selection changes externally
  useEffect(() => {
    setActiveImplUuid(basketSelectedUuid);
  }, [basketSelectedUuid]);

  const activeImpl = impls.find(i => i.uuid === activeImplUuid) || impls[0];

  // Add null safety check
  if (!activeImpl) {
    return (
      <div className="max-w-5xl mx-auto">
        <button onClick={onBack} className="text-sm text-ink hover:text-link-blue flex items-center mb-6 font-mono uppercase transition-colors duration-brutal">
          <i className="fas fa-arrow-left mr-2"></i> Back to Catalog
        </button>
        <div className="bg-white border-2 border-ink p-8 text-center shadow-terminal">
          <i className="fas fa-exclamation-circle text-4xl text-ink mb-4"></i>
          <h3 className="text-xl font-semibold font-mono uppercase text-ink mb-2">No Implementations Available</h3>
          <p className="text-ink">This pattern doesn't have any implementations yet. Contribute one to get started!</p>
        </div>
      </div>
    );
  }

  const canEdit =
    role === "admin" ||
    role === "premier" ||
    (role === "contributor" && activeImpl?.author === CURRENT_USER);

  const markdown = generateMarkdown(def, activeImpl);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(markdown);
    alert("Context copied!");
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
         <button onClick={onBack} className="text-sm text-ink hover:text-link-blue flex items-center font-mono uppercase transition-colors duration-brutal">
            <i className="fas fa-arrow-left mr-2"></i> Back to Catalog
          </button>

          {isSignedIn && (role === "contributor" || role === "premier" || role === "admin") && (
            <button
              onClick={onAddImplementation}
              className="bg-ink text-white hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal px-4 py-2 text-sm font-medium font-mono uppercase transition-all duration-brutal border border-ink"
            >
              <i className="fas fa-plus mr-2"></i> Contribute Alternative
            </button>
          )}
      </div>

      {/* Container Header (Immutable Definition) */}
      <div className="bg-white border border-ink p-8">
        <div className="flex items-center space-x-3 mb-3">
          <span className="text-2xl font-bold text-ink font-mono uppercase">{def.title}</span>
          <span className="px-2 py-1 bg-ink text-white text-xs font-mono uppercase border border-ink">
            {def.id}
          </span>
        </div>
        <p className="text-ink text-lg mb-4">{def.problem}</p>
        <div className="bg-white border-2 border-ink p-8">
             <h5 className="text-xs font-bold text-ink uppercase mb-2 font-mono tracking-tight-mono">When to Use</h5>
             <p className="text-sm text-ink">{def.whenToUse}</p>
        </div>
      </div>

      {/* Tabs for Implementations */}
      <div className="bg-canvas border-x border-ink border-b border-ink px-8 pt-4 flex space-x-2 overflow-x-auto">
        {impls.map((impl) => (
          <button
            key={impl.uuid}
            onClick={() => setActiveImplUuid(impl.uuid)}
            className={`px-4 py-3 text-sm font-medium transition-all duration-brutal flex items-center space-x-2 font-mono uppercase tracking-tight-mono ${
              activeImplUuid === impl.uuid
                ? "bg-white text-link-blue border-t-2 border-x-2 border-ink -mb-[2px]"
                : "text-ink hover:text-link-blue hover:bg-white/50"
            }`}
          >
            {impl.author === SYSTEM_AUTHOR && <i className="fas fa-shield-alt mr-1 text-xs"></i>}
            <span>{impl.author === CURRENT_USER ? "Your Version" : impl.author}</span>
            {basketSelectedUuid === impl.uuid && (
               <span className="ml-2 w-2 h-2 rounded-full bg-terminal-green" title="Selected for Export"></span>
            )}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="bg-white border border-ink border-t-0 overflow-hidden min-h-[500px] flex flex-col">

        {/* Action Bar */}
        <div className="bg-canvas border-b border-ink p-4 flex justify-between items-center">
            <div className="text-sm text-ink font-mono">
               Showing implementation by <span className="font-semibold text-ink uppercase">{activeImpl?.author}</span>
            </div>
            <div className="flex space-x-3">
               {canEdit && (
                 <button
                   onClick={() => onEditImplementation(activeImpl)}
                   className="text-ink hover:text-link-blue text-sm font-medium font-mono uppercase px-3 py-2 border border-ink hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal transition-all duration-brutal"
                 >
                   <i className="fas fa-edit mr-1"></i> Edit Code
                 </button>
               )}
               <button
                 onClick={() => onAddToBasket(activeImpl.uuid)}
                 disabled={basketSelectedUuid === activeImpl.uuid}
                 className={`px-4 py-2 text-sm font-medium font-mono uppercase transition-all duration-brutal flex items-center border border-ink ${
                    basketSelectedUuid === activeImpl.uuid
                    ? "bg-terminal-green text-white cursor-default"
                    : "bg-white text-ink hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal"
                 }`}
               >
                 {basketSelectedUuid === activeImpl.uuid ? (
                    <>
                      <i className="fas fa-check-circle mr-2"></i> Selected for Agent
                    </>
                 ) : (
                    <>
                      <i className="fas fa-suitcase-medical mr-2"></i> Select this Version
                    </>
                 )}
               </button>
            </div>
        </div>

        {/* Code Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 flex-grow">
          <div className="p-8 border-r border-ink">
             <div className="mb-6">
              <h5 className="text-xs font-semibold text-ink uppercase mb-2 font-mono tracking-tight-mono">Considerations</h5>
              {activeImpl.considerations.length > 0 ? (
                <ul className="list-disc list-inside text-sm text-ink space-y-1">
                  {activeImpl.considerations.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink italic">None specified.</p>
              )}
            </div>
            <div>
              <h5 className="text-xs font-semibold text-ink uppercase mb-2 font-mono tracking-tight-mono">Variations</h5>
              {activeImpl.variations.length > 0 ? (
                <ul className="list-disc list-inside text-sm text-ink space-y-1">
                  {activeImpl.variations.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink italic">None specified.</p>
              )}
            </div>
          </div>

          <div className="bg-white text-ink overflow-auto h-full max-h-[800px] border-l border-ink">
            <div className="p-4 bg-white border-b border-ink flex justify-between items-center sticky top-0 shadow-terminal">
               <div className="flex items-center space-x-2">
                 <div className="w-3 h-3 rounded-full bg-terminal-red"></div>
                 <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                 <div className="w-3 h-3 rounded-full bg-terminal-green"></div>
                 <span className="text-xs font-mono ml-4">{`${def.id}_${activeImpl?.author?.toLowerCase().replace(' ','-') ?? 'unknown'}.md`}</span>
               </div>
               <button onClick={copyToClipboard} className="text-ink hover:text-link-blue transition-colors duration-brutal">
                 <i className="fas fa-copy"></i>
               </button>
            </div>
            <pre className="p-6 text-xs font-mono leading-relaxed whitespace-pre-wrap border border-ink m-4">
              {markdown}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

// Multi-entry field component for dynamic add/remove inputs
interface MultiEntryFieldProps {
  label: string;
  value: string[];
  onChange: (newValue: string[]) => void;
  placeholder?: string;
  maxEntries?: number;
}

const MultiEntryField = ({
  label,
  value,
  onChange,
  placeholder = "",
  maxEntries = 10,
}: MultiEntryFieldProps) => {
  const handleAdd = () => {
    if (value.length < maxEntries) {
      onChange([...value, ""]);
    }
  };

  const handleRemove = (index: number) => {
    const newValue = value.filter((_, i) => i !== index);
    onChange(newValue);
  };

  const handleChange = (index: number, newText: string) => {
    const newValue = [...value];
    newValue[index] = newText;
    // Filter out empty strings when updating
    const filtered = newValue.filter((s) => s.trim() !== "");
    onChange(filtered);
  };

  const canAdd = value.length < maxEntries;

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
        <span className="ml-2 text-xs text-slate-500">
          ({value.length}/{maxEntries} entries)
        </span>
      </label>

      {/* Existing entries */}
      <div className="space-y-2 mb-2">
        {value.length === 0 && (
          <p className="text-sm text-slate-400 italic">No entries yet. Click "Add Entry" to start.</p>
        )}
        {value.map((entry, index) => (
          <div key={index} className="flex items-center space-x-2">
            <input
              type="text"
              value={entry}
              onChange={(e) => handleChange(index, e.target.value)}
              placeholder={placeholder}
              className="flex-1 p-2 border border-slate-300 rounded-md text-sm"
              autoFocus={index === value.length - 1}
            />
            <button
              type="button"
              onClick={() => handleRemove(index)}
              className="text-red-600 hover:text-red-800 transition-colors"
              title="Remove entry"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        ))}
      </div>

      {/* Add button */}
      <button
        type="button"
        onClick={handleAdd}
        disabled={!canAdd}
        className={`w-full p-2 border-2 border-dashed rounded-md text-sm transition-colors ${
          canAdd
            ? "border-indigo-300 text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50"
            : "border-slate-200 text-slate-400 cursor-not-allowed"
        }`}
      >
        <i className="fas fa-plus mr-1"></i>
        Add Entry {!canAdd && "(Max reached)"}
      </button>
    </div>
  );
};

const SmartEtlForm = ({
  definition,
  initialImpl,
  onSave,
  onCancel,
  isSaving = false,
  allPatterns = [],
}: {
  definition?: PatternDefinition;
  initialImpl?: PatternImplementation;
  onSave: (impl: PatternImplementation, updatedDef?: Partial<PatternDefinition>) => void;
  onCancel: () => void;
  isSaving?: boolean;
  allPatterns?: PatternDefinition[];
}) => {
  const isEditMode = !!initialImpl;
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [rawInput, setRawInput] = useState("");
  const [selectedPatternId, setSelectedPatternId] = useState(definition?.id || "");
  const [formData, setFormData] = useState<Partial<PatternImplementation>>({
    sasCode: "",
    rCode: "",
    considerations: [],
    variations: [],
    author: CURRENT_USER,
    ...initialImpl
  });

  // Get current pattern based on selection
  const currentPattern = definition || allPatterns.find(p => p.id === selectedPatternId);

  // State for pattern definition fields
  const [defData, setDefData] = useState<Partial<PatternDefinition>>({
    title: definition?.title || "",
    problem: definition?.problem || "",
    whenToUse: definition?.whenToUse || "",
  });

  // Update defData when pattern selection changes
  useEffect(() => {
    if (currentPattern && !definition) {
      setDefData({
        title: currentPattern.title,
        problem: currentPattern.problem,
        whenToUse: currentPattern.whenToUse,
      });
    }
  }, [currentPattern, definition]);

  const analyzeWithGemini = async () => {
    if (!rawInput.trim()) return;

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patternTitle: currentPattern?.title || "",
          rawInput: rawInput,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'API request failed');
      }

      const extracted = await response.json();
      setFormData((prev) => ({ ...prev, ...extracted }));
    } catch (e) {
      console.error("Analysis Error:", e);
      alert("Failed to analyze text. Please fill manually.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPattern) {
      alert("Please select a pattern to contribute to.");
      return;
    }

    // Validate that at least one code field is provided
    const hasSasCode = formData.sasCode && formData.sasCode.trim().length > 0;
    const hasRCode = formData.rCode && formData.rCode.trim().length > 0;

    if (!hasSasCode && !hasRCode) {
      alert("Please provide at least one code implementation (SAS or R).");
      return;
    }

    const newImpl: PatternImplementation = {
      uuid: isEditMode && initialImpl ? initialImpl.uuid : crypto.randomUUID(),
      patternId: currentPattern.id,
      author: formData.author || CURRENT_USER,
      sasCode: formData.sasCode || "",
      rCode: formData.rCode || "",
      considerations: formData.considerations || [],
      variations: formData.variations || [],
      status: "active", // Simplified for MVP
      isPremium: isEditMode && initialImpl ? initialImpl.isPremium : false,
      timestamp: Date.now()
    };

    // Check if any definition fields have changed
    const hasDefChanges = definition && (
      defData.title !== definition.title ||
      defData.problem !== definition.problem ||
      defData.whenToUse !== definition.whenToUse
    );

    onSave(newImpl, hasDefChanges ? defData : undefined);
  };

  return (
    <div className="max-w-3xl mx-auto bg-white border-2 border-ink overflow-hidden shadow-terminal">
      <div className="bg-ink px-6 py-4 flex justify-between items-center border-b border-white">
        <div>
           <h2 className="text-white font-bold text-lg font-mono uppercase tracking-tight-mono">{isEditMode ? "Edit Implementation" : "Contribute New Pattern Implementation"}</h2>
           {currentPattern && <p className="text-white text-xs font-mono">For Pattern: {currentPattern.id} - {currentPattern.title}</p>}
        </div>
        {!isEditMode && <span className="text-white text-xs uppercase font-semibold tracking-wider font-mono">Smart Ingest Active</span>}
      </div>

      {/* Pattern Selection Dropdown (only show if no definition provided) */}
      {!definition && !isEditMode && (
        <div className="p-6 bg-white border-b border-ink">
          <label className="block text-sm font-medium text-ink mb-2 font-mono uppercase">
            <i className="fas fa-list-alt mr-2"></i>Select Pattern to Contribute To
          </label>
          <select
            name="patternId"
            required
            value={selectedPatternId}
            onChange={(e) => setSelectedPatternId(e.target.value)}
            className="w-full p-3 border border-ink text-sm focus:outline-none focus:border-2 focus:border-link-blue font-mono"
          >
            <option value="">Choose a pattern...</option>
            {CATEGORIES.map(cat => (
              <optgroup key={cat.code} label={cat.name}>
                {allPatterns
                  .filter(p => p.category === cat.code)
                  .map(pattern => (
                    <option key={pattern.id} value={pattern.id}>
                      {pattern.id} - {pattern.title}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}

      {!isEditMode && (
        <div className="p-6 bg-white border-b border-ink">
          <label className="block text-xs font-bold text-ink uppercase mb-2 font-mono">
            <i className="fas fa-magic mr-1 text-link-blue"></i> AI Smart Fill
          </label>
          <div className="flex gap-2">
            <textarea
              className="flex-grow p-3 text-sm border border-ink focus:outline-none focus:border-2 focus:border-link-blue font-mono transition-all duration-brutal"
              rows={3}
              placeholder="Paste raw text or documentation here to extract code..."
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
            />
            <button
              onClick={analyzeWithGemini}
              disabled={isAnalyzing || !rawInput}
              className="px-4 bg-ink hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal disabled:bg-canvas disabled:text-ink disabled:border-ink text-white text-sm font-medium font-mono uppercase transition-all duration-brutal border border-ink flex flex-col justify-center items-center min-w-[100px]"
            >
              {isAnalyzing ? <i className="fas fa-spinner fa-spin mb-1"></i> : <i className="fas fa-robot mb-1"></i>}
              {isAnalyzing ? "Thinking..." : "Analyze"}
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-6 space-y-6">

        {/* Pattern Definition Fields (Read-only when pattern selected from dropdown) */}
        {currentPattern && (
          <div className="bg-white border-2 border-ink p-6 space-y-4">
            <h3 className="text-sm font-semibold text-ink uppercase tracking-wide mb-2 font-mono">
              <i className="fas fa-info-circle mr-2"></i>Pattern Definition {!definition && <span className="text-xs text-ink font-normal">(Read-only)</span>}
            </h3>

            <div>
              <label className="block text-sm font-medium text-ink mb-1 font-mono uppercase">Pattern Title</label>
              <input
                type="text"
                required
                value={defData.title}
                onChange={(e) => setDefData({ ...defData, title: e.target.value })}
                className="w-full p-2 border border-ink text-sm bg-canvas focus:outline-none focus:border-2 focus:border-link-blue transition-all duration-brutal"
                placeholder="e.g., Last Observation Carried Forward (LOCF)"
                disabled={!definition}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1 font-mono uppercase">Problem Statement</label>
              <textarea
                required
                rows={2}
                value={defData.problem}
                onChange={(e) => setDefData({ ...defData, problem: e.target.value })}
                className="w-full p-2 border border-ink text-sm bg-canvas focus:outline-none focus:border-2 focus:border-link-blue transition-all duration-brutal"
                placeholder="Describe what problem this pattern solves..."
                disabled={!definition}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1 font-mono uppercase">When to Use</label>
              <textarea
                required
                rows={2}
                value={defData.whenToUse}
                onChange={(e) => setDefData({ ...defData, whenToUse: e.target.value })}
                className="w-full p-2 border border-ink text-sm bg-canvas focus:outline-none focus:border-2 focus:border-link-blue transition-all duration-brutal"
                placeholder="Specify scenarios and triggers for using this pattern..."
                disabled={!definition}
              />
            </div>
          </div>
        )}

        {/* Implementation Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-ink mb-1 font-mono uppercase">
              SAS Implementation {!formData.rCode && <span className="text-terminal-red text-xs">(Required if R code not provided)</span>}
            </label>
            <textarea
              rows={8}
              value={formData.sasCode}
              onChange={(e) => setFormData({ ...formData, sasCode: e.target.value })}
              className="w-full p-3 border border-ink text-sm font-mono bg-white focus:outline-none focus:border-2 focus:border-link-blue transition-all duration-brutal"
              placeholder="Enter SAS code..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1 font-mono uppercase">
              R Implementation {!formData.sasCode && <span className="text-terminal-red text-xs">(Required if SAS code not provided)</span>}
            </label>
            <textarea
              rows={8}
              value={formData.rCode}
              onChange={(e) => setFormData({ ...formData, rCode: e.target.value })}
              className="w-full p-3 border border-ink text-sm font-mono bg-white focus:outline-none focus:border-2 focus:border-link-blue transition-all duration-brutal"
              placeholder="Enter R code..."
            />
          </div>
        </div>

        <MultiEntryField
          label="Key Considerations"
          value={formData.considerations || []}
          onChange={(newValue) => setFormData({ ...formData, considerations: newValue })}
          placeholder="e.g., Requires non-missing baseline value"
          maxEntries={10}
        />

        <MultiEntryField
          label="Common Variations"
          value={formData.variations || []}
          onChange={(newValue) => setFormData({ ...formData, variations: newValue })}
          placeholder="e.g., Baseline Observation Carried Forward (BOCF)"
          maxEntries={10}
        />

        <div className="flex justify-end space-x-3 pt-4 border-t border-ink">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 border border-ink text-sm font-medium font-mono uppercase text-ink hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-brutal"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 bg-ink text-sm font-medium font-mono uppercase text-white hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal disabled:opacity-50 disabled:cursor-not-allowed flex items-center border border-ink transition-all duration-brutal"
          >
            {isSaving ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Saving...
              </>
            ) : (
              isEditMode ? "Update Code" : "Submit Contribution"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

const AdminReviewQueue = () => {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingImplementations, setPendingImplementations] = useState<Array<{
    uuid: string;
    patternId: string;
    patternTitle: string;
    patternCategory: string;
    authorId: string;
    authorName: string;
    sasCode: string;
    rCode: string;
    considerations: string[];
    variations: string[];
    status: "pending";
    createdAt: string;
    updatedAt: string;
  }>>([]);
  const [processingUuid, setProcessingUuid] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedImpl, setSelectedImpl] = useState<typeof pendingImplementations[0] | null>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);

  // Check if user is admin
  const userRole = (user?.publicMetadata?.role as Role) || 'contributor';
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    const fetchPendingImplementations = async () => {
      if (!isAdmin) {
        setLoading(false);
        setError("Access denied. Admin role required.");
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const token = await getToken();
        if (!token) {
          setError("Please sign in to access admin features");
          setLoading(false);
          return;
        }

        const response = await fetch('/api/implementations?status=pending', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("Please sign in to access admin features");
          }
          if (response.status === 403) {
            throw new Error("Access denied. Admin role required.");
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setPendingImplementations(data.implementations || []);
      } catch (err) {
        console.error('Failed to fetch pending implementations:', err);
        setError(err instanceof Error ? err.message : 'Failed to load pending implementations');
      } finally {
        setLoading(false);
      }
    };

    fetchPendingImplementations();
  }, [getToken, isAdmin, user]);

  // Filter logic
  const filteredPending = useMemo(() => {
    return pendingImplementations.filter(impl => {
      const matchesSearch = !searchQuery ||
        impl.patternTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        impl.patternId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        impl.authorName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = !selectedCategory || impl.patternCategory === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [pendingImplementations, searchQuery, selectedCategory]);

  const handleApprove = async (uuid: string) => {
    try {
      setProcessingUuid(uuid);

      const token = await getToken();
      if (!token) {
        alert("Please sign in to approve implementations");
        return;
      }

      const response = await fetch(`/api/implementations/${uuid}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'active' })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          alert('Access denied. Admin role required.');
        } else if (response.status === 404) {
          alert('Implementation not found');
        } else {
          alert(`Error: ${data.error || 'Failed to approve implementation'}`);
        }
        return;
      }

      // Remove from pending list
      setPendingImplementations(prev => prev.filter(impl => impl.uuid !== uuid));
      alert('Implementation approved successfully!');

    } catch (error) {
      console.error('Failed to approve implementation:', error);
      alert('Network error: Could not approve implementation. Please try again.');
    } finally {
      setProcessingUuid(null);
    }
  };

  const handleReject = async (uuid: string) => {
    if (!confirm('Are you sure you want to reject this implementation? This action cannot be undone.')) {
      return;
    }

    try {
      setProcessingUuid(uuid);

      const token = await getToken();
      if (!token) {
        alert("Please sign in to reject implementations");
        return;
      }

      const response = await fetch(`/api/implementations/${uuid}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'rejected' })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          alert('Access denied. Admin role required.');
        } else if (response.status === 404) {
          alert('Implementation not found');
        } else {
          alert(`Error: ${data.error || 'Failed to reject implementation'}`);
        }
        return;
      }

      // Remove from pending list
      setPendingImplementations(prev => prev.filter(impl => impl.uuid !== uuid));
      alert('Implementation rejected.');

    } catch (error) {
      console.error('Failed to reject implementation:', error);
      alert('Network error: Could not reject implementation. Please try again.');
    } finally {
      setProcessingUuid(null);
    }
  };

  const getCodePreview = (sasCode: string, rCode: string) => {
    const code = sasCode || rCode || "";
    const lines = code.split('\n').filter(l => l.trim()).slice(0, 5);
    return lines.length > 0 ? lines.join('\n') : "No code preview available";
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="text-center py-20">
          <div className="inline-block animate-spin w-12 h-12 border-2 border-ink border-t-transparent mb-4"></div>
          <div className="text-ink text-lg font-mono uppercase tracking-tight-mono">Loading pending submissions...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-white border-2 border-terminal-red p-8 text-center shadow-brutal">
          <i className="fas fa-exclamation-triangle text-terminal-red text-4xl mb-4"></i>
          <h3 className="text-xl font-semibold font-mono uppercase text-ink mb-2 tracking-tight-mono">Access Denied</h3>
          <p className="text-ink">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-4xl font-bold font-mono uppercase text-ink mb-2 tracking-wide-head">Admin Review Queue</h2>
        <p className="text-ink font-sans">
          {filteredPending.length} pending submission{filteredPending.length !== 1 ? 's' : ''} {searchQuery || selectedCategory ? 'matching filters' : 'awaiting review'}
        </p>
      </div>

      {/* Filter Bar */}
      <div className="mb-8">
        {/* Category Filters */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-4">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 font-mono uppercase text-xs tracking-tight-mono transition-all duration-brutal whitespace-nowrap ${
              selectedCategory === null
                ? 'bg-ink text-white shadow-brutal'
                : 'bg-white border border-ink text-ink hover:-translate-y-0.5 hover:shadow-brutal'
            }`}
          >
            All Categories
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.code}
              onClick={() => setSelectedCategory(cat.code)}
              className={`px-4 py-2 font-mono uppercase text-xs tracking-tight-mono transition-all duration-brutal whitespace-nowrap ${
                selectedCategory === cat.code
                  ? 'bg-ink text-white shadow-brutal'
                  : 'bg-white border border-ink text-ink hover:-translate-y-0.5 hover:shadow-brutal'
              }`}
            >
              {cat.code}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <input
          type="text"
          placeholder="Search pending patterns..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 border-2 border-ink font-mono text-sm focus:border-link-blue focus:outline-none transition-colors duration-brutal"
        />
      </div>

      {/* Grid Layout or Empty State */}
      {filteredPending.length === 0 ? (
        <div className="bg-white border-2 border-ink p-16 text-center shadow-brutal">
          <i className="fas fa-check-circle text-terminal-green text-5xl mb-6"></i>
          <h3 className="text-2xl font-bold font-mono uppercase text-ink mb-3 tracking-tight-mono">
            {pendingImplementations.length === 0 ? 'No Pending Submissions' : 'No Results Found'}
          </h3>
          <p className="text-ink font-sans max-w-md mx-auto">
            {pendingImplementations.length === 0
              ? 'All pattern implementations have been reviewed. Great job!'
              : 'Try adjusting your search or filter criteria.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPending.map(impl => (
            <PendingImplementationCard
              key={impl.uuid}
              impl={impl}
              onApprove={() => handleApprove(impl.uuid)}
              onReject={() => handleReject(impl.uuid)}
              onViewCode={() => {
                setSelectedImpl(impl);
                setShowCodeModal(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Code Preview Modal */}
      {showCodeModal && selectedImpl && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-2 border-ink shadow-terminal max-w-4xl w-full max-h-[90vh] overflow-auto">
            {/* Modal Header */}
            <div className="bg-ink text-white px-6 py-4 flex justify-between items-center border-b-2 border-ink sticky top-0">
              <div>
                <h3 className="text-xl font-mono uppercase tracking-tight-mono">{selectedImpl.patternId} - Code Preview</h3>
                <p className="text-sm font-sans text-white/80">by {selectedImpl.authorName}</p>
              </div>
              <button
                onClick={() => setShowCodeModal(false)}
                className="text-white hover:text-terminal-red transition-colors duration-brutal text-2xl"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 space-y-6">
              {/* SAS Code */}
              {selectedImpl.sasCode && (
                <div>
                  <h4 className="text-sm font-mono uppercase tracking-tight-mono text-ink mb-2 border-b border-ink pb-2">SAS Implementation</h4>
                  <pre className="bg-canvas border border-ink p-4 text-xs font-mono text-ink overflow-x-auto">
                    {selectedImpl.sasCode}
                  </pre>
                </div>
              )}

              {/* R Code */}
              {selectedImpl.rCode && (
                <div>
                  <h4 className="text-sm font-mono uppercase tracking-tight-mono text-ink mb-2 border-b border-ink pb-2">R Implementation</h4>
                  <pre className="bg-canvas border border-ink p-4 text-xs font-mono text-ink overflow-x-auto">
                    {selectedImpl.rCode}
                  </pre>
                </div>
              )}

              {/* Considerations */}
              {selectedImpl.considerations.length > 0 && (
                <div>
                  <h4 className="text-sm font-mono uppercase tracking-tight-mono text-ink mb-2 border-b border-ink pb-2">Key Considerations</h4>
                  <ul className="list-disc list-inside text-sm text-ink space-y-1 font-sans">
                    {selectedImpl.considerations.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Variations */}
              {selectedImpl.variations.length > 0 && (
                <div>
                  <h4 className="text-sm font-mono uppercase tracking-tight-mono text-ink mb-2 border-b border-ink pb-2">Common Variations</h4>
                  <ul className="list-disc list-inside text-sm text-ink space-y-1 font-sans">
                    {selectedImpl.variations.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t-2 border-ink bg-canvas px-6 py-4 flex justify-end gap-3 sticky bottom-0">
              <button
                onClick={() => {
                  handleReject(selectedImpl.uuid);
                  setShowCodeModal(false);
                }}
                disabled={processingUuid === selectedImpl.uuid}
                className="bg-terminal-red hover:bg-terminal-red/80 text-white px-6 py-3 text-sm font-medium font-mono uppercase transition-colors duration-brutal border border-ink disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processingUuid === selectedImpl.uuid ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Processing...
                  </>
                ) : (
                  <>
                    <i className="fas fa-times-circle mr-2"></i>
                    Reject
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  handleApprove(selectedImpl.uuid);
                  setShowCodeModal(false);
                }}
                disabled={processingUuid === selectedImpl.uuid}
                className="bg-terminal-green hover:bg-terminal-green/80 text-white px-6 py-3 text-sm font-medium font-mono uppercase transition-colors duration-brutal border border-ink disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processingUuid === selectedImpl.uuid ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Processing...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check-circle mr-2"></i>
                    Approve
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Admin Pattern Management Components ---

const UnifiedPatternModal = ({
  pattern,
  implementations,
  initialTab,
  initialImplementationUuid,
  userRole,
  onSave,
  onClose,
}: {
  pattern: PatternDefinition | null;
  implementations: Array<PatternImplementation & { authorId?: string }>;
  initialTab?: 'definition' | 'implementation';
  initialImplementationUuid?: string;
  userRole: Role;
  onSave: (definitionData?: Partial<PatternDefinition>, implementationData?: { uuid: string; data: any }) => Promise<void>;
  onClose: () => void;
}) => {
  const [activeTab, setActiveTab] = useState<'definition' | 'implementation'>(initialTab || 'definition');
  const [selectedImplUuid, setSelectedImplUuid] = useState<string>(
    initialImplementationUuid || implementations[0]?.uuid || ''
  );

  const selectedImpl = implementations.find(impl => impl.uuid === selectedImplUuid);

  const [definitionForm, setDefinitionForm] = useState({
    id: pattern?.id || '',
    category: pattern?.category || 'IMP',
    title: pattern?.title || '',
    problem: pattern?.problem || '',
    whenToUse: pattern?.whenToUse || '',
  });

  const [implementationForm, setImplementationForm] = useState({
    author: selectedImpl?.authorName || '',
    sasCode: selectedImpl?.sasCode || '',
    rCode: selectedImpl?.rCode || '',
    considerations: selectedImpl?.considerations?.join('\n') || '',
    variations: selectedImpl?.variations?.join('\n') || '',
    status: selectedImpl?.status || 'pending',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [definitionDirty, setDefinitionDirty] = useState(false);
  const [implementationDirty, setImplementationDirty] = useState(false);

  // Update implementation form when selection changes
  useEffect(() => {
    if (selectedImpl) {
      setImplementationForm({
        author: selectedImpl.authorName,
        sasCode: selectedImpl.sasCode,
        rCode: selectedImpl.rCode,
        considerations: selectedImpl.considerations?.join('\n') || '',
        variations: selectedImpl.variations?.join('\n') || '',
        status: selectedImpl.status,
      });
      setImplementationDirty(false);
    }
  }, [selectedImplUuid, selectedImpl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate based on which tab(s) are dirty
    if (definitionDirty) {
      if (!definitionForm.id.match(/^[A-Z]{3}-\d{3}$/)) {
        setError('Pattern ID must be in format XXX-NNN (e.g., IMP-001)');
        return;
      }
      if (!definitionForm.title || !definitionForm.problem || !definitionForm.whenToUse) {
        setError('All definition fields are required');
        return;
      }
    }

    if (implementationDirty && activeTab === 'implementation') {
      if (!implementationForm.sasCode || !implementationForm.rCode) {
        setError('Both SAS Code and R Code are required');
        return;
      }
    }

    setSaving(true);
    try {
      const defData = definitionDirty ? definitionForm : undefined;
      const implData = implementationDirty && selectedImplUuid ? {
        uuid: selectedImplUuid,
        data: {
          sasCode: implementationForm.sasCode,
          rCode: implementationForm.rCode,
          considerations: implementationForm.considerations
            .split('\n')
            .map(s => s.trim())
            .filter(Boolean),
          variations: implementationForm.variations
            .split('\n')
            .map(s => s.trim())
            .filter(Boolean),
          status: userRole === 'admin' ? implementationForm.status : undefined,
        }
      } : undefined;

      await onSave(defData, implData);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {pattern ? `Edit Pattern: ${pattern.id}` : 'Create New Pattern'}
          </h2>
          <button onClick={onClose} className="text-white hover:text-slate-200">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        {/* Tab Navigation */}
        {pattern && implementations.length > 0 && (
          <div className="flex border-b border-slate-200 bg-slate-50">
            <button
              onClick={() => setActiveTab('definition')}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === 'definition'
                  ? 'border-b-2 border-indigo-600 text-indigo-600 bg-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <i className="fas fa-file-alt mr-2"></i>
              Definition
              {definitionDirty && <span className="ml-2 text-orange-500">*</span>}
            </button>
            <button
              onClick={() => setActiveTab('implementation')}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === 'implementation'
                  ? 'border-b-2 border-indigo-600 text-indigo-600 bg-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <i className="fas fa-code mr-2"></i>
              Implementation
              {implementationDirty && <span className="ml-2 text-orange-500">*</span>}
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* DEFINITION TAB */}
          {activeTab === 'definition' && (
            <>
              {/* Pattern ID */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Pattern ID *
                </label>
                <input
                  type="text"
                  value={definitionForm.id}
                  onChange={(e) => {
                    setDefinitionForm({ ...definitionForm, id: e.target.value.toUpperCase() });
                    setDefinitionDirty(true);
                  }}
                  disabled={!!pattern}
                  placeholder="IMP-001"
                  className="w-full p-2 border border-slate-300 rounded-md text-sm disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-slate-500 mt-1">Format: XXX-NNN (e.g., IMP-001)</p>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Category *
                </label>
                <select
                  value={definitionForm.category}
                  onChange={(e) => {
                    setDefinitionForm({ ...definitionForm, category: e.target.value });
                    setDefinitionDirty(true);
                  }}
                  className="w-full p-2 border border-slate-300 rounded-md text-sm"
                >
                  <option value="IMP">IMP - Imputation</option>
                  <option value="DER">DER - Derivations</option>
                  <option value="DAT">DAT - Date/Time</option>
                  <option value="RSH">RSH - Reshaping</option>
                  <option value="AGG">AGG - Aggregation</option>
                  <option value="MRG">MRG - Merging</option>
                  <option value="CAT">CAT - Categorization</option>
                  <option value="FLG">FLG - Flagging</option>
                  <option value="SRT">SRT - Sorting</option>
                  <option value="FMT">FMT - Formatting</option>
                  <option value="VAL">VAL - Validation</option>
                  <option value="CDS">CDS - CDISC</option>
                  <option value="STA">STA - Statistics</option>
                  <option value="OPT">OPT - Optimization</option>
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={definitionForm.title}
                  onChange={(e) => {
                    setDefinitionForm({ ...definitionForm, title: e.target.value });
                    setDefinitionDirty(true);
                  }}
                  className="w-full p-2 border border-slate-300 rounded-md text-sm"
                  placeholder="e.g., Last Observation Carried Forward"
                />
              </div>

              {/* Problem */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Problem Statement *
                </label>
                <textarea
                  value={definitionForm.problem}
                  onChange={(e) => {
                    setDefinitionForm({ ...definitionForm, problem: e.target.value });
                    setDefinitionDirty(true);
                  }}
                  rows={4}
                  className="w-full p-2 border border-slate-300 rounded-md text-sm"
                  placeholder="Describe the problem this pattern solves..."
                />
              </div>

              {/* When to Use */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  When to Use *
                </label>
                <textarea
                  value={definitionForm.whenToUse}
                  onChange={(e) => {
                    setDefinitionForm({ ...definitionForm, whenToUse: e.target.value });
                    setDefinitionDirty(true);
                  }}
                  rows={4}
                  className="w-full p-2 border border-slate-300 rounded-md text-sm"
                  placeholder="Describe when to use this pattern..."
                />
              </div>
            </>
          )}

          {/* IMPLEMENTATION TAB */}
          {activeTab === 'implementation' && implementations.length > 0 && (
            <>
              {/* Implementation Selector */}
              {implementations.length > 1 && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Select Implementation
                  </label>
                  <select
                    value={selectedImplUuid}
                    onChange={(e) => setSelectedImplUuid(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-md text-sm"
                  >
                    {implementations.map(impl => (
                      <option key={impl.uuid} value={impl.uuid}>
                        {impl.author} - {impl.status} ({impl.uuid.substring(0, 8)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Author (read-only) */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Author
                </label>
                <input
                  type="text"
                  value={implementationForm.author}
                  disabled
                  className="w-full p-2 border border-slate-300 rounded-md text-sm bg-slate-100 cursor-not-allowed"
                />
              </div>

              {/* SAS Code */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  SAS Code *
                </label>
                <textarea
                  value={implementationForm.sasCode}
                  onChange={(e) => {
                    setImplementationForm({ ...implementationForm, sasCode: e.target.value });
                    setImplementationDirty(true);
                  }}
                  rows={10}
                  className="w-full p-2 border border-slate-300 rounded-md text-sm font-mono"
                  placeholder="/* SAS code here */"
                />
              </div>

              {/* R Code */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  R Code *
                </label>
                <textarea
                  value={implementationForm.rCode}
                  onChange={(e) => {
                    setImplementationForm({ ...implementationForm, rCode: e.target.value });
                    setImplementationDirty(true);
                  }}
                  rows={10}
                  className="w-full p-2 border border-slate-300 rounded-md text-sm font-mono"
                  placeholder="# R code here"
                />
              </div>

              {/* Considerations */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Key Considerations
                </label>
                <textarea
                  value={implementationForm.considerations}
                  onChange={(e) => {
                    setImplementationForm({ ...implementationForm, considerations: e.target.value });
                    setImplementationDirty(true);
                  }}
                  rows={4}
                  className="w-full p-2 border border-slate-300 rounded-md text-sm"
                  placeholder="One consideration per line..."
                />
                <p className="text-xs text-slate-500 mt-1">Enter each consideration on a new line</p>
              </div>

              {/* Variations */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Common Variations
                </label>
                <textarea
                  value={implementationForm.variations}
                  onChange={(e) => {
                    setImplementationForm({ ...implementationForm, variations: e.target.value });
                    setImplementationDirty(true);
                  }}
                  rows={4}
                  className="w-full p-2 border border-slate-300 rounded-md text-sm"
                  placeholder="One variation per line..."
                />
                <p className="text-xs text-slate-500 mt-1">Enter each variation on a new line</p>
              </div>

              {/* Status (admin only) */}
              {userRole === 'admin' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={implementationForm.status}
                    onChange={(e) => {
                      setImplementationForm({ ...implementationForm, status: e.target.value as 'active' | 'pending' });
                      setImplementationDirty(true);
                    }}
                    className="w-full p-2 border border-slate-300 rounded-md text-sm"
                  >
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                  </select>
                </div>
              )}
            </>
          )}

          {/* Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || (!definitionDirty && !implementationDirty)}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {saving ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Saving...
                </>
              ) : (
                <>
                  <i className="fas fa-save mr-2"></i>
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


const ImplementationsTable = ({
  implementations,
  onEdit,
  onDelete,
}: {
  implementations: Array<PatternImplementation & {
    isDeleted?: boolean;
    patternTitle?: string;
    patternCategory?: string;
    createdAt?: string;
  }>;
  onEdit: (implementation: PatternImplementation & { patternId?: string }) => void;
  onDelete: (uuid: string) => void;
}) => {
  if (implementations.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 text-center">
        <i className="fas fa-folder-open text-4xl text-slate-300 mb-4"></i>
        <p className="text-slate-500">No implementations found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {implementations.map((implementation) => (
        <div
          key={implementation.uuid}
          className={`bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow ${
            implementation.isDeleted ? 'bg-slate-50 opacity-60' : ''
          }`}
        >
          <div className="flex items-start justify-between">
            {/* Left: Implementation Info */}
            <div className="flex-grow">
              {/* Badges row */}
              <div className="flex items-center space-x-3 mb-2">
                <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-mono rounded">
                  {implementation.uuid.substring(0, 8)}...
                </span>
                <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-mono rounded">
                  {implementation.patternId}
                </span>
                {implementation.patternCategory && (
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded">
                    {implementation.patternCategory}
                  </span>
                )}
                <span className={`px-2 py-1 text-xs font-semibold rounded ${
                  implementation.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {implementation.status}
                </span>
                {implementation.isDeleted && (
                  <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">
                    Deleted
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 className={`text-lg font-bold ${
                implementation.isDeleted ? 'line-through text-slate-400' : 'text-slate-900'
              }`}>
                {implementation.patternTitle || implementation.patternId}
              </h3>

              {/* Author & Date */}
              <div className="flex items-center space-x-4 mt-1">
                <p className="text-sm text-slate-600">
                  <i className="fas fa-user mr-1"></i>
                  Author: {implementation.author}
                </p>
                {implementation.createdAt && (
                  <p className="text-sm text-slate-500">
                    <i className="fas fa-clock mr-1"></i>
                    Submitted: {formatRelativeTime(implementation.createdAt)}
                  </p>
                )}
              </div>
            </div>

            {/* Right: Actions */}
            {!implementation.isDeleted && (
              <div className="flex space-x-2 ml-4">
                <button
                  onClick={() => onEdit(implementation)}
                  className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center"
                >
                  <i className="fas fa-edit mr-2"></i>
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to delete this implementation?`)) {
                      onDelete(implementation.uuid);
                    }
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center"
                >
                  <i className="fas fa-trash mr-2"></i>
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

const PatternDefinitionsTable = ({
  patterns,
  onEdit,
  onDelete,
}: {
  patterns: Array<PatternDefinition & { isDeleted?: boolean; createdAt?: string }>;
  onEdit: (pattern: PatternDefinition) => void;
  onDelete: (patternId: string) => void;
}) => {
  if (patterns.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 text-center">
        <i className="fas fa-folder-open text-4xl text-slate-300 mb-4"></i>
        <p className="text-slate-500">No patterns found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {patterns.map((pattern) => (
        <div
          key={pattern.id}
          className={`bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow ${
            pattern.isDeleted ? 'bg-slate-50 opacity-60' : ''
          }`}
        >
          <div className="flex items-start justify-between">
            {/* Left: Pattern Info */}
            <div className="flex-grow">
              <div className="flex items-center space-x-3 mb-2">
                <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-mono rounded">
                  {pattern.id}
                </span>
                <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded">
                  {pattern.category}
                </span>
                {pattern.isDeleted && (
                  <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">
                    Deleted
                  </span>
                )}
              </div>
              <h3 className={`text-lg font-bold ${pattern.isDeleted ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                {pattern.title}
              </h3>
              {pattern.createdAt && (
                <p className="text-sm text-slate-500 mt-1">
                  Created: {formatRelativeTime(pattern.createdAt)}
                </p>
              )}
              <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                {pattern.problem}
              </p>
            </div>

            {/* Right: Actions */}
            {!pattern.isDeleted && (
              <div className="flex space-x-2 ml-4">
                <button
                  onClick={() => onEdit(pattern)}
                  className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center"
                >
                  <i className="fas fa-edit mr-2"></i>
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to delete pattern ${pattern.id}?`)) {
                      onDelete(pattern.id);
                    }
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center"
                >
                  <i className="fas fa-trash mr-2"></i>
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

const AdminPatternManager = ({
  onBack,
  userRole,
}: {
  onBack: () => void;
  userRole: Role;
}) => {
  const [patterns, setPatterns] = useState<Array<PatternDefinition & { isDeleted?: boolean; createdAt?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"definitions" | "implementations">("definitions");
  const [editingPattern, setEditingPattern] = useState<PatternDefinition | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalInitialTab, setModalInitialTab] = useState<'definition' | 'implementation'>('definition');
  const [modalInitialImplUuid, setModalInitialImplUuid] = useState<string | undefined>(undefined);
  const [modalImplementations, setModalImplementations] = useState<Array<PatternImplementation & { authorId?: string }>>([]);
  const [implementations, setImplementations] = useState<Array<PatternImplementation & {
    isDeleted?: boolean;
    patternTitle?: string;
    patternCategory?: string;
    createdAt?: string;
  }>>([]);
  const [implementationsLoading, setImplementationsLoading] = useState(false);

  const { getToken } = useAuth();

  // Fetch patterns
  useEffect(() => {
    fetchPatterns();
  }, [showDeleted]);

  const fetchPatterns = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setError("Authentication required");
        setLoading(false);
        return;
      }

      const url = `/api/patterns${showDeleted ? '?includeDeleted=true' : ''}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch patterns: ${response.statusText}`);
      }

      const data = await response.json();
      setPatterns(data.patterns || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchImplementations = async () => {
    setImplementationsLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setError("Authentication required");
        setImplementationsLoading(false);
        return;
      }

      const url = `/api/implementations?status=pending${showDeleted ? '&includeDeleted=true' : ''}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch implementations: ${response.statusText}`);
      }

      const data = await response.json();
      setImplementations(data.implementations || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImplementationsLoading(false);
    }
  };

  // Fetch implementations when tab changes
  useEffect(() => {
    if (activeTab === "implementations") {
      fetchImplementations();
    }
  }, [activeTab, showDeleted]);

  // Filter patterns (client-side)
  const filteredPatterns = patterns.filter(p => {
    const matchesSearch =
      p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Filter implementations (client-side)
  const filteredImplementations = implementations.filter(impl => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      impl.patternId?.toLowerCase().includes(search) ||
      impl.author?.toLowerCase().includes(search) ||
      impl.patternTitle?.toLowerCase().includes(search)
    );
  });

  // Handle save (create or update) - supports both definitions and implementations
  const handleSave = async (
    definitionData?: Partial<PatternDefinition>,
    implementationData?: { uuid: string; data: any }
  ) => {
    const token = await getToken();
    if (!token) throw new Error("Authentication required");

    const promises = [];

    // Update pattern definition if provided
    if (definitionData) {
      if (editingPattern) {
        // Update existing pattern
        promises.push(
          fetch(`/api/patterns/${editingPattern.id}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(definitionData)
          }).then(async (response) => {
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to update pattern');
            }
          })
        );
      } else {
        // Create new pattern
        promises.push(
          fetch('/api/patterns', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(definitionData)
          }).then(async (response) => {
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to create pattern');
            }
          })
        );
      }
    }

    // Update implementation if provided
    if (implementationData) {
      promises.push(
        fetch(`/api/implementations/${implementationData.uuid}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(implementationData.data)
        }).then(async (response) => {
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update implementation');
          }
        })
      );
    }

    // Execute all updates in parallel
    await Promise.all(promises);

    // Refresh both lists
    await Promise.all([
      fetchPatterns(),
      activeTab === 'implementations' ? fetchImplementations() : Promise.resolve()
    ]);
  };

  // Handle delete
  const handleDelete = async (patternId: string) => {
    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication required");

      const response = await fetch(`/api/patterns/${patternId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete pattern');
      }

      // Refresh patterns list
      await fetchPatterns();
    } catch (err: any) {
      alert(`Error deleting pattern: ${err.message}`);
    }
  };

  // Handle delete implementation
  const handleDeleteImplementation = async (uuid: string) => {
    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication required");

      const response = await fetch(`/api/implementations/${uuid}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete implementation');
      }

      // Refresh implementations list
      await fetchImplementations();
    } catch (err: any) {
      alert(`Error deleting implementation: ${err.message}`);
    }
  };

  // Handle edit pattern - opens modal on Definition tab
  const handleEditPattern = async (pattern: PatternDefinition) => {
    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication required");

      // Fetch implementations for this pattern
      const response = await fetch(`/api/implementations?patternId=${pattern.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch implementations');
      }

      const data = await response.json();
      const impls = data.implementations || [];

      // Prefer System author if exists, otherwise first one
      const systemImpl = impls.find((impl: any) => impl.author === 'System');
      const defaultImpl = systemImpl || impls[0];

      setEditingPattern(pattern);
      setModalImplementations(impls);
      setModalInitialTab('definition');
      setModalInitialImplUuid(defaultImpl?.uuid);
      setShowModal(true);
    } catch (err: any) {
      alert(`Error loading pattern: ${err.message}`);
    }
  };

  // Handle edit implementation - opens modal on Implementation tab
  const handleEditImplementation = async (implementation: PatternImplementation & { patternId?: string }) => {
    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication required");

      // Fetch the pattern definition for context
      const patternResponse = await fetch(`/api/patterns/${implementation.patternId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!patternResponse.ok) {
        throw new Error('Failed to fetch pattern definition');
      }

      const patternData = await patternResponse.json();

      // Fetch all implementations for this pattern
      const implResponse = await fetch(`/api/implementations?patternId=${implementation.patternId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!implResponse.ok) {
        throw new Error('Failed to fetch implementations');
      }

      const implData = await implResponse.json();

      setEditingPattern(patternData.pattern);
      setModalImplementations(implData.implementations || []);
      setModalInitialTab('implementation');
      setModalInitialImplUuid(implementation.uuid);
      setShowModal(true);
    } catch (err: any) {
      alert(`Error loading implementation: ${err.message}`);
    }
  };

  if (userRole !== 'admin') {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white border-2 border-terminal-red p-8 text-center shadow-brutal">
          <i className="fas fa-exclamation-triangle text-terminal-red text-4xl mb-4"></i>
          <h3 className="text-xl font-semibold font-mono uppercase text-ink mb-2 tracking-tight-mono">Access Denied</h3>
          <p className="text-ink font-sans">Admin role required to access this feature.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold font-mono uppercase text-ink tracking-wide-head">Admin Pattern Management</h1>
        <button
          onClick={onBack}
          className="bg-ink hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal text-white px-6 py-3 text-sm font-medium font-mono uppercase transition-all duration-brutal border border-ink flex items-center"
        >
          <i className="fas fa-arrow-left mr-2"></i>
          Back
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b-2 border-ink mb-8">
        <button
          onClick={() => setActiveTab("definitions")}
          className={`px-8 py-4 font-mono uppercase text-sm tracking-tight-mono transition-colors duration-brutal ${
            activeTab === "definitions"
              ? "bg-ink text-white border-t-2 border-x-2 border-ink -mb-[2px]"
              : "text-ink hover:bg-canvas"
          }`}
        >
          Pattern Definitions
        </button>
        <button
          onClick={() => setActiveTab("implementations")}
          className={`px-8 py-4 font-mono uppercase text-sm tracking-tight-mono transition-colors duration-brutal ${
            activeTab === "implementations"
              ? "bg-ink text-white border-t-2 border-x-2 border-ink -mb-[2px]"
              : "text-ink hover:bg-canvas"
          }`}
        >
          Implementations
        </button>
      </div>

      {/* Filters & Controls */}
      {activeTab === "definitions" ? (
        <div className="mb-8">
          {/* Category Filters */}
          <div className="flex gap-2 overflow-x-auto pb-4 mb-4">
            <button
              onClick={() => setCategoryFilter("all")}
              className={`px-4 py-2 font-mono uppercase text-xs tracking-tight-mono transition-all duration-brutal whitespace-nowrap ${
                categoryFilter === "all"
                  ? 'bg-ink text-white shadow-brutal'
                  : 'bg-white border border-ink text-ink hover:-translate-y-0.5 hover:shadow-brutal'
              }`}
            >
              All Categories
            </button>
            {CATEGORIES.map(cat => (
              <button
                key={cat.code}
                onClick={() => setCategoryFilter(cat.code)}
                className={`px-4 py-2 font-mono uppercase text-xs tracking-tight-mono transition-all duration-brutal whitespace-nowrap ${
                  categoryFilter === cat.code
                    ? 'bg-ink text-white shadow-brutal'
                    : 'bg-white border border-ink text-ink hover:-translate-y-0.5 hover:shadow-brutal'
                }`}
              >
                {cat.code}
              </button>
            ))}
          </div>

          {/* Search & Create Row */}
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Search by ID or title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-3 border-2 border-ink font-mono text-sm focus:border-link-blue focus:outline-none transition-colors duration-brutal"
            />

            {/* Show Deleted Checkbox */}
            <label className="flex items-center space-x-2 px-4 py-3 bg-white border border-ink">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
                className="w-4 h-4 accent-ink"
              />
              <span className="text-sm font-mono uppercase text-ink tracking-tight-mono">Show Deleted</span>
            </label>

            {/* Create New Button */}
            <button
              onClick={() => {
                setEditingPattern(null);
                setShowModal(true);
              }}
              className="bg-ink hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal text-white px-6 py-3 text-sm font-medium font-mono uppercase transition-all duration-brutal border border-ink flex items-center whitespace-nowrap"
            >
              <i className="fas fa-plus mr-2"></i>
              Create New
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-8">
          <div className="flex gap-4">
            {/* Search */}
            <input
              type="text"
              placeholder="Search by Pattern ID, author, or title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-3 border-2 border-ink font-mono text-sm focus:border-link-blue focus:outline-none transition-colors duration-brutal"
            />

            {/* Show Deleted Checkbox */}
            <label className="flex items-center space-x-2 px-4 py-3 bg-white border border-ink">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
                className="w-4 h-4 accent-ink"
              />
              <span className="text-sm font-mono uppercase text-ink tracking-tight-mono">Show Deleted</span>
            </label>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-white border-2 border-terminal-red p-8 text-center shadow-brutal mb-8">
          <i className="fas fa-exclamation-triangle text-terminal-red text-4xl mb-4"></i>
          <h3 className="text-xl font-semibold font-mono uppercase text-ink mb-2 tracking-tight-mono">Error</h3>
          <p className="text-ink font-sans">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white border-2 border-ink p-16 text-center shadow-brutal">
          <div className="inline-block animate-spin w-12 h-12 border-2 border-ink border-t-transparent mb-4"></div>
          <p className="text-ink font-mono uppercase tracking-tight-mono">Loading patterns...</p>
        </div>
      )}

      {/* Pattern Definitions Grid */}
      {!loading && activeTab === "definitions" && (
        filteredPatterns.length === 0 ? (
          <div className="bg-white border-2 border-ink p-16 text-center shadow-brutal">
            <i className="fas fa-folder-open text-ink/40 text-5xl mb-6"></i>
            <h3 className="text-2xl font-bold font-mono uppercase text-ink mb-3 tracking-tight-mono">No Patterns Found</h3>
            <p className="text-ink font-sans max-w-md mx-auto">
              {searchTerm || categoryFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'No patterns available. Create your first pattern to get started.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPatterns.map(pattern => {
              const implCount = implementations.filter(
                impl => impl.patternId === pattern.id
              ).length;

              return (
                <PatternCardAdmin
                  key={pattern.id}
                  def={pattern}
                  implCount={implCount}
                  onView={() => {
                    // View pattern detail in catalog (optional navigation)
                    handleEditPattern(pattern);
                  }}
                  onEdit={() => handleEditPattern(pattern)}
                  onDelete={() => {
                    if (window.confirm(`Are you sure you want to delete pattern ${pattern.id}?`)) {
                      handleDelete(pattern.id);
                    }
                  }}
                />
              );
            })}
          </div>
        )
      )}

      {/* Implementations Tab */}
      {activeTab === "implementations" && (
        implementationsLoading ? (
          <div className="bg-white border-2 border-ink p-16 text-center shadow-brutal">
            <div className="inline-block animate-spin w-12 h-12 border-2 border-ink border-t-transparent mb-4"></div>
            <p className="text-ink font-mono uppercase tracking-tight-mono">Loading implementations...</p>
          </div>
        ) : filteredImplementations.length === 0 ? (
          <div className="bg-white border-2 border-ink p-16 text-center shadow-brutal">
            <i className="fas fa-folder-open text-ink/40 text-5xl mb-6"></i>
            <h3 className="text-2xl font-bold font-mono uppercase text-ink mb-3 tracking-tight-mono">No Implementations Found</h3>
            <p className="text-ink font-sans max-w-md mx-auto">
              {searchTerm ? 'Try adjusting your search criteria.' : 'No implementations available.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredImplementations.map(impl => (
              <ImplementationCardAdmin
                key={impl.uuid}
                impl={impl}
                onEdit={() => handleEditImplementation(impl)}
                onDelete={() => {
                  if (window.confirm('Are you sure you want to delete this implementation?')) {
                    handleDeleteImplementation(impl.uuid);
                  }
                }}
              />
            ))}
          </div>
        )
      )}

      {/* Modal */}
      {showModal && (
        <UnifiedPatternModal
          pattern={editingPattern}
          implementations={modalImplementations}
          initialTab={modalInitialTab}
          initialImplementationUuid={modalInitialImplUuid}
          userRole={userRole}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

const MyContributions = ({
  onEdit,
  onContribute
}: {
  onEdit: (impl: PatternImplementation) => void;
  onContribute: () => void;
}) => {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contributions, setContributions] = useState<Array<{
    uuid: string;
    patternId: string;
    patternTitle: string;
    patternCategory: string;
    sasCode: string;
    rCode: string;
    considerations: string[];
    variations: string[];
    status: "pending" | "active" | "rejected";
    createdAt: string;
    updatedAt: string;
  }>>([]);

  useEffect(() => {
    const fetchContributions = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = await getToken();
        if (!token) {
          setError("Please sign in to view your contributions");
          setLoading(false);
          return;
        }

        const response = await fetch('/api/implementations?author_id=me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("Please sign in to view your contributions");
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setContributions(data.implementations || []);
      } catch (err) {
        console.error('Failed to fetch contributions:', err);
        setError(err instanceof Error ? err.message : 'Failed to load contributions');
      } finally {
        setLoading(false);
      }
    };

    fetchContributions();
  }, [getToken]);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getCodePreview = (sasCode: string, rCode: string) => {
    const code = sasCode || rCode || "";
    const lines = code.split('\n').filter(l => l.trim()).slice(0, 3);
    return lines.length > 0 ? lines.join('\n') : "No code preview available";
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <div className="text-slate-700 text-lg">Loading your contributions...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <i className="fas fa-exclamation-triangle text-red-500 text-3xl mb-3"></i>
          <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Contributions</h3>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (contributions.length === 0) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fas fa-folder-open text-indigo-500 text-3xl"></i>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-3">No Contributions Yet</h3>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            You haven't submitted any pattern implementations yet. Share your expertise with the community!
          </p>
          <button
            onClick={onContribute}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm inline-flex items-center"
          >
            <i className="fas fa-plus-circle mr-2"></i>
            Contribute Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">My Contributions</h2>
        <p className="text-slate-600">
          You have submitted {contributions.length} pattern implementation{contributions.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="space-y-4">
        {contributions.map((contribution) => {
          const isPending = contribution.status === 'pending';
          const isActive = contribution.status === 'active';
          const isRejected = contribution.status === 'rejected';

          return (
            <div
              key={contribution.uuid}
              className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-grow">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-mono font-semibold rounded">
                        {contribution.patternId}
                      </span>
                      <h3 className="text-lg font-bold text-slate-900">
                        {contribution.patternTitle}
                      </h3>
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusBadgeClass(contribution.status)}`}>
                        {contribution.status.charAt(0).toUpperCase() + contribution.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">
                      Category: {contribution.patternCategory} | Submitted: {formatRelativeTime(contribution.createdAt)}
                      {contribution.updatedAt !== contribution.createdAt && (
                        <> | Updated: {formatRelativeTime(contribution.updatedAt)}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {isPending && (
                      <button
                        onClick={() => {
                          const impl: PatternImplementation = {
                            uuid: contribution.uuid,
                            patternId: contribution.patternId,
                            author: CURRENT_USER,
                            sasCode: contribution.sasCode,
                            rCode: contribution.rCode,
                            considerations: contribution.considerations,
                            variations: contribution.variations,
                            status: contribution.status,
                            isPremium: false,
                            timestamp: new Date(contribution.updatedAt).getTime()
                          };
                          onEdit(impl);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                      >
                        <i className="fas fa-edit mr-2"></i>
                        Edit
                      </button>
                    )}
                    {(isActive || isRejected) && (
                      <span className="text-sm text-slate-500 italic">
                        {isActive ? 'Published' : 'View Only'}
                      </span>
                    )}
                  </div>
                </div>

                {/* SAS Code Preview */}
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <h4 className="text-xs font-semibold text-slate-700 uppercase mb-2">SAS Code Preview</h4>
                  {contribution.sasCode ? (
                    <>
                      <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap overflow-hidden">
                        {contribution.sasCode.split('\n').filter(l => l.trim()).slice(0, 3).join('\n')}
                      </pre>
                      {contribution.sasCode.split('\n').length > 3 && (
                        <p className="text-xs text-slate-500 mt-2 italic">...</p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-slate-500 italic">(Not provided)</p>
                  )}
                </div>

                {/* R Code Preview */}
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 mt-4">
                  <h4 className="text-xs font-semibold text-slate-700 uppercase mb-2">R Code Preview</h4>
                  {contribution.rCode ? (
                    <>
                      <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap overflow-hidden">
                        {contribution.rCode.split('\n').filter(l => l.trim()).slice(0, 3).join('\n')}
                      </pre>
                      {contribution.rCode.split('\n').length > 3 && (
                        <p className="text-xs text-slate-500 mt-2 italic">...</p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-slate-500 italic">(Not provided)</p>
                  )}
                </div>

                {contribution.considerations.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-xs font-semibold text-slate-700 uppercase mb-1">Considerations</h4>
                    <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                      {contribution.considerations.slice(0, 2).map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                      {contribution.considerations.length > 2 && (
                        <li className="text-slate-500 italic">+ {contribution.considerations.length - 2} more...</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const BasketView = ({
  basket,
  defs,
  impls,
  onClear,
  onRemove,
  onReset
}: {
  basket: Record<string, string>,
  defs: PatternDefinition[],
  impls: PatternImplementation[],
  onClear: () => void,
  onRemove: (patternId: string) => void,
  onReset: (patternId: string) => void
}) => {
  const [activeCategory, setActiveCategory] = useState("ALL");

  // 1. Prepare Enriched Data
  const enrichedItems = useMemo(() => {
    return Object.entries(basket).map(([patId, implUuid]) => {
      const def = defs.find(d => d.id === patId);
      const impl = impls.find(i => i.uuid === implUuid);
      return { def, impl };
    }).filter(p => p.def && p.impl) as { def: PatternDefinition, impl: PatternImplementation }[];
  }, [basket, defs, impls]);

  // 2. Statistics
  const stats = useMemo(() => {
    return {
      total: enrichedItems.length,
      custom: enrichedItems.filter(i => i.impl.author !== SYSTEM_AUTHOR).length,
      system: enrichedItems.filter(i => i.impl.author === SYSTEM_AUTHOR).length
    };
  }, [enrichedItems]);

  // 3. Category Groups (For Sidebar)
  const categoryStats = useMemo(() => {
    return CATEGORIES.map(cat => {
      const itemsInCat = enrichedItems.filter(i => i.def.category === cat.code);
      const hasCustom = itemsInCat.some(i => i.impl.author !== SYSTEM_AUTHOR);
      return { 
        ...cat, 
        count: itemsInCat.length, 
        hasCustom 
      };
    });
  }, [enrichedItems]);

  // 4. Display Logic
  const displayedItems = useMemo(() => {
      return activeCategory === "ALL"
          ? enrichedItems
          : enrichedItems.filter(i => i.def.category === activeCategory);
  }, [activeCategory, enrichedItems]);

  const exportData = async () => {
      try {
        const zip = new JSZip();

        // 1. Generate and add SKILL.md to root
        const skillMdContent = generateSkillMd(enrichedItems);
        zip.file("SKILL.md", skillMdContent);

        // 2. Create references folder structure and add pattern files
        const categoryFolders: Record<string, JSZip | null> = {};

        // Initialize category folders
        CATEGORIES.forEach(cat => {
          categoryFolders[cat.code] = zip.folder(cat.path);
        });

        // Add each pattern file to its category folder
        enrichedItems.forEach(({ def, impl }) => {
          const filename = getPatternFilename(def);
          const patternContent = generatePatternMarkdown(def, impl);
          const folder = categoryFolders[def.category];
          if (folder) {
            folder.file(filename, patternContent);
          }
        });

        // 3. Generate ZIP file
        const blob = await zip.generateAsync({ type: "blob" });

        // 4. Trigger download
        const url = URL.createObjectURL(blob);
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", url);
        downloadAnchorNode.setAttribute("download", "stat-programming.zip");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Error generating ZIP:", error);
        alert("Failed to generate export. Please try again.");
      }
  }

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-140px)] flex flex-col">
        {/* Dashboard Header */}
        <div className="bg-white border border-ink p-8 mb-6 flex justify-between items-center shrink-0">
            <div>
               <h2 className="text-2xl font-bold text-ink mb-2 font-mono uppercase tracking-tight-mono">Skill Basket Review</h2>
               <div className="flex space-x-6 text-sm text-ink">
                  <span className="font-mono">Total Patterns: <strong className="text-ink">{stats.total}</strong></span>
                  <span className="font-mono">System Default: <strong className="text-ink">{stats.system}</strong></span>
                  <span className="font-mono">Custom Overrides: <strong className="text-link-blue">{stats.custom}</strong></span>
               </div>
            </div>
            <div className="flex space-x-3">
                 <button onClick={onClear} className="text-terminal-red hover:text-terminal-red px-4 py-2 text-sm font-medium font-mono uppercase border border-terminal-red hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal transition-all duration-brutal">Clear All</button>
                 <button onClick={exportData} className="bg-ink hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal text-white px-6 py-2 font-semibold font-mono uppercase transition-all duration-brutal border border-ink">
                    <i className="fas fa-download mr-2"></i> Export for Agent
                 </button>
            </div>
        </div>

        {/* Split Pane */}
        <div className="flex flex-grow overflow-hidden bg-white border border-ink">
            
            {/* Left Sidebar: Categories */}
            <div className="w-64 border-r border-ink bg-canvas overflow-y-auto flex flex-col">
               <div className="p-4 border-b border-ink sticky top-0 bg-canvas z-10">
                  <h3 className="text-xs font-bold text-ink uppercase tracking-wider font-mono">Categories</h3>
               </div>
               <nav className="p-2 space-y-1">
                  <button
                     onClick={() => setActiveCategory("ALL")}
                     className={`w-full text-left px-3 py-2 text-sm font-medium flex justify-between items-center font-mono uppercase transition-all duration-brutal ${
                        activeCategory === "ALL" ? "bg-white border-2 border-ink text-link-blue" : "text-ink hover:bg-white/50"
                     }`}
                  >
                     <span>All Categories</span>
                     <span className="bg-ink text-white text-xs px-2 py-1 border border-ink">{enrichedItems.length}</span>
                  </button>
                  {categoryStats.map(cat => (
                     <button
                        key={cat.code}
                        onClick={() => setActiveCategory(cat.code)}
                        className={`w-full text-left px-3 py-2 text-sm font-medium flex justify-between items-center font-mono uppercase transition-all duration-brutal ${
                           activeCategory === cat.code ? "bg-white border-2 border-ink text-link-blue" : "text-ink hover:bg-white/50"
                        }`}
                     >
                        <div className="flex items-center">
                           {cat.hasCustom && <span className="w-2 h-2 rounded-full bg-link-blue mr-2"></span>}
                           <span>{cat.name}</span>
                        </div>
                        <span className={`${cat.count > 0 ? "bg-ink text-white" : "bg-white text-ink border border-ink"} text-xs px-2 py-1`}>
                           {cat.count}
                        </span>
                     </button>
                  ))}
               </nav>
            </div>

            {/* Right Pane: List */}
            <div className="flex-grow overflow-y-auto p-6">
               <div className="mb-4 flex justify-between items-end">
                   <h3 className="text-lg font-bold text-ink font-mono uppercase">
                      {activeCategory === "ALL" ? "All Patterns" : CATEGORIES.find(c => c.code === activeCategory)?.name}
                   </h3>
                   <span className="text-xs text-ink font-mono">{displayedItems.length} items shown</span>
               </div>

               {displayedItems.length === 0 ? (
                  <div className="text-center py-20 text-ink">
                     <p className="font-mono">No patterns in this category.</p>
                  </div>
               ) : (
                  <div className="space-y-3">
                     {displayedItems.map(({def, impl}) => {
                        const isCustom = impl.author !== SYSTEM_AUTHOR;
                        return (
                           <div
                              key={def.id}
                              className={`p-4 border flex justify-between items-center transition-all duration-brutal ${
                                 isCustom
                                 ? "bg-white border-2 border-link-blue shadow-brutal-lg"
                                 : "bg-white border border-ink"
                              }`}
                           >
                              <div className="flex-grow">
                                 <div className="flex items-center space-x-3 mb-1">
                                    <span className={`text-xs font-mono font-bold px-2 py-1 border border-ink ${
                                       isCustom ? "bg-link-blue text-white" : "bg-white text-ink"
                                    }`}>
                                       {def.id}
                                    </span>
                                    <h4 className={`font-semibold ${isCustom ? "text-link-blue" : "text-ink"}`}>{def.title}</h4>
                                 </div>
                                 <div className="flex items-center text-sm">
                                    <span className="text-ink mr-2 font-mono">Implementation:</span>
                                    {isCustom ? (
                                       <span className="flex items-center text-link-blue font-bold font-mono uppercase px-2 py-1 border border-ink bg-white">
                                          <i className="fas fa-user-circle mr-1.5"></i>
                                          {impl.author}
                                       </span>
                                    ) : (
                                       <span className="text-ink flex items-center font-mono uppercase">
                                          <i className="fas fa-shield-alt mr-1.5 text-xs"></i>
                                          System Default
                                       </span>
                                    )}
                                 </div>
                              </div>

                              <div className="flex items-center space-x-2">
                                 {isCustom && (
                                    <button
                                       onClick={() => onReset(def.id)}
                                       className="text-xs text-ink hover:text-link-blue px-3 py-1 font-medium font-mono uppercase border border-ink hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal transition-all duration-brutal"
                                       title="Revert to System Default"
                                    >
                                       Reset to System
                                    </button>
                                 )}
                                 <button
                                    onClick={() => onRemove(def.id)}
                                    className="text-ink hover:text-terminal-red w-8 h-8 flex items-center justify-center border border-ink hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal transition-all duration-brutal"
                                    title="Remove from Basket"
                                 >
                                    <i className="fas fa-times"></i>
                                 </button>
                              </div>
                           </div>
                        );
                     })}
                  </div>
               )}
            </div>
        </div>
    </div>
  );
}

const Catalog = ({
  defs,
  impls,
  onPatternClick,
  onRefresh,
}: {
  defs: PatternDefinition[];
  impls: PatternImplementation[];
  onPatternClick: (d: PatternDefinition) => void;
  onRefresh?: () => void;
}) => {
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const filteredDefs = useMemo(() => defs.filter((d) => {
    const matchesCat = filter === "ALL" || d.category === filter;
    const matchesSearch =
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.id.toLowerCase().includes(search.toLowerCase()) ||
      d.problem.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  }), [defs, filter, search]);

  const getImplCount = (patId: string) => impls.filter(i => i.patternId === patId).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
          <button
            onClick={() => setFilter("ALL")}
            className={`px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all duration-brutal font-mono uppercase border border-ink ${
              filter === "ALL" ? "bg-ink text-white shadow-brutal" : "bg-white text-ink hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal"
            }`}
          >
            All Categories
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.code}
              onClick={() => setFilter(cat.code)}
              className={`px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all duration-brutal font-mono uppercase border border-ink ${
                filter === cat.code ? "bg-ink text-white shadow-brutal" : "bg-white text-ink hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-ink text-xs"></i>
            <input
              type="text"
              placeholder="Search patterns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-2 border border-ink text-sm focus:outline-none focus:border-2 focus:border-link-blue transition-all duration-brutal"
            />
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-4 py-2 bg-white border border-ink text-sm font-medium font-mono uppercase text-ink hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal hover:text-link-blue transition-all duration-brutal flex items-center gap-2"
              title="Refresh catalog data"
            >
              <i className="fas fa-sync-alt"></i>
              <span className="hidden md:inline">Refresh</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDefs.map((d) => (
          <PatternCard
            key={d.id}
            def={d}
            implCount={getImplCount(d.id)}
            onClick={() => onPatternClick(d)}
          />
        ))}
      </div>

      {filteredDefs.length === 0 && (
          <div className="text-center py-10 text-ink">
              <i className="fas fa-folder-open text-4xl mb-2"></i>
              <p className="font-mono">No patterns found in this category.</p>
          </div>
      )}
    </div>
  );
};

// --- Main App ---

const App = () => {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [view, setView] = useState("catalog");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // SECURITY: Read role from Clerk metadata - defaults to contributor
  const userRole = (user?.publicMetadata?.role as Role) || 'contributor';

  // Fetch patterns from API
  const { patterns, implementations, loading, error } = usePatterns(refreshTrigger);

  // Data State
  const [definitions, setDefinitions] = useState<PatternDefinition[]>([]);
  const [implementationsList, setImplementationsList] = useState<PatternImplementation[]>([]);

  // Update local state when API data loads
  useEffect(() => {
    if (patterns.length > 0) {
      setDefinitions(patterns);
    }
  }, [patterns]);

  useEffect(() => {
    if (implementations.length > 0) {
      setImplementationsList(implementations);
    }
  }, [implementations]);

  // Selection State
  const [selectedDef, setSelectedDef] = useState<PatternDefinition | null>(null);
  const [editingImpl, setEditingImpl] = useState<PatternImplementation | null>(null); // For edit/create
  const [savingImpl, setSavingImpl] = useState<string | null>(null); // Loading state for save operations

  // Basket State: Record<PatternID, ImplementationUUID>
  const [basket, setBasket] = useState<Record<string, string>>({});

  // Initialize basket with system implementations when data loads
  useEffect(() => {
    if (patterns.length > 0 && implementations.length > 0) {
      const initialBasket: Record<string, string> = {};
      patterns.forEach(def => {
        const sysImpl = implementations.find(i => i.patternId === def.id && i.author === SYSTEM_AUTHOR);
        if (sysImpl) initialBasket[def.id] = sysImpl.uuid;
      });
      setBasket(initialBasket);
    }
  }, [patterns, implementations]);

  const handlePatternClick = (d: PatternDefinition) => {
    setSelectedDef(d);
    setView("detail");
  };
  
  const handleAddToBasket = (implUuid: string) => {
      if (!selectedDef) return;
      setBasket(prev => ({
          ...prev,
          [selectedDef.id]: implUuid
      }));
  };
  
  const handleResetToSystem = (patternId: string) => {
      const sysImpl = implementationsList.find(i => i.patternId === patternId && i.author === SYSTEM_AUTHOR);
      if (sysImpl) {
          setBasket(prev => ({
              ...prev,
              [patternId]: sysImpl.uuid
          }));
      }
  };

  const handleAddImplementation = () => {
      setEditingImpl(null); // Clear for new
      setView("contribute");
  };

  const handleEditImplementation = (impl: PatternImplementation) => {
      setEditingImpl(impl);
      setView("contribute");
  };

  const handleSaveImplementation = async (
    newImpl: PatternImplementation,
    updatedDef?: Partial<PatternDefinition>
  ) => {
    // Check if this is an edit (existing UUID) or new contribution
    // Use editingImpl to determine edit mode since implementationsList only contains active implementations
    const isEdit = editingImpl !== null && editingImpl.uuid === newImpl.uuid;

    if (isEdit) {
      // EDIT MODE: Call PUT endpoint
      setSavingImpl(newImpl.uuid);

      try {
        // 1. Get Clerk authentication token
        const token = await getToken();

        if (!token) {
          alert('Please log in to edit implementations');
          return;
        }

        // 2. Prepare request payload
        const payload = {
          sasCode: newImpl.sasCode,
          rCode: newImpl.rCode,
          considerations: newImpl.considerations || [],
          variations: newImpl.variations || [],
          isPremium: newImpl.isPremium || false
        };

        // 3. Call backend API
        const response = await fetch(`/api/implementations/${newImpl.uuid}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        // 4. Handle errors
        if (!response.ok) {
          if (response.status === 401) {
            alert('Please log in to edit implementations');
          } else if (response.status === 403) {
            alert('You can only edit your own implementations');
          } else if (response.status === 404) {
            alert('Implementation not found');
          } else {
            alert(`Error: ${data.error || 'Failed to save changes'}`);
          }
          return;
        }

        // 5. Update local state with server response
        setImplementationsList(prev =>
          prev.map(impl =>
            impl.uuid === newImpl.uuid
              ? {
                  ...impl,
                  ...newImpl,
                  status: data.implementation.status, // Use status from server
                  timestamp: new Date(data.implementation.updatedAt).getTime()
                }
              : impl
          )
        );

        // 6. Show success message
        if (data.statusChanged) {
          alert(
            `✅ ${data.message}\n\n` +
            `Status changed: ${data.previousStatus} → ${data.newStatus}\n\n` +
            `Your changes have been submitted for admin review.`
          );
        } else {
          alert('✅ Implementation updated successfully!');
        }

        // Update definition if provided
        if (updatedDef && selectedDef) {
          setDefinitions(prev => {
            const index = prev.findIndex(d => d.id === selectedDef.id);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = { ...updated[index], ...updatedDef };
              return updated;
            }
            return prev;
          });
          setSelectedDef(prev => prev ? { ...prev, ...updatedDef } : prev);
        }

        // 7. Navigate back to My Contributions
        setView("my-contributions");
        setEditingImpl(null);

      } catch (error) {
        console.error('Failed to save implementation:', error);
        alert('❌ Network error: Could not save changes. Please try again.');
      } finally {
        setSavingImpl(null);
      }

    } else {
      // NEW CONTRIBUTION MODE: Call POST /api/implementations
      setSavingImpl(newImpl.uuid);

      (async () => {
        try {
          // 1. Get Clerk authentication token
          const token = await getToken();

          if (!token) {
            alert('Please sign in to submit pattern implementations.');
            setSavingImpl(null);
            return;
          }

          // 2. Prepare request payload (match API schema)
          const payload = {
            patternId: newImpl.patternId,
            sasCode: newImpl.sasCode || undefined,
            rCode: newImpl.rCode || undefined,
            considerations: newImpl.considerations || [],
            variations: newImpl.variations || []
          };

          // 3. Call backend API
          const response = await fetch('/api/implementations', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          const data = await response.json();

          // 4. Handle errors
          if (!response.ok) {
            if (response.status === 401) {
              alert('Please sign in to submit pattern implementations.');
            } else if (response.status === 404) {
              alert('Selected pattern not found. Please refresh and try again.');
            } else if (response.status === 400) {
              alert(`Validation error: ${data.details?.map((d: any) => d.message).join(', ') || data.error || 'Please check your input.'}`);
            } else {
              alert(`Error: ${data.error || 'Failed to submit implementation'}`);
            }
            setSavingImpl(null);
            return;
          }

          // 5. Update local state with server response
          const createdImpl: PatternImplementation = {
            uuid: data.implementation.uuid,
            patternId: data.implementation.patternId,
            author: data.implementation.authorName,
            sasCode: data.implementation.sasCode || "",
            rCode: data.implementation.rCode || "",
            considerations: data.implementation.considerations || [],
            variations: data.implementation.variations || [],
            status: data.implementation.status,
            isPremium: data.implementation.isPremium || false,
            timestamp: new Date(data.implementation.createdAt).getTime()
          };

          setImplementationsList(prev => [...prev, createdImpl]);

          // 6. Show success message
          alert(
            `✅ Pattern implementation submitted successfully!\n\n` +
            `Status: ${data.implementation.status}\n\n` +
            `Your contribution has been submitted for admin review. Thank you for contributing to StatPatternHub!`
          );

          // 7. Navigate back to detail view or catalog
          if (selectedDef && selectedDef.id === newImpl.patternId) {
            setView("detail");
          } else {
            // If submitting for a different pattern, go back to catalog
            setView("catalog");
          }
          setEditingImpl(null);

        } catch (error) {
          console.error('Failed to submit implementation:', error);
          alert('❌ Network error: Could not submit implementation. Please try again.');
        } finally {
          setSavingImpl(null);
        }
      })();
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
          <div className="text-white text-xl">Loading patterns...</div>
          <div className="text-slate-400 text-sm mt-2">Fetching data from database</div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="bg-red-900 text-white p-6 rounded-lg max-w-md">
          <div className="flex items-center mb-3">
            <i className="fas fa-exclamation-triangle text-2xl mr-3"></i>
            <h2 className="text-xl font-bold">Error Loading Patterns</h2>
          </div>
          <p className="mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-700 rounded hover:bg-red-600 transition-colors w-full"
          >
            <i className="fas fa-sync mr-2"></i> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <Layout
        currentView={view}
        setView={setView}
        basketCount={Object.keys(basket).length}
        onContributeClick={() => {
          setSelectedDef(null); // Clear selected pattern for standalone contribute mode
          setEditingImpl(null);
          setView("contribute");
        }}
        onRefresh={() => setRefreshTrigger(prev => prev + 1)}
    >
      {view === "catalog" && (
        <Catalog
            defs={definitions}
            impls={implementationsList}
            onPatternClick={handlePatternClick}
            onRefresh={() => setRefreshTrigger(prev => prev + 1)}
        />
      )}

      {view === "detail" && selectedDef && (
        <PatternDetail
          def={selectedDef}
          impls={implementationsList.filter(i => i.patternId === selectedDef.id)}
          basketSelectedUuid={basket[selectedDef.id]}
          onBack={() => {
            setSelectedDef(null);
            setView("catalog");
          }}
          onAddToBasket={handleAddToBasket}
          onAddImplementation={handleAddImplementation}
          onEditImplementation={handleEditImplementation}
          role={userRole}
        />
      )}

      {view === "contribute" && (
        <SmartEtlForm
            definition={selectedDef || undefined}
            initialImpl={editingImpl || undefined}
            onSave={handleSaveImplementation}
            onCancel={() => {
              if (selectedDef) {
                setView("detail");
              } else {
                setView("catalog");
              }
              setEditingImpl(null);
            }}
            isSaving={savingImpl !== null}
            allPatterns={definitions}
        />
      )}

      {view === "my-contributions" && (
        <MyContributions
          onEdit={(impl) => {
            // Find the pattern definition for this implementation
            const pattern = definitions.find(d => d.id === impl.patternId);
            if (pattern) {
              setSelectedDef(pattern);
            }
            setEditingImpl(impl);
            setView("contribute");
          }}
          onContribute={() => {
            setSelectedDef(null);
            setEditingImpl(null);
            setView("contribute");
          }}
        />
      )}

      {view === "admin-review" && (
        <AdminReviewQueue />
      )}

      {view === "admin-patterns" && (
        <AdminPatternManager
          onBack={() => {
            setRefreshTrigger(prev => prev + 1);
            setView("catalog");
          }}
          userRole={userRole}
        />
      )}

      {view === "basket" && (
          <BasketView
             basket={basket}
             defs={definitions}
             impls={implementationsList}
             onClear={() => setBasket({})}
             onRemove={(patId) => {
                 const newBasket = {...basket};
                 delete newBasket[patId];
                 setBasket(newBasket);
             }}
             onReset={handleResetToSystem}
          />
      )}
    </Layout>
  );
};

// Get Clerk publishable key from environment variables
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  console.error("Missing VITE_CLERK_PUBLISHABLE_KEY environment variable");
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <ClerkProvider publishableKey={clerkPubKey || ""}>
    <App />
  </ClerkProvider>
);