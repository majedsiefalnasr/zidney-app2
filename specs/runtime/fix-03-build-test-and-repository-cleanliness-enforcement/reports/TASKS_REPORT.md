# Tasks Report — Build, Test, and Repository Cleanliness Enforcement

**Step:** 4 — Tasks  
**Timestamp:** 2026-03-24T00:04:00Z  
**Status:** COMPLETE

---

## Summary

34 atomic tasks generated from the 23-file implementation manifest (9 rule files, 4 supporting scripts, 3 core engine files, 2 infra files) plus 15 unit test files. Tasks are organized into 6 sequential phases with parallel groups in Phases 2 and 4–5. No DB migrations required. `RULE_FIX_03_FLAKY_TEST_DETECTION` formally deferred to a follow-up stage.

---

## Inputs Reviewed

- `specs/runtime/fix-03-build-test-and-repository-cleanliness-enforcement/spec.md`
- `specs/runtime/fix-03-build-test-and-repository-cleanliness-enforcement/plan.md`
- `specs/runtime/fix-03-build-test-and-repository-cleanliness-enforcement/tasks.md`

---

## Task Breakdown

| Category                                       | Count  | Tasks     | Notes                                                   |
| ---------------------------------------------- | ------ | --------- | ------------------------------------------------------- |
| Core engine (types.ts, runner.ts, registry.ts) | 3      | T001–T003 | Atomic/coordinated breaking migration — commit together |
| Supporting scripts                             | 4      | T004–T007 | `scripts/validate/` — idempotent, read-only             |
| package.json entries                           | 1      | T008      | 4 new `validate:` and `repo:` scripts                   |
| Rule implementations                           | 9      | T009–T017 | All in `scripts/policy-engine/rules/fix-03/`            |
| Unit tests                                     | 15     | T018–T032 | `tests/policy-engine/fix-03/**`                         |
| CI / Husky migration                           | 2      | T033–T034 | `ci.yml` + `.husky/pre-push`                            |
| **Total**                                      | **34** |           |                                                         |

---

## Risk-Ranked Task Summary

| Task ID              | Risk      | Description                                                                                                      |
| -------------------- | --------- | ---------------------------------------------------------------------------------------------------------------- |
| T001                 | 🔴 HIGH   | Breaking type migration in `scripts/policy-engine/types.ts` — removes `success`/`message`, adds mandatory fields |
| T002                 | 🔴 HIGH   | `runner.ts` update — exit code contract, GitNexus wiring, import-failure guard (exit 2)                          |
| T003                 | 🔴 HIGH   | `registry.ts` update — registers 9 new rules; order is contractual                                               |
| T010                 | 🔴 HIGH   | `auto-fix-attempt.ts` — mutates working tree (lint:fix, format); populates `autoFixedPaths` in shared context    |
| T033                 | 🟡 MEDIUM | `.github/workflows/ci.yml` — removes `build-verification` job; structural CI change                              |
| T034                 | 🟡 MEDIUM | `.husky/pre-push` — replaces steps 4+5 with `validate:policy --changed`                                          |
| T009                 | 🟡 MEDIUM | `environment-ready.ts` — hard-fail rule; stops all subsequent rules on failure                                   |
| T014                 | 🟡 MEDIUM | `repo-clean.ts` — reads `context.autoFixedPaths` cross-rule dependency                                           |
| T004–T007            | 🟢 LOW    | Supporting scripts — read-only, idempotent                                                                       |
| T008                 | 🟢 LOW    | `package.json` — additive script entries only                                                                    |
| T011–T013, T015–T017 | 🟢 LOW    | Remaining rule files — isolated, no shared state                                                                 |
| T018–T032            | 🟢 LOW    | Test files — additive, no production impact                                                                      |

---

## Tasks with External Dependencies

| Task ID | Package / Tool                                | Version Note                                                                                    |
| ------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| T002    | `gitnexus-context.json` artifact              | Runner reads `docs/ai/context/gitnexus-context.json`; freshness validated via mtime vs git HEAD |
| T019    | vitest                                        | Uses `--pool=forks --isolate` per `vitest.config.ts` — no changes to test runner config         |
| T033    | `actions/checkout@v4`, `oven-sh/setup-bun@v2` | Existing pinned actions reused                                                                  |

---

## High-Downstream-Impact Tasks

| Task ID | Module                            | Impact                                                    | Description                   |
| ------- | --------------------------------- | --------------------------------------------------------- | ----------------------------- |
| T001    | `scripts/policy-engine/types.ts`  | HIGH — all rule files and runner.ts depend on these types | Breaking interface migration  |
| T002    | `scripts/policy-engine/runner.ts` | HIGH — entry point consumed by CI and Husky hooks         | Exit code contract change     |
| T033    | `.github/workflows/ci.yml`        | HIGH — affects all CI builds                              | Remove build-verification job |

---

## Transactional Tasks

- None — this is an infra-only stage. No DB writes are performed.
- `scripts/init-test-db.sh` (invoked by T013) uses PostgreSQL-level transactions internally, but these are handled by the existing script — no new transaction design required.

---

## Idempotency Tasks

- T004 (`validate-runtime-env.ts`) — read-only service probes; idempotent
- T005 (`repo-assert-clean.ts`) — reads `git status --porcelain`; idempotent
- T006 (`repo-detect-artifacts.ts`) — filesystem scan; idempotent
- T007 (`repo-hash-build.ts`) — file hashing; idempotent
- All supporting script tests (T030–T032) include duplicate-invocation assertions

---

## Constitutional Compliance

| Check                                        | Status | Notes                                                                                                  |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| All write paths include transaction tasks    | ✅     | No write paths — infra-only stage                                                                      |
| Idempotency tasks are defined where required | ✅     | T004–T007 all idempotent; verified in tests                                                            |
| Layer boundary rules are respected           | ✅     | All tasks confined to `scripts/`, `tests/`, `.github/`, `.husky/`; no `apps/*` or `packages/*` touches |
| No unrelated file modifications planned      | ✅     | 23 files + 15 tests — all scoped to STAGE_FIX_03 deliverables                                          |
| Migration tasks included when required       | ✅     | No migrations needed (infra-only stage)                                                                |

**Overall:** COMPLIANT

---

## Open Risks

- `RULE_FIX_03_FLAKY_TEST_DETECTION` formally deferred — flaky test history tracking infrastructure not in scope; `DeferralReport` will be emitted by runner as follow-up marker.
- T010 (`auto-fix-attempt.ts`) modifies working tree — must be carefully tested to ensure `autoFixedPaths` is populated before T014 (`repo-clean.ts`) runs in same invocation.

---

## Next Step

Proceed to Step 5 — Analyze.
