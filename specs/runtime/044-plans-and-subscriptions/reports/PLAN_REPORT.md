# Plan Report — Stage 44: Plans & Subscriptions

**Step:** 3 — Plan
**Date:** 2026-04-04
**Stage:** STAGE_44_PLANS_AND_SUBSCRIPTIONS
**Phase:** 03_BACKOFFICE_CORE / 06_COMMERCIAL_LAYER

---

## Summary

Technical planning for Stage 44 is complete. The plan covers the full B2C subscription layer for Zidney tenant workspaces: database schema, domain modules, API routes, validation schemas, and middleware. All 9 clarifications from Step 2 are reflected in the plan.

---

## Artifacts Produced

| Artifact       | Path                                                      | Status      |
| -------------- | --------------------------------------------------------- | ----------- |
| Technical plan | `specs/runtime/044-plans-and-subscriptions/plan.md`       | ✅ Complete |
| Data model     | `specs/runtime/044-plans-and-subscriptions/data-model.md` | ✅ Complete |

---

## Plan Scope

### New Database Tables

| Table           | Columns    | Indexes                          | Notes                                                      |
| --------------- | ---------- | -------------------------------- | ---------------------------------------------------------- |
| `plans`         | 12 columns | 1 partial B-tree on workspace_id | Tenant-scoped; soft-delete only                            |
| `subscriptions` | 14 columns | 1 unique partial + 3 B-tree      | Unique ACTIVE index enforces single active sub per student |

### New Domain Modules

| Module          | Location                                  | Key Exports                                                                                           |
| --------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `plans`         | `packages/domain-core/src/plans/`         | `createPlan`, `updatePlan`, `deletePlan`, `getPlanById`, `listPlans`, `PlanError`, `PlanRecord`       |
| `subscriptions` | `packages/domain-core/src/subscriptions/` | `activateSubscription` (SERIALIZABLE), `cancelSubscription`, `SubscriptionError`, `SubscriptionState` |

### New API Endpoints (9 total)

| Method | Path                                                    | Module        | Description          |
| ------ | ------------------------------------------------------- | ------------- | -------------------- |
| GET    | `/api/v1/backoffice/workspace/plans`                    | PLANS         | List workspace plans |
| POST   | `/api/v1/backoffice/workspace/plans`                    | PLANS         | Create plan          |
| GET    | `/api/v1/backoffice/workspace/plans/:id`                | PLANS         | Get plan             |
| PATCH  | `/api/v1/backoffice/workspace/plans/:id`                | PLANS         | Update plan          |
| DELETE | `/api/v1/backoffice/workspace/plans/:id`                | PLANS         | Soft-delete plan     |
| GET    | `/api/v1/backoffice/workspace/subscriptions`            | SUBSCRIPTIONS | List subscriptions   |
| POST   | `/api/v1/backoffice/workspace/subscriptions`            | SUBSCRIPTIONS | Manual activation    |
| GET    | `/api/v1/backoffice/workspace/subscriptions/:id`        | SUBSCRIPTIONS | Get subscription     |
| PATCH  | `/api/v1/backoffice/workspace/subscriptions/:id/cancel` | SUBSCRIPTIONS | Cancel subscription  |

### RBAC Module Additions

| Enum Entry                       | Value             | Permission Actions                         |
| -------------------------------- | ----------------- | ------------------------------------------ |
| `PermissionModule.PLANS`         | `'plans'`         | can_view, can_create, can_edit, can_delete |
| `PermissionModule.SUBSCRIPTIONS` | `'subscriptions'` | can_view, can_create, can_edit             |

### New Validation Schemas

| File                                                          | Schemas                                                                                      |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `packages/validation/src/backoffice/plans.schemas.ts`         | `createPlanBodySchema`, `updatePlanBodySchema`, `planIdParamsSchema`                         |
| `packages/validation/src/backoffice/subscriptions.schemas.ts` | `createSubscriptionBodySchema`, `subscriptionIdParamsSchema`, `listSubscriptionsQuerySchema` |

### New Middleware (not mounted)

| File                                                  | Purpose                       | Mounted?                   |
| ----------------------------------------------------- | ----------------------------- | -------------------------- |
| `apps/api/src/middleware/subscription-enforcement.ts` | Frontoffice subscription gate | NO — deferred to Stage 45+ |

---

## Architecture Decisions Made

### Transaction Strategy

- `activateSubscription`: SERIALIZABLE isolation — prevents race condition where two concurrent activations for the same student pass the ACTIVE-check simultaneously before the unique index fires
- `cancelSubscription`: READ COMMITTED — single-student update, row-level lock sufficient
- All subscription state changes atomically sync `students.subscription_status` in the same transaction

### Student Status Sync Model

Two separate enums co-exist:

- `SubscriptionStatus` (Stage 42, students table): `'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'NONE'` — unchanged
- `SubscriptionState` (Stage 44, subscriptions table): `'ACTIVE' | 'EXPIRED' | 'CANCELED' | 'PENDING'` — new

Mapping from subscriptions → students: `CANCELED→NONE`, `PENDING→NONE`, `ACTIVE→ACTIVE`, `EXPIRED→EXPIRED`

### Route Mounting

All routes mount via `app.ts` directly (no `backoffice/index.ts` — pattern confirmed from Stage 42 research).

### Deferred Features (not in Stage 44)

