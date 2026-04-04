# Analyze Report — Stage 44: Plans & Subscriptions

**Stage:** STAGE_44_PLANS_AND_SUBSCRIPTIONS
**Phase:** 03_BACKOFFICE_CORE / 06_COMMERCIAL_LAYER
**Branch:** `spec/044-plans-and-subscriptions`
**Report Date:** 2025-01-09
**Attempt:** 1

---

## Final Gate Verdict

**✅ APPROVED — Implementation AUTHORIZED**

All 12 mandatory drift criteria pass. Two low-severity warnings are logged but do not block.

---

## Structural Drift Audit

### Criteria Evaluation

| #   | Criterion                                         | Verdict | Evidence                                                                                                                                                                                                                         |
| --- | ------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Tenant isolation                                  | ✅ PASS | All plan/subscription queries include `WHERE workspace_id = $N`. `workspace_id` sourced exclusively from tenant context (`c.get('tenant')`), never from request body                                                             |
| 2   | License middleware                                | ✅ PASS | All routes mount under `/api/v1/backoffice/workspace/*` which has `tenantResolver → licenseEnforcementMiddleware → schemaVersionMiddleware → rateLimiter → validateJwtMiddleware` applied at `app.ts` middleware chain           |
| 3   | Authentication enforcement                        | ✅ PASS | Same `validateJwtMiddleware()` chain covers all backoffice routes — no bypass path                                                                                                                                               |
| 4   | Transaction boundaries                            | ✅ PASS | `activateSubscription`: SERIALIZABLE (concurrent dual-activation race prevented). `cancelSubscription`: READ COMMITTED (single-student update, no concurrent conflict). `createPlan`/`deletePlan`: explicit transactions present |
| 5   | Student status sync atomicity                     | ✅ PASS | `UPDATE students SET subscription_status = $1 WHERE id = $2` is issued within the SAME transaction as subscription write. Commit/rollback preserves consistency                                                                  |
| 6   | Server-authoritative time                         | ✅ PASS | `expires_at = SELECT NOW() + INTERVAL '$N days'` computed in DB, not from client. `started_at` defaults to server `NOW()` if client omits it                                                                                     |
| 7   | No client-authoritative time as security boundary | ✅ PASS | Client-supplied `started_at` is validated ISO string used as informational metadata only; `expires_at` is always DB-computed from plan duration                                                                                  |
| 8   | Import boundary compliance                        | ✅ PASS | `packages/domain-core/plans/` and `subscriptions/` contain pure functions only — no HTTP, no framework imports. API handlers import domain functions via `packages/domain-core` (never reversed)                                 |
| 9   | Error contract                                    | ✅ PASS | All handlers return `{ success, data, error: { code, message } }` envelope. Domain errors mapped to HTTP status via `PLAN_ERROR_HTTP` and `SUBSCRIPTION_ERROR_HTTP` maps                                                         |
| 10  | Unique subscription constraint                    | ✅ PASS | `CREATE UNIQUE INDEX idx_subscriptions_active_per_student ON subscriptions(student_id) WHERE status = 'ACTIVE'` in migration 023 — DB-level guard. Service-level check (`getActiveSubscription`) is defense-in-depth             |
| 11  | Forward-only migration                            | ✅ PASS | Migration 023 uses `CREATE TABLE IF NOT EXISTS`, `BEGIN/COMMIT/ROLLBACK` pattern. Follows and does not modify migration 022                                                                                                      |
| 12  | Spec → Plan → Tasks traceability                  | ✅ PASS | All FR-01 through FR-04, FR-09, FR-10 mapped to tasks. Deferred items (FR-05, FR-07, FR-08) explicitly logged in tasks.md deferred scope section                                                                                 |

---

## Warnings (Non-Blocking)

### ⚠️ W-01 — deletePlan: count-check without explicit transaction lock

**Severity:** Low  
**Location:** `plans.service.ts` → `deletePlan`

**Issue:** The pattern `countActiveSubscriptionsByPlanId(client, planId)` → check count → `softDeletePlan()` has a TOCTOU window. A concurrent subscription activation could run between the count check and the soft-delete, resulting in a subscription referencing a soft-deleted plan.

**Why it is not blocking:** The `ON DELETE RESTRICT` FK prevents hard deletion. Soft delete (`is_deleted = TRUE`) leaves the row accessible — subscriptions can still reference it. The plan record is readable and the subscription remains valid. Data integrity is preserved.

