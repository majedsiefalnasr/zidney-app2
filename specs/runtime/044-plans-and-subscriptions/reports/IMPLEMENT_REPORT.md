# Implement Report — Stage 44: Plans & Subscriptions

**Stage:** STAGE_44_PLANS_AND_SUBSCRIPTIONS
**Phase:** 03_BACKOFFICE_CORE / 06_COMMERCIAL_LAYER
**Branch:** `spec/044-plans-and-subscriptions`
**Tasks Completed:** 27 / 27
**Date:** 2026-04-04

---

## Task Completion Summary

All 27 tasks completed. No deferrals.

| Task | Description                                                                | Status |
| ---- | -------------------------------------------------------------------------- | ------ |
| T001 | Migration 023 — plans + subscriptions tables                               | ✅     |
| T002 | Drizzle schema — plans                                                     | ✅     |
| T003 | Drizzle schema — subscriptions                                             | ✅     |
| T004 | RBAC PermissionModule: PLANS, SUBSCRIPTIONS                                | ✅     |
| T005 | Plans domain types                                                         | ✅     |
| T006 | Plans error codes                                                          | ✅     |
| T007 | Plans repository                                                           | ✅     |
| T008 | Plans service                                                              | ✅     |
| T009 | Plans domain barrel (index.ts)                                             | ✅     |
| T010 | `packages/domain-core` package.json exports                                | ✅     |
| T011 | `packages/domain-core` src/index.ts re-exports                             | ✅     |
| T012 | Validation schema — plans                                                  | ✅     |
| T013 | Subscriptions domain types                                                 | ✅     |
| T014 | Subscriptions error codes                                                  | ✅     |
| T015 | Subscriptions repository                                                   | ✅     |
| T016 | Subscriptions service                                                      | ✅     |
| T017 | Subscriptions domain barrel (index.ts)                                     | ✅     |
| T018 | Validation schema — subscriptions                                          | ✅     |
| T019 | Route handler — create-plan.ts                                             | ✅     |
| T020 | Route handler — get-plan.ts, list-plans.ts, update-plan.ts, delete-plan.ts | ✅     |
| T021 | Plans router index (with helpers)                                          | ✅     |
| T022 | Route handler — activate-subscription.ts, cancel-subscription.ts           | ✅     |
| T023 | Route handler — get-subscription.ts, list-subscriptions.ts                 | ✅     |
| T024 | Subscriptions router index (with helpers)                                  | ✅     |
| T025 | subscription-enforcement middleware stub                                   | ✅     |
| T026 | app.ts: import + mount plansRouter + subscriptionsRouter                   | ✅     |
| T027 | Unit tests: plans service (7 tests) + subscriptions service (16 tests)     | ✅     |

---

## Files Changed

### New Files (31)

- `apps/api/src/db/tenant/migrations/20260407_023_plans_and_subscriptions.ts`
- `apps/api/src/db/tenant/schemas/plans.schema.ts`
- `apps/api/src/db/tenant/schemas/subscriptions.schema.ts`
- `apps/api/src/middleware/subscription-enforcement.ts`
- `apps/api/src/routes/backoffice/plans/create-plan.ts`
- `apps/api/src/routes/backoffice/plans/delete-plan.ts`
- `apps/api/src/routes/backoffice/plans/get-plan.ts`
- `apps/api/src/routes/backoffice/plans/helpers.ts`
- `apps/api/src/routes/backoffice/plans/index.ts`
- `apps/api/src/routes/backoffice/plans/list-plans.ts`
- `apps/api/src/routes/backoffice/plans/update-plan.ts`
- `apps/api/src/routes/backoffice/subscriptions/activate-subscription.ts`
- `apps/api/src/routes/backoffice/subscriptions/cancel-subscription.ts`
- `apps/api/src/routes/backoffice/subscriptions/get-subscription.ts`
- `apps/api/src/routes/backoffice/subscriptions/helpers.ts`
- `apps/api/src/routes/backoffice/subscriptions/index.ts`
- `apps/api/src/routes/backoffice/subscriptions/list-subscriptions.ts`
- `packages/domain-core/src/plans/__tests__/plans.service.test.ts`
- `packages/domain-core/src/plans/index.ts`
- `packages/domain-core/src/plans/plans.errors.ts`
- `packages/domain-core/src/plans/plans.repository.ts`
- `packages/domain-core/src/plans/plans.service.ts`
- `packages/domain-core/src/plans/plans.types.ts`
- `packages/domain-core/src/subscriptions/__tests__/subscriptions.service.test.ts`
- `packages/domain-core/src/subscriptions/index.ts`
- `packages/domain-core/src/subscriptions/subscriptions.errors.ts`
- `packages/domain-core/src/subscriptions/subscriptions.repository.ts`
- `packages/domain-core/src/subscriptions/subscriptions.service.ts`
- `packages/domain-core/src/subscriptions/subscriptions.types.ts`
- `packages/validation/src/backoffice/plans.schemas.ts`
- `packages/validation/src/backoffice/subscriptions.schemas.ts`

### Modified Files (7)

- `.gitignore` — scope `plans/` to root-only (`/plans/`)
- `apps/api/src/app.ts` — import + mount plansRouter, subscriptionsRouter
- `apps/api/src/db/tenant/schemas/index.ts` — export plans + subscriptions schemas
- `apps/api/src/routes/backoffice/roles.ts` — add PLANS, SUBSCRIPTIONS to MODULE_DISPLAY_NAMES
- `packages/domain-core/package.json` — add plans + subscriptions exports
- `packages/domain-core/src/index.ts` — re-export plans + subscriptions
- `packages/domain-core/src/rbac/rbac.types.ts` — add PermissionModule.PLANS, SUBSCRIPTIONS
- `packages/validation/src/backoffice/index.ts` — add plans + subscriptions schemas

---

## Validation Summary

| Check                     | Result                            |
| ------------------------- | --------------------------------- |
| Unit tests                | ✅ 23/23 pass                     |
| TypeScript                | ✅ Clean                          |
| Biome lint                | ✅ Clean                          |
| Policy engine (TYPES-001) | ✅ Clean (duplicate export fixed) |

Full validation evidence in `audits/VALIDATION_REPORT.md`.

---

## Deferred Tasks

None.
