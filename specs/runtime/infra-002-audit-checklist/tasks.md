# tasks.md — INFRA_AUDIT_CHECKLIST

**Stage:** INFRA_AUDIT_CHECKLIST  
**Phase:** 01_PLATFORM_FOUNDATION  
**Generated:** 2026-03-04  
**Total Tasks:** 53

---

## Implementation Tasks

---

### Phase 0: Research & Setup

> Foundational verification tasks. No user story label. Must complete before Phase 1 begins.
> T002–T007 can run in parallel; T001 is the entry point.

- [x] T001 Confirm `bun --version` ≥ 1.0 at repo root — record version string for audit metadata
- [x] T002 [P] Check `.gitignore` for `infra-audit-report.json` entry; append if absent
      (`.gitignore`)
- [x] T003 [P] Record current git commit SHA via `git rev-parse HEAD` for audit timestamping
- [x] T004 [P] Verify all 5 Vitest config files exist: `vitest.config.ts`,
      `apps/backoffice/vitest.config.ts`, `apps/frontoffice/vitest.config.ts`,
      `apps/mmc/vitest.config.ts`, `packages/api-client/vitest.config.ts`
- [x] T005 [P] Verify all 4 ESLint config files exist: `eslint.config.mjs`,
      `apps/backoffice/eslint.config.js`, `apps/frontoffice/eslint.config.js`,
      `apps/mmc/eslint.config.js`
- [x] T006 [P] Verify all 4 GitHub workflow files exist under `.github/workflows/`:
      `test-stage-001.yml`, `typecheck.yml`, `mmc-dashboard-deploy.yml`, `hard-mode-guard.yml`
- [x] T007 [P] Create directory `specs/runtime/infra-002-audit-checklist/reports/` if not present

---

### Phase 1: Audit Script

> Creates `scripts/infra-audit.ts` and validates it. T008–T015 are sequential (each task builds on
> prior). T018 and T019 are parallel lint/type-check validations that may run alongside T016. T016
> must complete before T017.

- [x] T008 [US9] Create `scripts/infra-audit.ts` — scaffold entry point with recursive filesystem
      walker, secret-pattern skip logic (skips `.env`, `.env.*`, `*.pem`, `*.key`, `*.secret`,
      `*.p12`, `*.pfx`, `docker-compose.override.yml`), and `node_modules`/`.git` exclusion (section
      1.1)
- [x] T009 [US9] Add Vitest config inventory scanner to `scripts/infra-audit.ts` — locate all
      `vitest.config.ts`, `vitest.config.js`, `vitest.workspace.ts`, `vitest.workspace.js`; record
      `path`, `environment`, `globals`, coverage-enabled flag, custom reporters; flag conflicts;
      classify consolidation risk (section 1.2)
- [x] T010 [US9] Add ESLint config inventory scanner to `scripts/infra-audit.ts` — locate all
      `eslint.config.*`, `.eslintrc.*` files; record `path` and format (flat/legacy); check root and
      per-app `package.json` for `eslint-config-prettier` and `prettier` in `devDependencies`; set
      `prettierConflictRisk` (section 1.3)
- [x] T011 [US9] Add test file counter to `scripts/infra-audit.ts` — count `**/*.test.ts` and
      `**/*.test.js` under `apps/*/src/` (unit); count files under `tests/integration/` and
      `apps/*/tests/integration/` (integration); count `**/*.spec.ts` (spec); record per-app and
      per-package totals (section 1.4)
- [x] T012 [US9] Add Playwright config detector to `scripts/infra-audit.ts` — locate
      `playwright.config.ts`, `playwright.config.js`; record `e2ePresent: true/false` per app;
      populate `playwrightConfigs` array (section 1.5)
- [x] T013 [US9] Add README presence and section-completeness scanner to `scripts/infra-audit.ts` —
      for every `apps/*` and `packages/*` directory: check for `README.md` (case-insensitive); if
      present, scan for 7 required section headings; classify each as `PRESENT`, `PRESENT_EMPTY`, or
      `MISSING`; classify missing READMEs as `README_MISSING` (section 1.6)
- [x] T014 [US9] Add skipped/flaky test scanner to `scripts/infra-audit.ts` — scan all test source
      files for `.skip(`, `.todo(`, `xit(`, `xdescribe(`, `.retry(`, `// flaky`, `// FLAKY`,
      `// unstable`, `// UNSTABLE`, and `retry:` config key ≥ 1; record counts per app with
      `"detectionMethod": "STATIC_SCAN_ONLY"` (section 1.7)
