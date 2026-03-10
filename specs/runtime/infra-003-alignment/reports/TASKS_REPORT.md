# TASKS REPORT — STAGE_INFRA_03_ALIGNMENT

**Step:** 4 — Tasks **Stage:** STAGE_INFRA_03_ALIGNMENT **Phase:** 01_PLATFORM_FOUNDATION
**Branch:** `infra-003-alignment` **Date:** 2026-03-04 **Agent:** speckit.tasks

---

## Tasks Summary

**Total Tasks: 72**

All tasks are atomic, dependency-ordered, and execution-ready. Tasks are numbered T001–T072
sequentially across all phases.

---

## Phase Breakdown

| Phase                            | Tasks     | Count  | Description                                                                           |
| -------------------------------- | --------- | ------ | ------------------------------------------------------------------------------------- |
| 1 — Vitest Consolidation         | T001–T015 | 15     | Root config rewrite, 4 existing config modifications, 9 new configs, scripts update   |
| 2 — Test Directory Normalization | T016–T027 | 12     | 10 `.gitkeep` files for missing dirs, 2 investigation tasks                           |
| 3 — Playwright                   | T028–T038 | 11     | Install dep, 3 configs, 4 smoke tests, Vitest exclusion, scripts                      |
| 4 — ESLint/Prettier              | T039–T043 | 5      | Install 2 packages, prettier config, `.prettierignore`, eslint update, format scripts |
| 5 — Flaky Test Stabilization     | T044–T047 | 4      | Investigate and fix/quarantine 2 flaky test files                                     |
| 6 — Skipped Test Review          | T048–T057 | 10     | Review one skip file per task; T053 serial (also removes vitest exclude)              |
| 7 — README Creation              | T058–T070 | 13     | 11 new READMEs + 2 rewrites; all parallel [P]                                         |
| 8 — CI Pipeline                  | T071–T072 | 2      | `.github/workflows/ci.yml` + dev scripts                                              |
| **Total**                        |           | **72** |                                                                                       |

---

## Key Sequencing Decisions

| Decision                        | Reason                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| T001 serial before T002–T014    | Root config must be in projects mode before per-app configs are stripped              |
| Phase 2 before Phase 3          | E2E directories must exist before Playwright smoke tests are authored                 |
| T028 (install) before T029–T034 | `@playwright/test` types needed for config/test files                                 |
| T053 serial in Phase 6          | `DataTable.spec.ts` requires also removing entry from `vitest.config.ts` exclude list |
| Phase 8 last                    | CI YAML references scripts only added in Phases 1, 3, 4                               |

---

## Parallel Task Groups

| Group                             | Tasks                  | Phase   |
| --------------------------------- | ---------------------- | ------- |
| Config strip (parallel)           | T002, T003, T004, T005 | Phase 1 |
| New config creation (parallel)    | T006–T014              | Phase 1 |
| E2E directory creation (parallel) | T016–T025              | Phase 2 |
| Playwright configs (parallel)     | T029, T030, T031       | Phase 3 |
| Playwright smoke tests (parallel) | T032, T033, T034       | Phase 3 |
| README creation (parallel)        | T058–T070              | Phase 7 |

---

## Files Covered by Tasks

**Created by tasks:** 54 files **Modified by tasks:** 24 files

See [plan.md Complete File Inventory](../plan.md) for the full list.

---

## Validation Checklist Coverage

| Validation                          | Tasks     |
| ----------------------------------- | --------- |
| V001 — Vitest Consolidation         | T001–T015 |
| V002 — Test Architecture Compliance | T016–T027 |
| V003 — Playwright Installation      | T028–T038 |
| V004 — ESLint + Prettier Alignment  | T039–T043 |
| V005 — Skipped Tests Audit          | T048–T057 |
| V006 — Flaky Test Stabilization     | T044–T047 |
| V007 — README Coverage              | T058–T070 |
| V008 — CI Capability Verification   | T071–T072 |

All 8 validation criteria from `STAGE_INFRA_03_ALIGNMENT.md §12` are covered by tasks.

---

## Next Step

Proceed to **Step 5 — Analyze** (Drift Detector) to validate all artifacts before implementation is
authorized.
