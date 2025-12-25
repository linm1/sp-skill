# StatPatternHub - API Documentation
## Sprint 1 Day 1 - Backend Deliverables

---

## Overview

This document describes the RESTful API endpoints created for Sprint 1 Day 1 (Priority 1 work). These endpoints provide the foundation for pattern management in StatPatternHub.

**Base URL (Local Development)**: `http://localhost:3000/api`
**Base URL (Production)**: `https://sp-skill.vercel.app/api`

---

## Authentication & Security

### Migration-Protected Endpoints

The seed endpoint is protected by a migration token to prevent unauthorized database modifications.

**Header Required**:
```
x-migration-token: your-secret-token
```

**Configuration**:
Add to `.env.local`:
```env
MIGRATION_TOKEN=your-secret-token-12345
```

---

## Endpoints

### 1. Seed Database (POST /api/seed)

Creates 30 realistic clinical programming patterns with implementations.

#### Request

```http
POST /api/seed
x-migration-token: your-secret-token-12345
```

#### Response (Success - 200)

```json
{
  "success": true,
  "message": "Database seeded successfully",
  "summary": {
    "patternsCreated": 30,
    "impPatterns": 15,
    "derPatterns": 15,
    "implementationsCreated": 30,
    "systemUserId": 1
  },
  "timestamp": "2025-12-25T23:30:00.000Z"
}
```

#### Response (Error - 401)

```json
{
  "error": "Unauthorized - Invalid or missing migration token"
}
```

#### Response (Error - 500)

```json
{
  "success": false,
  "error": "Detailed error message",
  "message": "Database seeding failed"
}
```

#### Patterns Created

**IMP (Imputation) - 15 patterns**:
- IMP-001: LOCF (Last Observation Carried Forward)
- IMP-002: Mean Imputation by Treatment Group
- IMP-003: Linear Interpolation Between Visits
- IMP-004: Multiple Imputation with PROC MI
- IMP-005: Baseline Observation Carried Forward (BOCF)
- IMP-006: Hot Deck Imputation
- IMP-007: Regression-Based Imputation
- IMP-008: Monotone Missing Data Imputation
- IMP-009: K-Nearest Neighbors (KNN) Imputation
- IMP-010: Expectation-Maximization (EM) Imputation
- IMP-011: Worst Rank Imputation for Composite Endpoints
- IMP-012: Copy Reference Imputation (Control-Based)
- IMP-013: Pattern Mixture Models for MNAR
- IMP-014: Propensity Score Matching for Imputation
- IMP-015: Retrieved Dropout Imputation

**DER (Derivations) - 15 patterns**:
- DER-001: Change from Baseline Calculation
- DER-002: Analysis Flags (ANLzzFL)
- DER-003: Treatment-Emergent Adverse Event (TEAE) Flag
- DER-004: Worst Post-Baseline Value
- DER-005: Laboratory Reference Range Flags
- DER-006: Vital Signs Change Categories
- DER-007: Exposure Duration Calculation
- DER-008: Visit Window Assignment
- DER-009: Adverse Event Severity Grading
- DER-010: ECG Interval QTc Correction
- DER-011: Treatment Compliance/Adherence Calculation
- DER-012: Baseline and Post-Baseline Record Selection
- DER-013: Age Group Categorization
- DER-014: Derived Treatment Variables
- DER-015: Analysis Date (ADT) and Day (ADY) Derivation

#### Testing

**cURL (Linux/macOS)**:
```bash
curl -X POST http://localhost:3000/api/seed \
  -H "x-migration-token: your-secret-token-12345"
```

**PowerShell (Windows)**:
```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/seed `
  -Method POST `
  -Headers @{"x-migration-token"="your-secret-token-12345"}
```

---

### 2. List All Patterns (GET /api/patterns)

Retrieves all patterns with implementation counts and author information.

#### Request

