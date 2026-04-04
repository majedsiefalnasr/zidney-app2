# PR Summary — Stage 44: Plans & Subscriptions

## Title

`feat(backoffice): plans and subscriptions commercial layer (Stage 44)`

## Branch

`spec/044-plans-and-subscriptions` → `develop`

---

## What This PR Delivers

This PR implements the full **plans and subscriptions commercial layer** for the Zidney backoffice. It covers the database schema, domain logic, API routes, validation, and RBAC integration for plan management and subscription lifecycle management.

---

## Changes

### Database

- **Migration 023** (`apps/api/src/db/tenant/migrations/20260407_023_plans_and_subscriptions.ts`): Creates `plans` and `subscriptions` tables with foreign keys, unique constraints, and partial indexes. Forward-only, no rollback destructive SQL.

### ORM

- Drizzle schemas: `plans.schema.ts`, `subscriptions.schema.ts` (tenant DB)
- `schemas/index.ts` updated to export both

### RBAC

- `packages/domain-core/src/rbac/rbac.types.ts`: `PermissionModule.PLANS`, `PermissionModule.SUBSCRIPTIONS`
- `apps/api/src/routes/backoffice/roles.ts`: `MODULE_DISPLAY_NAMES` entries for both modules

### Domain — Plans (`packages/domain-core/src/plans/`)

- `plans.types.ts` — `PlanRecord`, `CreatePlanInput`, `UpdatePlanInput`, `PlanListQuery`, `PlanListResult`, shared `DbClient`/`TransactionClient` interfaces
- `plans.errors.ts` — `PlanErrorCode`: `PLAN_NOT_FOUND`, `PLAN_HAS_ACTIVE_SUBSCRIPTIONS`
- `plans.repository.ts` — raw-SQL: `insertPlan`, `findPlanById`, `updatePlan`, `softDeletePlan`, `listPlans`, `countActiveSubscriptionsByPlanId`
- `plans.service.ts` — `createPlan`, `getPlanById`, `listPlansService`, `updatePlanService`, `deletePlanService` (soft-delete with active-subscription guard)

### Domain — Subscriptions (`packages/domain-core/src/subscriptions/`)

- `subscriptions.types.ts` — `SubscriptionRecord`, `CreateSubscriptionInput`, `SubscriptionListQuery`, `SubscriptionListResult`, `SubscriptionState`
- `subscriptions.errors.ts` — `SubscriptionErrorCode`: `SUBSCRIPTION_NOT_FOUND`, `SUBSCRIPTION_CANNOT_CANCEL`, `PLAN_NOT_FOUND`, `PLAN_INACTIVE`
- `subscriptions.repository.ts` — raw-SQL: `insertSubscription`, `findSubscriptionById`, `findActiveSubscriptionByStudent`, `expireSubscription`, `cancelSubscription`, `syncStudentSubscriptionStatus`, `listSubscriptions`, `countSubscriptions`
- `subscriptions.service.ts` — `activateSubscription` (SERIALIZABLE tx + student sync), `getSubscriptionById`, `listSubscriptionsService`, `cancelSubscriptionService`

### Validation (`packages/validation/src/backoffice/`)

- `plans.schemas.ts` — Zod: `createPlanSchema`, `updatePlanSchema`, `planParamsSchema`, `planListQuerySchema`
- `subscriptions.schemas.ts` — Zod: `createSubscriptionSchema`, `subscriptionParamsSchema`, `cancelSubscriptionSchema`, `subscriptionListQuerySchema`

### API Routes (`apps/api/src/routes/backoffice/`)

- **Plans** (5 routes): `POST /plans`, `GET /plans`, `GET /plans/:id`, `PATCH /plans/:id`, `DELETE /plans/:id`
- **Subscriptions** (4 routes): `POST /subscriptions`, `GET /subscriptions`, `GET /subscriptions/:id`, `POST /subscriptions/:id/cancel`
- Both routers mounted in `apps/api/src/app.ts`

### Middleware

- `subscription-enforcement.ts` — stub only, not mounted (activation deferred to Stage 45)

### Tests

- `plans/__tests__/plans.service.test.ts` — 7 service-layer unit tests
- `subscriptions/__tests__/subscriptions.service.test.ts` — 16 service-layer unit tests
- **23/23 tests pass**

### Infra

- `.gitignore` — scoped `plans/` pattern to root-only to unblock source tracking

---

## Key Design Decisions

| Decision                                          | Rationale                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| SERIALIZABLE isolation for `activateSubscription` | Prevents double-activation race; existing ACTIVE/PENDING subscription is expired first atomically |
| Soft-delete for plans                             | Preserves referential integrity; hard-delete blocked by PLAN_HAS_ACTIVE_SUBSCRIPTIONS guard       |
| Student status sync within transaction            | Keeps `students.subscription_status` consistent without a separate job                            |
| Enforcement middleware not mounted                | Intentional stub — mounting and enforcement logic scoped to Stage 45                              |

---

## Test Instructions

See [guides/TESTING_GUIDE.md](./guides/TESTING_GUIDE.md) for full manual test scenarios.

Quick automated check:

```bash
bun run test packages/domain-core/src/plans/__tests__/plans.service.test.ts
bun run test packages/domain-core/src/subscriptions/__tests__/subscriptions.service.test.ts
```

---

## Checklist

- [x] Migration is forward-only
- [x] All queries scoped by `workspace_id` (tenant isolation)
- [x] No business logic in route handlers
- [x] All writes transactional
- [x] RBAC guards applied to all routes
- [x] Validation with Zod on all inputs
- [x] Error contract `{ success, data, error }` on all responses
- [x] Structured logging with correlation ID
- [x] TypeScript clean
- [x] Biome lint clean
- [x] 23/23 unit tests pass
- [x] Policy engine TYPES-001 clean
