---
name: clinical-programming-patterns
description: Domain-specific skill for clinical programming patterns in SAS and R. Use when creating, editing, or managing clinical programming patterns, pattern definitions, implementations, markdown exports, ETL operations, or working with CDISC standards. Covers the 14 pattern categories (IMP, DER, DAT, RSH, AGG, MRG, CAT, FLG, SRT, FMT, VAL, CDS, STA, OPT) and ensures agent skill-compliant markdown output.
---

# Clinical Programming Patterns Skill

## Purpose

Maintain consistency and quality for clinical programming patterns in SAS and R, ensuring all patterns follow the Agent Skill-Compliant Markdown format and adhere to clinical programming best practices.

## When to Use This Skill

Automatically activates when working on:
- Creating or editing pattern definitions
- Adding or modifying pattern implementations
- Generating markdown exports for AI agents
- Working with SmartETL form
- Managing pattern baskets
- CDISC SDTM/ADaM operations
- SAS or R code for clinical trials

---

## Pattern Categories (14 Total, 172 Patterns)

| Code | Category | Count | Description |
|------|----------|-------|-------------|
| **IMP** | Imputation | 14 | Missing data imputation methods (LOCF, BOCF, WOCF, etc.) |
| **DER** | Derivations | 25 | Derived variables (BMI, BSA, age calculations, etc.) |
| **DAT** | Date/Time | 12 | Date/time operations (ISO8601, relative days, etc.) |
| **RSH** | Reshaping | 10 | Data transformation (wide↔long, transposing, etc.) |
| **AGG** | Aggregation | 12 | Summary statistics (mean, median, counts, etc.) |
| **MRG** | Merging | 12 | Dataset joins (left, inner, outer, fuzzy, etc.) |
| **CAT** | Categorization | 10 | Value categorization (age groups, severity, etc.) |
| **FLG** | Flagging | 10 | Boolean flags (baseline, last visit, etc.) |
| **SRT** | Sorting | 9 | Ordering data (multi-level, custom, etc.) |
| **FMT** | Formatting | 15 | Output formatting (decimals, dates, labels, etc.) |
| **VAL** | Validation | 10 | Data quality checks (ranges, missing, duplicates) |
| **CDS** | CDISC | 10 | CDISC SDTM/ADaM compliance operations |
| **STA** | Statistics | 15 | Statistical tests and summaries |
| **OPT** | Optimization | 8 | Performance improvements and efficiency |

---

## Data Model

### Pattern Definition (Immutable Container)
The high-level pattern specification that never changes:

```typescript
{
  id: string;           // Pattern ID (e.g., "IMP-001", "DER-020")
  category: string;     // Category code (e.g., "IMP", "DER")
  title: string;        // Human-readable name
  problem: string;      // What the pattern solves
  whenToUse: string;    // Usage triggers/scenarios
}
```

**Pattern ID Format**: `{CATEGORY}-{3-digit-number}`
- Examples: `IMP-002`, `DER-020`, `DAT-005`

### Pattern Implementation (Mutable Content)
The actual code and details that can evolve:

```typescript
{
  uuid: string;         // Unique implementation ID
  patternId: string;    // Links to PatternDefinition
  author: string;       // Contributor name ("System" for defaults)
  sasCode: string;      // SAS implementation
  rCode: string;        // R implementation
  considerations: string;  // Edge cases/warnings
  variations: string;   // Related patterns
  status: "active" | "pending";
  isPremium: boolean;   // Access tier flag
}
```

---

## Agent Skill-Compliant Markdown Format

All pattern exports MUST follow this EXACT structure:

```markdown
# [Pattern Name] ([Pattern ID])
Author: [Author Name]

## Problem
[Description of what the pattern solves]

## When to Use
[Specific scenarios and triggers]

## SAS Implementation
### Method 1
\`\`\`sas
[SAS code]
\`\`\`

## R Implementation
### Method 1
\`\`\`r
[R code]
\`\`\`

## Key Considerations
- [List of edge cases, dependencies, warnings]

## Common Variations
- [Related patterns or alternatives]
```

**Critical Requirements:**
1. Pattern ID in parentheses in H1: `# Pattern Name (IMP-001)`
2. Author line immediately after H1
3. Use `## Problem` and `## When to Use` (exact capitalization)
4. Code blocks with proper language tags: ` ```sas ` and ` ```r `
5. `## Key Considerations` as bulleted list
6. `## Common Variations` as bulleted list

---

## Pattern Creation Checklist

When creating a new pattern:

- [ ] **Pattern ID**: Follow `{CATEGORY}-{XXX}` format
- [ ] **Title**: Clear, descriptive, domain-specific
- [ ] **Problem**: Specific clinical programming problem
- [ ] **When to Use**: Concrete scenarios (e.g., "LOCF for early dropout", "Age at consent for screening data")
- [ ] **SAS Code**: Working, tested SAS code
- [ ] **R Code**: Equivalent R implementation
- [ ] **Considerations**: Edge cases, dependencies, CDISC notes
- [ ] **Variations**: Link to related pattern IDs
- [ ] **Author**: Credit contributor or "System" for defaults
- [ ] **Markdown Validation**: Ensure agent skill-compliant format

---

## Common Pattern Examples

### Imputation Pattern (IMP)

```markdown
# Last Observation Carried Forward (IMP-001)
Author: System

## Problem
Handle missing endpoint values in longitudinal clinical trials by imputing using the last observed value.

## When to Use
- Subject discontinues early but has prior measurements
- Endpoint is relatively stable over time
- Regulatory guidance allows LOCF (e.g., FDA may prefer MMRM for some endpoints)

## SAS Implementation
### Method 1
\`\`\`sas
proc sort data=input;
  by usubjid visitnum;
run;

data locf_imputed;
  set input;
  by usubjid;
  retain last_value;

  if first.usubjid then last_value = .;

  if not missing(aval) then last_value = aval;
  else if missing(aval) and not missing(last_value) then do;
    aval = last_value;
    avalfl = 'LOCF';
  end;
run;
\`\`\`

## R Implementation
### Method 1
\`\`\`r
library(dplyr)
library(tidyr)

locf_imputed <- input %>%
  arrange(usubjid, visitnum) %>%
  group_by(usubjid) %>%
  fill(aval, .direction = "down") %>%
  mutate(avalfl = ifelse(is.na(aval) & lag(!is.na(aval)), "LOCF", ""))
\`\`\`

## Key Considerations
- LOCF assumes data are missing at random (MAR) - verify assumption
- Not appropriate for monotonically changing variables (e.g., tumor growth)
- ICH E9(R1) recommends sensitivity analyses with multiple imputation
- Document imputation in statistical analysis plan (SAP)

## Common Variations
- IMP-002: Baseline Observation Carried Forward (BOCF)
- IMP-003: Worst Observation Carried Forward (WOCF)
- IMP-004: Multiple Imputation using MI procedure
```

### Derivation Pattern (DER)

```markdown
# Body Mass Index Calculation (DER-001)
Author: System

## Problem
Calculate BMI from height and weight measurements for ADSL or VS datasets.

## When to Use
- Creating ADSL baseline characteristics
- Deriving BMIVAL in vital signs (VS) domain
- Categorizing BMI for subgroup analysis

## SAS Implementation
### Method 1
\`\`\`sas
data bmi_derived;
  set input;

  /* BMI = weight (kg) / height (m)^2 */
  if not missing(weight) and not missing(height) then do;
    bmi = weight / (height / 100) ** 2;
    bmi = round(bmi, 0.1);
  end;
run;
\`\`\`

## R Implementation
### Method 1
\`\`\`r
library(dplyr)

bmi_derived <- input %>%
  mutate(
    bmi = if_else(
      !is.na(weight) & !is.na(height),
      round(weight / (height / 100)^2, 1),
      NA_real_
    )
  )
\`\`\`

## Key Considerations
- Ensure consistent units (kg for weight, cm for height)
- CDISC SDTM stores height in cm, weight in kg
- Round BMI to 1 decimal place per convention
- Handle missing values explicitly

## Common Variations
- DER-002: Body Surface Area (BSA) - Mosteller formula
- DER-003: BMI Categories (underweight, normal, overweight, obese)
- CAT-005: BMI Categorization for stratification
```

---

## CDISC-Specific Guidelines

### SDTM Standards

When creating CDISC SDTM patterns:
- Use standard domain abbreviations (DM, VS, LB, AE, etc.)
- Include required variables (STUDYID, DOMAIN, USUBJID, etc.)
- Follow naming conventions (e.g., `--DTC` for dates, `--TEST` for test names)
- Use controlled terminology from CDISC CT

### ADaM Standards

When creating CDISC ADaM patterns:
- Use standard dataset types (ADSL, ADAE, ADLB, etc.)
- Include analysis flags (ANL01FL, ANL02FL, etc.)
- Derive analysis value (AVAL) and baseline (BASE, CHG, PCHG)
- Follow ADaM structure (one record per analysis per subject per parameter per time point)

