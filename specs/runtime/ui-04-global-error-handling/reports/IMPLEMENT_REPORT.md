# Implement Report — STAGE_UI_04_GLOBAL_ERROR_HANDLING

**Stage:** GLOBAL ERROR HANDLING — Error Boundary & Normalization Layer  
**Branch:** `spec/ui-04-global-error-handling`  
**Implementation Date:** 2026-04-06  
**Tasks Completed:** 32 / 32  
**Status:** ✅ BACKEND CLOSED

---

## Implementation Summary

All 32 tasks from `tasks.md` were completed. A shared error handling layer was built and deployed identically across three frontend apps (MMC, Backoffice, Frontoffice).

---

## Tasks Completed

### Foundation — packages/api-client

| Task | Description                                               | File                                    |
| ---- | --------------------------------------------------------- | --------------------------------------- |
| T001 | Add `AppError` type, `ErrorCodes` enum                    | `packages/api-client/src/types.ts`      |
| T002 | Add `createAppError`, `isAppError`, `mapHttpStatusToCode` | `packages/api-client/src/http-error.ts` |
| T003 | Add `normalizeError` — handles all 7 error branch paths   | `packages/api-client/src/http-error.ts` |
| T004 | Add `normalizeResponseError` for AdapterResponse shape    | `packages/api-client/src/http-error.ts` |
| T005 | Export all error utilities from package index             | `packages/api-client/src/index.ts`      |

### MMC App

| Task | Description                                                              | File                                                              |
| ---- | ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| T006 | Delete legacy `types.ts` (removes `NormalizedError`)                     | `apps/mmc/src/core/errors/types.ts` (deleted)                     |
| T007 | Update `error-normalizer.ts` to use `AppError` from `@zidney/api-client` | `apps/mmc/src/core/errors/error-normalizer.ts`                    |
| T008 | Add `redact-error.ts`                                                    | `apps/mmc/src/core/errors/redact-error.ts`                        |
| T009 | Add `ErrorBoundary.vue`                                                  | `apps/mmc/src/core/errors/ErrorBoundary.vue`                      |
| T010 | Add `global-error-handler.ts`                                            | `apps/mmc/src/core/errors/global-error-handler.ts`                |
| T011 | Wire `ErrorBoundary` into `App.vue`                                      | `apps/mmc/src/App.vue`                                            |
| T012 | Register `appLogger` + `isProduction` in `main.ts`                       | `apps/mmc/src/main.ts`                                            |
| T013 | Spec: `error-normalizer.spec.ts`                                         | `apps/mmc/src/core/errors/__tests__/error-normalizer.spec.ts`     |
| T014 | Spec: `redact-error.spec.ts`                                             | `apps/mmc/src/core/errors/__tests__/redact-error.spec.ts`         |
| T015 | Spec: `global-error-handler.spec.ts`                                     | `apps/mmc/src/core/errors/__tests__/global-error-handler.spec.ts` |
| T016 | Spec: `ErrorBoundary.spec.ts`                                            | `apps/mmc/src/core/errors/__tests__/ErrorBoundary.spec.ts`        |

### Backoffice App

| Task | Description                          | File                                                                     |
| ---- | ------------------------------------ | ------------------------------------------------------------------------ |
| T017 | Delete legacy `types.ts`             | `apps/backoffice/src/core/errors/types.ts` (deleted)                     |
| T018 | Update `error-normalizer.ts`         | `apps/backoffice/src/core/errors/error-normalizer.ts`                    |
| T019 | Add `redact-error.ts`                | `apps/backoffice/src/core/errors/redact-error.ts`                        |
| T020 | Add `ErrorBoundary.vue`              | `apps/backoffice/src/core/errors/ErrorBoundary.vue`                      |
| T021 | Add `global-error-handler.ts`        | `apps/backoffice/src/core/errors/global-error-handler.ts`                |
| T022 | Wire `ErrorBoundary` into `App.vue`  | `apps/backoffice/src/App.vue`                                            |
| T023 | Register providers in `main.ts`      | `apps/backoffice/src/main.ts`                                            |
| T024 | Spec: `error-normalizer.spec.ts`     | `apps/backoffice/src/core/errors/__tests__/error-normalizer.spec.ts`     |
| T025 | Spec: `redact-error.spec.ts`         | `apps/backoffice/src/core/errors/__tests__/redact-error.spec.ts`         |
| T026 | Spec: `global-error-handler.spec.ts` | `apps/backoffice/src/core/errors/__tests__/global-error-handler.spec.ts` |
| T027 | Spec: `ErrorBoundary.spec.ts`        | `apps/backoffice/src/core/errors/__tests__/ErrorBoundary.spec.ts`        |

