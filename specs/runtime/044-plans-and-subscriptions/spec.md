# Stage 44 – Plans & Subscriptions

**Phase:** 3 – Backoffice Core
**Subdomain:** 06_COMMERCIAL_LAYER
**Branch:** `spec/044-plans-and-subscriptions`
**Stage File:** `specs/phases/03_BACKOFFICE_CORE/06_COMMERCIAL_LAYER/STAGE_44_PLANS_AND_SUBSCRIPTIONS.md`

---

## Objective

Implement the complete Plans & Subscriptions system inside each tenant workspace, enabling:

1. **Plan Management** — Backoffice admins can create, edit, disable, and soft-delete sellable plans
2. **Subscription Activation** — Manual admin-driven and gateway-based subscription activation for students
3. **Subscription Enforcement** — Frontoffice middleware validates active subscription on every request
4. **Expiration Logic** — Runtime-checked expiration (no cron-only dependency)
5. **Module Access Control** — Per-plan module enablement enforced in backend and reflected in Frontoffice
6. **Reporting** — Backoffice subscription listing per student, revenue overview

This stage governs B2C (student-facing) access control inside a workspace. B2B license limits are handled in Stage 43.

---

## Architecture Governance Declaration

✅ No cross-tenant access — all reads/writes scoped to `workspace_id` (ADR-0001)
✅ No middleware bypass — subscription enforcement is a dedicated Frontoffice middleware layer
✅ No grading outside Worker — not applicable to this stage
✅ Tenant resolver only — no direct database instantiation
✅ No weakening of snapshot integrity — not applicable to this stage
✅ All writes transactional — plan and subscription creation/updates use transactions
✅ Version compatibility enforced — migrations follow forward-only policy (ADR-0003)
✅ Server-authoritative time — all `expires_at`, `started_at`, `created_at` set from DB `NOW()` (ADR-0006)
✅ No client-authoritative time — client-supplied dates are validated/normalized server-side

---

## Trust Chain Verification

- [x] Tenant isolation is the first gate (slug-based, database-per-tenant)
- [x] License validation occurs before any workspace operation
- [x] Authentication is checked after tenant resolution
- [x] Attempt engine: not applicable
- [x] Runtime enforces server-authoritative time for subscription dates
- [x] Frontoffice receives only presentation data — subscription enforcement produces flags, not raw records

---

## Import Boundary Compliance

- `apps/api` → `packages/domain-core` ✅
- `apps/frontoffice` → `packages/api-client` ✅ (no direct DB imports)
- `packages/domain-core/subscriptions` → `packages/domain-core/students` ✅ (internal cross-domain reference only for type)
- `packages/*` → `apps/*` ❌ FORBIDDEN
- UI → DB schemas ❌ FORBIDDEN

---

## Current State Analysis

### Existing (Stage 42)

The `students` table includes `subscription_status VARCHAR(20)` as a simple flag column:

- Values: `ACTIVE | SUSPENDED | EXPIRED | NONE`
- This is a **direct field on the student record** — not a plan/subscription relationship

There are NO plans or subscriptions tables. The `update-student-subscription.ts` route only updates this status flag.

### What Must Be Built (Stage 44)

| Concern                          | What is Needed                                        |
| -------------------------------- | ----------------------------------------------------- |
| `plans` table                    | New tenant schema table for plan definitions          |
| `subscriptions` table            | New tenant schema table with FK to students and plans |
| Plan CRUD routes                 | Backoffice admin API endpoints                        |
| Manual activation route          | `POST /subscriptions` route                           |
| Expiration middleware            | Runtime enforcement in Frontoffice                    |
| Module access enforcement        | Backend permission gate per plan modules              |
| Student subscription status sync | Keep `students.subscription_status` synchronized      |

---

## Database Schema

### New Table: `plans`

```sql
CREATE TABLE plans (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   VARCHAR(255) NOT NULL,
  name           VARCHAR(255) NOT NULL,
  description    TEXT,
  price          NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  billing_type   VARCHAR(20) NOT NULL DEFAULT 'one-time',  -- 'one-time' | 'recurring'
  duration_days  INTEGER NOT NULL,                          -- plan duration in days
  enabled_modules JSONB NOT NULL DEFAULT '[]',              -- array of module keys
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted     BOOLEAN NOT NULL DEFAULT FALSE,            -- soft-delete only
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_plans_workspace ON plans(workspace_id) WHERE is_deleted = FALSE;
```

