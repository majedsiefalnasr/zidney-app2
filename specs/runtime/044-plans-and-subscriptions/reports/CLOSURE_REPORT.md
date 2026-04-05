# Closure Report — Stage 44: Plans & Subscriptions

**Stage:** STAGE_44_PLANS_AND_SUBSCRIPTIONS
**Phase:** 03_BACKOFFICE_CORE / 06_COMMERCIAL_LAYER
**Branch:** `spec/044-plans-and-subscriptions`
**Status:** PRODUCTION READY
**Closure Date:** 2026-04-04
**Tasks:** 27 / 27 completed

---

## Delivery Summary

Stage 44 delivers the **commercial layer** for the Zidney backoffice: plan management (CRUD with soft-delete) and subscription lifecycle (activate, cancel, list, get). All operations are tenant-isolated via `workspace_id`, and student subscription status is atomically synchronized within SERIALIZABLE transactions.

---

## Scope Delivered

| Area                   | Deliverable                                                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Database               | Migration 023 — `plans` + `subscriptions` tables with FK, partial indexes, constraints                                                       |
| ORM                    | Drizzle schemas for plans and subscriptions (tenant DB)                                                                                      |
| RBAC                   | `PermissionModule.PLANS`, `PermissionModule.SUBSCRIPTIONS` + display names in roles.ts                                                       |
| Domain — Plans         | types, errors, repository (rawSQL), service (createPlan, getPlanById, listPlansService, updatePlanService, deletePlanService)                |
| Domain — Subscriptions | types, errors, repository (rawSQL), service (activateSubscription, getSubscriptionById, listSubscriptionsService, cancelSubscriptionService) |
| Validation             | Zod schemas for both domains (backoffice)                                                                                                    |
| API — Plans            | 5 routes: POST, GET, GET all, PATCH, DELETE                                                                                                  |
| API — Subscriptions    | 4 routes: POST (activate), GET, GET all, POST (cancel)                                                                                       |
| Middleware             | `subscription-enforcement.ts` stub (not mounted — future stage)                                                                              |
| Tests                  | 23 unit tests (7 plans service + 16 subscriptions service), all pass                                                                         |

---

## Architecture Governance

| Rule                                 | Status                                                    |
| ------------------------------------ | --------------------------------------------------------- |
| Database-per-tenant (ADR-0001)       | ✅ All queries scoped by workspace_id                     |
| Server-authoritative time (ADR-0006) | ✅ NOW() used in SQL, no client timestamps                |
| Snapshot immutability (ADR-0002)     | N/A                                                       |
| Version compatibility (ADR-0007)     | ✅                                                        |
| Semantic versioning (ADR-0008)       | ✅                                                        |
| Tenant resolver only (no direct DB)  | ✅                                                        |
| All writes transactional             | ✅ SERIALIZABLE for activation; READ COMMITTED for cancel |
| Idempotency (unique constraints)     | ✅ plans.workspace_id+name+is_deleted partial index       |
| Domain purity (no HTTP in packages/) | ✅                                                        |
| Import boundary (apps→packages only) | ✅                                                        |

---

## Key Design Decisions

1. **SERIALIZABLE isolation for `activateSubscription`** — prevents double-activation race condition. Existing ACTIVE/PENDING subscription is expired first before inserting the new one, atomically.

2. **Soft-delete for plans** (`is_deleted = TRUE`) — preserves referential integrity with existing subscriptions. Hard-delete is blocked if active subscriptions exist (PLAN_HAS_ACTIVE_SUBSCRIPTIONS error).

3. **Student status sync** — `subscriptions.service.ts` calls `syncStudentSubscriptionStatus` within the same transaction as subscription mutations to keep `students.subscription_status` consistent.

4. **subscription-enforcement.ts stub** — Created but not mounted. Enforcement logic (license gate, subscription check per route) deferred to Stage 45+.

5. **`PermissionModule.PLANS` / `SUBSCRIPTIONS`** — Added to RBAC enum and roles.ts MODULE_DISPLAY_NAMES so the role-permission-modules endpoint reflects the new modules.

---

## Validation Results

| Check                   | Result                                                              |
| ----------------------- | ------------------------------------------------------------------- |
| Unit tests              | ✅ 23 / 23 passed                                                   |
| TypeScript (src + test) | ✅ Clean                                                            |
| Biome lint              | ✅ Clean (7 auto-fixed)                                             |
| Policy engine TYPES-001 | ✅ Clean (duplicate export removed, MODULE_DISPLAY_NAMES completed) |

---

## Deferred Scope

None. All 27 tasks completed.

---

## Next Stage Dependency

Stage 45: Subscription Enforcement — activates and mounts the `subscription-enforcement.ts` middleware, adds subscription gate to frontoffice/API routes, and implements gateway payment integration.