- [x] T015 [US9] Add JSON output writer and structured console output to `scripts/infra-audit.ts` —
      write `infra-audit-report.json` with all 11 required top-level keys (`timestamp`, `gitSha`,
      `vitestConfigs`, `eslintConfigs`, `playwrightConfigs`, `totalTestFiles`, `readmeAudit`,
      `skippedTests`, `flakyTests`, `consolidationRisk`, `prettierConflictRisk`); emit
      `[INFRA AUDIT]` phase headers to stdout; emit `WARN: PARSE_ERROR` on file parse failure; emit
      `SKIP: SKIPPED (secret pattern)` for skipped files (sections 1.8–1.9)
- [x] T016 [US9] Run `bun run scripts/infra-audit.ts` — verify exit code 0 and confirm
      `infra-audit-report.json` is written at repo root
- [x] T017 [US9] Validate `infra-audit-report.json` — confirm all 11 required top-level keys are
      present and non-null; confirm `timestamp` is ISO 8601; confirm `gitSha` matches recorded SHA
      from T003
- [x] T018 [P] [US9] Lint `scripts/infra-audit.ts` via `bun run lint` — verify 0 new ESLint errors
      introduced by the script
- [x] T019 [P] [US9] Type-check via `bun run typecheck:src --noEmit` — verify 0 new TypeScript errors
      introduced by `scripts/infra-audit.ts`

---

### Phase 2: Manual Audit Supplements

> All Phase 2 tasks begin after T017 (script validated, JSON confirmed). Tasks within each sub-group
> marked [P] can run in parallel with each other and with other sub-groups. Command-execution tasks
> (T038–T046) must run **sequentially** per NFR-P2.

#### 2.1 — Vitest Config Detail Audit [US1]

- [x] T020 [P] [US1] Read `vitest.config.ts` (root) — record `test.environment`, `globals`, coverage
      provider and enabled flag, and any custom reporters
- [x] T021 [P] [US1] Read `apps/backoffice/vitest.config.ts` — record `test.environment`, `globals`,
      coverage provider and enabled flag, and any custom reporters
- [x] T022 [P] [US1] Read `apps/frontoffice/vitest.config.ts` — record `test.environment`,
      `globals`, coverage provider and enabled flag, and any custom reporters
- [x] T023 [P] [US1] Read `apps/mmc/vitest.config.ts` — record `test.environment`, `globals`,
      coverage provider and enabled flag, and any custom reporters
- [x] T024 [P] [US1] Read `packages/api-client/vitest.config.ts` — record `test.environment`,
      `globals`, coverage provider and enabled flag, and any custom reporters
- [x] T025 [P] [US1] Classify Vitest consolidation risk (LOW/MEDIUM/HIGH) by comparing T020–T024
      findings; identify and document any conflicting property values across configs

#### 2.2 — Test Distribution Verification [US2]

- [x] T026 [P] [US2] Verify `infra-audit-report.json` `totalTestFiles` section — confirm unit,
      integration, and spec counts are populated per app and package; confirm `playwrightConfigs`
      array is empty (research-confirmed: no Playwright in any app → all `e2ePresent: false`)

#### 2.3 — ESLint Rule Severity Scan [US3]

- [x] T027 [P] [US3] Read `eslint.config.mjs` (root) — extract severity for `no-unused-vars`,
      `@typescript-eslint/no-explicit-any`, `no-console`, and `vue/multi-word-component-names`
- [x] T028 [P] [US3] Read `apps/backoffice/eslint.config.js` — extract severity for
      `no-unused-vars`, `@typescript-eslint/no-explicit-any`, `no-console`, and
      `vue/multi-word-component-names`
- [x] T029 [P] [US3] Read `apps/frontoffice/eslint.config.js` — extract severity for
      `no-unused-vars`, `@typescript-eslint/no-explicit-any`, `no-console`, and
      `vue/multi-word-component-names`
- [x] T030 [P] [US3] Read `apps/mmc/eslint.config.js` — extract severity for `no-unused-vars`,
      `@typescript-eslint/no-explicit-any`, `no-console`, and `vue/multi-word-component-names`