Constraints:

- `billing_type IN ('one-time', 'recurring')`
- `duration_days > 0`
- `price >= 0`

### New Table: `subscriptions`

```sql
CREATE TABLE subscriptions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  plan_id        UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  status         VARCHAR(20) NOT NULL DEFAULT 'PENDING',   -- 'ACTIVE' | 'EXPIRED' | 'CANCELED' | 'PENDING'
  started_at     TIMESTAMPTZ NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL,
  auto_renew     BOOLEAN NOT NULL DEFAULT FALSE,
  payment_method VARCHAR(20) NOT NULL DEFAULT 'MANUAL',    -- 'MANUAL' | 'GATEWAY'
  gateway_ref    VARCHAR(255),                             -- external payment reference
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_subscriptions_active_per_student
  ON subscriptions(student_id)
  WHERE status = 'ACTIVE';

CREATE INDEX idx_subscriptions_student ON subscriptions(student_id);
CREATE INDEX idx_subscriptions_plan ON subscriptions(plan_id);
CREATE INDEX idx_subscriptions_expires ON subscriptions(expires_at) WHERE status = 'ACTIVE';
```

Constraints:

- `status IN ('ACTIVE', 'EXPIRED', 'CANCELED', 'PENDING')`
- `payment_method IN ('MANUAL', 'GATEWAY')`
- `expires_at > started_at`
- Unique partial index enforces at most ONE ACTIVE subscription per student

---

## Migration Strategy

**Migration number:** 023 (follows 20260406_022_student_management.ts)
**File:** `apps/api/src/db/tenant/migrations/20260407_023_plans_and_subscriptions.ts`

Steps:

1. Create `plans` table with indexes and constraints
2. Create `subscriptions` table with indexes and constraints
3. No data backfill needed — existing `students.subscription_status` is a simple flag and is not migrated

---

## Domain Modules

### New: `packages/domain-core/src/plans/`

```
plans.types.ts        — Pure types: PlanRow, PlanInput, PlanUpdateInput
plans.repository.ts   — listPlans, getPlan, createPlan, updatePlan, softDeletePlan
plans.service.ts      — Business logic: validatePlan, canDeletePlan, getActivePlans
plans.errors.ts       — Error codes: PLAN_NOT_FOUND, PLAN_HAS_ACTIVE_SUBSCRIPTIONS, etc.
index.ts              — Public exports
```

### New: `packages/domain-core/src/subscriptions/`

```
subscriptions.types.ts        — Pure types: SubscriptionRow, SubscriptionInput
subscriptions.repository.ts   — createSubscription, getActiveSubscription, listStudentSubscriptions, expireSubscriptions
subscriptions.service.ts      — activateSubscription, cancelSubscription, checkSubscriptionAccess, syncStudentStatus
subscriptions.errors.ts       — Error codes: SUBSCRIPTION_NOT_FOUND, STUDENT_ALREADY_HAS_ACTIVE_SUBSCRIPTION, etc.
index.ts                       — Public exports
```

---

## API Endpoints

### Plans (Backoffice — Admin only)

| Method | Path                    | Handler        | Description                                              |
| ------ | ----------------------- | -------------- | -------------------------------------------------------- |
| GET    | `/backoffice/plans`     | list-plans.ts  | List all active plans in workspace                       |
| POST   | `/backoffice/plans`     | create-plan.ts | Create a new plan                                        |
| GET    | `/backoffice/plans/:id` | get-plan.ts    | Get plan by ID                                           |
| PATCH  | `/backoffice/plans/:id` | update-plan.ts | Update plan name/price/config                            |
| DELETE | `/backoffice/plans/:id` | delete-plan.ts | Soft-delete plan (blocked if active subscriptions exist) |

### Subscriptions (Backoffice — Admin only)

| Method | Path                                   | Handler                | Description                                        |
| ------ | -------------------------------------- | ---------------------- | -------------------------------------------------- |
| GET    | `/backoffice/subscriptions`            | list-subscriptions.ts  | List subscriptions (filterable by student, status) |
| POST   | `/backoffice/subscriptions`            | create-subscription.ts | Manual activation                                  |
| GET    | `/backoffice/subscriptions/:id`        | get-subscription.ts    | Get subscription details                           |
| PATCH  | `/backoffice/subscriptions/:id/cancel` | cancel-subscription.ts | Cancel subscription                                |

