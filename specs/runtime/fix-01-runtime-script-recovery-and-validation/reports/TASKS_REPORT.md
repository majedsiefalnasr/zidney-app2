# Tasks Report — Runtime Script Recovery and Validation

**Step:** 4 — Tasks
**Timestamp:** 2026-03-17T00:04:00.000Z
**Status:** COMPLETE

---

## Summary

46 atomic tasks generated across 6 phases, covering all 12 originally identified spec tasks (T001–T012 from spec.md) expanded into full implementation subtasks. Tasks are dependency-ordered and include parallel markers for concurrent execution opportunities. No schema changes, no migrations, no API routes — pure infrastructure recovery and governance tooling.

---

## Inputs Reviewed

- `specs/runtime/fix-01-runtime-script-recovery-and-validation/spec.md`
- `specs/runtime/fix-01-runtime-script-recovery-and-validation/plan.md`
- `specs/runtime/fix-01-runtime-script-recovery-and-validation/research.md`
- `specs/runtime/fix-01-runtime-script-recovery-and-validation/tasks.md`

---

## Task Breakdown

| Phase         | Category                             | Count  | Notes                                                                      |
| ------------- | ------------------------------------ | ------ | -------------------------------------------------------------------------- |
| Phase 1       | Setup & Prerequisites                | 2      | Logger factory + directory verification                                    |
| Phase 2       | Foundational Scan Tooling            | 5      | Scan, diff, broken-detection scripts + execution                           |
| Phase 3 (US1) | Script Reconstruction & Registration | 14     | 4 seed dedup + 7 new scripts + 3 package.json registration tasks           |
| Phase 4 (US3) | CI Guard + Unit Tests                | 4      | validate-runtime-scripts implementation + test coverage                    |
| Phase 5 (US2) | Documentation & Generator            | 14     | 1 README + 10 script doc pages + generator impl + registration + execution |
| Final Phase   | Polish, Governance & Validation      | 7      | AGENTS.md, registry, validation run, type-check, lint                      |
| **Total**     |                                      | **46** |                                                                            |

---

## Parallel Opportunities

**Phase 3 / US1 (6 concurrent):**

- T012 `scripts/db/pool-status.ts`
- T013 `scripts/db/validate-licenses.ts`
- T015 `scripts/db/console.ts`
- T016 `scripts/validate/ai-context-fresh.ts`
- T017 `scripts/validate/ai-context-schemas.ts`
- T018 `scripts/maintenance/cache-clean.ts`

**Phase 5 / US2 (10 concurrent after T026):**

- T027–T036: all 10 individual `docs/scripts/<script>.md` pages

---

## Transactional Tasks

None. This stage involves no database write paths — all operations are filesystem reads/writes, process execution validation, and package.json updates.

---

## Idempotency Tasks

- T009: Seed script dedup — compare before move (file-existence check prevents double-move)
- T012–T018: All new scripts contain infra-absent exit-0 patterns (safe to re-run without DB)
- T019–T021: `package.json` registrations — idempotent (same key → same value)
- T044: CI guard — re-runnable at any time (validates current state only)

---

## Constitutional Compliance

| Check                                        | Status | Notes                                                         |
| -------------------------------------------- | ------ | ------------------------------------------------------------- |
| All write paths include transaction tasks    | ✅     | No DB writes; filesystem ops are atomic (rename then delete)  |
| Idempotency tasks are defined where required | ✅     | Infra-absent exit-0 pattern on all DB scripts                 |
| Layer boundary rules are respected           | ✅     | No cross-app imports; all scripts in `scripts/<domain>/`      |
| No unrelated file modifications planned      | ✅     | Only `AGENTS.md`, `package.json`, `scripts/`, `docs/scripts/` |
| Migration tasks included when required       | ✅     | No migrations required; infrastructure fix only               |

**Overall:** COMPLIANT

---

## MVP Scope (Minimum Viable Pass)

Complete Phase 1 → Phase 2 → Phase 3 US1 (T001–T021).

This resolves the primary developer experience failures (commands not found) and satisfies:

- Scenario 1: `bun run <script>` executes cleanly
- Scenario 4: seed dedup complete
- Scenario 5: zero drift after phase 3

**Increment 2:** Phase 4 (T022–T025) — CI guard prevents regression.

**Increment 3:** Phase 5 (T026–T039) — documentation generator and script pages.

**Complete:** Final Phase (T040–T046) — governance rules in AGENTS.md, validation report.

---

## Open Risks

1. **T014 (db:migrate):** File may or may not exist on disk — need to check before creating to avoid overwrite of existing work.
2. **T008–T011 (seed dedup):** Two files at `scripts/seed-dashboard-test-data.ts` (root) and `scripts/dev/seed-dashboard-test-data.ts` — canonical must be identified by line-by-line comparison before deletion.
3. **T003 (scan-package-scripts.ts):** Scan scope set to `specs/runtime/**/*.md` — if additional markdown locations contain undocumented `bun run` references, coverage may be incomplete.

---

## Next Step

Proceed to Step 5 — Analyze.
