# Tasks: STAGE_INFRA_06_ARCHITECTURE_GUARD

Zidney Strict Tasks — Execution Discipline  
Validated against Zidney Constitution v1.2.0  
Generated: 2026-03-08

---

## Stage Context

- **Phase:** 01_PLATFORM_FOUNDATION
- **Stage:** STAGE_INFRA_06_ARCHITECTURE_GUARD
- **Related Plan:** `specs/runtime/infra-006-architecture-guard/plan.md`
- **Related Spec:** `specs/runtime/infra-006-architecture-guard/spec.md`
- **Related ADR:** None required

---

## Pre-Task Constraints Verified

- ✅ Plan validated against Zidney Constitution v1.2.0
- ✅ No architectural violations — governance tooling only
- ✅ Stage scope respected — no API, DB, Worker, or UI changes
- ✅ Implementation gate open (`drift_passed` pending — tasks generated for Analyze gate)

---

## Infrastructure Tasks

- [x] T001 Add `export` keyword to 7 pure functions in `scripts/ai-guard.ts` — additive only, no
      logic change
  - Layer: Developer Tooling (governance scripts)
  - Transaction: Not required
  - Idempotency: Not required
  - Version enforcement: Not required
  - License middleware: Not required
  - Functions to export: `detectModule`, `detectFileModule`, `extractImports`, `validateRules`,
    `validateCrossAppImports`, `validateRelativeLeaks`, `validateArchitectureMap`
  - Functions NOT to export: `validateBranchNaming` (calls `process.exit`), `runGuard` (entry point)

- [x] T002 Add `"arch:guard": "bun scripts/ai-guard.ts"` script to root `package.json`
  - Layer: Developer Tooling (build scripts)
  - Add after the existing `"arch:fix"` script entry
  - Transaction: Not required
  - Idempotency: Not required
  - Version enforcement: Not required
  - License middleware: Not required

---

## Testing Tasks — Fixture Files

- [x] T003 [P] Create fixture file `tests/unit/ai-guard/fixtures/valid-package-imports.ts` — imports
      within packages only (baseline "should pass" fixture)
  - Layer: Test Infrastructure
  - Content: two or three import statements importing from `packages/` paths only
  - Must be syntactically valid TypeScript
  - Transaction: Not required

- [x] T004 [P] Create fixture file `tests/unit/ai-guard/fixtures/cross-app-violation.ts` — apps/api
      importing from apps/mmc (cross-app violation fixture)
  - Layer: Test Infrastructure
  - Content: one import from `apps/mmc/src/something`
  - Must be syntactically valid TypeScript
  - Transaction: Not required

- [x] T005 [P] Create fixture file `tests/unit/ai-guard/fixtures/packages-import-apps-violation.ts`
      — packages/domain-core importing from apps/api (packages→apps violation fixture)
  - Layer: Test Infrastructure
  - Content: one import from `apps/api/src/something`
  - Must be syntactically valid TypeScript
  - Transaction: Not required

- [x] T006 [P] Create fixture file `tests/unit/ai-guard/fixtures/relative-leak-violation.ts` —
      relative import containing apps/ path segment (relative leak violation fixture)
  - Layer: Test Infrastructure
  - Content: one relative import such as `../../apps/api/something`
  - Must be syntactically valid TypeScript
  - Transaction: Not required

- [x] T007 [P] Create fixture file `tests/unit/ai-guard/fixtures/clean-api-file.ts` — single import
      from packages/logger only (clean single-import baseline fixture)
  - Layer: Test Infrastructure
  - Content: one import from `@zidney/logger` or `packages/logger`
  - Must be syntactically valid TypeScript
  - Transaction: Not required

---

## Testing Tasks — Unit Tests

