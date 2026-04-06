# Stage 45 – Promocodes: Data Model

**Generated:** 2026-04-05  
**Branch:** `spec/045-promocodes`

---

## Migration File

**Location:** `apps/api/src/db/tenant/migrations/20260408_024_promocodes.ts`

```typescript
/**
 * Migration: Promocodes
 * File: apps/api/src/db/tenant/migrations/20260408_024_promocodes.ts
 * Stage: STAGE_45_PROMOCODES
 * Date: 2026-04-08
 *
 * Purpose:
 *   Creates the `promocodes` and `promocode_usages` tables for the commercial
 *   discount layer. Promocodes are per-workspace, case-insensitive, and support
 *   PERCENTAGE, FIXED, and FREE_TRIAL discount types.
 *
 * Safety:
 *   - Uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS for idempotency.
 *   - Wrapped in explicit BEGIN/COMMIT/ROLLBACK for atomicity.
 *   - Forward-only: no DROP statements, no data backfill required.
 *   - FK references use ON DELETE RESTRICT to preserve usage history.
 *
 * Impact:
 *   - Adds `promocodes` table (20 columns, 6 CHECK constraints, 2 indexes).
 *   - Adds `promocode_usages` table (6 columns, 1 CHECK constraint, 3 indexes).
 *
 * References: ADR-0001 (tenant isolation), ADR-0003 (forward-only migrations),
 *             ADR-0006 (server-authoritative time)
 */

import type { PoolClient } from "pg";

export async function up(client: PoolClient): Promise<void> {
  await client.query("BEGIN");
  try {
    // -------------------------------------------------------------------------
    // promocodes
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS promocodes (
        id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        code                VARCHAR(100)  NOT NULL,
        type                VARCHAR(20)   NOT NULL,
        value               NUMERIC(10,2),
        free_trial_days     INTEGER,
        valid_from          TIMESTAMPTZ   NOT NULL,
        valid_until         TIMESTAMPTZ   NOT NULL,
        usage_limit         INTEGER,
        per_user_limit      INTEGER       NOT NULL DEFAULT 1,
        applies_to_plan_ids JSONB         NOT NULL DEFAULT '[]'::jsonb,
        target_division_ids JSONB,
        target_group_ids    JSONB,
        is_stackable        BOOLEAN       NOT NULL DEFAULT FALSE,
        is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
        created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

        CONSTRAINT promocodes_type_check
          CHECK (type IN ('PERCENTAGE', 'FIXED', 'FREE_TRIAL')),

        CONSTRAINT promocodes_value_required_for_percentage_fixed
          CHECK (
            (type IN ('PERCENTAGE', 'FIXED') AND value IS NOT NULL) OR
            (type = 'FREE_TRIAL' AND value IS NULL)
          ),

        CONSTRAINT promocodes_free_trial_days_required
          CHECK (
            (type = 'FREE_TRIAL' AND free_trial_days IS NOT NULL AND free_trial_days > 0) OR
            (type != 'FREE_TRIAL' AND free_trial_days IS NULL)
          ),

        CONSTRAINT promocodes_value_positive
          CHECK (value IS NULL OR value > 0),

        CONSTRAINT promocodes_percentage_max_100
          CHECK (type != 'PERCENTAGE' OR value <= 100),

        CONSTRAINT promocodes_valid_window
          CHECK (valid_until > valid_from),

        CONSTRAINT promocodes_per_user_limit_min
          CHECK (per_user_limit >= 1),

        CONSTRAINT promocodes_usage_limit_positive
          CHECK (usage_limit IS NULL OR usage_limit >= 1)
      )
    `);

    // Case-insensitive unique code per tenant DB
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_promocodes_code_lower
        ON promocodes (LOWER(code))
    `);

    // Fast lookup for active codes within validity window
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_promocodes_active
        ON promocodes (is_active, valid_from, valid_until)
        WHERE is_active = TRUE
    `);

    // -------------------------------------------------------------------------
    // promocode_usages
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS promocode_usages (
        id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        promocode_id    UUID          NOT NULL REFERENCES promocodes(id) ON DELETE RESTRICT,
        student_id      UUID          NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
        subscription_id UUID          NOT NULL REFERENCES subscriptions(id) ON DELETE RESTRICT,
        discount_amount NUMERIC(10,2) NOT NULL,
        redeemed_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

        CONSTRAINT promocode_usages_discount_non_negative
          CHECK (discount_amount >= 0)
      )
    `);

    // Deduplication: one usage per (promocode, subscription) pair
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_promocode_usages_subscription
        ON promocode_usages (promocode_id, subscription_id)
    `);

    // Usage count for global limit enforcement
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_promocode_usages_promocode
        ON promocode_usages (promocode_id)
    `);

    // Usage count for per-user limit enforcement
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_promocode_usages_student_promocode
        ON promocode_usages (student_id, promocode_id)
    `);

    // -------------------------------------------------------------------------
    // schema_version bump
    // -------------------------------------------------------------------------
    await client.query(`
      UPDATE schema_versions SET version = 24, updated_at = NOW()
        WHERE id = 1
    `);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