### Subscription Access (Frontoffice middleware)

- `subscriptionEnforcement` middleware in `apps/api/src/middleware/subscription-enforcement.ts`
- Runs on all `frontoffice` routes that require access control
- Returns `subscription_required` flag with safe allow-list (profile, certificates, payment page)

---

## Functional Requirements

### FR-01 — Plan Creation

Backoffice admin can create a plan:

- name, description, price, billing_type, duration_days, enabled_modules
- Plan stored per workspace — no cross-tenant access
- Validation: name required, duration_days > 0, price >= 0
- enabled_modules must be a JSON array of valid module keys

### FR-02 — Plan Edit

Admin can update plan name, description, price, billing_type, duration_days, enabled_modules, is_active.
Edits do NOT affect existing active subscriptions (plan is referenced by ID; edit is non-destructive).

### FR-03 — Plan Soft Delete

Admin can soft-delete a plan (`is_deleted = TRUE`).
**Hard blocked** if ANY active subscription references the plan.
**Allowed** with soft-delete if only historical (EXPIRED/CANCELED) subscriptions exist.

### FR-04 — Manual Subscription Activation

Admin selects student + plan + start date (or defaults to NOW()).
System:

- Validates no existing ACTIVE subscription for that student (unique partial index enforces this)
- If another ACTIVE subscription exists → expire it first (set status = 'EXPIRED', update `students.subscription_status`)
- Create new subscription record: status=ACTIVE, expires_at = started_at + plan.duration_days
- Update `students.subscription_status = 'ACTIVE'`
- All writes in a single SERIALIZABLE transaction

### FR-05 — Gateway Subscription Activation

Payment gateway callback triggers subscription activation.
On successful payment:

- Create subscription with payment_method='GATEWAY', gateway_ref from callback
- Same activation logic as FR-04
- Payment failure: do NOT create subscription; log failure

### FR-06 — Expiration Runtime Enforcement

On every Frontoffice API request, the `subscriptionEnforcement` middleware:

1. Load active subscription for authenticated student
2. If `subscription.expires_at <= NOW()`:
   - Update subscription status → EXPIRED (within middleware via domain service)
   - Update `students.subscription_status` → EXPIRED
   - Return `{ subscription_required: true }` with HTTP 403 for protected routes
3. Enable access to: profile, certificates, payment page regardless of subscription status

No cron-only dependency — enforcement happens at request time.

### FR-07 — Auto-Renew (Recurring Plans)

If `auto_renew = TRUE` and plan.billing_type = 'recurring':

- On expiration attempt → trigger gateway renewal (async, via job queue)
- On renewal success → create new subscription extending from expires_at
- On renewal failure → mark EXPIRED, update student status

### FR-08 — Module Access Control

Every plan defines `enabled_modules` (e.g. `['MCQ', 'TRADITIONAL_EXAMS', 'LIBRARY']`).
Backend API routes for protected modules must check `subscription.plan.enabled_modules`.
Frontoffice receives `enabled_modules` as part of subscription context to control UI visibility.
Backend enforcement is primary; frontend visibility is secondary.

### FR-09 — Student Subscription Status Sync

`students.subscription_status` column must always reflect the most recent subscription state:

- Activation → 'ACTIVE'
- Cancellation → 'NONE'
- Expiration → 'EXPIRED'
- No subscription → 'NONE'

Updates to this column are made within the same transaction as subscription state changes.

### FR-10 — Reporting

Backoffice subscription list supports filtering by:

- student_id
- status (ACTIVE | EXPIRED | CANCELED)
- date range (started_at, expires_at)

Revenue overview returns: count by status, sum of prices by payment_method.

---

## Validation Schemas (packages/validation)

New Zod schemas required:

- `createPlanBodySchema` — name, description?, price, billing_type, duration_days, enabled_modules
- `updatePlanBodySchema` — all fields optional, same constraints
- `planIdParamsSchema` — UUID
- `createSubscriptionBodySchema` — student_id, plan_id, started_at?, auto_renew?, payment_method, notes?
- `subscriptionIdParamsSchema` — UUID
- `listSubscriptionsQuerySchema` — student_id?, status?, page?, limit?

---

## Error Codes

