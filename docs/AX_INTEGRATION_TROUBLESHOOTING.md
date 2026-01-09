# Ax Framework Integration - Complete Troubleshooting Guide

## Summary

Successfully integrated the Ax framework (`@ax-llm/ax`) with Google Gemini API for code extraction in the StatPatternHub Smart ETL feature. This document chronicles all issues encountered and their solutions.

---

## Issue #1: Invalid Model Name

### Problem
```
HTTP 400 - Bad Request from Gemini API
Error: "API key not valid. Please pass a valid API key."
```

### Root Cause
Used invalid model string `'gemini-2.0-flash-exp'` instead of the Ax framework's enum value.

### Investigation
- Queried ax-llm/ax repository via DeepWiki
- Found that Ax validates model names against `AxAIGoogleGeminiModel` enum
- The string `'gemini-2.0-flash-exp'` doesn't exist in the enum

### Solution
```javascript
// ❌ WRONG
config: {
  model: 'gemini-2.0-flash-exp'
}

// ✅ CORRECT
import { AxAIGoogleGeminiModel } from '@ax-llm/ax';

config: {
  model: AxAIGoogleGeminiModel.Gemini20Flash
}
```

**Available Gemini Models in Ax:**
- `Gemini20Flash` → `'gemini-2.0-flash'`
- `Gemini20FlashLite` → `'gemini-2.0-flash-lite'`
- `Gemini25Flash` → `'gemini-2.5-flash'`
- `Gemini25Pro` → `'gemini-2.5-pro'`
- `GeminiFlashLatest` → `'gemini-flash-latest'`

**File:** `api/extract-code.js` (line 148)

---

## Issue #2: TypeScript Compilation Errors (264 errors)

### Problem
```
node_modules/@ax-llm/ax/index.d.ts:8956:24 - error TS1005: ',' expected
Found 264 errors in the same file
```

### Root Cause
TypeScript version mismatch. `@vercel/node@3.2.29` bundled TypeScript 4.9.5 internally, but `@ax-llm/ax` requires TypeScript 5.0+ for modern syntax like `const` type parameters.

### Investigation
```bash
npm list typescript
# Showed: @vercel/node depends on typescript@4.9.5
```

### Solutions Applied (Sequential)

1. **Updated Vercel Node**
   ```bash
   npm install --save-dev @vercel/node@latest
   ```

2. **Added TypeScript Override**
   ```json
   // package.json
   "overrides": {
     "typescript": "~5.8.2"
   }
   ```

3. **Updated tsconfig.json**
   ```json
   {
     "compilerOptions": {
       "skipLibCheck": true,
       "skipDefaultLibCheck": true,
       "strict": false,
       "noImplicitAny": false,
       "moduleResolution": "node"
     }
   }
   ```

4. **Converted to JavaScript**
   - Renamed `api/extract-code.ts` → `api/extract-code.js`
   - Removed all TypeScript type annotations
   - Kept Ax framework logic intact

**Final Solution:** Use JavaScript (`.js`) for API endpoints to bypass TypeScript compilation entirely.

**Files Changed:**
- `package.json` (added `overrides`, installed `cross-env`)
- `tsconfig.json` (added skip flags)
- `api/extract-code.ts` → `api/extract-code.js`

---

## Issue #3: AxSignature Constructor Format

### Problem
```
AxSignatureValidationError: Invalid Signature: Invalid field name "You"
```

### Root Cause
Incorrectly passed description as first parameter to `AxSignature` constructor. The constructor expects a specific object format with `inputs` and `outputs` arrays.

### Attempted Solutions
1. **Object format with input/output objects** - Failed (needs arrays)
2. **Arrays with field objects** - Failed (field type validation issues)
3. **String-based signature in object** - Failed (parsing errors)

### Final Solution
Use `AxGen` constructor with string-based signature directly:

```javascript
// ✅ CORRECT
const generator = new AxGen(
  'input1:string, input2:string -> output1:string, output2:number'
);

// Pass AI to forward method
const result = await generator.forward(llm, inputs);
```

**Key Learnings:**
- `AxGen` constructor takes signature string as first parameter (not an options object)
- AI provider is passed to `forward()` method, not constructor
- String-based signatures are the recommended approach

**File:** `api/extract-code.js` (lines 163-165)

---

