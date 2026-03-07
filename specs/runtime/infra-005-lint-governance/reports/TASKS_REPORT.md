# TASKS_REPORT.md — Lint Governance

**Stage:** STAGE_INFRA_05_LINT_GOVERNANCE  
**Phase:** 01_PLATFORM_FOUNDATION  
**Branch:** `spec/infra-005-lint-governance`  
**Step:** 4 — Tasks  
**Generated:** 2026-03-07  
**Tasks Total:** 21

---

## Summary

Tasks generated from `plan.md` and `spec.md`. All 21 tasks are atomic, dependency-ordered, and scoped to the minimal 4-file change set identified in the plan.

No implementation tasks affect tenant isolation, business logic, database migrations, or any runtime application code — this stage is toolchain governance only.

---

## Task Breakdown

| Phase                    | IDs       | Count  | Description                                                                        |
| ------------------------ | --------- | ------ | ---------------------------------------------------------------------------------- |
| Phase 1 — Baseline       | T001–T003 | 3      | Capture violations, auto-fix, identify `noUnreachable` warnings before tightening  |
| Phase 2 — Core Changes   | T004–T010 | 7      | `biome.json`, CI pipeline (`ci.yml`), pre-commit hook, governance docs             |
| Phase 3 — Fix Violations | T011–T012 | 2      | Manually resolve any `noUnreachable` violations surfaced by Phase 1 (may be no-op) |
| Phase 4 — Validation     | T013–T021 | 9      | Lint, typecheck, AI-Guard + 6 targeted file verifications                          |
| **Total**                | T001–T021 | **21** |                                                                                    |

---

## Parallelizable Task Sets

| Set   | Tasks            | Pre-Condition                                 |
| ----- | ---------------- | --------------------------------------------- |
| Set A | T004, T009, T010 | All start after T003; touch independent files |
| Set B | T014, T015       | Start after T013; independent commands        |

**Sequential constraint:** T005 → T006 → T007 → T008 must run in order (same file: `.github/workflows/ci.yml`).

---

## Files Modified

| File                                     | Tasks     | Change Type                                          |
| ---------------------------------------- | --------- | ---------------------------------------------------- |
| `biome.json`                             | T004      | Rule severity: `noUnreachable` warn → error          |
| `.github/workflows/ci.yml`               | T005–T008 | Add `arch-guard` job; fix lint step; gate tests      |
| `.husky/pre-commit`                      | T009      | Cosmetic: replace stale ESLint/Prettier comment      |
| `docs/governance/LINT_GOVERNANCE.md`     | T010      | CREATE — developer governance guide                  |
| Auto-fixed files from `bun run lint:fix` | T002      | Formatting/import fixes (varies, tracked in Phase 3) |

---

## Constitutional Compliance Spot-Check

| Rule                                        | Task Coverage              | Status       |
| ------------------------------------------- | -------------------------- | ------------ |
| No tenant isolation modification            | Scope: toolchain only      | ✅ Confirmed |
| No business logic changes                   | Scope: toolchain only      | ✅ Confirmed |
| No new runtime dependencies introduced      | devDeps only (none needed) | ✅ Confirmed |
| No cross-layer import violations introduced | AI-Guard validates (T015)  | ✅ Covered   |
| Lint exits 0 before closure                 | T013                       | ✅ Covered   |
| Typecheck exits 0 before closure            | T014                       | ✅ Covered   |

---

## Stage Completion Criteria

All of the following must be true before this stage is marked COMPLETE:

| Criterion                                                             | Task |
| --------------------------------------------------------------------- | ---- |
| `bun run lint` exits code 0 across full monorepo                      | T013 |
| `bun run typecheck` exits code 0                                      | T014 |
| `bun scripts/ai-guard.ts` exits code 0                                | T015 |
| `biome.json` has `noUnreachable: error` in `linter.rules.correctness` | T016 |
| `biome.json` import organizer confirmed active                        | T016 |
| `.github/workflows/ci.yml` has `arch-guard` job                       | T019 |
| `.github/workflows/ci.yml` test jobs have `needs: arch-guard`         | T019 |
| `.husky/pre-commit` stale comment replaced                            | T018 |
| `docs/governance/LINT_GOVERNANCE.md` created with 8 sections          | T020 |

---

## Risk Assessment

| Risk                                                       | Mitigation                                                                | Tasks                |
| ---------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------- |
| Tightening `noUnreachable` reveals pre-existing violations | Phase 1 baseline captures them first; Phase 3 fixes before rule activates | T001–T003, T011–T012 |
| `arch-guard` CI job breaks existing CI pipeline            | Job only added, existing jobs preserved; tested locally in T015           | T006–T008            |
| Auto-fix (`lint:fix`) touches unrelated files              | Scope limited by `biome.json` includes; reviewed in Phase 3               | T002                 |

---

_Drift analysis gate (Step 5 — Analyze) required before implementation proceeds._
