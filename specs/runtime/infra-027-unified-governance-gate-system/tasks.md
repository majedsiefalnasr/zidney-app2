# Tasks — INFRA-27 Unified Governance Gate System

**Stage:** INFRA-27 Unified Governance Gate System  
**Phase:** 01_PLATFORM_FOUNDATION  
**Total Tasks:** 16  
**Generated:** 2026-03-25T00:00:00Z

---

## Parallelization Groups

| Group | Tasks                        | Gate Condition                  |
| ----- | ---------------------------- | ------------------------------- |
| G0    | T001, T002                   | Entry — no deps                 |
| G1    | T003                         | After T002 (same file, ordered) |
| G2    | T004, T005                   | After T003                      |
| G3    | T006                         | After T004 (wraps gate.ts)      |
| G4    | T007, T008, T009, T010, T011 | After T006 (all independent)    |
| G5    | T012                         | After T004 + T011 settled       |
| G6    | T013, T014, T015, T016       | After T012 (final validation)   |

---

## Task List

### G0 — Entry (no dependencies)

- [ ] T001 [P] Verify 10th canonical `governance` domain and `scripts/governance/` location policy entry exist in `.agents/skills/script-system-governance/SKILL.md`
- [ ] T002 [P] Add `ai-context:validate` chained alias (`validate:ai-context-fresh && validate:ai-context-schemas`) to root `package.json`

### G1 — package.json Foundation (after T002)

- [ ] T003 Add `governance:gate`, `governance:gate:ci`, `governance:gate:changed`, and `governance:report` scripts to root `package.json`

### G2 — New Script Files: gate and report (parallel, after T003)

- [ ] T004 [P] Create full governance gate with 6-guard sequential report-all runner and 5-field script metadata header — `scripts/governance/gate.ts`
- [ ] T005 [P] Create governance report generator that writes consolidated markdown health report and 5-field script metadata header — `scripts/governance/report.ts`

### G3 — New Script File: gate-ci (after T004)

- [ ] T006 Create CI-variant governance gate wrapping `governance:gate` with GitHub Actions `::group::`/`::endgroup::`/`::error::` annotations and 5-field script metadata header — `scripts/governance/gate-ci.ts`

### G4 — Infrastructure Integration (parallel, after T006)

- [ ] T007 [P] [US1] Add `governance:gate:changed` invocation block (after Trivy secret scan, before final echo) in `.husky/pre-commit`
- [ ] T008 [P] [US2] Append step 18 (`Unified Governance Gate` / `bun run governance:gate:ci`) after step 17 in `.github/workflows/architecture-governance.yml`
- [ ] T009 [P] Add `docs/governance/governance-report.md` generated-artifact exclusion entry to `.gitignore`
- [ ] T010 [P] [US3] Add Step 6.1B (`governance:gate:changed`) and Step 7.0 (`governance:gate`) blocking gate invocations to `.agents/agents/orchestrator.agent.md`
- [ ] T011 [P] Regenerate script registry documentation via `dev:generate:script-docs` to capture new `governance:*` entries — `docs/scripts/`

### G5 — Tests (after T004)

- [ ] T012 Write unit tests for sequential guard runner, exit code propagation, and report-all behavior — `scripts/governance/__tests__/gate.test.ts`

### G6 — Final Validation (parallel, after T012)

- [ ] T013 [P] Verify `bun run biome check` passes across all new and modified files
- [ ] T014 [P] Verify `bun run typecheck` passes across the workspace
- [ ] T015 [P] Verify `bun run validate:scripts:infrastructure` passes (5-field headers on all three new scripts)
- [ ] T016 [P] Verify `bun run validate:scripts:usage` passes (all `governance:*` references resolve correctly)
