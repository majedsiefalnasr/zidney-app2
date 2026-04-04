# Tasks — Stage 44: Plans & Subscriptions

**Stage:** STAGE_44_PLANS_AND_SUBSCRIPTIONS
**Phase:** 03_BACKOFFICE_CORE / 06_COMMERCIAL_LAYER
**Branch:** `spec/044-plans-and-subscriptions`
**Tasks Total:** 24
**Generated:** 2025-01-09

---

## Task Format

```
- [ ] T001 [P] [US1] Description — exact/file/path.ts
```

- `[P]` = can run in parallel with other `[P]` tasks in the same wave
- `[USn]` = user story grouping (omitted for infrastructure tasks)
- Tasks in the same wave with `[P]` may be worked concurrently

---

## Wave 1 — Foundation (all parallel)

- [ ] T001 [P] Create migration 023 file — `apps/api/src/db/tenant/migrations/20260407_023_plans_and_subscriptions.ts`
- [ ] T002 [P] Create plans Drizzle schema — `apps/api/src/db/tenant/schemas/plans.schema.ts`
- [ ] T003 [P] Create subscriptions Drizzle schema — `apps/api/src/db/tenant/schemas/subscriptions.schema.ts`
- [ ] T004 [P] Update RBAC PermissionModule (add PLANS, SUBSCRIPTIONS) — `packages/domain-core/src/rbac/rbac.types.ts`

> T002 and T003 depend on T001 DDL being stable (types align). T004 has no dependencies.

---

## Wave 2 — Schema barrel (sequential after T002+T003)

- [ ] T005 Update tenant schema barrel to export new schemas — `apps/api/src/db/tenant/schemas/index.ts`

---

## Wave 3 — Domain types + errors (all parallel, no inter-dependencies)

- [ ] T006 [P] Create plans domain types — `packages/domain-core/src/plans/plans.types.ts`
- [ ] T007 [P] Create plans domain errors — `packages/domain-core/src/plans/plans.errors.ts`
- [ ] T008 [P] Create subscriptions domain types — `packages/domain-core/src/subscriptions/subscriptions.types.ts`
- [ ] T009 [P] Create subscriptions domain errors — `packages/domain-core/src/subscriptions/subscriptions.errors.ts`

---

## Wave 4 — Repositories (plans and subscriptions can run in parallel)

- [ ] T010 [P] [US1] Create plans repository (listPlans, getPlan, insertPlan, updatePlan, softDeletePlan, countActiveSubscriptionsByPlanId) — `packages/domain-core/src/plans/plans.repository.ts`
- [ ] T011 [P] [US2] Create subscriptions repository (insertSubscription, getActiveSubscription, getSubscriptionById, listSubscriptions, expireSubscription, cancelSubscription) — `packages/domain-core/src/subscriptions/subscriptions.repository.ts`

---

## Wave 5 — Services + unit tests (plans and subscriptions can run in parallel)

- [ ] T012 [P] [US1] Create plans service (createPlan, updatePlan, deletePlan, getPlanById, listPlans, toPlanRecord) + unit tests — `packages/domain-core/src/plans/plans.service.ts`, `packages/domain-core/src/plans/__tests__/plans.service.test.ts`
- [ ] T013 [P] [US2] Create subscriptions service (activateSubscription with SERIALIZABLE tx + student sync, cancelSubscription with student sync, toCancelledResult) + unit tests — `packages/domain-core/src/subscriptions/subscriptions.service.ts`, `packages/domain-core/src/subscriptions/__tests__/subscriptions.service.test.ts`

---

## Wave 6 — Domain barrels (all parallel)

- [ ] T014 [P] Create plans domain barrel — `packages/domain-core/src/plans/index.ts`
- [ ] T015 [P] Create subscriptions domain barrel — `packages/domain-core/src/subscriptions/index.ts`

---

## Wave 7 — Domain-core root barrel + validation schemas (all parallel)

- [ ] T016 [P] Update domain-core root barrel (export _ as plans, export _ as subscriptions) — `packages/domain-core/src/index.ts`
- [ ] T017 [P] Create plans validation schemas (planIdParamsSchema, createPlanBodySchema, updatePlanBodySchema) — `packages/validation/src/backoffice/plans.schemas.ts`
- [ ] T018 [P] Create subscriptions validation schemas (subscriptionIdParamsSchema, createSubscriptionBodySchema, listSubscriptionsQuerySchema) — `packages/validation/src/backoffice/subscriptions.schemas.ts`

---

## Wave 8 — Validation barrel (after T017+T018)

- [ ] T019 Update validation backoffice barrel (export plans + subscriptions schemas) — `packages/validation/src/backoffice/index.ts`

---

## Wave 9 — Route handlers (plans and subscriptions can run in parallel)