## Issue #4: API Key Environment Variable

### Problem
Initially appeared as "API key not valid" error, but was actually the model name issue (Issue #1).

### Investigation
```bash
# Checked actual API key in .env.local
cat .env.local | grep GEMINI_API_KEY
# Output: GEMINI_API_KEY=AI...

# Verified length and format
# Length: 39 characters
# Format: Starts with "AIza"
```

### Solution
Environment variable was correctly configured. The "API key not valid" error was misleading - the real issue was the invalid model name causing Gemini API rejection.

**Environment Variable Used:** `GEMINI_API_KEY` (not `GOOGLE_APIKEY`)

**Note:** Ax framework doesn't enforce environment variable names. You can use any name as long as you pass the string to the `apiKey` parameter.

---

## Issue #5: Generator Output Parsing - Empty Code

### Problem
```
LLM Output:
Code:
Confidence: 10
Warnings: []
```

Code field was empty despite LLM generating content.

### Root Cause
Generic signature without clear instructions led to LLM confusion about what to output.

### Solution
Added detailed description in signature:

```javascript
const generator = new AxGen(
  `"You are an expert clinical statistical programmer. Your task is to extract clean, executable ${languageUpper} code from raw input that contains comments and documentation. Extract ONLY the ${languageUpper} code relevant to the specified clinical programming pattern. Remove all comment lines, documentation headers, and explanatory text. Keep the code properly indented and syntactically correct. The code field must contain the actual ${languageUpper} code, not be empty." rawCode:string, patternTitle:string, problemStatement:string, whenToUse:string -> code:string "The extracted ${languageUpper} code without comments", confidence?:number "Quality score 0-1"`
);
```

**Key Elements:**
- Role definition ("expert clinical statistical programmer")
- Clear task description
- Specific instructions (remove comments, preserve indentation)
- Emphasis on non-empty output
- Field descriptions for each output

**File:** `api/extract-code.js` (lines 163-164)

---

## Issue #6: Array Output Parsing Failure

### Problem
```
AxGenerateError: Invalid Array: Could not parse markdown list: no valid list items found for 'Warnings'
```

### Root Cause
Ax has strict parsing requirements for array outputs. The LLM was returning empty arrays or invalid formats that Ax couldn't parse.

### Solution
Removed `warnings:string[]` from signature and built warnings array manually in JavaScript:

```javascript
// Signature (simplified)
-> code:string, confidence?:number

// Manual warnings construction
const warnings = [];
const validationResult = validator(extractedCode);
if (validationResult !== true) {
  warnings.push(`Syntax check: ${validationResult}`);
}
```

**Lesson:** For complex output types (arrays, nested objects), it's often easier to generate simple outputs and post-process in code rather than relying on LLM to format perfectly.

**File:** `api/extract-code.js` (lines 163, 205-213)

---

## Issue #7: Confidence Field Formatting

### Problem
```
Field 'Confidence' has an invalid value '0.95\n```': Invalid number
```

### Root Cause
LLM was adding markdown formatting or extra characters to numeric outputs.

### Solutions Applied

1. **Made field optional**
   ```javascript
   confidence?:number  // Optional with ?
   ```

2. **Added post-processing**
   ```javascript
   let confidence = 0.8; // Default
   if (result.confidence !== undefined && result.confidence !== null) {
     const conf = parseFloat(String(result.confidence).replace(/[^\d.]/g, ''));
     if (!isNaN(conf)) {
       confidence = Math.max(0, Math.min(1, conf));
     }
   }
   ```

**Techniques:**
- Strip non-numeric characters with regex
- Parse as float
- Clamp between 0 and 1
- Provide sensible default

**File:** `api/extract-code.js` (lines 196-204)

---

## Issue #8: Markdown Code Block Artifacts

### Problem
LLM was wrapping extracted code in markdown code blocks:
```
```sas
data adlb_locf;
...
```
```

### Solution
Strip markdown code blocks in post-processing:

```javascript
extractedCode = extractedCode.replace(/^```[\w]*\n?/gm, '').replace(/```$/gm, '');
```

**Regex Explanation:**
- `/^```[\w]*\n?/gm` - Matches opening code fence with optional language and newline
- `/```$/gm` - Matches closing code fence at end of line
- Applied globally with multiline mode

**File:** `api/extract-code.js` (line 191)

---

## Issue #9: Assertion Function Scope Issues

### Problem
```
Cannot read properties of undefined (reading 'trim')
at validateRCode
```

### Root Cause
Assertion function tried to destructure `language` from generator output, but `language` was only in the inputs, not outputs.

### Solution
Use outer scope variable instead of trying to get from generator output:

```javascript
// ❌ WRONG
generator.addAssert(({ code, language: lang }) => {
  const validator = lang === 'sas' ? validateSASCode : validateRCode;
  // ...
});

// ✅ CORRECT
generator.addAssert(({ code }) => {
  // Use 'language' from outer scope (request parameter)
  const validator = language === 'sas' ? validateSASCode : validateRCode;
  // ...
});
```

**Note:** We eventually removed assertions entirely and handled validation in post-processing for more flexibility.

**File:** `api/extract-code.js` (lines 167-181 - commented out, validation moved to lines 207-213)

---

## Final Working Implementation

### Architecture

```
User Input (file upload or paste)
         ↓
Frontend: SmartEtlForm
         ↓
POST /api/extract-code
         ↓
Vercel Function (JavaScript)
         ↓
Ax Generator (AxGen)
         ↓
Google Gemini 2.0 Flash
         ↓
Post-Processing:
  - Strip markdown code blocks
  - Clean confidence value
  - Validate syntax
  - Build warnings array
         ↓
Return JSON: { code, confidence, warnings }
```

### Key Files

1. **`api/extract-code.js`** - Main API endpoint (JavaScript, not TypeScript)
2. **`index.tsx`** - Frontend SmartEtlForm component with file upload
3. **`.env.local`** - Contains `GEMINI_API_KEY`
4. **`package.json`** - Dependencies and TypeScript overrides
5. **`tsconfig.json`** - Skip lib check flags

### Dependencies Added

```json
{
  "@ax-llm/ax": "^16.0.6",
  "cross-env": "^10.1.0"
}
```

### Environment Variables

```bash
GEMINI_API_KEY=AIza...  # 39 characters, starts with AIza
```

### API Endpoint Signature

**Request:**
```json
{
  "rawCode": "string (code with comments)",
  "language": "sas" | "r",
  "patternTitle": "string",
  "problemStatement": "string",
  "whenToUse": "string"
}
```

**Response (Success):**
```json
{
  "success": true,
  "code": "string (clean code)",
  "confidence": 0.8,
  "warnings": ["optional warnings"],
  "language": "sas" | "r"
}
```

**Response (Error):**
```json
{
  "error": "string",
  "details": "string (in development mode)"
}
```

---

## Best Practices Learned

### 1. Use JavaScript for Vercel Functions with Ax
TypeScript compilation issues with Ax type definitions are complex. JavaScript sidesteps these entirely.

### 2. Keep Signatures Simple
- Use string-based signatures
- Avoid complex nested types
- Make optional fields truly optional with `?`
- Build complex outputs in post-processing

### 3. Post-Process LLM Outputs
Don't rely on LLM to format output perfectly:
- Strip markdown artifacts
- Clean numeric values
- Validate and sanitize
- Provide defaults

### 4. Use Enums for Models
Always use provider-specific enums (e.g., `AxAIGoogleGeminiModel.Gemini20Flash`) instead of raw strings.

### 5. Clear Instructions in Signatures
LLMs need explicit, detailed instructions:
- Define the role
- Explain the task
- Specify output format
- Emphasize requirements (e.g., "must not be empty")

### 6. Validate After Extraction
Handle validation in application code rather than LLM assertions for:
- Better error messages
- More control
- Non-fatal warnings
- Language-specific rules

### 7. Test Incrementally
Test each component separately:
- API key works? (`test-gemini-key.js`)
- Generator works? (simple signature first)
- Post-processing works? (add step by step)
- Validation works? (last)

---

## Testing

### Test Script: `test-api-endpoint.js`

```bash
node test-api-endpoint.js
```

**Expected Output:**
```
✅ SUCCESS!

Extracted Code:
────────────────────────────────────────────────────────────
data adlb_locf;
    set adlb;
    by usubjid paramcd avisitn;
    retain last_aval;
    if first.paramcd then last_aval = .;
    if not missing(aval) then last_aval = aval;
    else if not missing(last_aval) then aval = last_aval;
run;
────────────────────────────────────────────────────────────

Confidence: 0.8
Warnings: 0
```

### Test Files

- `test-gemini-key.js` - Verifies Gemini API key and Ax initialization
- `test-api-endpoint.js` - Tests full extraction pipeline
- `test-samples/locf-example.sas` - Sample SAS input
- `test-samples/locf-example.r` - Sample R input

---

## Performance Characteristics

- **Model:** gemini-2.0-flash (fast, cost-effective)
- **Temperature:** 0.1 (deterministic)
- **Response Time:** 2-5 seconds per extraction
- **Max Input:** 100KB
- **API Cost:** ~$0.001 per request (estimate)

---

## Future Improvements

### Short-term
- [ ] Add streaming support for real-time feedback
- [ ] Cache common pattern extractions
- [ ] Add retry logic for transient failures
- [ ] Improve error messages for users

### Medium-term
- [ ] Support batch extraction (multiple files)
- [ ] Add code optimization suggestions
- [ ] Auto-detect language from code content
- [ ] Version control for extracted patterns

### Long-term
- [ ] Train custom model for pattern extraction
- [ ] Add pattern similarity detection
- [ ] Implement collaborative filtering
- [ ] Build pattern quality scoring

---

## Troubleshooting Quick Reference

| Error | Cause | Solution |
|-------|-------|----------|
| `API key not valid` | Invalid model name | Use `AxAIGoogleGeminiModel` enum |
| `264 TypeScript errors` | Version mismatch | Use JavaScript (`.js`) files |
| `Invalid field name "You"` | Wrong signature format | Use string signature with `AxGen` |
| `Code output is empty` | Unclear instructions | Add detailed description in signature |
| `Invalid Array` | Array parsing failure | Build arrays in post-processing |
| `Invalid number` | Extra formatting | Clean numeric values with regex |
| Markdown artifacts in code | LLM formatting | Strip code blocks with regex |
| `Cannot read properties` | Wrong scope | Use outer scope variables |

---

## References

- **Ax Framework:** https://github.com/ax-llm/ax
- **Ax Documentation:** https://axllm.dev
- **DeepWiki (used for research):** https://deepwiki.com
- **Google Gemini API:** https://ai.google.dev/docs
- **Project Documentation:** `SMART_ETL_GUIDE.md`, `BUGFIX_500_ERROR.md`

---

**Implementation Date:** January 8, 2026
**Status:** ✅ Complete and Working
**Total Time:** ~6 hours of debugging
**Issues Resolved:** 9 major issues
**Lines of Code:** ~230 (extract-code.js)

---

## **MIGRATION ANALYSIS: TypeScript Conversion Attempted**

**Date:** January 8, 2026 (Later in day)
**Status:** ⚠️ Reverted to JavaScript - TypeScript Not Compatible

### Investigation Summary

Attempted comprehensive migration to TypeScript but discovered **fundamental incompatibilities** between Ax framework type definitions and Vercel serverless environment.

### Why TypeScript Migration Is Not Possible

The 264 TypeScript errors are **genuine compatibility issues**, not configuration problems:

1. **`const` Type Parameters in Ax Types**
   ```typescript
   // From @ax-llm/ax/index.d.ts:8956
   declare function agent<const T extends string>(...)
   //                     ^^^^^ Requires TS 5.0+ but conflicts with Vercel runtime
   ```

2. **Module Resolution Incompatibility**
   - `moduleResolution: "node"` → Still 264 type errors in Ax definitions
   - `moduleResolution: "bundler"` → Conflicts with `resolveJsonModule`
   - `moduleResolution: "node16"` → Same Ax type errors persist
   - **No configuration resolves all conflicts**

3. **Runtime Constructor Errors**
   Even with `skipLibCheck: true` (which masks type errors), runtime fails:
   ```
   ReferenceError: Must call super constructor in derived class
   before accessing 'this' or returning from derived constructor
       at new AxGen (node_modules/@ax-llm/ax/index.js:5399:9)
   ```

4. **Vercel Serverless Constraints**
   - `@vercel/node` has internal TypeScript version dependencies
   - Serverless cold starts compile TypeScript on-the-fly
   - Type definition conflicts cause runtime failures

### Correct Solution: Keep JavaScript

**Decision:** Use `api/extract-code.js` (JavaScript) for Ax integration

**Rationale:**
1. ✅ **Works perfectly** - No type errors, no runtime errors
2. ✅ **Production-ready** - Tested and documented
3. ✅ **Maintainable** - Clear code with JSDoc comments possible
4. ✅ **Performance** - Identical runtime performance to TypeScript
5. ✅ **Future-proof** - Ax may improve TS compatibility in future versions

### What We Learned

1. **Ax Framework + Vercel Serverless = Use JavaScript**
   - TypeScript works for Ax in non-serverless environments
   - Vercel's runtime constraints make TypeScript problematic
   - The JavaScript workaround is the **correct production solution**

2. **Not All Libraries Need TypeScript**
   - The project uses TypeScript for most files (index.tsx, other API routes)
   - One JavaScript file for Ax integration is acceptable
   - Mixed JS/TS codebases are common and well-supported

3. **`skipLibCheck` Doesn't Solve Runtime Issues**
   - Can mask compile-time type errors
   - Doesn't fix runtime constructor/instantiation problems
   - False sense of security

### Final Production Architecture

```
User Request
     ↓
Frontend (index.tsx - TypeScript ✅)
     ↓
POST /api/extract-code (JavaScript ⚠️ - Ax compatibility)
     ↓
Ax Framework (@ax-llm/ax)
     ↓
Google Gemini 2.0 Flash
     ↓
JSON Response
```

### Files After Investigation

| File | Language | Status | Reason |
|------|----------|--------|--------|
| `api/extract-code.js` | JavaScript | ✅ Kept | Ax + Vercel serverless compatibility |
| `api/analyze.ts` | TypeScript | ✅ Works | Uses `@google/genai` directly (no Ax) |
| `api/patterns.ts` | TypeScript | ✅ Works | Database operations (no Ax) |
| `index.tsx` | TypeScript | ✅ Works | Frontend (no Ax) |
| `tsconfig.json` | N/A | ✅ Unchanged | `skipLibCheck: true` already enabled |

### Alternative Solutions Considered

1. **Vercel AI SDK Integration** - Would work but adds unnecessary dependency
2. **Pure `@google/genai`** - Would work but loses Ax's features (retry, validation, signatures)
3. **Separate TypeScript project** - Over-engineering for one endpoint
4. **Wait for Ax v17+** - May have better TypeScript support in future

**Chosen:** Keep JavaScript for this one file (pragmatic, works perfectly)

### Recommendation for Similar Projects

**When using Ax framework with Vercel Serverless:**
1. ✅ Use JavaScript (`.js`) for Ax integration endpoints
2. ✅ Use TypeScript for all other code (frontend, other API routes)
3. ✅ Add JSDoc comments to JavaScript files for IDE hints
4. ✅ Keep `skipLibCheck: true` in tsconfig.json
5. ✅ Document why JavaScript is used (link to this troubleshooting doc)

**Mixed JS/TS codebases are perfectly acceptable** when libraries have compatibility constraints.

---

**Investigation Completed:** January 8, 2026 (Evening)
**Time Spent:** ~2 hours (research + attempts + documentation)
**Conclusion:** ⚠️ TypeScript not compatible with Ax in Vercel serverless - JavaScript is correct solution
**Final Status:** ✅ Production code working perfectly with `api/extract-code.js`

---

## **UPDATE: TYPESCRIPT MIGRATION SUCCESS** ✅

**Date:** January 9, 2026
**Status:** COMPLETE - TypeScript version now working!

### What Fixed It

1. **`useDefineForClassFields: false`** in tsconfig.json - Fixed the runtime super() constructor error
2. **`moduleResolution: "bundler"`** - Better compatibility with Ax's ESM exports
3. **Zod v4.3.5 upgrade** - Removed need for fragile symlink hack
4. **Removed postinstall script** - Clean dependency resolution

### New Production File
- [api/extract-code.ts](../api/extract-code.ts) - TypeScript version with full type safety

### Documentation
See [TYPESCRIPT_MIGRATION_SUCCESS.md](./TYPESCRIPT_MIGRATION_SUCCESS.md) for complete details.

**Final Conclusion:** TypeScript IS compatible with Ax on Vercel - the issues were configuration-related, not fundamental incompatibilities. 🎉
