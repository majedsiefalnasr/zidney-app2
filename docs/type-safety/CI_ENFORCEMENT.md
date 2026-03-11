# Type Safety CI Enforcement

**Document**: Continuous Integration pipeline for TypeScript type safety governance  
**Stage**: STAGE_INFRA_12_TYPESCRIPT_TYPE_SAFETY_GOVERNANCE  
**Layer**: Layer 5 (CI Enforcement)  
**Status**: MVP Implementation Phase  
**Last Updated**: 2026-03-13

---

## Overview

The Type Safety CI Enforcement pipeline ensures all code (human and AI-generated) passes strict TypeScript type checking before merge. This document defines the gate behavior, error handling, and developer workflow.

## Pipeline Architecture

The type safety enforcement pipeline runs as a standalone GitHub Actions workflow: `.github/workflows/ci-type-safety.yml`

### Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  Type Safety CI Pipeline                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
        ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
        │  TypeScript  │  │ Type Safety  │  │ Biome Lint   │
        │ Strict Mode  │  │ Guard Script │  │  & Format    │
        │   (Layer 1)  │  │  (Layer 3)   │  │  (Layer 2)   │
        └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
               │                 │                 │
               └─────────────────┼─────────────────┘
                                 ▼
                    ┌──────────────────────────┐
                    │ Type Safety Complete     │
                    │ (All checks passed = ✓)  │
                    └──────────────────────────┘
```

## Step 1: TypeScript Strict Mode Check (Layer 1)

### Purpose

Validate that all TypeScript source code and tests compile without errors under strict mode.

### Configuration

- **tsconfig.json**: Root configuration with path mappings
- **tsconfig.base.json**: Shared strict mode settings for all packages
- **Strict Mode Flags** (enabled):
  - `strict: true` — Enable all strict type checking options
  - `noImplicitAny: true` — Reject implicit `any` types
  - `noUncheckedIndexedAccess: true` — Enforce bounds checking on array/object access
  - `noUnusedLocals: true` — Error on unused local variables
  - `noUnusedParameters: true` — Error on unused function parameters
  - `noImplicitReturns: true` — Error on functions with unreachable code paths
  - `noFallthroughCasesInSwitch: true` — Prevent switch fallthrough
  - `forceConsistentCasingInFileNames: true` — Enforce consistent file naming
  - `skipLibCheck: true` — Skip type checking of declaration files

### Commands

```bash
# Check source code only
bun run typecheck:src

# Check test files
bun run typecheck:tests

# Check all (source + tests)
bun run typecheck
```

### Failure Behavior

- **Exit Code**: Non-zero (build fails)
- **Output**: File:line:column error messages with type details
- **PR Impact**: ❌ Merge blocked until errors fixed
- **Example Error**:
  ```
  apps/api/src/routes/example.ts:42:5 - error TS2352:
  Conversion of type 'MyType' to type 'Record<string, unknown>'
  may be a mistake because neither type sufficiently overlaps
  with the other.
  ```

### Common Errors & Fixes

| Error                                                      | Cause                         | Fix                                             |
| ---------------------------------------------------------- | ----------------------------- | ----------------------------------------------- |
| `error TS7006: Parameter 'x' implicitly has an 'any' type` | Missing type annotation       | Add explicit type: `(x: string) => ...`         |
| `error TS2352: Conversion... may be a mistake`             | Invalid type cast             | Use intermediate `unknown`: `x as unknown as T` |
| `error TS2339: Property 'x' does not exist on type 'y'`    | Missing property              | Check types, use optional chaining: `y?.x`      |
| `error TS2538: Type 'x' cannot be used as an index type`   | Index access on non-indexable | Add type guard or use `Record<string, T>`       |

## Step 2: Type Safety Guard Script (Layer 3)

### Purpose

Detect and flag dangerous type patterns (`:any`, `as any`, `@ts-ignore`) that bypass type safety.

### Status

**Phase 1 (Post-MVP)**: Guard script implementation deferred to Phase 1. Currently, this step runs a placeholder that reports "Check deferred to Phase 1".

### Future Behavior (When Implemented)

- **Pattern Detection**:
  - `:any` — Detect explicit any type annotations
  - `as any` — Detect type assertions to any
  - `<any>` — Detect generic any
  - `@ts-ignore` — Detect TypeScript pragma comments without justification

- **Exception Management**:
  - Registry: `ALLOWED_ANY_EXCEPTIONS.json` per package
  - Expiration: Exceptions have sunset dates
  - Approval Flow: Exceptions require code review approval

- **Output Modes**:
  - JSON: Machine-readable format for CI parsing
  - Markdown: Human-readable markdown for PR comments

### Failure Behavior (When Implemented)

- **Exit Code**: Non-zero if violations found without exceptions
- **PR Impact**: ❌ Merge blocked if unapproved `any` patterns detected
- **Allow-list**: Per-package exception registry can suppress known violations

## Step 3: Biome Lint & Format Check (Layer 2)

### Purpose

Enforce code style, formatting, and linting rules using Biome.

### Configuration

- **biome.json**: Root linting configuration
- **Rules**:
  - Format compliance: Trailing commas, arrow parens, etc.
  - Lint: Dead code, unsafe patterns, etc.
  - Future: Explicit rules for `any` without comments

### Commands

```bash
# Check format and lint
bun run lint