- [ ] T020 [P] [US1] Create plans route helpers and all 5 handler files (list-plans, create-plan, get-plan, update-plan, delete-plan) — `apps/api/src/routes/backoffice/plans/helpers.ts`, `apps/api/src/routes/backoffice/plans/list-plans.ts`, `apps/api/src/routes/backoffice/plans/create-plan.ts`, `apps/api/src/routes/backoffice/plans/get-plan.ts`, `apps/api/src/routes/backoffice/plans/update-plan.ts`, `apps/api/src/routes/backoffice/plans/delete-plan.ts`
- [ ] T021 [P] [US2] Create subscriptions route helpers and all 4 handler files (list-subscriptions, create-subscription, get-subscription, cancel-subscription) — `apps/api/src/routes/backoffice/subscriptions/helpers.ts`, `apps/api/src/routes/backoffice/subscriptions/list-subscriptions.ts`, `apps/api/src/routes/backoffice/subscriptions/create-subscription.ts`, `apps/api/src/routes/backoffice/subscriptions/get-subscription.ts`, `apps/api/src/routes/backoffice/subscriptions/cancel-subscription.ts`

---

## Wave 10 — Router indexes (plans and subscriptions can run in parallel)

- [ ] T022 [P] [US1] Create plans router index with all 5 routes (GET, POST, DELETE/:id, GET/:id, PATCH/:id ordered to avoid :id collision) — `apps/api/src/routes/backoffice/plans/index.ts`
- [ ] T023 [P] [US2] Create subscriptions router index with all 4 routes (GET, POST, PATCH/:id/cancel, GET/:id ordered to avoid :id collision) — `apps/api/src/routes/backoffice/subscriptions/index.ts`

---

## Wave 11 — Middleware + app.ts mounting (sequential)

- [ ] T024 Create subscription-enforcement.ts middleware (DO NOT MOUNT — created for future Stage 45+) — `apps/api/src/middleware/subscription-enforcement.ts`

---

## Wave 12 — App mounting (sequential, all routers must exist)

- [ ] T025 Mount plansRouter and subscriptionsRouter in app.ts (after studentsRouter, before end of backoffice block) — `apps/api/src/app.ts`

---

## Wave 13 — Integration tests (plans and subscriptions can run in parallel)

- [ ] T026 [P] [US1] Create plans integration tests (8 test cases: create, validate error, list, get, 404, update, delete, 409 w/active subs) — `apps/api/src/routes/backoffice/plans/__tests__/plans.integration.test.ts`
- [ ] T027 [P] [US2] Create subscriptions integration tests (7 test cases: activate, 409 duplicate, prev expired, list filter, get, cancel, cancel 404) — `apps/api/src/routes/backoffice/subscriptions/__tests__/subscriptions.integration.test.ts`

---

## Summary

| Wave | Parallel?       | Tasks     | Layer                                   |
| ---- | --------------- | --------- | --------------------------------------- |
| 1    | ✅ All parallel | T001–T004 | Foundation: migration + schemas + RBAC  |
| 2    | ❌ Sequential   | T005      | Schema barrel                           |
| 3    | ✅ All parallel | T006–T009 | Domain types + errors                   |
| 4    | T010 ∥ T011     | T010–T011 | Repositories                            |
| 5    | T012 ∥ T013     | T012–T013 | Services + unit tests                   |
| 6    | ✅ All parallel | T014–T015 | Domain barrels                          |
| 7    | ✅ All parallel | T016–T018 | Domain-core barrel + validation schemas |
| 8    | ❌ Sequential   | T019      | Validation barrel                       |
| 9    | T020 ∥ T021     | T020–T021 | Route handlers                          |
| 10   | T022 ∥ T023     | T022–T023 | Router indexes                          |
| 11   | ❌ Sequential   | T024      | Middleware (unregistered)               |
| 12   | ❌ Sequential   | T025      | app.ts mount                            |
| 13   | T026 ∥ T027     | T026–T027 | Integration tests                       |

**Total tasks: 27** (T001–T027)

---

## Key Constraints

1. **T001 must exist before T002/T003** — schemas reference table DDL concepts
2. **T005–T009 before T010–T013** — repositories and services import types
3. **T014–T015 before T016** — domain-core barrel needs both sub-barrels
4. **T017–T018 before T019** — validation barrel needs both schema files
5. **T010–T013 + T017–T018 before T020–T021** — handlers import domain functions and validation
6. **T020–T021 before T022–T023** — router indexes import handler functions
7. **T022–T023 before T025** — app.ts needs routers to exist
8. **T024 (middleware)** — created independently; NOT imported/mounted in T025

## Architecture Notes

- `payment_method` is hard-coded to `'MANUAL'` in `activateSubscription` — NOT in the API body schema
- `SubscriptionState` lives in `subscriptions.types.ts` — DISTINCT from `SubscriptionStatus` in `students.types.ts`
- Student status sync (`UPDATE students SET subscription_status`) happens inside the same transaction as subscription write
- unique partial index `idx_subscriptions_active_per_student ON subscriptions(student_id) WHERE status = 'ACTIVE'` is the DB-level guard
- `activateSubscription` uses `SERIALIZABLE` isolation to prevent concurrent dual-activation race
- `started_at` defaults to server `NOW()` if not provided by client — never used as security boundary
