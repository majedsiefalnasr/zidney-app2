# Tasks Report — Stage 44: Plans & Subscriptions

**Stage:** STAGE_44_PLANS_AND_SUBSCRIPTIONS
**Phase:** 03_BACKOFFICE_CORE / 06_COMMERCIAL_LAYER
**Branch:** `spec/044-plans-and-subscriptions`
**Report Date:** 2025-01-09
**Tasks Total:** 27 (T001–T027)

---

## Summary

27 atomic tasks organized across 13 execution waves. Plans and subscriptions domain tasks are parallelized throughout. Foundation tasks (migration, Drizzle schemas, RBAC) go first to unblock all downstream work.

---

## Full Task List

| ID   | Wave | Parallel  | Layer             | Description                               | File(s)                                                                                                        |
| ---- | ---- | --------- | ----------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| T001 | 1    | ✅        | Foundation        | Migration 023 file                        | `apps/api/src/db/tenant/migrations/20260407_023_plans_and_subscriptions.ts`                                    |
| T002 | 1    | ✅        | Foundation        | plans Drizzle schema                      | `apps/api/src/db/tenant/schemas/plans.schema.ts`                                                               |
| T003 | 1    | ✅        | Foundation        | subscriptions Drizzle schema              | `apps/api/src/db/tenant/schemas/subscriptions.schema.ts`                                                       |
| T004 | 1    | ✅        | Foundation        | RBAC PermissionModule                     | `packages/domain-core/src/rbac/rbac.types.ts`                                                                  |
| T005 | 2    | ❌        | Schema barrel     | Tenant schema barrel                      | `apps/api/src/db/tenant/schemas/index.ts`                                                                      |
| T006 | 3    | ✅        | Domain types      | plans.types.ts                            | `packages/domain-core/src/plans/plans.types.ts`                                                                |
| T007 | 3    | ✅        | Domain errors     | plans.errors.ts                           | `packages/domain-core/src/plans/plans.errors.ts`                                                               |
| T008 | 3    | ✅        | Domain types      | subscriptions.types.ts                    | `packages/domain-core/src/subscriptions/subscriptions.types.ts`                                                |
| T009 | 3    | ✅        | Domain errors     | subscriptions.errors.ts                   | `packages/domain-core/src/subscriptions/subscriptions.errors.ts`                                               |
| T010 | 4    | T010∥T011 | Repository        | plans.repository.ts                       | `packages/domain-core/src/plans/plans.repository.ts`                                                           |
| T011 | 4    | T010∥T011 | Repository        | subscriptions.repository.ts               | `packages/domain-core/src/subscriptions/subscriptions.repository.ts`                                           |
| T012 | 5    | T012∥T013 | Service           | plans.service.ts + unit tests             | `packages/domain-core/src/plans/plans.service.ts`, `…/__tests__/plans.service.test.ts`                         |
| T013 | 5    | T012∥T013 | Service           | subscriptions.service.ts + unit tests     | `packages/domain-core/src/subscriptions/subscriptions.service.ts`, `…/__tests__/subscriptions.service.test.ts` |
| T014 | 6    | ✅        | Domain barrel     | plans/index.ts                            | `packages/domain-core/src/plans/index.ts`                                                                      |
| T015 | 6    | ✅        | Domain barrel     | subscriptions/index.ts                    | `packages/domain-core/src/subscriptions/index.ts`                                                              |
| T016 | 7    | ✅        | Root barrel       | domain-core index update                  | `packages/domain-core/src/index.ts`                                                                            |
| T017 | 7    | ✅        | Validation        | plans.schemas.ts                          | `packages/validation/src/backoffice/plans.schemas.ts`                                                          |
| T018 | 7    | ✅        | Validation        | subscriptions.schemas.ts                  | `packages/validation/src/backoffice/subscriptions.schemas.ts`                                                  |
| T019 | 8    | ❌        | Validation barrel | validation backoffice barrel              | `packages/validation/src/backoffice/index.ts`                                                                  |
| T020 | 9    | T020∥T021 | Route handlers    | plans helpers + 5 handlers                | `apps/api/src/routes/backoffice/plans/helpers.ts` + 5 handler files                                            |
| T021 | 9    | T020∥T021 | Route handlers    | subscriptions helpers + 4 handlers        | `apps/api/src/routes/backoffice/subscriptions/helpers.ts` + 4 handler files                                    |
| T022 | 10   | T022∥T023 | Router index      | plans router index                        | `apps/api/src/routes/backoffice/plans/index.ts`                                                                |
| T023 | 10   | T022∥T023 | Router index      | subscriptions router index                | `apps/api/src/routes/backoffice/subscriptions/index.ts`                                                        |
| T024 | 11   | ❌        | Middleware        | subscription-enforcement.ts (not mounted) | `apps/api/src/middleware/subscription-enforcement.ts`                                                          |
| T025 | 12   | ❌        | App mount         | Mount plans + subscriptions routers       | `apps/api/src/app.ts`                                                                                          |
| T026 | 13   | T026∥T027 | Integration tests | Plans integration tests (8 cases)         | `apps/api/src/routes/backoffice/plans/__tests__/plans.integration.test.ts`                                     |
| T027 | 13   | T026∥T027 | Integration tests | Subscriptions integration tests (7 cases) | `apps/api/src/routes/backoffice/subscriptions/__tests__/subscriptions.integration.test.ts`                     |

