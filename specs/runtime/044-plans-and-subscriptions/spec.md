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
- `packages/validation/src/index.ts` — export plan/subscription schemas
- `apps/api/src/routes/backoffice/index.ts` — mount plan & subscription routes
- `apps/api/src/routes/frontoffice/index.ts` — apply subscriptionEnforcement middleware

---

## Clarifications

_(Will be populated by Step 2 — Clarify)_