**Recommendation:** Wrap the two queries in a single READ COMMITTED transaction to tighten the window. Acceptable to defer if follow-up stage adds a transaction wrapper.

---

### ⚠️ W-02 — No serialization failure retry in activateSubscription

**Severity:** Low  
**Location:** `subscriptions.service.ts` → `activateSubscription`

**Issue:** PostgreSQL can throw `40001 serialization_failure` under SERIALIZABLE isolation when two transactions conflict. The service has no retry loop, so a serialization failure surfaces as a 500 to the client.

**Why it is not blocking:** This is standard SERIALIZABLE behavior. The unique partial index (`idx_subscriptions_active_per_student`) prevents duplicate active subscriptions at the DB level — the serialization failure is the second line of defense. Clients can retry on 500. Consistent with the existing `createStudent` SERIALIZABLE pattern in Stage 42 (no retry loop either).

**Recommendation:** Log serialization failures with a distinct error code (`SUBSCRIPTION_ACTIVATION_CONFLICT`) for observability. Retry loop is optional enhancement.

---

## Spec → Plan Alignment

| Spec Requirement               | Plan Coverage                                      | Tasks                             | Status            |
| ------------------------------ | -------------------------------------------------- | --------------------------------- | ----------------- |
| FR-01 Plan Creation            | Phase 4 plans routes, Phase 2.1.4 service          | T006–T009, T012, T017, T020, T022 | ✅                |
| FR-02 Plan Edit                | `updatePlan` service + PATCH route                 | T012, T020, T022                  | ✅                |
| FR-03 Plan Soft Delete (guard) | `deletePlan` with `countActiveSubscriptions` guard | T010, T012, T020, T022            | ✅                |
| FR-04 Manual Activation        | `activateSubscription` SERIALIZABLE tx             | T011, T013, T021, T023            | ✅                |
| FR-05 Gateway Activation       | Deferred (C-05)                                    | —                                 | ✅ Deferred       |
| FR-06 Expiration Enforcement   | subscription-enforcement.ts (created not mounted)  | T024                              | ✅ Deferred mount |
| FR-07 Auto-Renew               | Deferred                                           | —                                 | ✅ Deferred       |
| FR-08 Module Access            | Deferred                                           | —                                 | ✅ Deferred       |
| FR-09 Student Status Sync      | Atomic in activation/cancel transactions           | T013                              | ✅                |
| FR-10 Reporting (list filter)  | listSubscriptions with student_id/status filter    | T011, T013, T018, T021, T023      | ✅                |

---

## Guardian Audit Summary

### Architecture Compliance

- ADR-0001 Database-per-tenant: ✅ workspace_id in all plan queries; subscriptions via student pool context
- ADR-0003 Forward-only migrations: ✅ migration 023, CREATE TABLE IF NOT EXISTS
- ADR-0006 Server-authoritative time: ✅ expires_at from DB NOW() + interval
- ADR-0007 Version compatibility: ✅ no breaking changes to existing schemas
- ADR-0008 Semantic versioning: ✅ no new package versions introduced

### Security Review

- RBAC per route: ✅ `createPermissionGuard(logger, PermissionModule.PLANS/SUBSCRIPTIONS, 'can_*')` on every route
- Input validation gate: ✅ Zod schemas on all request bodies and query params
- Tenant isolation enforced at query layer: ✅ workspace_id in all plan queries
- No business logic in route handlers: ✅ handlers delegate to domain functions
- No stack traces to client: ✅ error handler maps to standard envelope

### Performance Review

- plans: query index on `(workspace_id) WHERE is_deleted = FALSE` ✅
- subscriptions: index on `(student_id)`, `(plan_id)`, `(expires_at) WHERE status='ACTIVE'` ✅
- Pagination: listPlans / listSubscriptions use `LIMIT/OFFSET` with capped max=100 ✅

### QA Review

- Unit tests defined: plans.service.test.ts (T012), subscriptions.service.test.ts (T013) ✅
- Integration tests defined: plans (T026), subscriptions (T027) ✅
- Race condition covered: serialization test + unique index test in T027 ✅
- Deferred tests noted in test plan ✅

---

## Implementation Authorization

```
drift_passed = true
implementation_allowed = true
```

All tasks T001–T027 may proceed. Parallelism as documented in tasks.md waves 1–13.