- [x] T031 [P] [US3] Verify `eslint-config-prettier` and `prettier` presence in root `package.json`
      `devDependencies`; assess whether any formatting rules are duplicated in ESLint configs;
      assign Prettier conflict risk classification (SAFE / NEEDS ALIGNMENT / CONFLICT PRESENT)

#### 2.4 — CI Pipeline Enforcement Posture [US4]

- [x] T032 [P] [US4] Read `.github/workflows/test-stage-001.yml` — record
      presence/absence/informational status for: Lint, Type Check, Unit Tests, Integration Tests,
      E2E Tests, Coverage Gate; flag absent merge gates
- [x] T033 [P] [US4] Read `.github/workflows/typecheck.yml` — record presence/absence/informational
      status for: Lint, Type Check, Unit Tests, Integration Tests, E2E Tests, Coverage Gate; flag
      absent merge gates
- [x] T034 [P] [US4] Read `.github/workflows/mmc-dashboard-deploy.yml` — record
      presence/absence/informational status for: Lint, Type Check, Unit Tests, Integration Tests,
      E2E Tests, Coverage Gate; flag absent merge gates
- [x] T035 [P] [US4] Read `.github/workflows/hard-mode-guard.yml` — record
      presence/absence/informational status for: Lint, Type Check, Unit Tests, Integration Tests,
      E2E Tests, Coverage Gate; flag absent merge gates
- [x] T036 [P] [US4] Compile per-workflow enforcement table from T032–T035 findings; identify all
      workflows where a merge-gate step is absent or informational-only; draft gap entries for Gap
      Report §CI

#### 2.5 — README Section Completeness [US6]

- [x] T037 [P] [US6] Read `packages/types/README.md` — check presence and body content of all 7
      required sections (Purpose, Responsibilities, Dependencies, Public API, How to Run Tests,
      Environment Variables, Known Boundaries); classify each as `PRESENT`, `PRESENT_EMPTY`, or
      `MISSING`
- [x] T038 [P] [US6] Read `packages/ui-system/README.md` — check presence and body content of all 7
      required sections (Purpose, Responsibilities, Dependencies, Public API, How to Run Tests,
      Environment Variables, Known Boundaries); classify each as `PRESENT`, `PRESENT_EMPTY`, or
      `MISSING`
- [x] T039 [P] [US6] Document all 5 `apps/*` directories (api, backoffice, frontoffice, mmc, worker)
      as `README_MISSING` → HIGH documentation debt (confirmed by research.md §7)
- [x] T040 [P] [US6] Document 6 of 8 `packages/*` directories (api-client, config, domain-core,
      logger, redis-utils, validation) as `README_MISSING` → HIGH documentation debt (confirmed by
      research.md §7)

#### 2.6 — Command Execution: Bun Compatibility & Technical Debt [US5, US7]

> These tasks are **strictly sequential** per NFR-P2. Do not run in parallel.

- [x] T041 [US5] Run `bun install` — record exit code and any Bun compatibility warnings; note any
      Node.js-only tooling warnings
- [x] T042 [US7] Run `bun run typecheck:src --noEmit` — record total TypeScript error count with git SHA and
      ISO 8601 timestamp
- [x] T043 [US7] Run `bun run lint` — record total ESLint error count and warning count with git SHA
      and ISO 8601 timestamp
- [x] T044 [US2] [US7] Run `bun test --coverage` in local test environment — record exit code;
      record raw Lines%, Functions%, Statements%, Branches% coverage baseline; document any DB-gated
      test failures as `"DB-GATED"` entries; do not filter by test type
- [x] T045 [US5] Run `bun run build` — record exit code and any build errors or warnings
- [x] T046 [US5] Assign Bun compatibility verdict (FULLY COMPATIBLE / PARTIALLY COMPATIBLE /
      INCOMPATIBLE) based on T041–T045 results (all four commands: install, tsc, lint, test, build)

#### 2.7 — Skipped/Flaky Test Count Verification [US7]

- [x] T047 [P] [US7] Verify `infra-audit-report.json` `skippedTests` and `flakyTests` sections —
      confirm counts are populated per app and per package; confirm
      `"detectionMethod": "STATIC_SCAN_ONLY"` is present on both keys

#### 2.8 — Enforcement Readiness Score [US8]

> Depends on all US1–US7 data being gathered (T020–T047). T048 and T049 are sequential.