**Example Pattern:**
```markdown
# ADSL Derivation - Age at Consent (DER-010)
Author: System

## Problem
Calculate age in years at informed consent date for ADSL dataset.

## When to Use
- Creating ADSL baseline dataset
- Need age for eligibility verification
- Subgroup analysis by age category

## SAS Implementation
### Method 1
\`\`\`sas
data adsl;
  set dm;

  /* Age at consent = (RFICDTC - BRTHDTC) / 365.25 */
  age = floor((input(rficdtc, yymmdd10.) - input(brthdtc, yymmdd10.)) / 365.25);

  /* Age category */
  if age < 18 then agegr1 = '<18';
  else if age <= 65 then agegr1 = '18-65';
  else agegr1 = '>65';
run;
\`\`\`

## R Implementation
### Method 1
\`\`\`r
library(dplyr)
library(lubridate)

adsl <- dm %>%
  mutate(
    rficdtc_date = ymd(rficdtc),
    brthdtc_date = ymd(brthdtc),
    age = floor(as.numeric(difftime(rficdtc_date, brthdtc_date, units = "days")) / 365.25),
    agegr1 = case_when(
      age < 18 ~ '<18',
      age <= 65 ~ '18-65',
      TRUE ~ '>65'
    )
  )
\`\`\`

## Key Considerations
- Use RFICDTC (informed consent date) not RFSTDTC (first treatment)
- CDISC convention: floor() for age calculation
- Handle partial dates (--UNK format) appropriately
- Verify age against eligibility criteria in protocol

## Common Variations
- DER-011: Age at First Treatment (RFSTDTC)
- DER-012: Age at Screening (RFXSTDTC)
- CAT-006: Age Categorization (custom bins)
```

---

## SmartETL Form Guidelines

When using the AI-powered ETL form to extract patterns from documentation:

### Input Sources
- Blog posts about SAS/R programming
- Technical documentation
- Code repositories
- Clinical programming forums (e.g., SAS Communities, PharmaSUG papers)

### Extraction Checklist
- [ ] Pattern identified with clear problem statement
- [ ] Category assigned correctly (one of 14 categories)
- [ ] Both SAS and R implementations extracted
- [ ] Code is complete and runnable
- [ ] Considerations captured (edge cases, dependencies)
- [ ] Variations linked to related patterns

### Post-Extraction Validation
- [ ] Code syntax is valid
- [ ] Markdown format is agent skill-compliant
- [ ] Pattern ID follows naming convention
- [ ] No sensitive data in code examples
- [ ] Author attribution is correct

---

## Basket Management

### Pattern Selection for AI Agent Export

When curating a basket for AI agent consumption:

1. **Group by Domain**: Imputation patterns for a specific trial
2. **Version Control**: Override system defaults with custom implementations
3. **Export Format**: Agent skill-compliant markdown only
4. **Validation**: Run markdown linter before export

### Basket JSON Structure

```json
{
  "patternId": "implementationUuid",
  "IMP-001": "uuid-custom-implementation",
  "DER-020": "uuid-system-default"
}
```

**Rule**: Each pattern ID maps to exactly ONE implementation UUID.

---

## Quality Standards

### Code Quality
- ✅ **Working Code**: Test before submitting
- ✅ **Comments**: Explain non-obvious logic
- ✅ **Efficiency**: Use appropriate data step vs. PROC
- ✅ **CDISC Compliance**: Follow controlled terminology

### Documentation Quality
- ✅ **Clear Problem**: Specific clinical scenario
- ✅ **When to Use**: Concrete triggers
- ✅ **Edge Cases**: Document limitations
- ✅ **Variations**: Link related patterns

### Markdown Quality
- ✅ **Agent Skill Format**: Exact structure match
- ✅ **Code Blocks**: Proper language tags
- ✅ **Formatting**: Consistent bullet points, headings
- ✅ **No Malformed**: Valid markdown syntax

---

## Pattern Naming Best Practices

### Good Pattern Names
- ✅ "Last Observation Carried Forward" (IMP-001)
- ✅ "Body Mass Index Calculation" (DER-001)
- ✅ "ISO 8601 Date Conversion" (DAT-001)
- ✅ "Baseline Flag Derivation" (FLG-001)

### Bad Pattern Names
- ❌ "LOCF" (too terse)
- ❌ "Missing Data Handler Type 1" (vague)
- ❌ "Generic Derivation" (not specific)
- ❌ "Helper Function" (not descriptive)

**Rule**: Pattern names should be searchable and describe the WHAT, not HOW.

---

## Related Concepts

### Statistical Methods
When creating STA-category patterns:
- Reference statistical literature (e.g., FDA guidance)
- Include assumptions and prerequisites
- Note when SAS vs. R implementations differ algorithmically

### Validation Patterns
When creating VAL-category patterns:
- Specify acceptance criteria
- Provide example fail scenarios
- Link to regulatory expectations

---

## Core Principles Summary

1. **Agent Skill Format**: ALL exports must be markdown compliant
2. **Pattern IDs**: Follow `{CATEGORY}-{XXX}` naming
3. **Dual Implementation**: Both SAS and R required
4. **CDISC Alignment**: Use controlled terminology
5. **Quality Over Quantity**: Working, tested code only
6. **Documentation**: Clear problem, when to use, considerations
7. **Variations**: Link related patterns for discoverability

---

**Skill Status**: Domain-specific for clinical programming pattern management in StatPatternHub
