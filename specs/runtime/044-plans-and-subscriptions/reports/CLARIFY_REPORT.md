# CLARIFY REPORT — Stage 44: Plans & Subscriptions

**Stage:** STAGE_44_PLANS_AND_SUBSCRIPTIONS
**Phase:** 03_BACKOFFICE_CORE / 06_COMMERCIAL_LAYER
**Step:** 2 — Clarify
**Completed:** 2025-01-09
**Orchestrator:** Hard Mode Workflow (Autopilot)

---

## Summary

9 clarification questions were resolved in this step. All ambiguities have been addressed.
No `[NEEDS CLARIFICATION]` markers remain in spec.md.
The clarifications section has been appended directly to `specs/runtime/044-plans-and-subscriptions/spec.md`.

---

## Clarifications Resolved

### C-01 — Route Mounting Correction

**Finding:** The original spec listed `apps/api/src/routes/backoffice/index.ts` as a modified file. Investigation confirmed this file does not exist.

**Resolution:** The correct mount point is `apps/api/src/app.ts`, where all backoffice routers are registered with `app.route('/api/v1/backoffice/workspace', router)`. The spec's Modified Files section has been corrected accordingly.

**Impact:** Plans router and subscriptions router will be imported and mounted in `app.ts` following the exact same pattern as `studentsRouter` (Stage 42). No new index file is needed.

---

### C-02 — Frontoffice API Route Layer Does Not Exist

**Finding:** The spec listed `apps/api/src/routes/frontoffice/index.ts` as a modified file. This directory does not exist. The frontoffice is a Vue 3 SPA (`apps/frontoffice/`), not an API route collection.

**Resolution:**

- Remove `apps/api/src/routes/frontoffice/index.ts` from scope entirely.
- The `subscription-enforcement.ts` middleware will be created in `apps/api/src/middleware/` but NOT mounted on any route in Stage 44.
- No `app.use('/api/v1/frontoffice/*', subscriptionEnforcementMiddleware)` will be added in Stage 44.
- The middleware is fully implemented and ready for future mounting in Stage 45+ when student API routes are introduced.

**Risk:** Low — creating the middleware without mounting it is safe and sets up the foundation for Stage 45.

---

### C-03 — SubscriptionStatus Enum Reconciliation

**Finding:** Stage 42 defines `students.subscription_status` with enum values `'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'NONE'`. Stage 44 subscriptions table uses `'ACTIVE' | 'EXPIRED' | 'CANCELED' | 'PENDING'`. These are two distinct enums governing different tables.

**Resolution:**

- `students.subscription_status` retains its Stage 42 constraint unchanged.
- `subscriptions.status` uses its own Stage 44 constraint.
- New type alias `SubscriptionState` (in subscriptions.types.ts) represents the subscriptions-table values.
- Sync mapping: `ACTIVE→ACTIVE`, `EXPIRED→EXPIRED`, `CANCELED→NONE`, `PENDING→NONE`.
- `SUSPENDED` is a student-level flag set by admin (not related to subscriptions in Stage 44).

**Impact:** No migration change to students table needed. Sync logic is in `subscriptions.service.ts`.

---

### C-04 — Validation Schema File Pattern

**Finding:** The validation package uses `packages/validation/src/backoffice/*.schemas.ts` pattern (not a flat file at root).

**Resolution:**

- New files: `backoffice/plans.schemas.ts` and `backoffice/subscriptions.schemas.ts`
- The `backoffice/index.ts` barrel re-exports both.
- Root `packages/validation/src/index.ts` does not require direct editing (it already re-exports from `backoffice/index.ts`).

---

### C-05 — Payment Gateway and Auto-Renew Deferred

**Finding:** FR-05 (gateway activation) and FR-07 (auto-renew job queue) have no gateway integration in the current codebase.

**Resolution:**

- FR-05 deferred. `payment_method`, `gateway_ref` columns created at DB level only.
- FR-07 deferred. `auto_renew` column created at DB level but treated as inactive metadata.
- Only `payment_method = 'MANUAL'` is supported in Stage 44.
- A future stage will add the renewal worker job.