| Code                                      | HTTP | Description                                                   |
| ----------------------------------------- | ---- | ------------------------------------------------------------- |
| `PLAN_NOT_FOUND`                          | 404  | Plan does not exist in this workspace                         |
| `PLAN_HAS_ACTIVE_SUBSCRIPTIONS`           | 409  | Cannot delete plan with active subscriptions                  |
| `PLAN_INACTIVE`                           | 422  | Cannot activate subscription for disabled plan                |
| `SUBSCRIPTION_NOT_FOUND`                  | 404  | Subscription does not exist                                   |
| `STUDENT_ALREADY_HAS_ACTIVE_SUBSCRIPTION` | 409  | Student already has an active subscription                    |
| `SUBSCRIPTION_REQUIRED`                   | 403  | Student must have active subscription to access this resource |
| `SUBSCRIPTION_MODULE_NOT_ENABLED`         | 403  | Module not enabled in student's active plan                   |
| `SUBSCRIPTION_EXPIRED`                    | 403  | Subscription has expired                                      |

---

## Non-Goals

- Shared subscription table across tenants (FORBIDDEN)
- Subscription enforcement only in frontend (FORBIDDEN)
- Hard deletion of subscription history (FORBIDDEN)
- Multiple simultaneous ACTIVE subscriptions per student (FORBIDDEN)
- Gateway payment processing logic (gateway integration is a stub/callback handler only)

---

## Files to Create / Modify

### New Files

#### Migrations

- `apps/api/src/db/tenant/migrations/20260407_023_plans_and_subscriptions.ts`

#### Drizzle Schemas

- `apps/api/src/db/tenant/schemas/plans.schema.ts`
- `apps/api/src/db/tenant/schemas/subscriptions.schema.ts`

#### Domain — Plans

- `packages/domain-core/src/plans/plans.types.ts`
- `packages/domain-core/src/plans/plans.errors.ts`
- `packages/domain-core/src/plans/plans.repository.ts`
- `packages/domain-core/src/plans/plans.service.ts`
- `packages/domain-core/src/plans/index.ts`
- `packages/domain-core/src/plans/__tests__/plans.service.test.ts`

#### Domain — Subscriptions

- `packages/domain-core/src/subscriptions/subscriptions.types.ts`
- `packages/domain-core/src/subscriptions/subscriptions.errors.ts`
- `packages/domain-core/src/subscriptions/subscriptions.repository.ts`
- `packages/domain-core/src/subscriptions/subscriptions.service.ts`
- `packages/domain-core/src/subscriptions/index.ts`
- `packages/domain-core/src/subscriptions/__tests__/subscriptions.service.test.ts`

#### API Routes — Plans

- `apps/api/src/routes/backoffice/plans/helpers.ts`
- `apps/api/src/routes/backoffice/plans/list-plans.ts`
- `apps/api/src/routes/backoffice/plans/create-plan.ts`
- `apps/api/src/routes/backoffice/plans/get-plan.ts`
- `apps/api/src/routes/backoffice/plans/update-plan.ts`
- `apps/api/src/routes/backoffice/plans/delete-plan.ts`
- `apps/api/src/routes/backoffice/plans/index.ts`

#### API Routes — Subscriptions

- `apps/api/src/routes/backoffice/subscriptions/helpers.ts`
- `apps/api/src/routes/backoffice/subscriptions/list-subscriptions.ts`
- `apps/api/src/routes/backoffice/subscriptions/create-subscription.ts`
- `apps/api/src/routes/backoffice/subscriptions/get-subscription.ts`
- `apps/api/src/routes/backoffice/subscriptions/cancel-subscription.ts`
- `apps/api/src/routes/backoffice/subscriptions/index.ts`

#### Middleware

- `apps/api/src/middleware/subscription-enforcement.ts`

#### Integration Tests

- `apps/api/src/routes/backoffice/plans/__tests__/plans.integration.test.ts`
- `apps/api/src/routes/backoffice/subscriptions/__tests__/subscriptions.integration.test.ts`

### Modified Files

- `apps/api/src/db/tenant/schemas/index.ts` — export plans, subscriptions schemas
- `packages/domain-core/src/index.ts` — export plans, subscriptions domains
- `packages/domain-core/src/rbac/rbac.types.ts` — add PLANS and SUBSCRIPTIONS PermissionModule entries
- `packages/validation/src/backoffice/index.ts` — re-export plan/subscription schemas
- `apps/api/src/app.ts` — import and mount plansRouter and subscriptionsRouter (see C-01)

