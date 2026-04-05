# Data Model — Stage 44: Plans & Subscriptions

**Stage:** STAGE_44_PLANS_AND_SUBSCRIPTIONS
**Phase:** 03_BACKOFFICE_CORE / 06_COMMERCIAL_LAYER

---

## Entity Relationship

```
workspaces (master DB)
  └── (pool-level isolation per tenant)

plans
  ├── id (PK)
  └── workspace_id  ←── tenant scope (no FK — pool isolation already guarantees it)

subscriptions
  ├── id (PK)
  ├── student_id  ──FK──▶ students.id (RESTRICT)
  └── plan_id     ──FK──▶ plans.id (RESTRICT)

students
  └── subscription_status  ←── sync field (updated within subscription transactions)
```

---

## Table: plans

| Column            | Type          | Constraints                                 | Default             | Description                                 |
| ----------------- | ------------- | ------------------------------------------- | ------------------- | ------------------------------------------- |
| `id`              | UUID          | PRIMARY KEY                                 | `gen_random_uuid()` | Unique plan identifier                      |
| `workspace_id`    | VARCHAR(255)  | NOT NULL                                    | —                   | Tenant scope                                |
| `name`            | VARCHAR(255)  | NOT NULL                                    | —                   | Display name                                |
| `description`     | TEXT          | NULLABLE                                    | —                   | Optional detail text                        |
| `price`           | NUMERIC(10,2) | NOT NULL, CHECK ≥ 0                         | `0.00`              | Plan price                                  |
| `billing_type`    | VARCHAR(20)   | NOT NULL, CHECK IN ('one-time','recurring') | `'one-time'`        | Billing cycle type                          |
| `duration_days`   | INTEGER       | NOT NULL, CHECK > 0                         | —                   | Plan validity in days                       |
| `enabled_modules` | JSONB         | NOT NULL                                    | `'[]'`              | Module access key array                     |
| `is_active`       | BOOLEAN       | NOT NULL                                    | `TRUE`              | Whether new subscriptions can use this plan |
| `is_deleted`      | BOOLEAN       | NOT NULL                                    | `FALSE`             | Soft-delete flag                            |
| `created_at`      | TIMESTAMPTZ   | NOT NULL                                    | `NOW()`             | Server-authoritative creation time          |
| `updated_at`      | TIMESTAMPTZ   | NOT NULL                                    | `NOW()`             | Server-authoritative update time            |

### Indexes — plans

| Name                  | Type           | Definition                                | Purpose                     |
| --------------------- | -------------- | ----------------------------------------- | --------------------------- |
| `idx_plans_workspace` | PARTIAL B-TREE | `(workspace_id) WHERE is_deleted = FALSE` | Fast workspace plan listing |

### Check Constraints — plans

| Name                        | Expression                                  |
| --------------------------- | ------------------------------------------- |
| `plans_billing_type_check`  | `billing_type IN ('one-time', 'recurring')` |
| `plans_duration_days_check` | `duration_days > 0`                         |
| `plans_price_check`         | `price >= 0`                                |

---

## Table: subscriptions

| Column           | Type         | Constraints                                                  | Default             | Description                                    |
| ---------------- | ------------ | ------------------------------------------------------------ | ------------------- | ---------------------------------------------- |
| `id`             | UUID         | PRIMARY KEY                                                  | `gen_random_uuid()` | Unique subscription identifier                 |
| `student_id`     | UUID         | NOT NULL, FK→students(id) RESTRICT                           | —                   | Student owning this subscription               |
| `plan_id`        | UUID         | NOT NULL, FK→plans(id) RESTRICT                              | —                   | Plan this subscription references              |
| `status`         | VARCHAR(20)  | NOT NULL, CHECK IN ('ACTIVE','EXPIRED','CANCELED','PENDING') | `'PENDING'`         | Lifecycle state                                |
| `started_at`     | TIMESTAMPTZ  | NOT NULL                                                     | —                   | Server-authoritative start (set from DB NOW()) |
| `expires_at`     | TIMESTAMPTZ  | NOT NULL, CHECK > started_at                                 | —                   | Entry point for expiry enforcement             |
| `auto_renew`     | BOOLEAN      | NOT NULL                                                     | `FALSE`             | Auto-renew flag (metadata only in Stage 44)    |
| `payment_method` | VARCHAR(20)  | NOT NULL, CHECK IN ('MANUAL','GATEWAY')                      | `'MANUAL'`          | How this was activated                         |
| `gateway_ref`    | VARCHAR(255) | NULLABLE                                                     | —                   | External payment reference (future)            |
| `notes`          | TEXT         | NULLABLE                                                     | —                   | Admin notes                                    |
| `created_at`     | TIMESTAMPTZ  | NOT NULL                                                     | `NOW()`             | Row creation time                              |
| `updated_at`     | TIMESTAMPTZ  | NOT NULL                                                     | `NOW()`             | Last update time                               |