```http
GET /api/patterns
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `category` | string | No | Filter by category (e.g., `IMP`, `DER`) |

#### Response (Success - 200)

```json
{
  "success": true,
  "count": 30,
  "category": "ALL",
  "patterns": [
    {
      "id": "IMP-001",
      "category": "IMP",
      "title": "LOCF (Last Observation Carried Forward)",
      "problem": "Handle missing follow-up values in longitudinal clinical trial data by carrying forward the last observed measurement",
      "whenToUse": "When you have time-series data with intermittent missing values and the assumption that values remain stable between visits is clinically reasonable",
      "implementationCount": 1,
      "authors": ["System"],
      "latestUpdate": "2025-12-25T23:30:00.000Z",
      "createdAt": "2025-12-25T23:30:00.000Z"
    },
    {
      "id": "IMP-002",
      "category": "IMP",
      "title": "Mean Imputation by Treatment Group",
      "problem": "Replace missing values with the mean of observed values within the same treatment arm",
      "whenToUse": "When missing data is minimal (<5%) and MCAR (Missing Completely At Random) assumption holds",
      "implementationCount": 1,
      "authors": ["System"],
      "latestUpdate": "2025-12-25T23:30:00.000Z",
      "createdAt": "2025-12-25T23:30:00.000Z"
    }
  ]
}
```

#### Response (Filtered by Category)

```http
GET /api/patterns?category=IMP
```

```json
{
  "success": true,
  "count": 15,
  "category": "IMP",
  "patterns": [
    {
      "id": "IMP-001",
      "category": "IMP",
      "title": "LOCF (Last Observation Carried Forward)",
      ...
    }
  ]
}
```

#### Response (Error - 500)

```json
{
  "success": false,
  "error": "Detailed error message",
  "message": "Failed to fetch patterns"
}
```

#### Testing

**cURL (All patterns)**:
```bash
curl http://localhost:3000/api/patterns
```

**cURL (Filter by category)**:
```bash
curl http://localhost:3000/api/patterns?category=IMP
```

**PowerShell (All patterns)**:
```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/patterns
```

**PowerShell (Filter by category)**:
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/patterns?category=IMP"
```

---

### 3. Get Pattern Detail (GET /api/patterns/[id])

Retrieves a single pattern with all its implementations.

#### Request

```http
GET /api/patterns/IMP-001
```

#### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Pattern ID (format: XXX-NNN, e.g., IMP-001) |

#### Response (Success - 200)

```json
{
  "success": true,
  "pattern": {
    "id": "IMP-001",
    "category": "IMP",
    "title": "LOCF (Last Observation Carried Forward)",
    "problem": "Handle missing follow-up values in longitudinal clinical trial data by carrying forward the last observed measurement",
    "whenToUse": "When you have time-series data with intermittent missing values and the assumption that values remain stable between visits is clinically reasonable",
    "createdAt": "2025-12-25T23:30:00.000Z",
    "implementations": [
      {
        "uuid": "550e8400-e29b-41d4-a716-446655440000",
        "authorId": 1,
        "authorName": "System",
        "sasCode": "/* LOCF Imputation using PROC SQL */\ndata imputed;\n  set original;\n  by subjid;\n  retain last_value;\n\n  if first.subjid then last_value = .;\n\n  if not missing(aval) then last_value = aval;\n  else if not missing(last_value) then aval = last_value;\nrun;",
        "rCode": "# LOCF Imputation using tidyverse\nlibrary(dplyr)\n\nimputed <- original %>%\n  group_by(subjid) %>%\n  arrange(visitnum) %>%\n  fill(aval, .direction = \"down\") %>%\n  ungroup()",
        "considerations": [
          "LOCF can introduce bias if measurements naturally change over time",
          "Not appropriate for endpoints expected to improve/worsen",
          "Consider regulatory guidance - some agencies discourage LOCF",
          "Document imputation in analysis datasets (add DTYPE variable)"
        ],
        "variations": [
          "BOCF (Baseline Observation Carried Forward)",
          "WOCF (Worst Observation Carried Forward)",
          "Mixed Model for Repeated Measures (MMRM) - preferred alternative"
        ],
        "status": "active",
        "isPremium": false,
        "createdAt": "2025-12-25T23:30:00.000Z",
        "updatedAt": "2025-12-25T23:30:00.000Z"
      }
    ]
  }
}
```

