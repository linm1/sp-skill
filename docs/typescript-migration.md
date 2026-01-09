# TypeScript Strict Mode Migration

## Current Status

- **Strict mode enabled:** ✅ (as of Sprint 005)
- **Incremental rollout:** In progress

## Strategy

We're enabling TypeScript strict mode incrementally using the `// @ts-strict-local` pragma to avoid breaking the entire codebase at once.

### Phase 1: New Files (Sprint 005)

Files with `// @ts-strict-local` annotation (strict mode enforced):

- `lib/validators.ts` - Code validation utilities
- `lib/sanitize.ts` - Input sanitization
- `lib/constants.ts` - Application constants

### Phase 2: Core Libraries (Future Sprint)

Next files to migrate:
- `lib/auth.ts`
- `lib/cache.ts`
- `lib/email.ts`

### Phase 3: API Endpoints (Future Sprint)

Migrate API endpoints one by one:
- `api/extract-code.ts`
- `api/patterns.ts`
- `api/implementations.ts`
- ... etc

## How to Add Strict Mode to a File

1. Add `// @ts-strict-local` to the top of the file
2. Run `npm run build` to see type errors
3. Fix errors (add type annotations, null checks, etc.)
4. Verify build passes
5. Commit changes

## Common Type Errors

### Implicit `any`

**Error:** Parameter 'x' implicitly has an 'any' type
**Fix:** Add explicit type annotation

```typescript
// Before
function process(data) { ... }

// After
function process(data: string): void { ... }
```

### Null/Undefined Safety

**Error:** Object is possibly 'null' or 'undefined'
**Fix:** Add null checks or optional chaining

```typescript
// Before
const name = user.profile.name;

// After
const name = user?.profile?.name ?? 'Unknown';
```

### Return Type Inference

**Error:** Function lacks return type annotation
**Fix:** Add explicit return type

```typescript
// Before
function calculate(x: number, y: number) {
  return x + y;
}

// After
function calculate(x: number, y: number): number {
  return x + y;
}
```

## Benefits

- **Type Safety:** Catch errors at compile time instead of runtime
- **Better IDE Support:** Improved autocomplete and error detection
- **Documentation:** Type annotations serve as inline documentation
- **Refactoring Safety:** TypeScript prevents breaking changes

## Timeline

- **Sprint 005:** 3 files migrated (lib/validators, lib/sanitize, lib/constants)
- **Sprint 006:** Target 5 more files
- **Sprint 007:** Complete migration of all lib/ files
- **Sprint 008+:** Migrate API endpoints

---

*Last Updated: 2026-01-09*
*Maintained by: Full-Stack Team*