---

## Clarifications

### Session 2025-01-09

---

#### C-01 — Route Mounting: No `backoffice/index.ts` Exists

**Question:** The spec's "Modified Files" lists `apps/api/src/routes/backoffice/index.ts` as a file to modify. This file does NOT exist in the codebase.

**Resolution:** All backoffice routes are mounted directly in `apps/api/src/app.ts` via:

```ts
app.route("/api/v1/backoffice/workspace", plansRouter);
app.route("/api/v1/backoffice/workspace", subscriptionsRouter);
```

**Corrected file**: `apps/api/src/app.ts` (not a non-existent `backoffice/index.ts`). The plans and subscriptions routers will be imported and mounted following the same pattern as `studentsRouter` (Stage 42).

---

#### C-02 — Frontoffice Routes: No API Frontoffice Route Layer Exists

**Question:** The spec's "Modified Files" lists `apps/api/src/routes/frontoffice/index.ts`. This directory and file do NOT exist in the API codebase. The frontoffice is a Vue 3 SPA located in `apps/frontoffice/`, not an API route directory.

**Resolution:**

- No `apps/api/src/routes/frontoffice/index.ts` — remove from Modified Files.
- The `subscription-enforcement.ts` middleware is created in `apps/api/src/middleware/` but is **NOT mounted on any live routes in Stage 44**, since no frontoffice student API route group exists yet.
- The middleware will be registered in a future stage when frontoffice student-facing API routes are introduced.
- Remove `apps/api/src/routes/frontoffice/index.ts` from the implementation scope entirely.

**Impact on FR-06:** The enforcement logic (checking expiry and returning 403) is fully implemented in `subscription-enforcement.ts`, but the mount point is deferred. The middleware is ready for plug-in in Stage 45+.

---

#### C-03 — SubscriptionStatus Enum Mismatch Between Stage 42 and Stage 44

**Question:** Stage 42 defines `students.subscription_status` as `'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'NONE'` (a direct column on the students table). Stage 44 introduces a separate `subscriptions` table with its own status: `'ACTIVE' | 'EXPIRED' | 'CANCELED' | 'PENDING'`. How do these sync? What happens to `SUSPENDED`?

**Resolution:**

- The `students.subscription_status` column retains its Stage 42 type constraint (`'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'NONE'`). No migration alters this column.
- The `subscriptions.status` column uses Stage 44's own enum: `'ACTIVE' | 'EXPIRED' | 'CANCELED' | 'PENDING'`.
- Status synchronization mapping (Stage 44 → students table):
  | subscriptions.status | → students.subscription_status |
  |----------------------|-------------------------------|
  | `ACTIVE` | `'ACTIVE'` |
  | `EXPIRED` | `'EXPIRED'` |
  | `CANCELED` | `'NONE'` |
  | `PENDING` | `'NONE'` (not yet activated) |
- `SUSPENDED` is a Stage 42 flag set by admin action on the student record directly (via `PATCH /students/:id/disable`). It is not a subscription state. Stage 44 does not set or unset `SUSPENDED`.
- The `SubscriptionStatus` type in `packages/domain-core/src/students/students.types.ts` is unchanged in Stage 44.
- New type `SubscriptionState` will be introduced in `packages/domain-core/src/subscriptions/subscriptions.types.ts` for the subscriptions table values: `'ACTIVE' | 'EXPIRED' | 'CANCELED' | 'PENDING'`.

---

#### C-04 — Validation Schema File Location and Naming

**Question:** The spec says `packages/validation/src/index.ts` needs modification. What is the correct file pattern for new plan/subscription validation schemas?

**Resolution:** The backoffice validation pattern in `packages/validation/src/backoffice/` uses `*.schemas.ts` files (e.g., `students.schemas.ts` → `subscriptionStatusSchema`, `mcq-exams.schemas.ts`). New validation files should be:

- `packages/validation/src/backoffice/plans.schemas.ts` — `createPlanBodySchema`, `updatePlanBodySchema`, `planIdParamsSchema`
- `packages/validation/src/backoffice/subscriptions.schemas.ts` — `createSubscriptionBodySchema`, `cancelSubscriptionBodySchema`, `subscriptionIdParamsSchema`, `listSubscriptionsQuerySchema`