---

## Risk-Ranked Task Summary

| Task ID | Risk      | Description                                                              |
| ------- | --------- | ------------------------------------------------------------------------ |
| T001    | 🔴 HIGH   | Database migration 023 — creates plans and subscriptions tables          |
| T013    | 🔴 HIGH   | activateSubscription with SERIALIZABLE transaction + student status sync |
| T004    | 🟡 MEDIUM | RBAC PermissionModule enum change — may affect permission checks         |
| T010    | 🟡 MEDIUM | Raw SQL repository for plans (workspace-scoped)                          |
| T011    | 🟡 MEDIUM | Raw SQL repository for subscriptions (student-scoped writes)             |
| T012    | 🟡 MEDIUM | Plans service with active-subscription guard on delete                   |
| T022    | 🟡 MEDIUM | Plans router index — route ordering critical (avoid :id collision)       |
| T023    | 🟡 MEDIUM | Subscriptions router index — `/:id/cancel` must precede `/:id`           |
| T025    | 🟡 MEDIUM | app.ts route mounting — must not break existing routes                   |
| T002    | 🟢 LOW    | Drizzle schema (type-only, no query execution)                           |
| T003    | 🟢 LOW    | Drizzle schema (type-only, no query execution)                           |
| T005    | 🟢 LOW    | Schema barrel update                                                     |
| T006    | 🟢 LOW    | plans.types.ts — pure types                                              |
| T007    | 🟢 LOW    | plans.errors.ts — pure class                                             |
| T008    | 🟢 LOW    | subscriptions.types.ts — pure types                                      |
| T009    | 🟢 LOW    | subscriptions.errors.ts — pure class                                     |
| T014    | 🟢 LOW    | plans/index.ts barrel                                                    |
| T015    | 🟢 LOW    | subscriptions/index.ts barrel                                            |
| T016    | 🟢 LOW    | domain-core barrel update                                                |
| T017    | 🟢 LOW    | plans.schemas.ts — pure Zod                                              |
| T018    | 🟢 LOW    | subscriptions.schemas.ts — pure Zod                                      |
| T019    | 🟢 LOW    | Validation barrel update                                                 |
| T020    | 🟢 LOW    | Plans route handler files                                                |
| T021    | 🟢 LOW    | Subscriptions route handler files                                        |
| T024    | 🟢 LOW    | subscription-enforcement.ts (not mounted — no blast radius)              |
| T026    | 🟢 LOW    | Integration tests (test-only)                                            |
| T027    | 🟢 LOW    | Integration tests (test-only)                                            |

---

## Tasks with External Dependencies

| Task ID   | Package                           | Version Note                                                                                            |
| --------- | --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| T001      | `pg` (PoolClient)                 | Uses `client.query()` raw SQL pattern — confirmed from migration 022                                    |
| T002      | `drizzle-orm/pg-core`             | Uses `pgTable`, `uuid`, `varchar`, `text`, `boolean`, `timestamp`, `numeric`, `integer`, `check`, `sql` |
| T003      | `drizzle-orm/pg-core`             | Same imports as T002                                                                                    |
| T010–T013 | `pg` (DbClient/TransactionClient) | Repository and service use typed pool/transaction clients from domain-core types                        |
| T017–T018 | `zod`                             | `z.object`, `z.enum`, `z.string().uuid()`, `z.coerce.number()` — standard patterns                      |

---

## High-Downstream-Impact Tasks

These tasks modify architectural hotspots requiring careful review.

| Task ID | Module               | Risk      | Description                                                                  |
| ------- | -------------------- | --------- | ---------------------------------------------------------------------------- |
| T001    | Migration system     | 🔴 HIGH   | Forward-only migration 023 — once committed, DDL is irreversible             |
| T013    | subscriptions domain | 🔴 HIGH   | SERIALIZABLE transaction + student status sync — affects students table      |
| T004    | RBAC                 | 🟡 MEDIUM | PermissionModule enum — ALL backoffice permission checks use this type       |
| T025    | apps/api/src/app.ts  | 🟡 MEDIUM | Route mounting touches the central router — risk of breaking existing routes |

---

## Deferred / Out of Scope

| Feature                           | Reason                                             |
| --------------------------------- | -------------------------------------------------- |
| Payment gateway (FR-05)           | No gateway integration in current codebase         |
| Auto-renew worker (FR-07)         | Deferred to Worker stage                           |
| Module access enforcement (FR-08) | No student API routes yet in Stage 44              |
| subscription-enforcement mount    | No frontoffice student route group yet (Stage 45+) |
| `checkModuleAccess()` enforcement | Created but not applied                            |