#### Response (Error - 400 Bad Request)

```json
{
  "success": false,
  "error": "Pattern ID is required"
}
```

```json
{
  "success": false,
  "error": "Invalid pattern ID format. Expected format: XXX-NNN (e.g., IMP-001)"
}
```

#### Response (Error - 404 Not Found)

```json
{
  "success": false,
  "error": "Pattern IMP-999 not found"
}
```

#### Response (Error - 500)

```json
{
  "success": false,
  "error": "Detailed error message",
  "message": "Failed to fetch pattern details"
}
```

#### Testing

**cURL**:
```bash
# Get specific pattern
curl http://localhost:3000/api/patterns/IMP-001

# Get another pattern
curl http://localhost:3000/api/patterns/DER-001
```

**PowerShell**:
```powershell
# Get specific pattern
Invoke-RestMethod -Uri http://localhost:3000/api/patterns/IMP-001

# Get another pattern
Invoke-RestMethod -Uri http://localhost:3000/api/patterns/DER-001
```

---

## Data Models

### PatternDefinition (Immutable Container)

```typescript
interface PatternDefinition {
  id: string;              // Pattern ID (e.g., 'IMP-001')
  category: string;        // Category code (e.g., 'IMP', 'DER')
  title: string;           // Human-readable name
  problem: string;         // What the pattern solves
  whenToUse: string;       // Usage triggers/scenarios
  createdAt: Date;         // Creation timestamp
}
```

### PatternImplementation (Mutable Content)

```typescript
interface PatternImplementation {
  uuid: string;            // Unique implementation ID
  patternId: string;       // Links to PatternDefinition
  authorId: number;        // Author user ID
  authorName: string;      // Contributor name
  sasCode: string;         // SAS implementation
  rCode: string;           // R implementation
  considerations: string[]; // Edge cases/warnings
  variations: string[];    // Related patterns
  status: 'active' | 'pending' | 'rejected';
  isPremium: boolean;      // Access tier flag
  createdAt: Date;
  updatedAt: Date;
}
```

### User

```typescript
interface User {
  id: number;
  email: string;
  name: string;
  role: 'guest' | 'contributor' | 'premier' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Integration Notes for Frontend Team

### 1. Environment Setup

Before testing endpoints, ensure:
1. Vercel environment variables are pulled: `vercel env pull .env.local`
2. Add `MIGRATION_TOKEN` to `.env.local`
3. Both servers are running:
   - Terminal 1: `npm run dev` (port 3000)
   - Terminal 2: `npm run dev:api` (port 3001)

### 2. Initial Setup Flow

```javascript
// 1. Run migration (one time)
await fetch('/api/migrate', {
  method: 'POST',
  headers: { 'x-migration-token': 'your-secret-token' }
});

// 2. Seed database (one time)
await fetch('/api/seed', {
  method: 'POST',
  headers: { 'x-migration-token': 'your-secret-token' }
});

// 3. Fetch patterns
const response = await fetch('/api/patterns');
const data = await response.json();
console.log(data.patterns);
```

### 3. Frontend Usage Examples

**Fetch all patterns**:
```javascript
const fetchPatterns = async (category?: string) => {
  const url = category
    ? `/api/patterns?category=${category}`
    : '/api/patterns';

  const response = await fetch(url);
  const data = await response.json();

  if (data.success) {
    return data.patterns;
  } else {
    throw new Error(data.error);
  }
};

// Usage
const allPatterns = await fetchPatterns();
const impPatterns = await fetchPatterns('IMP');
```

**Fetch pattern detail**:
```javascript
const fetchPatternDetail = async (patternId: string) => {
  const response = await fetch(`/api/patterns/${patternId}`);
  const data = await response.json();

  if (data.success) {
    return data.pattern;
  } else {
    throw new Error(data.error);
  }
};

// Usage
const pattern = await fetchPatternDetail('IMP-001');
console.log(pattern.implementations);
```

**React Hook Example**:
```javascript
import { useState, useEffect } from 'react';

