# Plan: STAGE_INFRA_06_ARCHITECTURE_GUARD

Zidney Strict Plan (Implementation Enforcement)  
Validated against Zidney Constitution v1.2.0  
Generated: 2026-03-08

---

## Stage Alignment

- **Phase:** 01_PLATFORM_FOUNDATION
- **Stage:** STAGE_INFRA_06_ARCHITECTURE_GUARD
- **Related Spec File:** `specs/runtime/infra-006-architecture-guard/spec.md`
- **Related ADR:** None required — implementing enforcement of existing ADRs, not creating new ones

Plan must not introduce architecture outside defined Stage scope.

---

## Architectural Scope Confirmation

- ✅ No cross-tenant data access — governance tooling only
- ✅ No middleware bypass — no API routes
- ✅ No direct DB instantiation — no database access at all
- ✅ No grading logic outside Worker — not applicable
- ✅ No weakening of snapshot integrity — not applicable
- ✅ No weakening of version enforcement — not applicable
- ✅ No layer boundary violation — only `scripts/`, `tests/`, `package.json` affected

---

## Implementation Layers

### API Layer

Not applicable. This stage introduces no API routes, handlers, or middleware.

### Worker Layer

Not applicable. This stage introduces no background jobs or queue interactions.

### Frontend Layer

Not applicable. This stage modifies no UI application code.

### MMC / Backoffice Scope

Not applicable. This stage modifies no commercial authority layer.

### Developer Tooling Layer (Governance)

This stage operates exclusively in the developer tooling layer:

| Component             | Change                   | File                                              |
| --------------------- | ------------------------ | ------------------------------------------------- |
| `package.json`        | Add `arch:guard` script  | `package.json`                                    |
| `scripts/ai-guard.ts` | Add `export` to pure fns | `scripts/ai-guard.ts` (additive only)             |
| Unit tests            | New test file            | `tests/unit/ai-guard/ai-guard-validation.test.ts` |
| Unit test fixtures    | 5 new fixture files      | `tests/unit/ai-guard/fixtures/`                   |
| Static contract test  | New test file            | `tests/static/05-architecture-guard.test.ts`      |

---

## Database Impact

**None.** This stage introduces no database access or schema changes.

- Master DB: Not touched
- Tenant DB: Not touched
- Migration: Not required
- Version bump: Not required

---

## Transaction Design

**Not applicable.** This stage introduces no database writes or transactional operations.

---

## Idempotency Plan

**Not applicable.** This stage introduces no mutable endpoints.

---

## Version Enforcement Strategy

**Not applicable.** This stage introduces no workspace-bound routes that validate `schema_version` or `product_version`.

---

## Authoritative Time Handling

**Not applicable.** This stage introduces no time-dependent operations.

---

## Observability & Logging

Developer tooling produces structured console output only:

| Condition                 | Output                                        |
| ------------------------- | --------------------------------------------- |
| No changed files detected | `AI Guard: no changed files detected.`        |
| Clean validation          | `AI Guard: architecture validation passed.`   |
| Brain file used           | `AI Guard: using ai-architecture-brain.json…` |
| Violations detected       | Structured violation list to stderr           |

`console.log` usage in `ai-guard.ts` is acceptable for CLI tooling context and has been reviewed as such.

---

## Rate Limiting

Not applicable. This stage introduces no endpoints.

---

## Failure Modes

| Failure Mode                           | Impact                       | Recovery                                    |
| -------------------------------------- | ---------------------------- | ------------------------------------------- |
| `ai-guard.ts` fails to compile         | Pre-commit hook breaks       | Fix TypeScript error; restore clean compile |
| `ARCHITECTURE_CONTRACT.json` not found | Guard crashes at startup     | Run `bun run arch:audit` to regenerate      |
| `ai-architecture-brain.json` not found | Guard falls back to contract | Non-issue — graceful fallback exists        |
| Architecture score < 85                | infra-audit --quick rejects  | Fix violations to restore score ≥ 85        |
| Unit test assertion failure            | CI blocks merge              | Fix the violation in implementation         |
| Static test file not found             | Test suite fails             | Restore file from source control            |

---

## Security Review

