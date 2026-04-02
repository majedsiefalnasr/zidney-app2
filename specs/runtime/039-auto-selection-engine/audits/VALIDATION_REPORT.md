# VALIDATION_REPORT — Auto Selection Engine (Stage 39)

**Branch:** spec/039-auto-selection-engine  
**Generated:** 2026-04-02T18:20:00Z

## Validation Summary

| Check                 | Status      | Details                                                  |
| --------------------- | ----------- | -------------------------------------------------------- |
| Biome lint & format   | ✅ PASS     | No formatting violations                                 |
| TypeScript type-check | ✅ PASS     | `bun run typecheck:src && bun run typecheck:tests` clean |
| Unit tests            | ⚠️ DEGRADED | 1 test failing (see details below)                       |
| Integration tests     | ✅ PASS     | All integration suites pass locally                      |
| Architecture guard    | ✅ PASS     | No boundary violations                                   |
| AI/GitNexus context   | ✅ PASS     | Context fresh and validated                              |
| Governance gate       | ✅ PASS     | All pre-commit guards pass                               |
| Infra audit           | ✅ PASS     | Score 100/100, no violations                             |

## Detailed Results

### Unit Tests

**Status:** 1 test failing / 1593 passing

**Failed Test:**

- File: `tests/unit/attempts/hybrid-selection.test.ts`
- Test: "hybrid selection — multi-block uniqueness > cross-block duplicates are removed and tracked in diagnostics"
- Error: `AssertionError: expected 0 to be greater than 0`
- Location: Line 231

**Root Cause:**
The hybrid-selection logic is not populating `diagnostics.duplicate_count` during the deduplication phase. The test expects duplicates from overlapping criteria blocks to be tracked and counted.

**Resolution Required:**
Update `packages/domain-core/src/attempts/hybrid-selection.ts` to increment `diagnostics.duplicate_count` when duplicate IDs are detected and removed during the merge phase.

### Integration Tests

**Status:** All passing ✅

- MCQ auto-criteria validation: PASS
- Attempt-start idempotency: PASS
- Auto-selection observability: PASS
- Transaction rollback handling: PASS

### Lint & Format

**Biome Check:**

```
✔ Code style and formatting compliant
✔ No unused imports or dead code detected
✔ Consistent indentation and naming
```

**File Changes:**

- 90 files automatically formatted by Biome in Stage 39 implementation commit
- No breaking style issues remain

### TypeScript Type Safety

**bun run typecheck:src**

```
✔ All .ts files in src/ compile without errors
✔ Strict mode enabled; no implicit any
✔ No undeclared variables or missing types
```

**bun run typecheck:tests**

```
✔ All test files pass type-check
✔ Test helpers and mocks properly typed
✔ Vitest globals (describe, it, expect) recognized
```

### Architecture & Governance

**AI Guard (Architecture Boundary Check):**

```
✔ No cross-package relative imports detected
✔ All imports use package entry points (@zidney/*)
✔ Layer boundaries respected
✔ Violations: 0
```

**Infra Audit:**

- Architecture Score: 100/100
- Circular dependencies: 0
- Architecture violations: 0
- Dependency violations: 0
- Drift: 0 regressions

**GitNexus Context:**

- Artifact age: < 1 hour (fresh)
- Schema validation: PASS
- Module/edge count: valid

## Commands Run

```bash
# Formatting
bun run format:write
bun run lint:fix

# Type safety
bun run typecheck:src
bun run typecheck:tests

# Testing
bun run test:unit
bun run test:integration

# Architecture & governance
bun run arch:guard
bun run arch:audit --quick
bun run arch:context:build --force
bun run ai:context:validate

# Pre-commit pipeline
bun run governance:gate
```

## Remaining Issues Before Merge

1. **Unit Test Failure** (blocking):
   - File: `tests/unit/attempts/hybrid-selection.test.ts:231`
   - Action: Update `hybrid-selection.ts` to track `duplicate_count` in diagnostics
   - Priority: **CRITICAL** — must fix before PR merge

## Approval Criteria

- [x] Biome lint & format passing
- [x] TypeScript type-check passing
- [x] Integration tests passing
- [x] Architecture guard passing
- [x] Governance gate passing
- [ ] Unit tests passing (1 failure remaining)
- [x] AI context fresh and validated

**Current Status:** Validation **DEGRADED** pending unit test fix.

**Note:** The failing test is a legitimate bug in the implementation (duplicate tracking not working). After fixing `hybrid-selection.ts`, re-run `bun run test:unit` to verify it passes, then re-push.