# Fix issues automatically
bun run lint:fix
```

### Failure Behavior

- **Exit Code**: Non-zero on violations
- **Output**: File:line violations with suggested fixes
- **PR Impact**: ❌ Merge blocked if format/lint violations
- **Fix**: `bun run lint:fix` for automatic fixes

## Pipeline Summary & Gates

### All Checks Pass (Green ✓)

- ✅ TypeScript compiles with zero errors (strict mode)
- ✅ Type safety guard finds no unapproved patterns (Phase 1+)
- ✅ Biome lint + format checks pass
- **Result**: ✏️ PR can be merged (assuming other CI checks also pass)

### Any Check Fails (Red ✗)

- ❌ TypeScript error detected
- ❌ Unapproved `any` pattern detected
- ❌ Lint or format violation
- **Result**: 🚫 PR merge is blocked (red X on PR status)

### Developer Workflow

1. **Push branch** → Type Safety pipeline runs automatically
2. **Pipeline fails** → CI shows red X on PR
3. **Fix issues**:
   - TypeScript errors: Update type annotations
   - Guard violations: Remove unapproved `any` or request exception
   - Lint errors: Run `bun run lint:fix`
4. **Push fixes** → Pipeline re-runs
5. **Pipeline passes** → Green ✓, PR ready to merge (if other checks pass)

## Performance Targets

| Check              | Target       | Status                               |
| ------------------ | ------------ | ------------------------------------ |
| TypeScript Check   | < 60 seconds | ✅ Achievable (incremental checking) |
| Type Safety Guard  | < 30 seconds | Phase 1 target                       |
| Biome Lint         | < 60 seconds | ✅ Achievable                        |
| **Total Pipeline** | < 2 minutes  | ✅ MVP target                        |

### Caching Strategy

- **Dependencies**: Cache `node_modules` and `bun.lock`
- **TypeScript**: Incremental `tsbuildinfo` cache
- **Goal**: Subsequent runs < 30 seconds

## Integration with Main CI

The type safety pipeline (`.github/workflows/ci-type-safety.yml`) runs **in parallel** with:

- Lint checks (`.github/workflows/ci.yml` → `lint` job)
- Unit tests (`.github/workflows/ci.yml` → `unit-tests` job)
- Architecture validation (`.github/workflows/ci.yml` → `arch-guard` job)

### Merge Requirements

A PR can only be merged when **all** of these pass:

1. ✅ Type Safety pipeline (t his document)
2. ✅ Lint pipeline
3. ✅ Unit tests
4. ✅ Architecture guard
5. ✅ Code review approval

## Troubleshooting

### Problem: "TypeScript error on line X"

- **Cause**: Type mismatch or missing type annotation
- **Fix**: Add explicit types, use type guards, or cast through `unknown`

### Problem: "Parameter implicitly has 'any' type"

- **Cause**: `noImplicitAny` flag detects missing type
- **Fix**: Add type annotation: `(param: Type) => ...`

### Problem: "Type conversion may be a mistake"

- **Cause**: Direct cast between incompatible types
- **Fix**: Cast through `unknown`: `x as unknown as TargetType`

### Problem: "cannot be used as an index type"

- **Cause**: `noUncheckedIndexedAccess` prevents unsafe array/object access
- **Fix**: Use type guard or `Record<string, T>` type

### Problem: Guard Check Hangs

- **Cause**: Phase 1 implementation pending (currently placeholder)
- **Fix**: Check `.github/workflows/ci-type-safety.yml` for phase status

## Exceptions & Appeals

### Requesting an Exception (Phase 1+)

1. **Identify** the unapproved `any` pattern
2. **Document** why it's necessary (library compatibility, complex type, etc.)
3. **Create** ALLOWED_ANY_EXCEPTIONS.json entry:
   ```json
   {
     "version": "1.0",
     "exceptions": [
       {
         "file": "packages/api-client/src/adapters/fetch-adapter.ts",
         "line": 42,
         "pattern": "as any",
         "reason": "Fetch RequestInit has complex optional structure",
         "approved_by": "tech-lead@example.com",
         "sunset_date": "2026-06-01",
         "ticket": "INFRA-012"
       }
     ]
   }
   ```
4. **Submit** PR with exception + explanation
5. **Code review** approves or rejects

### Exception Sunset

- **Expiration**: Guard script flags expired exceptions
- **Action**: Fix exception or request renewal in code review

## Future Phases

| Phase             | Layer | Tasks              | Target                      |
| ----------------- | ----- | ------------------ | --------------------------- |
| **Phase 0 (MVP)** | 1, 5  | TypeScript + CI ✅ | 40 hours                    |
| Phase 1           | 3     | Guard Script       | Type-safe patterns          |
| Phase 2           | 6     | Domain Safety      | Zero `any` in core packages |
| Phase 3           | 4     | Runtime Validation | External data validation    |
| Phase 4           | 2     | Biome Rules        | Enhanced linting            |
| Phase 5           | 7     | Boundary Typing    | Public API types            |
| Phase 6           | 8     | AI Governance      | AI compliance rules         |
| Phase 7           | -     | Documentation      | Runbooks & handbook         |

---

## References

- [TypeScript Handbook — Strict Mode](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [Biome Configuration](https://biomejs.dev/configuration/)
- [GitHub Actions Workflows](https://docs.github.com/en/actions/learn-github-actions)
- [STAGE_INFRA_12_TYPESCRIPT_TYPE_SAFETY_GOVERNANCE](../phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_12_TYPESCRIPT_TYPE_SAFETY_GOVERNANCE.md)