- ✅ RBAC enforcement: not applicable (no API routes)
- ✅ No secrets exposed: tooling reads only local JSON files
- ✅ No sensitive data in logs: violation messages contain only file paths and rule names
- ✅ No injection risk: all file paths are from `git diff --cached` or `git ls-files` (trusted source)

---

## Implementation Plan

### Phase 1: Expose Pure Functions from `ai-guard.ts`

**File:** `scripts/ai-guard.ts`

Add `export` keyword to the following functions (no logic changes — purely additive):

| Function                  | Signature                                                          | Rationale                                              |
| ------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------ |
| `detectModule`            | `export function detectModule(importPath: string): string \| null` | Pure — testable path resolver                          |
| `detectFileModule`        | `export function detectFileModule(file: string): string \| null`   | Pure — testable file classifier                        |
| `extractImports`          | `export function extractImports(filePath: string): string[]`       | Pure — testable import extractor (reads fixture files) |
| `validateRules`           | `export function validateRules(...)`                               | Pure — testable rule checker                           |
| `validateCrossAppImports` | `export function validateCrossAppImports(...)`                     | Pure — testable cross-app checker                      |
| `validateRelativeLeaks`   | `export function validateRelativeLeaks(...)`                       | Pure — testable relative leak checker                  |
| `validateArchitectureMap` | `export function validateArchitectureMap(...)`                     | Pure — testable map validator                          |

`validateBranchNaming` and `runGuard` use `process.exit` and `git` — tested via static/integration testing only.

**Why this is not a logic change:** `export` keywords expose the function outside the module but do not alter execution, parameters, return values, or side effects of any function.

### Phase 2: Add `arch:guard` Script

**File:** `package.json`

Add after `"arch:fix": "bun scripts/infra-audit.ts --fix-map"`:

```json
"arch:guard": "bun scripts/ai-guard.ts",
```

### Phase 3: Create Test Fixture Files

**Directory:** `tests/unit/ai-guard/fixtures/`

Create 5 fixture TypeScript source files with known import patterns:

| File                                | Import Content                                   | Purpose                      |
| ----------------------------------- | ------------------------------------------------ | ---------------------------- |
| `valid-package-imports.ts`          | Imports within packages only                     | "should pass" baseline       |
| `cross-app-violation.ts`            | `apps/api` importing from `apps/mmc`             | Cross-app violation fixture  |
| `packages-import-apps-violation.ts` | `packages/domain-core` importing from `apps/api` | Packages→apps violation      |
| `relative-leak-violation.ts`        | Relative import containing `apps/` path segment  | Relative leak violation      |
| `clean-api-file.ts`                 | Import from `packages/logger` only               | Clean single-import baseline |

All fixture files must be syntactically valid TypeScript (even if semantically nonsensical).

### Phase 4: Create Unit Tests

**File:** `tests/unit/ai-guard/ai-guard-validation.test.ts`

Test structure — one `describe` block per function:

#### `detectModule`

- `@zidney/logger` → `logger`
- `packages/domain-core/src/index.ts` → `domain-core`
- `apps/api/src/routes/tenant.ts` → `api`
- `node:child_process` → `null` (not a module path)

#### `detectFileModule`

- `apps/api/src/routes/tenant.ts` → `api`
- `packages/domain-core/src/index.ts` → `domain-core`
- `apps/mmc/src/components/Foo.vue` → `mmc`
- `scripts/infra-audit.ts` → `null`

#### `extractImports`

- Reads `fixtures/clean-api-file.ts` → returns array with `packages/logger`
- Reads `fixtures/cross-app-violation.ts` → returns import from `apps/mmc`
- Non-existent file → returns `[]` silently

#### `validateRules` (dependency violation)

- `fileModule = 'domain-core'`, imports `['apps/api']`, rules `{ 'domain-core': ['api'] }` → violation
- `fileModule = 'domain-core'`, imports `['packages/types']`, same rules → no violation
- `fileModule = 'api'`, imports anything, no rules for `api` → no violation

#### `validateCrossAppImports`

