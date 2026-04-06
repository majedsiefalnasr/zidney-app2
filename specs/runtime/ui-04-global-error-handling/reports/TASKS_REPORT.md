# Tasks Report: Global Error Boundary & Normalization Layer

**Stage**: STAGE_UI_04_GLOBAL_ERROR_HANDLING
**Phase**: 06_UI_APPLICATION_RUNTIME
**Generated**: 2026-04-06T00:40:00.000Z
**Total Tasks**: 32

---

## Task Breakdown

| Phase                                          | Tasks     | Parallelizable                  |
| ---------------------------------------------- | --------- | ------------------------------- |
| Phase 0 — Shared package (packages/api-client) | T001–T002 | No (sequential gate)            |
| Phase 1 — MMC implementation                   | T003–T008 | No (within-group sequential)    |
| Phase 1 — Backoffice implementation            | T009–T014 | Yes [P] — parallel with Group 3 |
| Phase 1 — Frontoffice implementation           | T015–T020 | Yes [P] — parallel with Group 2 |
| Phase 2 — All unit tests                       | T021–T032 | Yes [P] — all 12 parallel       |
| **Total**                                      | **32**    | —                               |

---

## Risk-Ranked Task Summary

| Task ID   | Risk      | Description                                                                              |
| --------- | --------- | ---------------------------------------------------------------------------------------- |
| T001      | 🔴 HIGH   | Add ErrorCodes + mapHttpStatusToCode — `packages/api-client/src/http-error.ts`           |
| T002      | 🔴 HIGH   | Export mapHttpStatusToCode + normalizeResponseError — `packages/api-client/src/index.ts` |
| T003      | 🔴 HIGH   | Replace error-normalizer.ts + delete types.ts — `apps/mmc`                               |
| T009      | 🔴 HIGH   | Replace error-normalizer.ts + delete types.ts — `apps/backoffice`                        |
| T015      | 🔴 HIGH   | Replace error-normalizer.ts + delete types.ts — `apps/frontoffice`                       |
| T004      | 🟡 MEDIUM | Create redact-error.ts — `apps/mmc/src/core/errors/redact-error.ts`                      |
| T005      | 🟡 MEDIUM | Create ErrorBoundary.vue — `apps/mmc/src/core/errors/ErrorBoundary.vue`                  |
| T006      | 🟡 MEDIUM | Create global-error-handler.ts — `apps/mmc/src/core/errors/global-error-handler.ts`      |
| T010–T012 | 🟡 MEDIUM | redact-error, ErrorBoundary, global-error-handler — `apps/backoffice`                    |
| T016–T018 | 🟡 MEDIUM | redact-error, ErrorBoundary, global-error-handler — `apps/frontoffice`                   |
| T007–T008 | 🟢 LOW    | App.vue + main.ts bootstrap Step 8.5 — `apps/mmc`                                        |
| T013–T014 | 🟢 LOW    | App.vue + main.ts bootstrap Step 8.5 — `apps/backoffice`                                 |
| T019–T020 | 🟢 LOW    | App.vue + main.ts bootstrap Step 8.5 — `apps/frontoffice`                                |
| T021–T032 | 🟢 LOW    | Unit test suites (test-only, no production impact)                                       |

---

## Tasks with External Dependencies

| Task ID    | Package                                | Verified Against                               |
| ---------- | -------------------------------------- | ---------------------------------------------- |
| T001, T002 | `@zidney/api-client` (internal)        | existing http-error.ts exports confirmed       |
| T003–T020  | `@zidney/api-client`, `@zidney/logger` | plan.md AD-1, AD-3                             |
| T021–T032  | `vitest`, `@vue/test-utils`            | existing vitest.config.ts, vitest.workspace.ts |

---

## High-Downstream-Impact Tasks

These tasks modify architectural hotspots — extra review attention recommended.

| Task ID          | Module              | Impact | Description                                                         |
| ---------------- | ------------------- | ------ | ------------------------------------------------------------------- |
| T001             | packages/api-client | HIGH   | ErrorCodes is used across all 3 apps + API interceptors             |
| T002             | packages/api-client | HIGH   | Barrel export changes affect all downstream imports                 |
| T003, T009, T015 | apps/\*/core/errors | HIGH   | Atomic delete+replace — broken state = cascading typecheck failures |

---

## Dependency Graph

```
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008
                ↓ (T002 unblocks)
              T009 [P] → T010 [P] → T011 [P] → T012 [P] → T013 [P] → T014 [P]
              T015 [P] → T016 [P] → T017 [P] → T018 [P] → T019 [P] → T020 [P]
                                    ↓ (T008 + T014 + T020 complete)
              T021–T032 all [P] (12 test files — fully parallel)
```

---

## Verification Summary

- Tasks are atomic (one file or closely coupled file pair per task)
- No task spans multiple unrelated files
- Parallel groups correctly identified (cross-app independence leveraged)
- User story labels aligned with spec.md US1–US10
- All 38 files in plan.md change matrix covered
- High-risk tasks (T001–T003, T009, T015) explicitly flagged for extra attention