### Indexes — subscriptions

| Name                                   | Type           | Definition                             | Purpose                                                              |
| -------------------------------------- | -------------- | -------------------------------------- | -------------------------------------------------------------------- |
| `idx_subscriptions_active_per_student` | UNIQUE PARTIAL | `(student_id) WHERE status = 'ACTIVE'` | **Enforces at most ONE ACTIVE subscription per student at DB level** |
| `idx_subscriptions_student`            | B-TREE         | `(student_id)`                         | Student subscription history queries                                 |
| `idx_subscriptions_plan`               | B-TREE         | `(plan_id)`                            | Plan usage lookups (delete guard)                                    |
| `idx_subscriptions_expires`            | PARTIAL B-TREE | `(expires_at) WHERE status = 'ACTIVE'` | Runtime expiry enforcement scan                                      |

### Check Constraints — subscriptions

| Name                                 | Expression                                               |
| ------------------------------------ | -------------------------------------------------------- |
| `subscriptions_status_check`         | `status IN ('ACTIVE', 'EXPIRED', 'CANCELED', 'PENDING')` |
| `subscriptions_payment_method_check` | `payment_method IN ('MANUAL', 'GATEWAY')`                |
| `subscriptions_expires_after_start`  | `expires_at > started_at`                                |

---

## Status Synchronization Model

```
subscriptions.status  ──sync──▶  students.subscription_status
─────────────────────────────────────────────────────────────
ACTIVE                ──────────▶ ACTIVE
EXPIRED               ──────────▶ EXPIRED
CANCELED              ──────────▶ NONE
PENDING               ──────────▶ NONE (not yet activated)

SUSPENDED (Stage 42)  ──────────▶ (Stage 44 does NOT set or unset SUSPENDED)
                                   SUSPENDED is a student-level admin flag only
```

The sync is performed atomically within the same transaction as the subscription state change via:

```sql
UPDATE students SET subscription_status = $1, updated_at = NOW() WHERE id = $2
```

---

## Pre-Existing Schema (Stage 42 — Unchanged)

```sql
-- NOT MODIFIED by Stage 44
ALTER TABLE students -- has column:
  subscription_status VARCHAR(20) NOT NULL DEFAULT 'NONE'
  -- CHECK (subscription_status IN ('ACTIVE', 'SUSPENDED', 'EXPIRED', 'NONE'))
```

No migration touches the `students` table in Stage 44.

---

## Migration File

**Path:** `apps/api/src/db/tenant/migrations/20260407_023_plans_and_subscriptions.ts`
**Sequential number:** 023
**Previous migration:** `20260406_022_student_management.ts`
**Pattern:** `async function up(client: PoolClient): Promise<void>` with `BEGIN/COMMIT/ROLLBACK`
**Idempotency:** All DDL uses `IF NOT EXISTS` and `IF NOT EXISTS` partial index names

---

## Domain Type Mapping

| DB Column                               | TypeScript Type                                                        | Notes                                                         |
| --------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| `plans.price`                           | `string` (PlanRow) → `number` (PlanRecord)                             | `pg` returns NUMERIC as string; converted in `toPlanRecord()` |
| `plans.enabled_modules`                 | `string[]`                                                             | JSONB deserialized by pg; typed as `string[]`                 |
| `subscriptions.status`                  | `SubscriptionState = 'ACTIVE' \| 'EXPIRED' \| 'CANCELED' \| 'PENDING'` | New type in subscriptions.types.ts                            |
| `subscriptions.started_at / expires_at` | `string` (ISO timestamp from pg)                                       | Not parsed to Date — preserved as ISO string                  |
| `students.subscription_status`          | `SubscriptionStatus = 'ACTIVE' \| 'SUSPENDED' \| 'EXPIRED' \| 'NONE'`  | Existing Stage 42 type — UNCHANGED                            |
