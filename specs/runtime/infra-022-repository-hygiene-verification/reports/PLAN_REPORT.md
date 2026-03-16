# Plan Report — REPOSITORY HYGIENE VERIFICATION

**Step:** 3 — Plan
**Timestamp:** 2026-03-15T00:03:00.000Z
**Status:** COMPLETE

---

## Summary

Technical plan for INFRA-022 was generated with full research phase. A single TypeScript orchestrator (`scripts/dev/hygiene-report-generator.ts`) invokes 9 per-task helper modules under `scripts/dev/hygiene-checks/` covering T001–T009, then produces `docs/reports/REPOSITORY_HYGIENE_REPORT.md` (T010). A `"hygiene:report"` script is added to root `package.json` as the entry point.

Both Architecture Checker and API Designer guardians returned **VERDICT: PASS**.

---

## Inputs Reviewed

- `specs/runtime/infra-022-repository-hygiene-verification/spec.md`
- `specs/runtime/infra-022-repository-hygiene-verification/plan.md`
- `specs/runtime/infra-022-repository-hygiene-verification/research.md`

---

## Architecture Layers Touched

| Layer           | Planned Changes                                                     |
| --------------- | ------------------------------------------------------------------- |
| API             | None                                                                |
| Worker          | None                                                                |
| Frontend        | None                                                                |
| DB Master       | None                                                                |
| DB Tenant       | None                                                                |
| Tooling/Scripts | 11 new files under `scripts/dev/hygiene-checks/` + orchestrator     |
| Reports         | 1 new tracked artifact: `docs/reports/REPOSITORY_HYGIENE_REPORT.md` |
| package.json    | 1 new script entry: `"hygiene:report"`                              |

---

## Key Technical Decisions

| #   | Decision                                                                           | Rationale                                                                 |
| --- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | Single orchestrator + 9 task helpers in `scripts/dev/hygiene-checks/`              | Clean separation of concerns; each task independently testable            |
| 2   | Shared `TaskResult` type with PASS/FLAG/WARNING/SKIP/INCONCLUSIVE statuses         | Uniform report schema; allows consistent markdown generation              |
| 3   | T004 uses `Bun.spawn` to invoke `verify-dependency-usage.ts` where applicable      | Reuse existing tooling; avoid duplication                                 |
| 4   | T008/T009 use `Bun.spawn` for `ai-context:validate` and `arch:guard`/`arch:health` | Avoids TS import boundary concerns; preserves subprocess isolation        |
| 5   | Report exits with code 0 always                                                    | Non-enforcing reporting tool; blocking on report generation would regress |
| 6   | 3 unit test files for orchestrator, routing check, and script detection            | Ensures core logic correctness without needing full repo scan in CI       |

---

## Migration Impact

| Item                  | Value | Notes                                       |
| --------------------- | ----- | ------------------------------------------- |
| Migration required    | No    | No schema changes                           |
| `schema_version` bump | No    | Not applicable                              |
| Backward compatible   | Yes   | Additive only; no existing behavior changes |

---

## Transaction Boundaries

- No database transactions required — verification reads only.

---

## Idempotency Strategy

All verification tasks are stateless reads. Running the hygiene report multiple times produces the same output. No side effects.

---

## Guardian Verdicts

| Guardian                    | Verdict  | Notes                                                    |
| --------------------------- | -------- | -------------------------------------------------------- |
| Zidney Architecture Checker | **PASS** | All 7 checks passed; no layer violations                 |
| Zidney API Designer         | **PASS** | No API surface introduced; no routing/middleware touched |

**Final Plan Gate: APPROVED**

---

## New Files Planned

| File                                                         | Purpose                                      |
| ------------------------------------------------------------ | -------------------------------------------- |
| `scripts/dev/hygiene-report-generator.ts`                    | Orchestrator — runs T001-T010, writes report |
| `scripts/dev/hygiene-checks/routing-authority-check.ts`      | T001: Routing surface audit                  |
| `scripts/dev/hygiene-checks/template-consolidation-check.ts` | T002: Template system check                  |
| `scripts/dev/hygiene-checks/dead-script-check.ts`            | T003: Dead script detection                  |
| `scripts/dev/hygiene-checks/dependency-hygiene-check.ts`     | T004: Dependency usage audit                 |
| `scripts/dev/hygiene-checks/workspace-package-check.ts`      | T005: Workspace package validation           |
| `scripts/dev/hygiene-checks/skill-surface-check.ts`          | T006: Skill surface validation               |
| `scripts/dev/hygiene-checks/ci-workflow-check.ts`            | T007: CI workflow hygiene                    |
| `scripts/dev/hygiene-checks/ai-context-check.ts`             | T008: AI context integrity                   |
| `scripts/dev/hygiene-checks/architecture-guard-check.ts`     | T009: Architecture guard execution           |
| `scripts/dev/hygiene-checks/types.ts`                        | Shared TaskResult type                       |
| `docs/reports/REPOSITORY_HYGIENE_REPORT.md`                  | Final hygiene report (tracked artifact)      |

---

## Modified Files Planned

| File           | Change                              |
| -------------- | ----------------------------------- |
| `package.json` | Add `"hygiene:report"` script entry |

---

## Open Risks

| Risk                                                            | Severity | Plan Mitigation                                       |
| --------------------------------------------------------------- | -------- | ----------------------------------------------------- |
| `arch:guard` output format may vary between versions            | Low      | Parse by regex; document raw output in report         |
| Workspace dependency graph may have intentional unused packages | Low      | Flag for review only — no automated removal           |
| Some scripts may have undocumented references                   | Medium   | Check docs/, CI, shell utilities, and stage artifacts |