- [x] T048 [US8] Synthesize US1–US7 findings — populate Enforcement Readiness Score table with READY
      or NEEDS WORK for all 6 governance areas: Vitest Consolidation, Coverage Threshold, E2E
      Isolation, ESLint Enforcement, Husky Hooks, CI Matrix; write one-sentence justification for
      every NEEDS WORK entry
- [x] T049 [US8] Assign overall enforcement readiness verdict using CL7 threshold rule (0 NEEDS WORK
      → READY FOR ENFORCEMENT; 1–3 → PARTIAL — FIX REQUIRED; 4–6 → NOT READY); document the
      threshold rule verbatim above the score table

---

### Phase 3: Written Deliverables

> All Phase 3 tasks depend on Phase 2 being fully complete (T049 done). T050, T051, T052 can be
> authored in parallel. T053 validates cross-references and must come last.

- [x] T050 [P] [US10] Author `specs/runtime/infra-002-audit-checklist/reports/GAP_REPORT.md` —
      include: Related Documents section (top, with relative markdown links), Audit Metadata (ISO
      8601 timestamp, git SHA, auditor), §1 Vitest Config Inventory, §2 Test Distribution Audit, §3
      ESLint Config Audit, §4 CI Pipeline Audit, §5 Bun Compatibility Check, §6 README Coverage
      Audit, §7 Technical Debt Snapshot, §8 Enforcement Readiness Score (with CL7 verdict rule
      verbatim above table); ≥ 1 finding per section
- [x] T051 [P] [US10] Author
      `specs/runtime/infra-002-audit-checklist/reports/RISK_CLASSIFICATION.md` — include: Related
      Documents section (top, with relative markdown links), Classification Table
      (`Gap ID | Gap Description | Risk Level | Rationale`) with one-sentence rationale per entry
      and levels LOW/MEDIUM/HIGH/CRITICAL, Summary Counts section; pre-classify known gaps from
      research (5 apps README missing → HIGH; 6 packages README missing → HIGH; no Playwright in any
      app → MEDIUM; no `vitest.workspace.*` → MEDIUM; ESLint absent for api/worker/packages →
      MEDIUM)
- [x] T052 [P] [US10] Author `specs/runtime/infra-002-audit-checklist/reports/SAFE_ROLLOUT_PLAN.md`
      — include: Related Documents section (top, with relative markdown links), Sequencing
      Rationale, Phase 1 LOW-Risk Remediation, Phase 2 MEDIUM-Risk Remediation (requires Phase 1
      complete), Phase 3 HIGH/CRITICAL Remediation (requires Phase 2 verified), Governance Gate
      section stating no `STAGE_INFRA_GOVERNANCE` task may open until all three reports are present
      and reviewed (FR-US10-5)
- [x] T053 [US10] Verify cross-reference links in all three reports — confirm each of
      `GAP_REPORT.md`, `RISK_CLASSIFICATION.md`, and `SAFE_ROLLOUT_PLAN.md` contains a Related
      Documents section at the top with valid relative markdown links to the other two documents
      (e.g., `[RISK_CLASSIFICATION.md](./RISK_CLASSIFICATION.md)`)

---

## Summary

**Total:** 53 tasks  
**Parallelizable:** 33 tasks marked [P]  
**Sequential dependencies:**

- Phase 0 → Phase 1: All Phase 0 setup (especially T002 `.gitignore` and T001 bun version) must
  complete before the audit script is created and run.
- T008–T015 are strictly sequential within Phase 1 (each adds a new section to the same file).
- T016 (run script) depends on T015 (script complete); T017 (validate JSON) depends on T016.
- T018/T019 (lint/type-check) depend on T015 but are parallel to T016.
- Phase 2 begins after T017 (validated JSON required for data verification tasks T026, T047).
- T041–T046 (command-execution tasks) must run **sequentially** per NFR-P2 (no parallel resource
  contention).
- T048–T049 (Readiness Score) depend on all Phase 2 data tasks T020–T047 completing.
- Phase 3 (T050–T052) depends on T049 (Readiness Score assigned); T050–T052 can be parallelised;
  T053 waits for all three report files.
- The governance gate in T052 (`SAFE_ROLLOUT_PLAN.md`) blocks `STAGE_INFRA_GOVERNANCE` from opening
  until T053 passes.