- `filePath = 'apps/api/...'`, `fileModule = 'api'`, imports `['apps/mmc']` → cross-app violation
- `filePath = 'apps/api/...'`, `fileModule = 'api'`, imports `['packages/logger']` → no violation
- `filePath = 'packages/domain-core/...'` → no violation (not an app file)

#### `validateRelativeLeaks`

- imports `['../../apps/api/something']` → relative leak violation
- imports `['../../packages/ui-system/util']` → relative leak violation
- imports `['../utils/helper']` → no violation (does not contain `apps/` or `packages/`)
- imports `['./local']` → no violation

#### `validateArchitectureMap`

- Module in arch map with `forbidden_dependencies` containing the imported module → violation
- Module in arch map with `allowed_dependencies` and import in allowed list → no violation
- Module not in arch map → no violation (graceful skip)

### Phase 5: Create Static Architecture Test

**File:** `tests/static/05-architecture-guard.test.ts`

Tests:

1. **Contract file exists and is valid JSON**
2. **`rules.dependencyRules.forbidPackagesImportingApps` is `true`**
3. **`rules.dependencyRules.forbidAppsImportingOtherApps` is `true`**
4. **`rules.layerRules.forbidUiImportingDomain.source` equals `packages/ui-system`**
5. **`rules.layerRules.forbidApiClientImportingWorker.source` equals `packages/api-client`**
6. **`ai-guard.ts` exits code 0 when no TypeScript files are staged** (this is verified via the `getChangedFiles()` → fallback → 0 path — tested in unit test for `validateCrossAppImports` on a clean project dir)
7. **`infra-audit.ts --quick` exits with code 0** (architecture score ≥ 85 — validates that changes in this stage haven't degraded governance)

---

## File Change Summary

| File                                                             | Action                           | Type                       |
| ---------------------------------------------------------------- | -------------------------------- | -------------------------- |
| `package.json`                                                   | Add `arch:guard` script          | Additive                   |
| `scripts/ai-guard.ts`                                            | Add `export` to 7 pure functions | Additive (no logic change) |
| `tests/unit/ai-guard/ai-guard-validation.test.ts`                | Create — unit tests              | New                        |
| `tests/unit/ai-guard/fixtures/valid-package-imports.ts`          | Create — fixture                 | New                        |
| `tests/unit/ai-guard/fixtures/cross-app-violation.ts`            | Create — fixture                 | New                        |
| `tests/unit/ai-guard/fixtures/packages-import-apps-violation.ts` | Create — fixture                 | New                        |
| `tests/unit/ai-guard/fixtures/relative-leak-violation.ts`        | Create — fixture                 | New                        |
| `tests/unit/ai-guard/fixtures/clean-api-file.ts`                 | Create — fixture                 | New                        |
| `tests/static/05-architecture-guard.test.ts`                     | Create — static test             | New                        |

**Total files affected:** 9

---

## Test Strategy

### Unit Tests

- **File:** `tests/unit/ai-guard/ai-guard-validation.test.ts`
- **Runner:** Vitest
- **Approach:** Import exported functions from `scripts/ai-guard.ts`, call with known inputs, assert known outputs
- **Fixtures:** `tests/unit/ai-guard/fixtures/*.ts` — deterministic, no git dependency

### Static Tests

- **File:** `tests/static/05-architecture-guard.test.ts`
- **Runner:** Vitest
- **Approach:** Read `ARCHITECTURE_CONTRACT.json` from disk, assert required fields exist and have correct values
- **Isolation:** Reads committed files only — no git state needed

### Integration Tests

Not required for this stage. The existing pre-commit hook provides end-to-end integration testing. The architecture audit script (`bun run arch:audit`) serves as the integration smoke test.

---

## Constraints Verified Against Plan

| Constraint                           | Status                                        |
| ------------------------------------ | --------------------------------------------- |
| No cross-tenant access               | ✅ No DB, no API                              |
| License middleware declared          | ✅ Not applicable                             |
| No direct DB instantiation           | ✅ Confirmed                                  |
| Constitutional compliance maintained | ✅ Governance tooling only                    |
| No new ADR required                  | ✅ Enforcing existing ADRs                    |
| Architecture score preserved         | ✅ No cross-layer changes                     |
| Import boundary rules respected      | ✅ Tests import from scripts/, not from apps/ |