- [x] T008 Create unit test suite `tests/unit/ai-guard/ai-guard-validation.test.ts` with 7 describe
      blocks (one per exported function)
  - Layer: Test Infrastructure
  - Depends on: T001 (exports required for import), T003–T007 (fixtures required for extractImports)
  - Transaction: Not required
  - Test cases:
    - `detectModule`: 4 assertions (module alias → name, package path → name, app path → name,
      node:builtin → null)
    - `detectFileModule`: 4 assertions (app file → app name, package file → package name, mmc file →
      mmc, scripts/ → null)
    - `extractImports`: 3 assertions (reads clean-api-file, reads cross-app-violation, non-existent
      → [])
    - `validateRules`: 3 assertions (violation match, no violation, module not in rules → [])
    - `validateCrossAppImports`: 3 assertions (cross-app import → violation, packages import → [],
      app imports packages → [])
    - `validateRelativeLeaks`: 4 assertions (../../apps/ → violation, ../../packages/ → violation,
      ../utils/ → [], ./local → [])
    - `validateArchitectureMap`: 3 assertions (forbidden dep → violation, allowed dep → [], module
      not in map → [])

---

## Testing Tasks — Static Tests

- [x] T009 Create static contract test `tests/static/05-architecture-guard.test.ts` — 7 assertions
      against ARCHITECTURE_CONTRACT.json and governance tooling
  - Layer: Test Infrastructure
  - Transaction: Not required
  - Test cases:
    - Contract file `docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json` exists and parses as
      valid JSON
    - `rules.dependencyRules.forbidPackagesImportingApps` equals `true`
    - `rules.dependencyRules.forbidAppsImportingOtherApps` equals `true`
    - `rules.layerRules.forbidUiImportingDomain.source` equals `packages/ui-system`
    - `rules.layerRules.forbidUiImportingDomain.target` equals `packages/domain-core`
    - `rules.layerRules.forbidApiClientImportingWorker.source` equals `packages/api-client`
    - `rules.layerRules.forbidApiClientImportingWorker.target` equals `apps/worker`

---

## Task Dependency Graph

```
T001 ─────────────────────────────┐
T002                               │
T003 [P] ─────────────────────────┤
T004 [P] ─────────────────────────┤──▶ T008
T005 [P] ─────────────────────────┤
T006 [P] ─────────────────────────┤
T007 [P] ─────────────────────────┘
T009 (independent — reads only ARCHITECTURE_CONTRACT.json)
```

**Recommended execution order:**

1. T001 (export functions — unblocks T008)
2. T002 (package.json script — independent)
3. T003–T007 in parallel (fixtures — unblock T008)
4. T008 (unit tests — depends on T001 + T003–T007)
5. T009 (static tests — independent)

---

## File Change Summary

| Task | File                                                             | Action |
| ---- | ---------------------------------------------------------------- | ------ |
| T001 | `scripts/ai-guard.ts`                                            | Modify |
| T002 | `package.json`                                                   | Modify |
| T003 | `tests/unit/ai-guard/fixtures/valid-package-imports.ts`          | Create |
| T004 | `tests/unit/ai-guard/fixtures/cross-app-violation.ts`            | Create |
| T005 | `tests/unit/ai-guard/fixtures/packages-import-apps-violation.ts` | Create |
| T006 | `tests/unit/ai-guard/fixtures/relative-leak-violation.ts`        | Create |
| T007 | `tests/unit/ai-guard/fixtures/clean-api-file.ts`                 | Create |
| T008 | `tests/unit/ai-guard/ai-guard-validation.test.ts`                | Create |
| T009 | `tests/static/05-architecture-guard.test.ts`                     | Create |

**Total tasks:** 9  
**Total files affected:** 9 (2 modified, 7 new)

---

## Hard Constraint Verification

| Constraint                              | Verified |
| --------------------------------------- | -------- |
| All tasks reference specific file paths | ✅       |
| All tasks state layer                   | ✅       |
| Transaction requirements stated         | ✅ (N/A) |
| Idempotency requirements stated         | ✅ (N/A) |
| Version enforcement requirements stated | ✅ (N/A) |
| License middleware requirements stated  | ✅ (N/A) |
| No vague tasks                          | ✅       |
| Tasks do not extend beyond stage scope  | ✅       |
| Zidney Constitution v1.2.0 compliant    | ✅       |
