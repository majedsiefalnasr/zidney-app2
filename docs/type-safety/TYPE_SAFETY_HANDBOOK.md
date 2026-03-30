# Type Safety Handbook - Complete Layer-by-Layer Guide

Comprehensive guide to Zidney's 8-layer Type Safety Governance system.

## Table of Contents

1. [Layer 1 - TypeScript Compiler Rules](#layer-1--typescript-compiler-rules)
2. [Layer 2 - Biome Lint Enforcement](#layer-2--biome-lint-enforcement)
3. [Layer 3 - Type Safety Guard Script](#layer-3--type-safety-guard-script)
4. [Layer 4 - Runtime Validation](#layer-4--runtime-validation)
5. [Layer 5 - CI Enforcement](#layer-5--ci-enforcement)
6. [Layer 6 - Domain Layer Safety](#layer-6--domain-layer-safety)
7. [Layer 7 - Boundary-Typed Architecture](#layer-7--boundary-typed-architecture)
8. [Layer 8 - AI Governance Rules](#layer-8--ai-governance-rules)

---

## Layer 1: TypeScript Compiler Rules

**What**: Strict TypeScript configuration in `tsconfig.json`

**How It Works**:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitThis": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true
  }
}
```

**What Gets Caught**:

- ✅ Implicit `any` type annotations
- ✅ Unchecked array/object access
- ✅ Null/undefined mismatches
- ✅ Function type compatibility
- ✅ Missing property initialization

**When It Runs**: `bun run typecheck` (compile-time)

**Example Error**:

```typescript
const count: number = "5"; // Error: string is not assignable to number
const first = items[0].id; // Error: items[0] could be undefined
```

**How to Comply**: Fix all type errors before committing.

---

## Layer 2: Biome Lint Enforcement

**What**: Linting rules in `biome.json` for type safety

**Key Rules**:

- `suspicious/noExplicitAny` — Explicit `any` requires justification comment
- `style/useConst` — Use `const` by default
- `complexity/noExcessiveComplexity` — Keep functions simple

**What Gets Caught**:

- ✅ `any` without justification comment
- ✅ `@ts-ignore` without explanation
- ✅ Type assertions (`as type`) without justification
- ✅ Unused variables

**When It Runs**: `bun run lint` (lint-time, pre-commit, CI)

**Example Error**:

```typescript
const user: any = data; // Error: explicit any requires comment
// @ts-ignore             // Error: @ts-ignore requires comment
const value = something;
```

**How to Comply**: Add justification comments or use `unknown` instead.

---

## Layer 3: Type Safety Guard Script

**What**: Custom script detecting unsafe patterns

**Location**: `scripts/type-safety-guard.ts`

**Detects**:

- ✅ `:any` type annotations
- ✅ `as any` type assertions
- ✅ `<any>` generic syntax
- ✅ `@ts-ignore` without justification
- ✅ Expired exceptions

**When It Runs**: Pre-CI, CI pipeline mandatory

**Example**:

```bash
bun run arch:type-safety-guard
# Output:
# 🔍 Type Safety Violations Found: 3
# 📄 src/api/users.ts
#   12:5 [explicit-any] Explicit 'any' type detected
#   23:8 [ts-ignore] @ts-ignore requires a justification comment
```

**How to Comply**: Fix violations or request approved exception.

---

## Layer 4: Runtime Validation

**What**: Schema validation at API boundaries using Zod

**Location**: `packages/validation/src/schemas/`

**How It Works**:

```typescript
// External data is unknown
const externalData: unknown = await fetchFromAPI();

// Validate with schema
const validated = UserSchema.parse(externalData);

// Now safely typed
await processUser(validated);
```

**Where It's Applied**:

- API request bodies
- Database query results
- Queue messages
- Environment variables
- File uploads

**When It Runs**: Request processing (runtime)

**Example Error**:

```typescript
// JSON { "email": 123 } doesn't pass email validation
// Throws ZodError at runtime
const user = UserSchema.parse(jsonData);

// Response to client:
{
  "error": "Validation failed",
  "issues": [
    { "path": ["email"], "message": "Invalid email" }
  ]
}
```

**How to Comply**: Validate all external data at entry points.

---

## Layer 5: CI Enforcement

**What**: GitHub Actions workflow running all type checks

**Location**: `.github/workflows/ci-type-safety.yml`

**Pipeline**:

1. TypeScript compile check (`bun run typecheck`)
2. Type safety guard scan (`bun run arch:type-safety-guard`)
3. Biome lint validation (`bun run lint`)

**When It Runs**: Every PR to develop/main

**Result**: PR merge blocked if any check fails

**Example CI Output**:

```
✅ Typecheck: 0 errors
✅ Type Safety Guard: 0 violations
✅ Biome Lint: 0 issues

All type safety checks passed!
```

**How to Comply**: Fix all issues before pushing PR.

---

## Layer 6: Domain Layer Safety

**What**: 100% type integrity for core packages

**Protected Packages**:

- `packages/domain-core/` — Business logic
- `packages/types/` — Type definitions
- `packages/validation/` — Validation schemas

**Rules**:

- Zero undeclared `any` usage
- Exceptions require approval
- Exceptions have max 30-day sunset
- Tracked in `ALLOWED_ANY_EXCEPTIONS.json`

**When It's Checked**: CI pipeline

**Example Exception**:

```json
{
  "file": "packages/domain-core/legacy.ts",
  "pattern": "explicit-any",
  "reason": "Legacy API untyped, migration in progress",
  "approvedBy": "architecture-team",
  "sunsetDate": "2026-04-30",
  "status": "active"
}
```

**How to Comply**: Keep protected packages fully typed, use exceptions only when truly blocked.

---

## Layer 7: Boundary-Typed Architecture

**What**: All public exports have explicit types

**Examples**:

```typescript
// ✅ GOOD - Explicit return type
export function getUserById(id: string): Promise<User> {}

// ❌ BAD - Implicit return type
export function getUserById(id: string) {}
```

**What Gets Checked**:

- ✅ Function return types on exports
- ✅ Class method return types
- ✅ Generic constraints specified
- ✅ No implicit `any` on exports

**When It's Checked**: Compile-time (`bun run typecheck`)

**How to Comply**: Always write explicit return types on public functions.

---

## Layer 8: AI Governance Rules

**What**: Explicit rules for AI-contributed code

**The 4 Core Rules**:

1. **Never use `any`** — Use `unknown` + validation
2. **Validate external data** — API, DB, queue, env vars
3. **Use generics** — For flexibility, not `any`
4. **Justify `@ts-ignore`** — Every one needs details

**Skill File**: `.agents/skills/typescript-governance/SKILL.md`

**When It's Checked**: Code review + CI (same as human code)

**How to Comply**: AI code must pass identical CI gates as human code.

---

## Integration: How Layers Work Together

### Flow for Request Handling

```
↓
Layer 5: CI validates code before merge
↓
Layer 1: TypeScript compiler ensures types correct
↓
Layer 2: Biome linter checks for unsafe patterns
↓
Layer 3: Guard script detects remaining violations
↓
Layer 7: Boundary types ensure exports typed
↓
REQUEST ARRIVES AT API
↓
Layer 4: Runtime validation converts unknown → typed
↓
Layer 6: Domain layer receives fully validated data
↓
Domain logic processes safe, typed data
```

### Example: Creating a User

**Developer writes code**:

```typescript
router.post("/users", async (c) => {
  const body: unknown = await c.req.json();
  const request = CreateUserSchema.parse(body);
  const user = await createUser(request);
  return c.json(user);
});
```

**Layer 1**: TypeScript compiler checks types ✅
**Layer 2**: Biome linter checks for `any` ✅
**Layer 3**: Guard script scans for patterns ✅
**Layer 5**: CI runs all checks ✅
**Code merges to main**

**Later, API receives request**:

```json
POST /api/users
{ "name": "John", "email": "john@example.com" }
```

**Layer 4**: Runtime validation via schema

```typescript
const request = CreateUserSchema.parse(body); // ✅ Valid
const user = await createUser(request);
```

**Layer 6**: Domain logic receives fully typed User ✅
**Layer 7**: createUser returns explicitly User type ✅

---

## Success Criteria by Layer

### Layer 1: TypeScript Strict Mode

✅ `bun run typecheck` runs without errors  
✅ All implicit `any` caught  
✅ No module compiles without types  
✅ Index access safety enforced

### Layer 2: Biome Linting

✅ `bun run lint` passes  
✅ No explicit `any` without comments  
✅ Comment format validated  
✅ Unused variables caught

### Layer 3: Guard Script

✅ `bun run arch:type-safety-guard` reports 0 violations  
✅ Patterns detected in <30 seconds  
✅ Exceptions properly tracked  
✅ Sunset dates enforced

### Layer 4: Runtime Validation

✅ All API inputs validated with schemas  
✅ Database results validated before use  
✅ Queue messages validated on receipt  
✅ Validation latency <100ms

### Layer 5: CI Enforcement

✅ CI workflow runs on every PR  
✅ Type errors block merge  
✅ Pipeline completes <2 minutes  
✅ Clear error reporting

### Layer 6: Domain Safety

✅ Protected packages: 0% undeclared `any`  
✅ Exceptions approved + tracked  
✅ Sunset dates enforced  
✅ Monthly audit clean

### Layer 7: Boundary Types

✅ All exports have explicit types  
✅ No implicit return types  
✅ Generics properly constrained  
✅ IDE shows full type information

### Layer 8: AI Governance

✅ AI code passes same CI gates  
✅ No special exemptions for AI  
✅ All 4 rules enforced  
✅ Code review validates compliance

---

## Quick Reference

### Command Cheat Sheet

```bash
# Check types locally
bun run typecheck

# Run full validation
bun run validate:types

# Scan for unsafe patterns
bun run arch:type-safety-guard

# Fix formatting
bun run lint:fix

# Run tests
bun run test

# Recommended pre-commit workflow
bun run typecheck && bun run validate:types && bun run test
```

### Key Files

| File                                    | Purpose            | Layer |
| --------------------------------------- | ------------------ | ----- |
| `tsconfig.base.json`                    | Root strict config | 1     |
| `biome.json`                            | Linter rules       | 2     |
| `scripts/type-safety-guard.ts`          | Guard script       | 3     |
| `packages/validation/src/schemas/`      | Validation         | 4     |
| `.github/workflows/ci-type-safety.yml`  | CI job             | 5     |
| `ALLOWED_ANY_EXCEPTIONS.json`           | Exceptions         | 6     |
| `packages/*/src/index.ts`               | Exports            | 7     |
| `.agents/skills/typescript-governance/` | AI rules           | 8     |

---

## Common Questions

**Q: Can I use `any` in private code?**  
A: No. `any` is forbidden everywhere. Use `unknown` + validation.

**Q: What if the library types are incomplete?**  
A: Request an exception with sunset date. Don't use `any` as workaround.

**Q: Do AI agents follow the same rules?**  
A: Yes, identical rules. Same CI gates. No special treatment.

**Q: How long can I keep an exception?**  
A: Max 30 days (domain packages), max 90 days (other). Then fix or extend.

**Q: What if I disagree with a type error?**  
A: The type checker is right. You caught a potential bug.

---

**For more information, see the runbooks**:

- [Fix Type Errors](./RUNBOOK_FIX_TYPE_ERRORS.md)
- [Validate External Data](./RUNBOOK_VALIDATE_EXTERNAL_DATA.md)
- [Type New Endpoint](./RUNBOOK_TYPE_NEW_API_ENDPOINT.md)

---

Last Updated: 2026-03-11