- Gateway payment processing (FR-05) — `payment_method` column exists, handler deferred
- Auto-renew job (FR-07) — `auto_renew` column exists as metadata, renewal logic deferred
- Subscription enforcement mount (FR-06) — middleware created but not mounted

---

## Files to Create / Modify

### New Files (33 total)

| File                                                                                       | Type               |
| ------------------------------------------------------------------------------------------ | ------------------ |
| `apps/api/src/db/tenant/migrations/20260407_023_plans_and_subscriptions.ts`                | Migration          |
| `apps/api/src/db/tenant/schemas/plans.schema.ts`                                           | Drizzle schema     |
| `apps/api/src/db/tenant/schemas/subscriptions.schema.ts`                                   | Drizzle schema     |
| `packages/domain-core/src/plans/plans.types.ts`                                            | Domain types       |
| `packages/domain-core/src/plans/plans.errors.ts`                                           | Domain errors      |
| `packages/domain-core/src/plans/plans.repository.ts`                                       | Domain repository  |
| `packages/domain-core/src/plans/plans.service.ts`                                          | Domain service     |
| `packages/domain-core/src/plans/index.ts`                                                  | Domain barrel      |
| `packages/domain-core/src/plans/__tests__/plans.service.test.ts`                           | Unit tests         |
| `packages/domain-core/src/subscriptions/subscriptions.types.ts`                            | Domain types       |
| `packages/domain-core/src/subscriptions/subscriptions.errors.ts`                           | Domain errors      |
| `packages/domain-core/src/subscriptions/subscriptions.repository.ts`                       | Domain repository  |
| `packages/domain-core/src/subscriptions/subscriptions.service.ts`                          | Domain service     |
| `packages/domain-core/src/subscriptions/index.ts`                                          | Domain barrel      |
| `packages/domain-core/src/subscriptions/__tests__/subscriptions.service.test.ts`           | Unit tests         |
| `packages/validation/src/backoffice/plans.schemas.ts`                                      | Validation schemas |
| `packages/validation/src/backoffice/subscriptions.schemas.ts`                              | Validation schemas |
| `apps/api/src/routes/backoffice/plans/helpers.ts`                                          | Route helpers      |
| `apps/api/src/routes/backoffice/plans/list-plans.ts`                                       | Route handler      |
| `apps/api/src/routes/backoffice/plans/create-plan.ts`                                      | Route handler      |
| `apps/api/src/routes/backoffice/plans/get-plan.ts`                                         | Route handler      |
| `apps/api/src/routes/backoffice/plans/update-plan.ts`                                      | Route handler      |
| `apps/api/src/routes/backoffice/plans/delete-plan.ts`                                      | Route handler      |
| `apps/api/src/routes/backoffice/plans/index.ts`                                            | Router index       |
| `apps/api/src/routes/backoffice/subscriptions/helpers.ts`                                  | Route helpers      |
| `apps/api/src/routes/backoffice/subscriptions/list-subscriptions.ts`                       | Route handler      |
| `apps/api/src/routes/backoffice/subscriptions/create-subscription.ts`                      | Route handler      |
| `apps/api/src/routes/backoffice/subscriptions/get-subscription.ts`                         | Route handler      |
| `apps/api/src/routes/backoffice/subscriptions/cancel-subscription.ts`                      | Route handler      |
| `apps/api/src/routes/backoffice/subscriptions/index.ts`                                    | Router index       |
| `apps/api/src/middleware/subscription-enforcement.ts`                                      | Middleware         |
| `apps/api/src/routes/backoffice/plans/__tests__/plans.integration.test.ts`                 | Integration tests  |
| `apps/api/src/routes/backoffice/subscriptions/__tests__/subscriptions.integration.test.ts` | Integration tests  |

### Modified Files (5 total)

| File                                          | Change                                                     |
| --------------------------------------------- | ---------------------------------------------------------- |
| `apps/api/src/db/tenant/schemas/index.ts`     | Add `plans` and `subscriptions` schema exports             |
| `packages/domain-core/src/rbac/rbac.types.ts` | Add `PLANS` and `SUBSCRIPTIONS` to PermissionModule enum   |
| `packages/domain-core/src/index.ts`           | Add `plans` and `subscriptions` namespace exports          |
| `packages/validation/src/backoffice/index.ts` | Add `plans.schemas` and `subscriptions.schemas` re-exports |
| `apps/api/src/app.ts`                         | Import and mount `plansRouter` and `subscriptionsRouter`   |

---

## Risk Assessment

| Risk                                               | Level  | Mitigation                                                                                         |
| -------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| Concurrent subscription activation race            | HIGH   | SERIALIZABLE isolation + unique partial index (double guard)                                       |
| Student status out of sync with subscription state | MEDIUM | Atomic update in same transaction                                                                  |
| Plans soft-delete breaks existing subscriptions    | MEDIUM | `RESTRICT` FK on plans(id) prevents hard delete; soft-delete blocked if active subscriptions exist |
| Migration affects existing student workloads       | LOW    | Tables created with IF NOT EXISTS; no data modification                                            |

---

## Implementation Order (24 atomic tasks)

Tasks T001–T024 are defined in detail in `tasks.md` (Step 4 output).

Parallel execution opportunities:

- T005–T008 (plans domain) ‖ T014 (plans validation schema)
- T009–T012 (subscriptions domain) ‖ T015 (subscriptions validation schema)
- T017 (plans route handlers) ‖ T019 (subscriptions route handlers) — after domain + validation complete
