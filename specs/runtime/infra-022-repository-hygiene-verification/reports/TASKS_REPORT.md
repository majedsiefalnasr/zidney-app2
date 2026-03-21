# Tasks Report — REPOSITORY HYGIENE VERIFICATION

**Step:** 4 — Tasks
**Timestamp:** 2026-03-15T00:04:00.000Z
**Status:** COMPLETE

---

## Summary

22 atomic tasks generated across 5 phases. All tasks have exact file paths and a clear dependency
order. No `[NEEDS CLARIFICATION]` markers. Ready for drift analysis.

---

## Inputs Reviewed

- `specs/runtime/infra-022-repository-hygiene-verification/spec.md`
- `specs/runtime/infra-022-repository-hygiene-verification/plan.md`
- `specs/runtime/infra-022-repository-hygiene-verification/tasks.md`

---

## Task Breakdown

| Phase | Category                      | Count  | Parallel-capable | Notes                                              |
| ----- | ----------------------------- | ------ | ---------------- | -------------------------------------------------- |
| 1     | Shared types foundation       | 1      | No               | T001 — must complete before Phase 2                |
| 2     | Verification check modules    | 9      | Yes (all 9)      | T002–T010 — independent per-check helpers          |
| 3     | Orchestrator/report writer    | 1      | No               | T011 — depends on all Phase 2 modules              |
| 4     | Unit tests                    | 3      | Yes (all 3)      | T012–T014 — routing, dead-script, workspace checks |
| 5     | Integration, artifacts, gates | 8      | Partial          | T015–T022 — sequential integration + safety gates  |
| —     | **Total**                     | **22** | —                | —                                                  |

---

## New Files to Create

| Task | File                                                                      |
| ---- | ------------------------------------------------------------------------- |
| T001 | `scripts/dev/hygiene-checks/types.ts`                                     |
| T002 | `scripts/dev/hygiene-checks/routing-authority-check.ts`                   |
| T003 | `scripts/dev/hygiene-checks/template-consolidation-check.ts`              |
| T004 | `scripts/dev/hygiene-checks/dead-script-check.ts`                         |
| T005 | `scripts/dev/hygiene-checks/dependency-hygiene-check.ts`                  |
| T006 | `scripts/dev/hygiene-checks/workspace-package-check.ts`                   |
| T007 | `scripts/dev/hygiene-checks/skill-surface-check.ts`                       |
| T008 | `scripts/dev/hygiene-checks/ci-workflow-check.ts`                         |
| T009 | `scripts/dev/hygiene-checks/ai-context-check.ts`                          |
| T010 | `scripts/dev/hygiene-checks/arch-guard-check.ts`                          |
| T011 | `scripts/dev/hygiene-report-generator.ts`                                 |
| T012 | `scripts/dev/hygiene-checks/__tests__/routing-authority-check.test.ts`    |
| T013 | `scripts/dev/hygiene-checks/__tests__/dead-script-check.test.ts`          |
| T014 | `scripts/dev/hygiene-checks/__tests__/workspace-package-check.test.ts`    |
| T016 | `docs/reports/REPOSITORY_HYGIENE_REPORT.md` (placeholder → replaced T017) |

---

## Modified Files

| Task | File           | Change                              |
| ---- | -------------- | ----------------------------------- |
| T015 | `package.json` | Add `"hygiene:report"` script entry |

---

## Transactional Tasks

None — this stage is read-only verification. No database writes. No state mutations outside the
final report commit (T022).

---

## Idempotency Tasks

- T017 (`bun run dev:hygiene:report`) — re-runnable; always overwrites `REPOSITORY_HYGIENE_REPORT.md`
  with fresh output. Idempotent by design.
- All check modules (T002–T010) — stateless reads; safe to re-execute at any time.

---

## Safety Gates

| Task | Gate                                                                  |
| ---- | --------------------------------------------------------------------- |
| T018 | `bun run lint` — zero violations in new script files                  |
| T019 | `bun run typecheck` — zero TypeScript errors                          |
| T020 | `bun run test` — all unit tests pass, no regressions                  |
| T021 | `git diff --name-only` — no architecture files modified, no deletions |
| T022 | Final report committed to source control                              |

---

## Task Dependency Summary

```
T001 → T002–T010 (parallel) → T011 → T012–T014 (parallel) → T015 → T016 → T017 → T018–T021 → T022
```