### Frontoffice App

| Task | Description                          | File                                                                      |
| ---- | ------------------------------------ | ------------------------------------------------------------------------- |
| T028 | Delete legacy `types.ts`             | `apps/frontoffice/src/core/errors/types.ts` (deleted)                     |
| T029 | Update `error-normalizer.ts`         | `apps/frontoffice/src/core/errors/error-normalizer.ts`                    |
| T030 | Add `redact-error.ts`                | `apps/frontoffice/src/core/errors/redact-error.ts`                        |
| T031 | Add `ErrorBoundary.vue`              | `apps/frontoffice/src/core/errors/ErrorBoundary.vue`                      |
| T032 | Add `global-error-handler.ts`        | `apps/frontoffice/src/core/errors/global-error-handler.ts`                |
| T033 | Wire `ErrorBoundary` into `App.vue`  | `apps/frontoffice/src/App.vue`                                            |
| T034 | Register providers in `main.ts`      | `apps/frontoffice/src/main.ts`                                            |
| T035 | Spec: `error-normalizer.spec.ts`     | `apps/frontoffice/src/core/errors/__tests__/error-normalizer.spec.ts`     |
| T036 | Spec: `redact-error.spec.ts`         | `apps/frontoffice/src/core/errors/__tests__/redact-error.spec.ts`         |
| T037 | Spec: `global-error-handler.spec.ts` | `apps/frontoffice/src/core/errors/__tests__/global-error-handler.spec.ts` |
| T038 | Spec: `ErrorBoundary.spec.ts`        | `apps/frontoffice/src/core/errors/__tests__/ErrorBoundary.spec.ts`        |

---

## Deferred Tasks

None. All 32 tasks completed.

---

## Files Changed

### New Files Created (21)

- `apps/{mmc,backoffice,frontoffice}/src/core/errors/ErrorBoundary.vue` (×3)
- `apps/{mmc,backoffice,frontoffice}/src/core/errors/redact-error.ts` (×3)
- `apps/{mmc,backoffice,frontoffice}/src/core/errors/global-error-handler.ts` (×3)
- `apps/{mmc,backoffice,frontoffice}/src/core/errors/__tests__/error-normalizer.spec.ts` (×3)
- `apps/{mmc,backoffice,frontoffice}/src/core/errors/__tests__/redact-error.spec.ts` (×3)
- `apps/{mmc,backoffice,frontoffice}/src/core/errors/__tests__/global-error-handler.spec.ts` (×3)
- `apps/{mmc,backoffice,frontoffice}/src/core/errors/__tests__/ErrorBoundary.spec.ts` (×3)

### Files Modified (11)

- `packages/api-client/src/http-error.ts` — AppError foundations
- `packages/api-client/src/index.ts` — re-export error utilities
- `apps/{mmc,backoffice,frontoffice}/src/core/errors/error-normalizer.ts` (×3) — AppError migration
- `apps/{mmc,backoffice,frontoffice}/src/App.vue` (×3) — ErrorBoundary wired in
- `apps/{mmc,backoffice,frontoffice}/src/main.ts` (×3) — providers registered

### Files Deleted (3)

- `apps/mmc/src/core/errors/types.ts`
- `apps/backoffice/src/core/errors/types.ts`
- `apps/frontoffice/src/core/errors/types.ts`

### Legacy Tests Updated (6)

- `apps/{mmc,backoffice,frontoffice}/tests/unit/core/error-normalizer.test.ts` (×3) — updated for AppError shape
- `apps/{mmc,backoffice,frontoffice}/tests/integration/app-layout.integration.test.ts` (×3) — added `useRouter` mock

---

## Validation Summary

Full evidence: `audits/VALIDATION_REPORT.md`

| Check                        | Result  |
| ---------------------------- | ------- |
| Tests (105 files, 894 tests) | ✅ PASS |
| Lint (apps/packages clean)   | ✅ PASS |
| TypeScript (src + tests)     | ✅ PASS |
| AI Guard (1830/1830)         | ✅ PASS |
| Architecture Audit (100/100) | ✅ PASS |

---

## Architecture Compliance

- ✅ Import boundary respected: `apps/* → packages/*` only (no cross-app imports)
- ✅ `AppError` type lives in `packages/api-client` (single source of truth)
- ✅ No business logic in UI layer — error modules contain only normalization/display
- ✅ No DB imports or env vars in frontend error modules
- ✅ Logger injected via `app.provide` — no direct imports in UI components
