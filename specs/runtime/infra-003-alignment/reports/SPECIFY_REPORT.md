# SPECIFY REPORT — STAGE_INFRA_03_ALIGNMENT

**Step:** 1 — Specify **Stage:** STAGE_INFRA_03_ALIGNMENT **Phase:** 01_PLATFORM_FOUNDATION
**Branch:** `infra-003-alignment` **Date:** 2026-03-04 **Agent:** speckit.specify

---

## Specification Summary

The specification for **Infrastructure & Governance Alignment** has been generated from the stage
design file (`STAGE_INFRA_03_ALIGNMENT.md`). This stage prepares the Zidney monorepo for governance
enforcement by aligning test infrastructure, tooling, and documentation — without modifying any
business logic or tenant database.

---

## Scope Defined

**In Scope:**

- Consolidate fragmented Vitest configuration into a single root `vitest.config.ts` using projects
- Normalize test directory structure (`tests/unit/`, `tests/integration/`, `tests/e2e/`) across all
  apps and packages
- Install Playwright and create per-app configs for MMC, Backoffice, Frontoffice
- Create shared E2E smoke test at `tests/e2e/app-load.spec.ts`
- Align ESLint + Prettier (install `prettier`, `eslint-config-prettier`; add `format`/`format:check`
  scripts)
- Stabilize or quarantine flaky tests
- Review and document all skipped tests
- Add README files to all `apps/*` and `packages/*` directories
- Prepare CI pipeline to support lint, type-check, unit, integration, and E2E test stages

**Out of Scope:**

- Coverage threshold enforcement (deferred to STAGE_INFRA_GOVERNANCE)
- Husky hooks (deferred to STAGE_INFRA_GOVERNANCE)
- Any tenant database changes, migrations, or schema modifications
- License middleware changes
- Attempt engine modifications
- Production bundle changes
- Business logic changes

---

## Requirements Summary

| Category                    | Count | Notes                                        |
| --------------------------- | ----- | -------------------------------------------- |
| Functional Requirements     | 39    | Across 8 tasks (T001–T008)                   |
| Non-Functional Requirements | 8     | Backward compat, no prod bundle impact, etc. |
| User Stories                | 8     | P1–P3 priorities                             |
| Acceptance Scenarios        | 28+   | Verifiable conditions per story              |

### User Stories

| ID  | Priority | Title                                                   |
| --- | -------- | ------------------------------------------------------- |
| US1 | P1       | Developer can run all tests from repo root              |
| US2 | P2       | Developer can run E2E tests for UI apps                 |
| US3 | P2       | Engineer formats code without ESLint/Prettier conflicts |
| US4 | P2       | Flaky/skipped tests are identified and documented       |
| US5 | P3       | Every app/package has a README                          |
| US6 | P2       | CI is prepared to run all test stages                   |
| US7 | P2       | Coverage baseline is collected                          |
| US8 | P3       | Test environment isolation is correct per module        |

---

## Clarification Status

**No [NEEDS CLARIFICATION] markers required.** The stage specification was complete and unambiguous.
All assumptions are documented in the spec's Assumptions section.

**Key assumptions encoded into spec:**

1. Playwright smoke tests target the dev server (not a production build)
2. Existing per-app Vitest configs may remain as project-level overrides (not deleted)
3. The `tests/e2e/` directory at repo root is for shared/cross-app E2E tests only
4. Flaky test quarantine uses `// QUARANTINE: <reason>` comment convention
5. CI changes are preparation only — no enforcement gates activated in this stage

---

## Constitutional Compliance

| Rule                  | Status        | Notes                    |
| --------------------- | ------------- | ------------------------ |
| Database-per-tenant   | ✅ Unaffected | No DB changes            |
| License middleware    | ✅ Unaffected | No route changes         |
| Attempt engine        | ✅ Unaffected | No grading logic changes |
| No cross-tenant joins | ✅ Unaffected | No new data access paths |
| Worker integrity      | ✅ Unaffected | No job changes           |
| Import boundary rules | ✅ Compliant  | Infrastructure only      |
| UI system rules       | ✅ Compliant  | No UI component changes  |

---

## Outputs

| File                                                           | Status                 |
| -------------------------------------------------------------- | ---------------------- |
| `specs/runtime/infra-003-alignment/spec.md`                    | ✅ Created (322 lines) |
| `specs/runtime/infra-003-alignment/checklists/requirements.md` | ✅ Created (90 lines)  |

---

## Next Step

Proceed to **Step 2 — Clarify** to perform an ambiguity scan and ask up to 5 targeted questions.