export async function down(_client: PoolClient): Promise<void> {
  // Forward-only migration — no down path (ADR-0003)
}
```

---

## Drizzle Schema: `promocodes`

**File:** `apps/api/src/db/tenant/schemas/promocodes.schema.ts`

```typescript
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const promocodes = pgTable("promocodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 100 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  value: numeric("value", { precision: 10, scale: 2 }),
  free_trial_days: integer("free_trial_days"),
  valid_from: timestamp("valid_from", { withTimezone: true }).notNull(),
  valid_until: timestamp("valid_until", { withTimezone: true }).notNull(),
  usage_limit: integer("usage_limit"),
  per_user_limit: integer("per_user_limit").notNull().default(1),
  applies_to_plan_ids: jsonb("applies_to_plan_ids")
    .notNull()
    .default(sql`'[]'::jsonb`)
    .$type<string[]>(),
  target_division_ids: jsonb("target_division_ids").$type<string[] | null>(),
  target_group_ids: jsonb("target_group_ids").$type<string[] | null>(),
  is_stackable: boolean("is_stackable").notNull().default(false),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Promocode = InferSelectModel<typeof promocodes>;
export type NewPromocode = InferInsertModel<typeof promocodes>;
```

---

## Drizzle Schema: `promocode_usages`

**File:** `apps/api/src/db/tenant/schemas/promocode-usages.schema.ts`

```typescript
import { numeric, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const promocodeUsages = pgTable("promocode_usages", {
  id: uuid("id").primaryKey().defaultRandom(),
  promocode_id: uuid("promocode_id").notNull(), // FK: promocodes.id
  student_id: uuid("student_id").notNull(), // FK: students.id
  subscription_id: uuid("subscription_id").notNull(), // FK: subscriptions.id
  discount_amount: numeric("discount_amount", { precision: 10, scale: 2 }).notNull(),
  redeemed_at: timestamp("redeemed_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PromocodeUsage = InferSelectModel<typeof promocodeUsages>;
export type NewPromocodeUsage = InferInsertModel<typeof promocodeUsages>;
```

> Note: FK relations defined at DB level in migration. Drizzle `relations()` helper
> is not required for this table since cross-table joins are not performed via Drizzle
> (usage counts use raw count queries).

---

## Entity Relationship

```
promocodes (1) ──── (N) promocode_usages
students   (1) ──── (N) promocode_usages
subscriptions (1) ── (1) promocode_usages  [UNIQUE on (promocode_id, subscription_id)]
```

---

## Field Constraints Summary

### `promocodes`

| Column                | Type          | Nullable | Default         | Constraint                                     |
| --------------------- | ------------- | -------- | --------------- | ---------------------------------------------- |
| `id`                  | UUID          | NO       | gen_random_uuid |                                                |
| `code`                | VARCHAR(100)  | NO       |                 | UNIQUE (case-insensitive via index)            |
| `type`                | VARCHAR(20)   | NO       |                 | IN ('PERCENTAGE', 'FIXED', 'FREE_TRIAL')       |
| `value`               | NUMERIC(10,2) | YES      |                 | NOT NULL when type≠FREE_TRIAL; > 0; ≤ 100 if % |
| `free_trial_days`     | INTEGER       | YES      |                 | NOT NULL when type=FREE_TRIAL; > 0             |
| `valid_from`          | TIMESTAMPTZ   | NO       |                 |                                                |
| `valid_until`         | TIMESTAMPTZ   | NO       |                 | > valid_from                                   |
| `usage_limit`         | INTEGER       | YES      |                 | NULL = unlimited; ≥ 1 if set                   |
| `per_user_limit`      | INTEGER       | NO       | 1               | ≥ 1                                            |
| `applies_to_plan_ids` | JSONB         | NO       | `[]`            | Empty array = all plans                        |
| `target_division_ids` | JSONB         | YES      |                 | NULL = all divisions                           |
| `target_group_ids`    | JSONB         | YES      |                 | NULL = all groups                              |
| `is_stackable`        | BOOLEAN       | NO       | false           |                                                |
| `is_active`           | BOOLEAN       | NO       | true            |                                                |
| `created_at`          | TIMESTAMPTZ   | NO       | NOW()           |                                                |
| `updated_at`          | TIMESTAMPTZ   | NO       | NOW()           |                                                |

### `promocode_usages`

| Column            | Type          | Nullable | Default         | Constraint                               |
| ----------------- | ------------- | -------- | --------------- | ---------------------------------------- |
| `id`              | UUID          | NO       | gen_random_uuid |                                          |
| `promocode_id`    | UUID          | NO       |                 | FK → promocodes.id ON DELETE RESTRICT    |
| `student_id`      | UUID          | NO       |                 | FK → students.id ON DELETE RESTRICT      |
| `subscription_id` | UUID          | NO       |                 | FK → subscriptions.id ON DELETE RESTRICT |
| `discount_amount` | NUMERIC(10,2) | NO       |                 | ≥ 0                                      |
| `redeemed_at`     | TIMESTAMPTZ   | NO       | NOW()           |                                          |

---

## Indexes

### `promocodes`

| Index Name                  | Columns                              | Type   | Partial              |
| --------------------------- | ------------------------------------ | ------ | -------------------- |
| `idx_promocodes_code_lower` | `LOWER(code)`                        | UNIQUE |                      |
| `idx_promocodes_active`     | `is_active, valid_from, valid_until` | BTREE  | WHERE is_active=TRUE |

### `promocode_usages`

| Index Name                               | Columns                           | Type   |
| ---------------------------------------- | --------------------------------- | ------ |
| `idx_promocode_usages_subscription`      | `(promocode_id, subscription_id)` | UNIQUE |
| `idx_promocode_usages_promocode`         | `(promocode_id)`                  | BTREE  |
| `idx_promocode_usages_student_promocode` | `(student_id, promocode_id)`      | BTREE  |

---

## Validation Context Type (enriched from R-06)

```typescript
export interface PromocodeValidationContext {
  code: string;
  student_id: string;
  plan_id: string;
  plan_billing_type: string; // 'recurring' | 'one-time' — loaded by route handler
  student_division_id: string | null;
  student_group_id: string | null;
  existing_promo_ids_on_subscription: string[];
  server_now: Date; // must come from DB NOW(), never from client
}
```

The route handler is responsible for loading `plan_billing_type`, `student_division_id`, and `student_group_id` before constructing the context.
