import React, { useState, useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, Type } from "@google/genai";
import JSZip from "jszip";
import { ClerkProvider, SignInButton, SignUpButton, UserButton, useAuth, useUser } from "@clerk/clerk-react";

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

// --- Initial State Generators ---

const { INITIAL_DEFS, INITIAL_IMPLS } = (() => {
  const defs: PatternDefinition[] = [];
  const impls: PatternImplementation[] = [];

  Object.entries(MANIFEST_DATA).forEach(([catCode, slugs]) => {
    slugs.forEach((slug, index) => {
      const id = `${catCode}-${String(index + 1).padStart(3, "0")}`;
      const preloaded = PRELOADED_CONTENT[id];
      
      const title = preloaded?.title || slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      
      // 1. Create Definition
      defs.push({
        id,
        category: catCode,
        title,
        problem: preloaded?.problem || "Content to be added.",
        whenToUse: preloaded?.whenToUse || "To be defined.",
      });

      // 2. Create System Implementation
      impls.push({
        uuid: `${id}-system`,
        patternId: id,
        author: SYSTEM_AUTHOR,
        sasCode: preloaded?.sasCode || "/* SAS implementation pending */",
        rCode: preloaded?.rCode || "# R implementation pending",
        considerations: preloaded?.considerations || [],
        variations: preloaded?.variations || [],
        status: "active",
        isPremium: false,
        timestamp: Date.now(),
      });

      // 3. MOCK DATA: Add Jane Doe's version to IMP-002 to demonstrate tabs
      if (id === "IMP-002") {
        impls.push({
          uuid: `${id}-jane`,
          patternId: id,
          author: "Jane Doe",
          sasCode: `/* Jane's optimized LOCF with extra checks */\ndata locf_checked;\n  set source;\n  /* ... different logic ... */\nrun;`,
          rCode: `# Jane's R Tidyverse version\n# ... `,
          considerations: ["Jane's version handles partial dates differently."],
          variations: [],
          status: "active",
          isPremium: false,
          timestamp: Date.now() + 1000,
        });
      }
    });
  });
  return { INITIAL_DEFS: defs, INITIAL_IMPLS: impls };
})();

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
  role,
  setRole,
  currentView,
  setView,
  basketCount
}: {
  children?: React.ReactNode;
  role: Role;
  setRole: (r: Role) => void;
  currentView: string;
  setView: (v: string) => void;
  basketCount: number;
}) => {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-800">
      <nav className="bg-slate-900 text-white shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4 cursor-pointer" onClick={() => setView("catalog")}>
            <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-xl">
              SPH
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">StatPatternHub</h1>
              <p className="text-xs text-slate-400">Clinical Knowledge Warehouse</p>
            </div>
          </div>
          <div className="flex items-center space-x-6">
            <button
              onClick={() => setView("catalog")}
              className={`hover:text-indigo-400 ${currentView === "catalog" ? "text-indigo-400" : ""}`}
            >
              Catalog
            </button>
            <button
              onClick={() => setView("basket")}
              className={`hover:text-indigo-400 flex items-center ${currentView === "basket" ? "text-indigo-400" : ""}`}
            >
              <i className="fas fa-suitcase mr-2"></i>
              Skill Basket
              <span className="ml-2 bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{basketCount}</span>
            </button>
            <div className="border-l border-slate-700 pl-6 flex items-center space-x-4">
              {isLoaded && isSignedIn ? (
                <>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-slate-300">
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
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-500 uppercase">Dev Role:</span>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as Role)}
                      className="bg-slate-800 border border-slate-700 text-xs rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
                      title="For development only - simulates different user roles"
                    >
                      <option value="guest">Guest</option>
                      <option value="contributor">Contributor</option>
                      <option value="premier">Premier</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </>
              ) : (
                <div className="flex items-center space-x-3">
                  <SignInButton mode="modal">
                    <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                      Sign In
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="bg-white hover:bg-slate-100 text-slate-900 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
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
      <footer className="bg-slate-100 border-t border-slate-200 mt-auto">
        <div className="container mx-auto px-6 py-6 text-center text-sm text-slate-500">
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
  role: Role;
}

const PatternCard: React.FC<PatternCardProps> = ({ 
  def, 
  implCount, 
  onClick, 
  role 
}) => {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full cursor-pointer group"
    >
      <div className="p-5 flex-grow">
        <div className="flex justify-between items-start mb-2">
          <span className="inline-block px-2 py-1 text-xs font-semibold bg-indigo-50 text-indigo-700 rounded-md">
            {def.id}
          </span>
          {implCount > 1 && (
             <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full border border-slate-200">
                {implCount} Variations
             </span>
          )}
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2 leading-tight group-hover:text-indigo-600 transition-colors">{def.title}</h3>
        <p className="text-sm text-slate-600 line-clamp-2 mb-4">{def.problem}</p>
      </div>
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
          <span>{def.category}</span>
          <span>View Container &rarr;</span>
      </div>
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

  const canEdit =
    role === "admin" ||
    role === "premier" ||
    (role === "contributor" && activeImpl.author === CURRENT_USER);

  const markdown = generateMarkdown(def, activeImpl);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(markdown);
    alert("Context copied!");
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
         <button onClick={onBack} className="text-sm text-slate-500 hover:text-indigo-600 flex items-center">
            <i className="fas fa-arrow-left mr-2"></i> Back to Catalog
          </button>

          {isSignedIn && (role === "contributor" || role === "premier" || role === "admin") && (
            <button
              onClick={onAddImplementation}
              className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <i className="fas fa-plus mr-2"></i> Contribute Alternative
            </button>
          )}
      </div>

      {/* Container Header (Immutable Definition) */}
      <div className="bg-white rounded-t-xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center space-x-3 mb-3">
          <span className="text-2xl font-bold text-slate-900">{def.title}</span>
          <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-mono rounded">
            {def.id}
          </span>
        </div>
        <p className="text-slate-600 text-lg mb-4">{def.problem}</p>
        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg">
             <h5 className="text-xs font-bold text-indigo-800 uppercase mb-1">When to Use</h5>
             <p className="text-sm text-indigo-900">{def.whenToUse}</p>
        </div>
      </div>

      {/* Tabs for Implementations */}
      <div className="bg-slate-100 border-x border-slate-200 px-8 pt-4 flex space-x-2 overflow-x-auto">
        {impls.map((impl) => (
          <button
            key={impl.uuid}
            onClick={() => setActiveImplUuid(impl.uuid)}
            className={`px-4 py-3 text-sm font-medium rounded-t-lg transition-all flex items-center space-x-2 ${
              activeImplUuid === impl.uuid 
                ? "bg-white text-indigo-600 border-t border-x border-slate-200 -mb-[1px] shadow-[0_-2px_5px_rgba(0,0,0,0.02)]" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            }`}
          >
            {impl.author === SYSTEM_AUTHOR && <i className="fas fa-shield-alt mr-1 text-xs"></i>}
            <span>{impl.author === CURRENT_USER ? "Your Version" : impl.author}</span>
            {basketSelectedUuid === impl.uuid && (
               <span className="ml-2 w-2 h-2 rounded-full bg-green-500" title="Selected for Export"></span>
            )}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-b-xl shadow-lg border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
        
        {/* Action Bar */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center">
            <div className="text-sm text-slate-500">
               Showing implementation by <span className="font-semibold text-slate-800">{activeImpl.author}</span>
            </div>
            <div className="flex space-x-3">
               {canEdit && (
                 <button 
                   onClick={() => onEditImplementation(activeImpl)}
                   className="text-slate-600 hover:text-indigo-600 text-sm font-medium px-3 py-2 rounded border border-transparent hover:border-slate-200"
                 >
                   <i className="fas fa-edit mr-1"></i> Edit Code
                 </button>
               )}
               <button
                 onClick={() => onAddToBasket(activeImpl.uuid)}
                 disabled={basketSelectedUuid === activeImpl.uuid}
                 className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center ${
                    basketSelectedUuid === activeImpl.uuid
                    ? "bg-green-100 text-green-700 cursor-default border border-green-200"
                    : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
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
          <div className="p-8 border-r border-slate-200">
             <div className="mb-6">
              <h5 className="text-xs font-semibold text-indigo-600 uppercase mb-2">Considerations</h5>
              {activeImpl.considerations.length > 0 ? (
                <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                  {activeImpl.considerations.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400 italic">None specified.</p>
              )}
            </div>
            <div>
              <h5 className="text-xs font-semibold text-indigo-600 uppercase mb-2">Variations</h5>
              {activeImpl.variations.length > 0 ? (
                <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                  {activeImpl.variations.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400 italic">None specified.</p>
              )}
            </div>
          </div>

          <div className="bg-slate-900 text-slate-300 overflow-auto h-full max-h-[800px]">
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center sticky top-0">
               <span className="text-xs font-mono">{`${def.id}_${activeImpl.author.toLowerCase().replace(' ','-')}.md`}</span>
               <button onClick={copyToClipboard} className="text-slate-400 hover:text-white">
                 <i className="fas fa-copy"></i>
               </button>
            </div>
            <pre className="p-6 text-xs font-mono leading-relaxed whitespace-pre-wrap">
              {markdown}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

const SmartEtlForm = ({
  definition,
  initialImpl,
  onSave,
  onCancel,
}: {
  definition: PatternDefinition;
  initialImpl?: PatternImplementation;
  onSave: (impl: PatternImplementation, updatedDef?: Partial<PatternDefinition>) => void;
  onCancel: () => void;
}) => {
  const isEditMode = !!initialImpl;
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [rawInput, setRawInput] = useState("");
  const [formData, setFormData] = useState<Partial<PatternImplementation>>({
    sasCode: "",
    rCode: "",
    considerations: [],
    variations: [],
    author: CURRENT_USER,
    ...initialImpl
  });

  // State for pattern definition fields
  const [defData, setDefData] = useState<Partial<PatternDefinition>>({
    title: definition.title,
    problem: definition.problem,
    whenToUse: definition.whenToUse,
  });

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
          patternTitle: definition.title,
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

    const newImpl: PatternImplementation = {
      uuid: isEditMode && initialImpl ? initialImpl.uuid : crypto.randomUUID(),
      patternId: definition.id,
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
    const hasDefChanges =
      defData.title !== definition.title ||
      defData.problem !== definition.problem ||
      defData.whenToUse !== definition.whenToUse;

    onSave(newImpl, hasDefChanges ? defData : undefined);
  };

  const handleArrayChange = (field: "considerations" | "variations", value: string) => {
    setFormData({ ...formData, [field]: value.split("\n").filter((s) => s.trim() !== "") });
  };

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
      <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center">
        <div>
           <h2 className="text-white font-bold text-lg">{isEditMode ? "Edit Implementation" : "Contribute New Version"}</h2>
           <p className="text-indigo-200 text-xs">For Pattern: {definition.id} - {definition.title}</p>
        </div>
        {!isEditMode && <span className="text-indigo-200 text-xs uppercase font-semibold tracking-wider">Smart Ingest Active</span>}
      </div>

      {!isEditMode && (
        <div className="p-6 bg-slate-50 border-b border-slate-200">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
            <i className="fas fa-magic mr-1 text-indigo-500"></i> AI Smart Fill
          </label>
          <div className="flex gap-2">
            <textarea
              className="flex-grow p-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              rows={3}
              placeholder="Paste raw text or documentation here to extract code..."
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
            />
            <button
              onClick={analyzeWithGemini}
              disabled={isAnalyzing || !rawInput}
              className="px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium transition-colors flex flex-col justify-center items-center min-w-[100px]"
            >
              {isAnalyzing ? <i className="fas fa-spinner fa-spin mb-1"></i> : <i className="fas fa-robot mb-1"></i>}
              {isAnalyzing ? "Thinking..." : "Analyze"}
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-6 space-y-6">

        {/* Pattern Definition Fields */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">
            <i className="fas fa-info-circle mr-2"></i>Pattern Definition
          </h3>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Pattern Title</label>
            <input
              type="text"
              required
              value={defData.title}
              onChange={(e) => setDefData({ ...defData, title: e.target.value })}
              className="w-full p-2 border border-slate-300 rounded-md text-sm"
              placeholder="e.g., Last Observation Carried Forward (LOCF)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Problem Statement</label>
            <textarea
              required
              rows={2}
              value={defData.problem}
              onChange={(e) => setDefData({ ...defData, problem: e.target.value })}
              className="w-full p-2 border border-slate-300 rounded-md text-sm"
              placeholder="Describe what problem this pattern solves..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">When to Use</label>
            <textarea
              required
              rows={2}
              value={defData.whenToUse}
              onChange={(e) => setDefData({ ...defData, whenToUse: e.target.value })}
              className="w-full p-2 border border-slate-300 rounded-md text-sm"
              placeholder="Specify scenarios and triggers for using this pattern..."
            />
          </div>
        </div>

        {/* Implementation Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">SAS Implementation</label>
            <textarea
              required
              rows={8}
              value={formData.sasCode}
              onChange={(e) => setFormData({ ...formData, sasCode: e.target.value })}
              className="w-full p-2 border border-slate-300 rounded-md text-sm font-mono bg-slate-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">R Implementation</label>
            <textarea
              required
              rows={8}
              value={formData.rCode}
              onChange={(e) => setFormData({ ...formData, rCode: e.target.value })}
              className="w-full p-2 border border-slate-300 rounded-md text-sm font-mono bg-slate-50"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Considerations (One per line)</label>
          <textarea
            rows={3}
            value={formData.considerations?.join("\n")}
            onChange={(e) => handleArrayChange("considerations", e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-md text-sm"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Common Variations (One per line)</label>
          <textarea
            rows={3}
            value={formData.variations?.join("\n")}
            onChange={(e) => handleArrayChange("variations", e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-md text-sm"
            placeholder="e.g. Baseline Observation Carried Forward (BOCF)"
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 rounded-md text-sm font-medium text-white hover:bg-indigo-700"
          >
            {isEditMode ? "Update Code" : "Submit Contribution"}
          </button>
        </div>
      </form>
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
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6 flex justify-between items-center shrink-0">
            <div>
               <h2 className="text-2xl font-bold text-slate-900 mb-1">Skill Basket Review</h2>
               <div className="flex space-x-6 text-sm text-slate-600">
                  <span>Total Patterns: <strong className="text-slate-900">{stats.total}</strong></span>
                  <span>System Default: <strong className="text-slate-500">{stats.system}</strong></span>
                  <span>Custom Overrides: <strong className="text-indigo-600">{stats.custom}</strong></span>
               </div>
            </div>
            <div className="flex space-x-3">
                 <button onClick={onClear} className="text-red-500 hover:text-red-700 px-4 py-2 text-sm font-medium">Clear All</button>
                 <button onClick={exportData} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg shadow-sm font-semibold transition-colors">
                    <i className="fas fa-download mr-2"></i> Export for Agent
                 </button>
            </div>
        </div>

        {/* Split Pane */}
        <div className="flex flex-grow overflow-hidden bg-white rounded-xl shadow-sm border border-slate-200">
            
            {/* Left Sidebar: Categories */}
            <div className="w-64 border-r border-slate-200 bg-slate-50 overflow-y-auto flex flex-col">
               <div className="p-4 border-b border-slate-200 sticky top-0 bg-slate-50 z-10">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Categories</h3>
               </div>
               <nav className="p-2 space-y-1">
                  <button
                     onClick={() => setActiveCategory("ALL")}
                     className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium flex justify-between items-center ${
                        activeCategory === "ALL" ? "bg-white shadow text-indigo-600" : "text-slate-600 hover:bg-slate-100"
                     }`}
                  >
                     <span>All Categories</span>
                     <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full">{enrichedItems.length}</span>
                  </button>
                  {categoryStats.map(cat => (
                     <button
                        key={cat.code}
                        onClick={() => setActiveCategory(cat.code)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium flex justify-between items-center ${
                           activeCategory === cat.code ? "bg-white shadow text-indigo-600" : "text-slate-600 hover:bg-slate-100"
                        }`}
                     >
                        <div className="flex items-center">
                           {cat.hasCustom && <span className="w-2 h-2 rounded-full bg-indigo-500 mr-2"></span>}
                           <span>{cat.name}</span>
                        </div>
                        <span className={`${cat.count > 0 ? "bg-slate-200 text-slate-600" : "bg-slate-100 text-slate-300"} text-xs px-2 py-0.5 rounded-full`}>
                           {cat.count}
                        </span>
                     </button>
                  ))}
               </nav>
            </div>

            {/* Right Pane: List */}
            <div className="flex-grow overflow-y-auto p-6">
               <div className="mb-4 flex justify-between items-end">
                   <h3 className="text-lg font-bold text-slate-800">
                      {activeCategory === "ALL" ? "All Patterns" : CATEGORIES.find(c => c.code === activeCategory)?.name}
                   </h3>
                   <span className="text-xs text-slate-500">{displayedItems.length} items shown</span>
               </div>

               {displayedItems.length === 0 ? (
                  <div className="text-center py-20 text-slate-400">
                     <p>No patterns in this category.</p>
                  </div>
               ) : (
                  <div className="space-y-3">
                     {displayedItems.map(({def, impl}) => {
                        const isCustom = impl.author !== SYSTEM_AUTHOR;
                        return (
                           <div 
                              key={def.id} 
                              className={`p-4 rounded-lg border flex justify-between items-center transition-all ${
                                 isCustom 
                                 ? "bg-indigo-50 border-indigo-200 shadow-sm" 
                                 : "bg-white border-slate-200 hover:border-slate-300"
                              }`}
                           >
                              <div className="flex-grow">
                                 <div className="flex items-center space-x-3 mb-1">
                                    <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                                       isCustom ? "bg-indigo-200 text-indigo-800" : "bg-slate-100 text-slate-500"
                                    }`}>
                                       {def.id}
                                    </span>
                                    <h4 className={`font-semibold ${isCustom ? "text-indigo-900" : "text-slate-800"}`}>{def.title}</h4>
                                 </div>
                                 <div className="flex items-center text-sm">
                                    <span className="text-slate-500 mr-2">Implementation:</span>
                                    {isCustom ? (
                                       <span className="flex items-center text-indigo-700 font-bold bg-white px-2 py-0.5 rounded border border-indigo-100 shadow-sm">
                                          <i className="fas fa-user-circle mr-1.5"></i>
                                          {impl.author}
                                       </span>
                                    ) : (
                                       <span className="text-slate-400 flex items-center">
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
                                       className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline px-3 py-1 font-medium"
                                       title="Revert to System Default"
                                    >
                                       Reset to System
                                    </button>
                                 )}
                                 <button 
                                    onClick={() => onRemove(def.id)} 
                                    className="text-slate-400 hover:text-red-500 w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors"
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
}: {
  defs: PatternDefinition[];
  impls: PatternImplementation[];
  onPatternClick: (d: PatternDefinition) => void;
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
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              filter === "ALL" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-indigo-50"
            }`}
          >
            All Categories
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.code}
              onClick={() => setFilter(cat.code)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === cat.code ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-indigo-50"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-64">
          <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-xs"></i>
          <input
            type="text"
            placeholder="Search patterns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDefs.map((d) => (
          <PatternCard 
            key={d.id} 
            def={d} 
            implCount={getImplCount(d.id)}
            onClick={() => onPatternClick(d)} 
            role="contributor" 
          />
        ))}
      </div>
      
      {filteredDefs.length === 0 && (
          <div className="text-center py-10 text-slate-400">
              <i className="fas fa-folder-open text-4xl mb-2"></i>
              <p>No patterns found in this category.</p>
          </div>
      )}
    </div>
  );
};

// --- Main App ---

const App = () => {
  const [role, setRole] = useState<Role>("contributor");
  const [view, setView] = useState("catalog");
  
  // Data State
  const [definitions, setDefinitions] = useState<PatternDefinition[]>(INITIAL_DEFS);
  const [implementations, setImplementations] = useState<PatternImplementation[]>(INITIAL_IMPLS);
  
  // Selection State
  const [selectedDef, setSelectedDef] = useState<PatternDefinition | null>(null);
  const [editingImpl, setEditingImpl] = useState<PatternImplementation | null>(null); // For edit/create
  
  // Basket State: Record<PatternID, ImplementationUUID>
  const [basket, setBasket] = useState<Record<string, string>>(() => {
     // Initialize basket with default SYSTEM implementations for all definitions
     const initialBasket: Record<string, string> = {};
     INITIAL_DEFS.forEach(def => {
        const sysImpl = INITIAL_IMPLS.find(i => i.patternId === def.id && i.author === SYSTEM_AUTHOR);
        if (sysImpl) initialBasket[def.id] = sysImpl.uuid;
     });
     return initialBasket;
  });

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
      const sysImpl = implementations.find(i => i.patternId === patternId && i.author === SYSTEM_AUTHOR);
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

  const handleSaveImplementation = (newImpl: PatternImplementation, updatedDef?: Partial<PatternDefinition>) => {
      setImplementations(prev => {
          const index = prev.findIndex(i => i.uuid === newImpl.uuid);
          if (index >= 0) {
              const updated = [...prev];
              updated[index] = newImpl;
              return updated;
          }
          return [...prev, newImpl];
      });

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
          // Update the selectedDef to reflect changes
          setSelectedDef(prev => prev ? { ...prev, ...updatedDef } : prev);
      }

      // Auto-select the new contribution in basket? Optional. Let's not for now.
      setView("detail");
  };

  return (
    <Layout 
        role={role} 
        setRole={setRole} 
        currentView={view} 
        setView={setView} 
        basketCount={Object.keys(basket).length}
    >
      {view === "catalog" && (
        <Catalog 
            defs={definitions} 
            impls={implementations}
            onPatternClick={handlePatternClick} 
        />
      )}
      
      {view === "detail" && selectedDef && (
        <PatternDetail
          def={selectedDef}
          impls={implementations.filter(i => i.patternId === selectedDef.id)}
          basketSelectedUuid={basket[selectedDef.id]}
          onBack={() => {
            setSelectedDef(null);
            setView("catalog");
          }}
          onAddToBasket={handleAddToBasket}
          onAddImplementation={handleAddImplementation}
          onEditImplementation={handleEditImplementation}
          role={role}
        />
      )}

      {view === "contribute" && selectedDef && (
        <SmartEtlForm 
            definition={selectedDef}
            initialImpl={editingImpl || undefined}
            onSave={handleSaveImplementation}
            onCancel={() => setView("detail")}
        />
      )}

      {view === "basket" && (
          <BasketView 
             basket={basket}
             defs={definitions}
             impls={implementations}
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