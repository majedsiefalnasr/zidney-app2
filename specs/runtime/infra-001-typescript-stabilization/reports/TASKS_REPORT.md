# Tasks Report — STAGE_INFRA_01_TYPESCRIPT_STABILIZATION

**Step:** 4 — Tasks **Timestamp:** 2026-02-27T00:04:00Z **Status:** COMPLETE

---

## Summary

86 atomic tasks generated across 7 phases for the TypeScript Infrastructure Stabilization stage. 31
tasks are parallelizable within their phase constraints. Tasks are ordered by dependency graph
(packages → apps → tests → CI). No user story labels — this is a Setup/Foundational infrastructure
stage.

**Total tasks: 86** | **Parallelizable: 31** | **Sequential gates: 7** (one per phase exit)

---

## Inputs Reviewed

- `specs/runtime/infra-001-typescript-stabilization/spec.md`
- `specs/runtime/infra-001-typescript-stabilization/plan.md`
- `specs/runtime/infra-001-typescript-stabilization/research.md`
- `specs/runtime/infra-001-typescript-stabilization/tasks.md`

---

## Task Breakdown

| Phase     | Category                                          | Count  | Parallelizable | Notes                                                              |
| --------- | ------------------------------------------------- | ------ | -------------- | ------------------------------------------------------------------ |
| Phase 0   | Day 0 — tsconfig Hardening (T001–T011)            | 11     | 0              | Sequential — must complete before Pass 1                           |
| Phase 1   | Pass 1 — Remove Implicit Any (T012–T033)          | 22     | 9              | Group A (packages/types, logger, validation, redis-utils) parallel |
| Phase 2   | Pass 2 — Domain Contract Alignment (T034–T040)    | 7      | 2              | Some API+Worker alignment tasks parallel                           |
| Phase 3   | Pass 3 — Strict Null Handling (T041–T051)         | 11     | 4              | Per-package null handling tasks parallel                           |
| Phase 4   | Pass 4 — Cross-Package Import Cleanup (T052–T063) | 12     | 7              | Per-package import type conversions parallel                       |
| Phase 5   | Pass 5 — Test File Strict Compliance (T064–T081)  | 18     | 7              | Test file fixes parallel by test area                              |
| Phase 6   | CI Gate + Final Validation (T082–T086)            | 5      | 2              | GitHub Actions job + ESLint rules tasks                            |
| **Total** |                                                   | **86** | **31**         |                                                                    |

---

## Key Task Highlights

### Phase 0 — Day 0 Tasks (T001–T011)

These must complete before Pass 1 begins. Removing `strict: false` from `apps/api` will expose
currently-suppressed errors, so the pre-Pass-1 error baseline will exceed 866.

Critical Day 0 tasks:

- T001: Add missing strict options to `tsconfig.base.json`
- T002: Remove `strict: false` from `apps/api/tsconfig.json` 🔴 (critical — hides ~120 errors)
- T003: Remove `noImplicitAny: false` from `packages/domain-core/tsconfig.json` 🔴 (critical — hides
  ~66 errors)
- T007: Create `tsconfig.test.json` with `noUnusedLocals/Parameters: false`, test path scope
- T008: Update root `tsconfig.json` to exclude test paths
- T010: Rename `type-check` → `typecheck:src`; add `typecheck:tests` and `typecheck` aggregator
  scripts
- T011: Re-baseline error count (run `pnpm typecheck:src`) — establishes true starting point

### Phase 1 — Pass 1 (T012–T033)

Dependency-ordered execution:

- Group A (T012–T015): `packages/types`, `packages/validation`, `packages/logger`,
  `packages/redis-utils` — all parallel
- Group B (T016–T017): `packages/domain-core` — sequential (depends on Group A)
- Group C (T018–T021): `apps/api` source — sequential (depends on domain-core)
- Group D (T022–T025): `apps/worker` source — sequential (depends on domain-core)
- Group E (T026–T027): `apps/mmc` source — parallel with worker
- Exit (T033): Per-phase regression gate (`pnpm test`)

### Phase 5 — Pass 5 Test Compliance (T064–T081)

73% of the 866 errors are in test files. This is the largest phase by effort but lowest risk
(test-only scope). Using `tsconfig.test.json` that relaxes `noUnusedLocals/Parameters`.

### Phase 6 — CI Gate (T082–T086)

- T082: Create `.github/workflows/typecheck.yml` CI gate
- T083: Add ESLint `ban-ts-comment` rule (with description requirement per CL-05)
- T084: Final `pnpm typecheck` (aggregator — zero errors gate)
- T085: Final `pnpm test` (regression confirmation)
- T086: Update CI workflow docs / CONTRIBUTING notes

---

## Transactional Tasks

Not applicable — this is an infrastructure stage. No database write operations are introduced.

---

## Idempotency Tasks

Not applicable — no new API endpoints or worker jobs introduced.

---

## Constitutional Compliance

| Check                                     | Status | Notes                                                                          |
| ----------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| All write paths include transaction tasks | ✅ N/A | Infrastructure stage — no DB writes                                            |
| Idempotency tasks defined where required  | ✅ N/A | No new endpoints                                                               |
| Layer boundary rules respected            | ✅     | Pass 4 tasks explicitly enforce `import type` and cross-package boundary rules |
| No unrelated file modifications planned   | ✅     | All tasks scoped to TypeScript config and type fix files; no logic changes     |
| Migration tasks included when required    | ✅ N/A | No schema changes                                                              |
| CL-04 logic bug isolation enforced        | ✅     | Pass 2 tasks include explicit stop condition for logic bug discovery           |
| CI gate tasks present                     | ✅     | T082–T083 add GitHub Actions typecheck job and ESLint rule                     |

**Overall:** COMPLIANT — task set is analytically complete and correctly ordered.
