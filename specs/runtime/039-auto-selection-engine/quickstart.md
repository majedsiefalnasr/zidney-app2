# Stage 39 — Auto-Selection Engine: Operator Quickstart

This guide explains how to run, verify, and validate the Stage 39 implementation locally.

---

## Prerequisites

- Bun ≥ 1.1
- PostgreSQL (for integration tests that touch the DB), or use the mocked patterns
- All dependencies installed: `bun install` from repo root

---

## Running Stage 39 Tests

### Run all Stage 39 unit tests (domain-core)

```bash
bun run test --filter packages/domain-core
```

### Run all Stage 39 API tests

```bash
cd apps/api
bun run test --run
```

### Run specific test suites

```bash
# Auto-selection unit tests
bun vitest run packages/domain-core/tests/unit/attempts/

# Contract tests (no DB required)
bun vitest run apps/api/tests/contract/

# Integration tests (domain logic, no real DB)
bun vitest run apps/api/tests/integration/

# Load tests (500-concurrent)
bun vitest run apps/api/tests/load/

# Performance benchmark gates
bun vitest run apps/api/tests/performance/
```

---

## Key Modules Introduced in Stage 39

| Module | Path |
|--------|------|
| Auto-selection service | `packages/domain-core/src/attempts/auto-selection.service.ts` |
| Selection persistence  | `packages/domain-core/src/attempts/selection-persistence.ts` |
| MCQ auto-criteria validation | `packages/domain-core/src/mcq-exams/mcq-auto-criteria-validation.service.ts` |
| MCQ exams types | `packages/domain-core/src/mcq-exams/mcq-exams.types.ts` |
| Create-attempt route | `apps/api/src/routes/workspace/attempts/create-attempt.ts` |
| MCQ criteria route | `apps/api/src/routes/workspace/mcq-exams/mcq-auto-criteria.ts` |

---

## Verifying Hybrid Selection Behavior

Manual IDs take priority — auto-selection fills the remainder:

```typescript
import { runAutoSelection } from '@zidney/domain-core/attempts/auto-selection.service'

const result = await runAutoSelection({
  workspaceId: 'ws-uuid',
  examId: 'exam-uuid',
  totalQuestions: 10,
  criteriaBlocks: [{ id: 'blk1', percentage: 100, fixed_count: null, filters: {} }],
  manualQuestionIds: ['manual-q-1', 'manual-q-2'],
  selectionSeed: 'my-seed',
  fetchEligiblePool: async (ws, ex, filters, excludeIds) => {
    // Provide your pool here — excludeIds will contain the manual IDs
    return yourPoolFetchImplementation(ws, ex, filters, excludeIds)
  },
})

console.log(result.selectedIds)          // Last 8 auto-selected
console.log(result.diagnostics)          // Pool sizes, counts, duplicate check
console.log(result.candidatePoolFingerprint) // Deterministic hash
```

---

## Environment Variables

No environment variables are required for unit/contract/integration tests — all use mocked `fetchEligiblePool` implementations.

For integration tests that touch real DB, ensure `TEST_DATABASE_URL` is set (see `apps/api/.env.test`).

---

## Typecheck

```bash
bun run typecheck
```

---

## Common Issues

| Issue | Fix |
|-------|-----|
| `Failed to load url @zidney/domain-core/...` | Run `bun install` from repo root to ensure workspace symlinks are created |
| Pool size < totalQuestions throws INSUFFICIENT_POOL | Provide a pool with at least `totalQuestions` unique IDs in your test mock |
| Fingerprint changes between runs | Check that `selectionSeed` is stable — the fingerprint is deterministic per seed+pool |