The backoffice `packages/validation/src/backoffice/index.ts` will be updated to re-export these. The root `packages/validation/src/index.ts` re-exports from `backoffice/index.ts` and does not need a direct edit if the barrel pattern is already in place.

---

#### C-05 — Payment Gateway Scope (FR-05 and FR-07)

**Question:** FR-05 describes gateway subscription activation and FR-07 describes auto-renew via job queue. Is this in Stage 44 scope?

**Resolution:**

- **FR-05 (gateway callback):** Deferred from Stage 44 scope. Only `payment_method = 'MANUAL'` is supported in Stage 44. The `gateway_ref`, `payment_method` columns are created at DB level for future use, but no gateway callback handler is implemented.
- **FR-07 (auto-renew):** Deferred from Stage 44 scope. The `auto_renew` column exists in the schema but no renewal logic or job queue trigger is implemented. A future stage will add the auto-renew worker job.
- `payment_method` allowed values in Stage 44: `'MANUAL'` only.
- `auto_renew` column exists but is treated as metadata only (always treated as `false` in Stage 44 business logic).

---

#### C-06 — Module Access Enforcement Backend Gate (FR-08)

**Question:** FR-08 requires that backend API routes check `subscription.plan.enabled_modules`. Which routes perform this check and in Stage 44 scope?

**Resolution:**

- **Stage 44 scope**: Create the `subscriptions.service.ts#checkModuleAccess()` function that checks if a given module key is in the student's active plan's `enabled_modules` array.
- Backend enforcement per existing content routes is NOT applied in Stage 44 (no enrolled student API route group exists yet).
- `enabled_modules` data is returned as part of `GET /backoffice/subscriptions/:id` response and stored correctly in the plans table.
- Full module enforcement is deferred to Stage 45+ when frontoffice student endpoints are created.

---

#### C-07 — `students.schema.ts` Drizzle Schema Does Not Need Modification

**Question:** Will the Drizzle ORM schema for students need updating?

**Resolution:** No. The `students.schema.ts` already includes the `subscription_status` column from Stage 42. No Drizzle schema update is needed. The `subscriptions.service.ts` will issue a raw SQL `UPDATE students SET subscription_status = $1 WHERE id = $2` within the same transaction as subscription state changes — following the same transactional pattern established in Stage 42.

---

#### C-08 — RBAC Permission Module Key for Plans/Subscriptions

**Question:** Which `PermissionModule` enum key(s) govern plans and subscriptions CRUD? Does an existing key cover this or must a new one be added?

**Resolution:** A new RBAC module will be introduced:

- `PermissionModule.PLANS` — covers plan CRUD (`can_view`, `can_create`, `can_edit`, `can_delete`)
- `PermissionModule.SUBSCRIPTIONS` — covers subscription management (`can_view`, `can_create`, `can_edit`)

The `PermissionModule` enum is in `packages/domain-core/src/rbac/`. A new entry must be added. This requires modifying `packages/domain-core/src/rbac/rbac.types.ts` (or equivalent). No migration change needed for RBAC module keys (they are application-level constants).

---

#### C-09 — `schema-version` Middleware and plans/subscriptions Tables

**Question:** Does adding `plans` and `subscriptions` tables require a `schema_version` bump in the tenant database?

**Resolution:** No schema version bump required. The `schema_version` middleware validates that the tenant DB version matches a declared minimum before allowing requests. The new migration `023` will increment the schema version naturally when applied. No changes to the schema version middleware constants are needed — the migration itself is the version signal.

---

#### Scope Confirmation

**In scope (Stage 44):**

- Migration 023: create `plans` and `subscriptions` tables with constraints and indexes
- Domain modules: `plans/` and `subscriptions/` in domain-core
- Backoffice API routes: 5 plan routes + 4 subscription routes
- Validation schemas in `packages/validation/src/backoffice/`
- `subscription-enforcement.ts` middleware (created, not mounted)
- Sync of `students.subscription_status` within transactions
- Integration tests for all routes

**Out of scope (deferred):**

- Payment gateway callback handler (FR-05)
- Auto-renew worker job (FR-07)
- Module access enforcement on student API routes (FR-08 application)
- Subscription enforcement middleware mounting (FR-06 mount point)
- `apps/api/src/routes/frontoffice/` route directory
