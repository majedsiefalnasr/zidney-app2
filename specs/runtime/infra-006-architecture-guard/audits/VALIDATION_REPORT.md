# VALIDATION REPORT — STAGE_INFRA_06_ARCHITECTURE_GUARD

**Stage:** STAGE_INFRA_06_ARCHITECTURE_GUARD  
**Phase:** 01_PLATFORM_FOUNDATION  
**Generated:** 2026-03-08T06:00:00.000Z

---

## Validation Gate Results

| Check              | Command                                                              | Result  |
| ------------------ | -------------------------------------------------------------------- | ------- |
| Unit tests         | `bun run vitest run tests/unit/ai-guard/ai-guard-validation.test.ts` | ✅ PASS |
| Static tests       | `bun run vitest run tests/static/05-architecture-guard.test.ts`      | ✅ PASS |
| Lint (Biome)       | `bunx lint-staged` (via Husky gate 1)                                | ✅ PASS |
| Type check         | `bun scripts/ai-guard.ts` (via Husky gate 2)                         | ✅ PASS |
| Architecture guard | `bun scripts/ai-guard.ts`                                            | ✅ PASS |
| Infra audit        | `bun scripts/infra-audit.ts --quick` (via Husky gate 3)              | ✅ PASS |

---

## Test Results

### Unit Tests — `tests/unit/ai-guard/ai-guard-validation.test.ts`

```
Test Files  1 passed (1)
      Tests  37 passed (37)
   Duration  ~256ms
```

**37 tests across 7 describe blocks:**

| Describe Block            | Tests | Result  |
| ------------------------- | ----- | ------- |
| `detectModule`            | 5     | ✅ PASS |
| `detectFileModule`        | 4     | ✅ PASS |
| `extractImports`          | 5     | ✅ PASS |
| `validateRules`           | 4     | ✅ PASS |
| `validateCrossAppImports` | 4     | ✅ PASS |
| `validateRelativeLeaks`   | 4     | ✅ PASS |
| `validateArchitectureMap` | 4     | ✅ PASS |

### Static Tests — `tests/static/05-architecture-guard.test.ts`

```
Test Files  1 passed (1)
      Tests  7 passed (7)
   Duration  ~256ms
```

**7 assertions on ARCHITECTURE_CONTRACT.json:**

| Assertion                                                         | Result  |
| ----------------------------------------------------------------- | ------- |
| Contract file exists and parses as valid JSON                     | ✅ PASS |
| `forbidPackagesImportingApps` === true                            | ✅ PASS |
| `forbidAppsImportingOtherApps` === true                           | ✅ PASS |
| `forbidUiImportingDomain.source` === `packages/ui-system`         | ✅ PASS |
| `forbidUiImportingDomain.target` === `packages/domain-core`       | ✅ PASS |
| `forbidApiClientImportingWorker.source` === `packages/api-client` | ✅ PASS |
| `forbidApiClientImportingWorker.target` === `apps/worker`         | ✅ PASS |

---

## Architecture Governance

**Architecture Score:** 100 / 100  
**Dependency violations:** 0  
**Circular dependencies:** 0  
**Layer violations:** 0  
**Architecture map violations:** 0  
**Architecture drift:** 0

**Undeclared modules (informational, not a blocker):**

- `packages/app`
- `packages/ui`

---

## Infra Audit Output (Gate 3)

```
[INFRA AUDIT][CI] Governance checks passed.
Architecture score: 100 / 100
Dependency violations: 0
Circular dependencies: 0
Layer violations: 0
```

---

## Commit Evidence

**Commit SHA:** e5c4b76  
**Branch:** spec/infra-006-architecture-guard  
**Files changed:** 9  
**Insertions:** 385  
**All Husky gates:** PASS
