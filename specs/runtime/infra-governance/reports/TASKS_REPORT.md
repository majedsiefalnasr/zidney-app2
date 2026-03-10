# Tasks Report — Infra Governance

**Step:** 4 — Tasks **Timestamp:** 2026-03-05T00:04:00.000Z **Status:** COMPLETE

---

## Summary

22 atomic, dependency-ordered tasks were generated for the Infra Governance stage. All tasks are
tooling and CI infrastructure changes — no application code, no database access, no API routes.
Tasks are grouped into 7 execution phases with two parallel slots (T005/T006 and T009/T010).

---

## Inputs Reviewed

- `specs/runtime/infra-governance/spec.md`
- `specs/runtime/infra-governance/plan.md`
- `specs/runtime/infra-governance/tasks.md`

---

## Task Breakdown

| Phase                                    | Tasks     | Description                                                                              |
| ---------------------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| Phase 1 — package.json additions         | T001–T004 | Add `@vitest/coverage-v8`, `husky`, `lint-staged`, `prepare` script                      |
| Phase 2 — Config file changes [parallel] | T005–T006 | `vitest.config.ts` coverage block; `lint-staged.config.mjs` (new)                        |
| Phase 3 — Dependency install             | T007–T008 | `bun install` + `bun run prepare` (Husky init)                                           |
| Phase 4 — Husky hook files [parallel]    | T009–T010 | Rewrite `pre-commit`; create `pre-push`                                                  |
| Phase 5 — infra-audit --quick            | T011–T014 | Add QUICK_MODE; guard mkdirSync; guard writeFileSync; extend enforcement                 |
| Phase 6 — CI workflow                    | T015–T020 | Remove monolithic e2e job; add 3 split E2E jobs; coverage-validation; build-verification |
| Phase 7 — Verification                   | T021–T022 | Verify hook executability; branch protection (manual)                                    |
| **Total**                                | **22**    |                                                                                          |

---

## Transactional Tasks

Not applicable — this stage introduces no database writes.

---

## Idempotency Tasks

- **T011–T014** — `scripts/infra-audit.ts` `--quick` flag: the quick mode execution path must be
  idempotent (no filesystem side effects on repeated invocations from pre-commit)
- **T009** — `.husky/pre-commit`: `lint-staged` auto-fix + re-stage behavior is idempotent (ESLint
  `--fix` applied to the same file produces the same result)

---

## Constitutional Compliance

| Check                                        | Status | Notes                                                    |
| -------------------------------------------- | ------ | -------------------------------------------------------- |
| All write paths include transaction tasks    | ✅ N/A | No DB writes in this stage                               |
| Idempotency tasks are defined where required | ✅     | T011–T014 address infra-audit idempotency                |
| Layer boundary rules are respected           | ✅     | No cross-app imports; all changes are tooling layer only |
| No unrelated file modifications planned      | ✅     | Only the 7 files from plan.md T001–T007 are touched      |
| Migration tasks included when required       | ✅ N/A | No migrations needed                                     |

**Overall:** COMPLIANT

---

## Next Step

Proceed to Step 5 — Analyze (Drift Detector).