const usePatterns = (category?: string) => {
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const url = category
          ? `/api/patterns?category=${category}`
          : '/api/patterns';

        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
          setPatterns(data.patterns);
        } else {
          setError(data.error);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [category]);

  return { patterns, loading, error };
};

// Usage in component
const PatternCatalog = () => {
  const { patterns, loading, error } = usePatterns('IMP');

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {patterns.map(pattern => (
        <PatternCard key={pattern.id} pattern={pattern} />
      ))}
    </div>
  );
};
```

### 4. Expected Response Headers

All endpoints return JSON with appropriate headers:
```
Content-Type: application/json
```

### 5. Error Handling

All endpoints follow consistent error response format:
```json
{
  "success": false,
  "error": "Human-readable error message",
  "message": "Additional context (optional)"
}
```

HTTP Status Codes:
- `200` - Success
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing/invalid token)
- `404` - Not Found (pattern doesn't exist)
- `405` - Method Not Allowed (wrong HTTP method)
- `500` - Internal Server Error

---

## Testing Checklist

### Manual Testing Steps

1. **Database Setup**
   - [ ] Verify `.env.local` has `POSTGRES_URL`
   - [ ] Verify `.env.local` has `MIGRATION_TOKEN`
   - [ ] Run migration: `POST /api/migrate`
   - [ ] Verify tables exist: `GET /api/list-tables`

2. **Seed Database**
   - [ ] Run seed endpoint: `POST /api/seed`
   - [ ] Verify 30 patterns created
   - [ ] Verify "System" user exists

3. **Pattern Catalog**
   - [ ] Fetch all patterns: `GET /api/patterns`
   - [ ] Verify returns 30 patterns
   - [ ] Filter by IMP: `GET /api/patterns?category=IMP`
   - [ ] Verify returns 15 patterns
   - [ ] Filter by DER: `GET /api/patterns?category=DER`
   - [ ] Verify returns 15 patterns

4. **Pattern Detail**
   - [ ] Fetch IMP-001: `GET /api/patterns/IMP-001`
   - [ ] Verify has SAS and R code
   - [ ] Verify has considerations array
   - [ ] Verify has variations array
   - [ ] Fetch DER-001: `GET /api/patterns/DER-001`
   - [ ] Test invalid ID: `GET /api/patterns/INVALID`
   - [ ] Verify 400 error response
   - [ ] Test non-existent ID: `GET /api/patterns/IMP-999`
   - [ ] Verify 404 error response

### Database Verification

Query to check pattern counts:
```sql
SELECT category, COUNT(*) as count
FROM pattern_definitions
GROUP BY category
ORDER BY category;
```

Expected result:
```
category | count
---------|------
DER      | 15
IMP      | 15
```

Query to check implementations:
```sql
SELECT
  pd.category,
  COUNT(DISTINCT pd.id) as patterns,
  COUNT(pi.uuid) as implementations
FROM pattern_definitions pd
LEFT JOIN pattern_implementations pi ON pd.id = pi.pattern_id
GROUP BY pd.category;
```

Expected result:
```
category | patterns | implementations
---------|----------|----------------
DER      | 15       | 15
IMP      | 15       | 15
```

---

## Next Steps (Day 2-3 Work)

### Priority 2: Authentication (Day 2)
- Install `@clerk/backend`
- Create `GET /api/auth/me`
- Implement just-in-time user provisioning
- Default new users to `role="contributor"`

### Priority 3: Contribution & Admin (Day 3)
- Create `POST /api/implementations` (contribution submission)
- Create `PATCH /api/implementations/[uuid]/status` (admin approval)
- Create `PUT /api/implementations/[uuid]` (edit implementation)

---

## Support & Questions

For questions or issues:
1. Check DEVELOPMENT.md for setup instructions
2. Check DATABASE_SETUP.md for database configuration
3. Report blockers to Scrum Lead
4. Contact frontend team for integration questions

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-25 | Initial API documentation for Sprint 1 Day 1 |