---

### C-06 — Module Access Enforcement (FR-08) Partially Deferred

**Finding:** Backend per-route module enforcement requires student-facing API routes that do not yet exist.

**Resolution:**

- `checkModuleAccess()` service function is implemented in Stage 44.
- Per-route enforcement is deferred to Stage 45+.
- `enabled_modules` data is persisted and returned correctly by plans/subscriptions APIs.

---

### C-07 — Students Drizzle Schema Unchanged

**Finding:** `students.schema.ts` already has `subscription_status` column from Stage 42. No changes needed.

**Resolution:** Subscription state sync uses raw SQL `UPDATE students` within transactions in the service layer. No Drizzle schema file modifications needed.

---

### C-08 — New RBAC Permission Modules Required

**Finding:** No existing `PermissionModule` key covers plans or subscriptions management.

**Resolution:**

- Add `PLANS` and `SUBSCRIPTIONS` entries to `packages/domain-core/src/rbac/rbac.types.ts`.
- Route handlers apply `createPermissionGuard(PermissionModule.PLANS, 'can_create')` etc.
- This is an additive change (no existing RBAC logic modified).

---

### C-09 — Schema Version Unchanged

**Finding:** Schema version middleware validates minimum tenant DB version. Migration 023 increments the version naturally.

**Resolution:** No changes to `schemaVersionMiddleware` constants needed. The migration itself is the version signal.

---

## Scope Boundary (Final)

### In Scope (Stage 44)

| Item                                                                       | Status      |
| -------------------------------------------------------------------------- | ----------- |
| Migration 023 (plans + subscriptions tables)                               | ✅ In scope |
| Drizzle schemas (plans.schema.ts, subscriptions.schema.ts)                 | ✅ In scope |
| Domain: packages/domain-core/src/plans/                                    | ✅ In scope |
| Domain: packages/domain-core/src/subscriptions/                            | ✅ In scope |
| Backoffice routes: 5 plan routes + 4 subscription routes                   | ✅ In scope |
| Validation schemas (backoffice/plans.schemas.ts, subscriptions.schemas.ts) | ✅ In scope |
| subscription-enforcement.ts middleware (created, not mounted)              | ✅ In scope |
| RBAC: Add PLANS + SUBSCRIPTIONS to PermissionModule                        | ✅ In scope |
| Sync students.subscription_status within transactions                      | ✅ In scope |
| Integration tests (plans + subscriptions routes)                           | ✅ In scope |
| Unit tests (service layer)                                                 | ✅ In scope |

### Out of Scope (Deferred)

| Item                                                        | Reason                                     |
| ----------------------------------------------------------- | ------------------------------------------ |
| Gateway callback handler (FR-05)                            | No payment gateway integration in codebase |
| Auto-renew worker job (FR-07)                               | Worker job deferred to future stage        |
| Module access enforcement on student routes (FR-08 applied) | Student API routes don't exist yet         |
| Subscription middleware mounting                            | No frontoffice student API route group yet |
| apps/api/src/routes/frontoffice/ directory                  | Does not exist; out of scope               |

---

## Governance Checks

| Check                                                              | Status                                                      |
| ------------------------------------------------------------------ | ----------------------------------------------------------- |
| All clarifications encode concrete resolutions (no open questions) | ✅ PASS                                                     |
| No new architecture changes introduced                             | ✅ PASS — only additive (new domain modules, new RBAC keys) |
| Tenant isolation maintained                                        | ✅ PASS — all data scoped by workspace_id                   |
| ADR-0001 (no cross-tenant)                                         | ✅ PASS                                                     |
| ADR-0003 (forward-only migrations)                                 | ✅ PASS                                                     |
| ADR-0006 (server-authoritative time)                               | ✅ PASS                                                     |
| No new external dependencies required                              | ✅ PASS                                                     |

---

## Next Step

Proceed to **Step 3 — Plan** (speckit.plan).
All ambiguities are resolved and planning is authorized.
