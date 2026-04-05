# Technical Plan — Stage 44: Plans & Subscriptions

**Stage:** STAGE_44_PLANS_AND_SUBSCRIPTIONS
**Phase:** 03_BACKOFFICE_CORE / 06_COMMERCIAL_LAYER
**Branch:** `spec/044-plans-and-subscriptions`
**Plan Date:** 2025-01-09

---

## Phase 0 — Research Summary

### Existing Code Patterns Confirmed

#### Repository Pattern (`packages/domain-core/src/students/students.repository.ts`)

- Raw SQL via `pg` `PoolClient` — no ORM queries
- Column sets defined as `const COLUMNS = '...'` at top of file
- Function signature: `(client: DbClient, workspaceId: string, ...args): Promise<T | null>`
- Returns `rows[0] ?? null` for single-item queries
- Tenant isolation for plans/subscriptions via `workspace_id` column (unlike students which use pool-level isolation)

#### Drizzle Schema Pattern (`apps/api/src/db/tenant/schemas/students.schema.ts`)

- `pgTable('table_name', { columns }, (t) => indexes)`
- Imports from `drizzle-orm/pg-core`: `uuid`, `varchar`, `text`, `boolean`, `timestamp`, `numeric`, `integer`, `jsonb`
- FK: `references(() => otherTable.id, { onDelete: 'restrict' })`
- Check constraints: `.check(sql\`col IN ('val1','val2')\`)`

#### Migration Pattern (`apps/api/src/db/tenant/migrations/20260406_022_student_management.ts`)

- `async function up(client: PoolClient): Promise<void>`
- `BEGIN / try { ... COMMIT } catch { ROLLBACK; throw }`
- `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` for idempotency
- Version comment at top

#### Route Handler Pattern (`apps/api/src/routes/backoffice/students/create-student.ts`, `helpers.ts`)

- Shared `helpers.ts` exports: `getDb(c)`, `buildAuditCtx(c)`, `<domain>ErrorResponse(c, err)`
- Handler: parse body → `safeParse` → get DB pool → call domain service → return `{ success, data, error, request_id }` envelope
- Error handling: catch `DomainError` → `errorResponse(c, err.code, err.httpStatus, err.message)`

#### Router Index Pattern (`apps/api/src/routes/backoffice/students/index.ts`)

- `export const plansRouter = new Hono<BackofficeEnv>()`
- Route registration with `createPermissionGuard(logger, PermissionModule.PLANS, 'can_view')` per route
- Routing ordering comment to prevent `:id` collisions
- Mount in `app.ts`: `app.route('/api/v1/backoffice/workspace', plansRouter)`

#### Service Pattern (`packages/domain-core/src/students/students.service.ts`)

- Pure functions — no HTTP, no logger, no framework imports
- SERIALIZABLE transactions for concurrent-safe operations (e.g., createStudent limit check)
- Transaction: `client.connect()` → `BEGIN ISOLATION LEVEL SERIALIZABLE` → writes → `COMMIT`/`ROLLBACK`
- `toStudentRecord()` mapper strips DB internal fields before returning to API layer

#### Domain Index Barrel (`packages/domain-core/src/index.ts`)

- Domains exported as namespaces: `export * as plans from './plans'`

#### Validation Barrel (`packages/validation/src/backoffice/index.ts`)

- Simple re-exports: `export * from './plans.schemas'`

---

## Phase 1 — Data Model Design

### 1.1 Migration File

**File:** `apps/api/src/db/tenant/migrations/20260407_023_plans_and_subscriptions.ts`
**Migration number:** 023
**Follows:** `20260406_022_student_management.ts`

```ts
/**
 * Migration 023 — Plans and Subscriptions
 *
 * Creates plans and subscriptions tables with constraints, indexes.
 * No data backfill — students.subscription_status is unchanged.
 *
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 */
import type { PoolClient } from "pg";

export async function up(client: PoolClient): Promise<void> {
  await client.query("BEGIN");
  try {
    // -----------------------------------------------------------------------
    // 1. plans table
    // -----------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id     VARCHAR(255) NOT NULL,
        name             VARCHAR(255) NOT NULL,
        description      TEXT,
        price            NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        billing_type     VARCHAR(20) NOT NULL DEFAULT 'one-time',
        duration_days    INTEGER NOT NULL,
        enabled_modules  JSONB NOT NULL DEFAULT '[]',
        is_active        BOOLEAN NOT NULL DEFAULT TRUE,
        is_deleted       BOOLEAN NOT NULL DEFAULT FALSE,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT plans_billing_type_check CHECK (billing_type IN ('one-time', 'recurring')),
        CONSTRAINT plans_duration_days_check CHECK (duration_days > 0),
        CONSTRAINT plans_price_check CHECK (price >= 0)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_plans_workspace
        ON plans(workspace_id)
        WHERE is_deleted = FALSE
    `);

    // -----------------------------------------------------------------------
    // 2. subscriptions table
    // -----------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id       UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
        plan_id          UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
        status           VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        started_at       TIMESTAMPTZ NOT NULL,
        expires_at       TIMESTAMPTZ NOT NULL,
        auto_renew       BOOLEAN NOT NULL DEFAULT FALSE,
        payment_method   VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
        gateway_ref      VARCHAR(255),
        notes            TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT subscriptions_status_check CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELED', 'PENDING')),
        CONSTRAINT subscriptions_payment_method_check CHECK (payment_method IN ('MANUAL', 'GATEWAY')),
        CONSTRAINT subscriptions_expires_after_start CHECK (expires_at > started_at)
      )
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_active_per_student
        ON subscriptions(student_id)
        WHERE status = 'ACTIVE'
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_subscriptions_student
        ON subscriptions(student_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_subscriptions_plan
        ON subscriptions(plan_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_subscriptions_expires
        ON subscriptions(expires_at)
        WHERE status = 'ACTIVE'
    `);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}
```

---

### 1.2 Drizzle Schema — plans.schema.ts

**File:** `apps/api/src/db/tenant/schemas/plans.schema.ts`

```ts
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspace_id: varchar("workspace_id", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0.00"),
  billing_type: varchar("billing_type", { length: 20 }).notNull().default("one-time"),
  duration_days: integer("duration_days").notNull(),
  enabled_modules: jsonb("enabled_modules").notNull().default("[]"),
  is_active: boolean("is_active").notNull().default(true),
  is_deleted: boolean("is_deleted").notNull().default(false),
  created_at: varchar("created_at").notNull(), // TIMESTAMPTZ — typed as varchar for inference
  updated_at: varchar("updated_at").notNull(),
});
```

> Note: The Drizzle schema is used for type inference at build time. SQL CHECK constraints and partial indexes are defined in the migration only.

---

### 1.3 Drizzle Schema — subscriptions.schema.ts

**File:** `apps/api/src/db/tenant/schemas/subscriptions.schema.ts`

```ts
import { boolean, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { students } from "./students.schema";
import { plans } from "./plans.schema";

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  student_id: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "restrict" }),
  plan_id: uuid("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "restrict" }),
  status: varchar("status", { length: 20 }).notNull().default("PENDING"),
  started_at: varchar("started_at").notNull(),
  expires_at: varchar("expires_at").notNull(),
  auto_renew: boolean("auto_renew").notNull().default(false),
  payment_method: varchar("payment_method", { length: 20 }).notNull().default("MANUAL"),
  gateway_ref: varchar("gateway_ref", { length: 255 }),
  notes: text("notes"),
  created_at: varchar("created_at").notNull(),
  updated_at: varchar("updated_at").notNull(),
});
```

---

### 1.4 Schema Barrel Update

**File:** `apps/api/src/db/tenant/schemas/index.ts`

Add at the end:

```ts
export * from "./plans.schema";
export * from "./subscriptions.schema";
```

---

## Phase 2 — Domain Module Design

### 2.1 Plans Domain (`packages/domain-core/src/plans/`)

#### 2.1.1 plans.types.ts

```ts
// Pure types — no logic, no framework imports

export type BillingType = "one-time" | "recurring";

export interface PlanRow {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  price: string; // numeric comes back as string from pg
  billing_type: BillingType;
  duration_days: number;
  enabled_modules: string[];
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlanRecord {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  price: number; // converted from string for API response
  billing_type: BillingType;
  duration_days: number;
  enabled_modules: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePlanInput {
  workspace_id: string;
  name: string;
  description?: string | null;
  price: number;
  billing_type: BillingType;
  duration_days: number;
  enabled_modules: string[];
}

export interface UpdatePlanInput {
  name?: string;
  description?: string | null;
  price?: number;
  billing_type?: BillingType;
  duration_days?: number;
  enabled_modules?: string[];
  is_active?: boolean;
}

export interface PlanListQuery {
  workspace_id: string;
  include_inactive?: boolean;
  page?: number;
  limit?: number;
}

export interface PlanListResult {
  items: PlanRecord[];
  total: number;
  page: number;
  limit: number;
}
```

#### 2.1.2 plans.errors.ts

```ts
export type PlanErrorCode =
  | "PLAN_NOT_FOUND"
  | "PLAN_HAS_ACTIVE_SUBSCRIPTIONS"
  | "PLAN_INACTIVE"
  | "PLAN_INVALID_MODULES";

export const PLAN_ERROR_HTTP: Record<PlanErrorCode, number> = {
  PLAN_NOT_FOUND: 404,
  PLAN_HAS_ACTIVE_SUBSCRIPTIONS: 409,
  PLAN_INACTIVE: 422,
  PLAN_INVALID_MODULES: 422,
};

export class PlanError extends Error {
  readonly code: PlanErrorCode;
  readonly httpStatus: number;

  constructor(code: PlanErrorCode, message: string) {
    super(message);
    this.code = code;
    this.httpStatus = PLAN_ERROR_HTTP[code];
    this.name = "PlanError";
  }
}
```

#### 2.1.3 plans.repository.ts (key functions)

Column set constant:

```ts
const PLAN_COLUMNS =
  "id, workspace_id, name, description, price, billing_type, duration_days, enabled_modules, is_active, is_deleted, created_at, updated_at";
```

Functions:
| Function | Signature | Description |
|----------|-----------|-------------|
| `listPlans` | `(client, workspaceId, query)` → `{ items, total }` | List non-deleted plans; active-only if `include_inactive=false` |
| `getPlan` | `(client, workspaceId, planId)` → `PlanRow \| null` | Single plan scoped to workspace |
| `insertPlan` | `(client, input)` → `PlanRow` | Insert, return full row |
| `updatePlan` | `(client, workspaceId, planId, input)` → `PlanRow \| null` | Partial update |
| `softDeletePlan` | `(client, workspaceId, planId)` → `boolean` | Set `is_deleted = TRUE` |
| `countActiveSubscriptionsByPlanId` | `(client, planId)` → `number` | Used for delete guard |

All queries: `WHERE workspace_id = $N` for tenant scoping + `WHERE is_deleted = FALSE` for plans.

#### 2.1.4 plans.service.ts (key functions)

| Function                                         | Description                                                           |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| `createPlan(client, input)`                      | Validate → insert; no SERIALIZABLE needed (no concurrent limit check) |
| `updatePlan(client, workspaceId, planId, input)` | Validate → update; 404 if not found                                   |
| `deletePlan(client, workspaceId, planId)`        | Check active subscriptions → 409 if any → soft-delete                 |
| `getPlanById(client, workspaceId, planId)`       | Get + 404 if not found                                                |
| `listPlans(client, query)`                       | Delegate to repository, return `PlanListResult`                       |
| `toPlanRecord(row)`                              | Convert `PlanRow` → `PlanRecord` (string price → number)              |

---

### 2.2 Subscriptions Domain (`packages/domain-core/src/subscriptions/`)

#### 2.2.1 subscriptions.types.ts

```ts
// New type for subscriptions table — different from students.SubscriptionStatus
export type SubscriptionState = "ACTIVE" | "EXPIRED" | "CANCELED" | "PENDING";
export type PaymentMethod = "MANUAL" | "GATEWAY";

export interface SubscriptionRow {
  id: string;
  student_id: string;
  plan_id: string;
  status: SubscriptionState;
  started_at: string;
  expires_at: string;
  auto_renew: boolean;
  payment_method: PaymentMethod;
  gateway_ref: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionRecord {
  id: string;
  student_id: string;
  plan_id: string;
  status: SubscriptionState;
  started_at: string;
  expires_at: string;
  auto_renew: boolean;
  payment_method: PaymentMethod;
  gateway_ref: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSubscriptionInput {
  student_id: string;
  plan_id: string;
  started_at?: string | null; // If null → server uses NOW()
  payment_method?: PaymentMethod;
  notes?: string | null;
}

export interface SubscriptionListQuery {
  student_id?: string;
  status?: SubscriptionState;
  page?: number;
  limit?: number;
}

export interface SubscriptionListResult {
  items: SubscriptionRecord[];
  total: number;
  page: number;
  limit: number;
}

// Passed between service functions within transaction
export interface ActivationContext {
  plan_duration_days: number;
  workspace_id: string;
}
```

#### 2.2.2 subscriptions.errors.ts

```ts
export type SubscriptionErrorCode =
  | "SUBSCRIPTION_NOT_FOUND"
  | "STUDENT_ALREADY_HAS_ACTIVE_SUBSCRIPTION"
  | "SUBSCRIPTION_REQUIRED"
  | "SUBSCRIPTION_MODULE_NOT_ENABLED"
  | "SUBSCRIPTION_EXPIRED"
  | "PLAN_INACTIVE"
  | "PLAN_NOT_FOUND";

export const SUBSCRIPTION_ERROR_HTTP: Record<SubscriptionErrorCode, number> = {
  SUBSCRIPTION_NOT_FOUND: 404,
  STUDENT_ALREADY_HAS_ACTIVE_SUBSCRIPTION: 409,
  SUBSCRIPTION_REQUIRED: 403,
  SUBSCRIPTION_MODULE_NOT_ENABLED: 403,
  SUBSCRIPTION_EXPIRED: 403,
  PLAN_INACTIVE: 422,
  PLAN_NOT_FOUND: 404,
};

export class SubscriptionError extends Error {
  readonly code: SubscriptionErrorCode;
  readonly httpStatus: number;

  constructor(code: SubscriptionErrorCode, message: string) {
    super(message);
    this.code = code;
    this.httpStatus = SUBSCRIPTION_ERROR_HTTP[code];
    this.name = "SubscriptionError";
  }
}
```

#### 2.2.3 subscriptions.repository.ts (key functions)

```ts
const SUB_COLUMNS =
  "id, student_id, plan_id, status, started_at, expires_at, auto_renew, payment_method, gateway_ref, notes, created_at, updated_at";
```

| Function                | Signature                                         | Description                             |
| ----------------------- | ------------------------------------------------- | --------------------------------------- |
| `insertSubscription`    | `(client, input, expiresAt)` → `SubscriptionRow`  | Insert new subscription row             |
| `getActiveSubscription` | `(client, studentId)` → `SubscriptionRow \| null` | WHERE status='ACTIVE'                   |
| `getSubscriptionById`   | `(client, id)` → `SubscriptionRow \| null`        | Single by ID                            |
| `listSubscriptions`     | `(client, query)` → `{ items, total }`            | Filtered list with pagination           |
| `expireSubscription`    | `(client, id)` → `void`                           | SET status='EXPIRED', updated_at=NOW()  |
| `cancelSubscription`    | `(client, id)` → `void`                           | SET status='CANCELED', updated_at=NOW() |

Note: `expireSubscription` and `cancelSubscription` are called WITHIN the `activateSubscription` transaction, so they accept `TransactionClient` not `DbClient`.

#### 2.2.4 subscriptions.service.ts — Activation Transaction

**Key function: `activateSubscription`**

Transaction isolation: `SERIALIZABLE` (prevents race condition — two concurrent activations for the same student)

```
TRANSACTION (SERIALIZABLE):
  1. getPlan(client, workspaceId, planId) → 404 PLAN_NOT_FOUND if missing
  2. Validate plan.is_active → 422 PLAN_INACTIVE if false
  3. getActiveSubscription(txClient, studentId)
     → If found: expireSubscription(txClient, existing.id)
                 syncStudentSubscriptionStatus(txClient, studentId, 'EXPIRED')
  4. Calculate expires_at = started_at + plan.duration_days DAYS (server clock: SELECT NOW() + INTERVAL '$N days')
  5. insertSubscription(txClient, { student_id, plan_id, status:'ACTIVE', started_at, expires_at, payment_method:'MANUAL', ... })
  6. syncStudentSubscriptionStatus(txClient, studentId, 'ACTIVE')
  COMMIT
```

Where `syncStudentSubscriptionStatus` issues:

```sql
UPDATE students SET subscription_status = $1, updated_at = NOW() WHERE id = $2
```

This runs within the same transaction — atomicity guaranteed.

**Key function: `cancelSubscription`**

```
TRANSACTION (READ COMMITTED sufficient — single-row update):
  1. getSubscriptionById(txClient, id) → 404 if missing
  2. Validate status = 'ACTIVE' or 'PENDING' (cannot cancel EXPIRED/CANCELED)
  3. cancelSubscription(txClient, id)        -- SET status='CANCELED'
  4. syncStudentSubscriptionStatus(txClient, student_id, 'NONE')
  COMMIT
```

---

### 2.3 RBAC Update

**File:** `packages/domain-core/src/rbac/rbac.types.ts`

Append to `PermissionModule` enum:

```ts
PLANS = 'plans',
SUBSCRIPTIONS = 'subscriptions',
```

> `COMMERCIAL = 'commercial'` already exists — `PLANS` and `SUBSCRIPTIONS` are separate more-specific modules.

---

### 2.4 Domain Core Index Update

**File:** `packages/domain-core/src/index.ts`

Append exports (after the students entry):

```ts
// Plans module (Stage 044)
export * as plans from "./plans";
// Subscriptions module (Stage 044)
export * as subscriptions from "./subscriptions";
```

---

## Phase 3 — Validation Schemas

### 3.1 plans.schemas.ts

**File:** `packages/validation/src/backoffice/plans.schemas.ts`

```ts
import { z } from "zod";

export const planIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createPlanBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional().nullable(),
  price: z.number().min(0),
  billing_type: z.enum(["one-time", "recurring"]),
  duration_days: z.number().int().positive(),
  enabled_modules: z.array(z.string()).default([]),
});

export const updatePlanBodySchema = createPlanBodySchema.partial().extend({
  is_active: z.boolean().optional(),
});

export type CreatePlanBody = z.infer<typeof createPlanBodySchema>;
export type UpdatePlanBody = z.infer<typeof updatePlanBodySchema>;
```

### 3.2 subscriptions.schemas.ts

**File:** `packages/validation/src/backoffice/subscriptions.schemas.ts`

```ts
import { z } from "zod";

export const subscriptionIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createSubscriptionBodySchema = z.object({
  student_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  started_at: z.string().datetime({ offset: true }).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});
// payment_method is locked to 'MANUAL' in Stage 44 — no field exposed

export const listSubscriptionsQuerySchema = z.object({
  student_id: z.string().uuid().optional(),
  status: z.enum(["ACTIVE", "EXPIRED", "CANCELED", "PENDING"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateSubscriptionBody = z.infer<typeof createSubscriptionBodySchema>;
export type ListSubscriptionsQuery = z.infer<typeof listSubscriptionsQuerySchema>;
```

### 3.3 Barrel Update

**File:** `packages/validation/src/backoffice/index.ts`

Add:

```ts
export * from "./plans.schemas";
export * from "./subscriptions.schemas";
```

---

## Phase 4 — API Routes Design

### 4.1 Shared helpers (per-router)

**File:** `apps/api/src/routes/backoffice/plans/helpers.ts`
**File:** `apps/api/src/routes/backoffice/subscriptions/helpers.ts`

Each helpers.ts exports:

- `getDb(c: Context)` — identical pattern to students/helpers.ts
- `buildAuditCtx(c: Context)` — identical pattern
- `planErrorResponse(c, err)` / `subscriptionErrorResponse(c, err)` — catch typed error, return standard envelope

---

### 4.2 Plans Routes

| File             | Route               | Permission                             |
| ---------------- | ------------------- | -------------------------------------- |
| `list-plans.ts`  | `GET /plans`        | `PermissionModule.PLANS`, `can_view`   |
| `create-plan.ts` | `POST /plans`       | `PermissionModule.PLANS`, `can_create` |
| `get-plan.ts`    | `GET /plans/:id`    | `PermissionModule.PLANS`, `can_view`   |
| `update-plan.ts` | `PATCH /plans/:id`  | `PermissionModule.PLANS`, `can_edit`   |
| `delete-plan.ts` | `DELETE /plans/:id` | `PermissionModule.PLANS`, `can_delete` |

**Routing order note:** `DELETE /plans/:id` before `GET /plans/:id` to match `:id` collision convention.

**Plans Router Index:** `apps/api/src/routes/backoffice/plans/index.ts`

```ts
export const plansRouter = new Hono<BackofficeEnv>();

// List (before :id)
plansRouter.get(
  "/plans",
  createPermissionGuard(logger, PermissionModule.PLANS, "can_view"),
  handleListPlans,
);
// Create
plansRouter.post(
  "/plans",
  createPermissionGuard(logger, PermissionModule.PLANS, "can_create"),
  handleCreatePlan,
);
// Delete (BEFORE get/:id)
plansRouter.delete(
  "/plans/:id",
  createPermissionGuard(logger, PermissionModule.PLANS, "can_delete"),
  handleDeletePlan,
);
// Get
plansRouter.get(
  "/plans/:id",
  createPermissionGuard(logger, PermissionModule.PLANS, "can_view"),
  handleGetPlan,
);
// Update
plansRouter.patch(
  "/plans/:id",
  createPermissionGuard(logger, PermissionModule.PLANS, "can_edit"),
  handleUpdatePlan,
);
```

---

### 4.3 Subscriptions Routes

| File                     | Route                             | Permission                                     |
| ------------------------ | --------------------------------- | ---------------------------------------------- |
| `list-subscriptions.ts`  | `GET /subscriptions`              | `PermissionModule.SUBSCRIPTIONS`, `can_view`   |
| `create-subscription.ts` | `POST /subscriptions`             | `PermissionModule.SUBSCRIPTIONS`, `can_create` |
| `get-subscription.ts`    | `GET /subscriptions/:id`          | `PermissionModule.SUBSCRIPTIONS`, `can_view`   |
| `cancel-subscription.ts` | `PATCH /subscriptions/:id/cancel` | `PermissionModule.SUBSCRIPTIONS`, `can_edit`   |

**Routing order note:** `PATCH /subscriptions/:id/cancel` registered BEFORE `GET /subscriptions/:id`.

**Subscriptions Router Index:** `apps/api/src/routes/backoffice/subscriptions/index.ts`

```ts
export const subscriptionsRouter = new Hono<BackofficeEnv>();

// List
subscriptionsRouter.get(
  "/subscriptions",
  createPermissionGuard(logger, PermissionModule.SUBSCRIPTIONS, "can_view"),
  handleListSubscriptions,
);
// Create (manual activation)
subscriptionsRouter.post(
  "/subscriptions",
  createPermissionGuard(logger, PermissionModule.SUBSCRIPTIONS, "can_create"),
  handleCreateSubscription,
);
// Cancel (BEFORE :id GET)
subscriptionsRouter.patch(
  "/subscriptions/:id/cancel",
  createPermissionGuard(logger, PermissionModule.SUBSCRIPTIONS, "can_edit"),
  handleCancelSubscription,
);
// Get
subscriptionsRouter.get(
  "/subscriptions/:id",
  createPermissionGuard(logger, PermissionModule.SUBSCRIPTIONS, "can_view"),
  handleGetSubscription,
);
```

---

### 4.4 Route Mounting in app.ts

**File:** `apps/api/src/app.ts`

Add after `studentsRouter` mount (line ~218):

```ts
// Plans endpoints — Stage 044, permission guard applied per route
app.route("/api/v1/backoffice/workspace", plansRouter);

// Subscriptions endpoints — Stage 044, permission guard applied per route
app.route("/api/v1/backoffice/workspace", subscriptionsRouter);
```

---

## Phase 5 — Middleware Design

### 5.1 Subscription Enforcement Middleware (NOT MOUNTED IN STAGE 44)

**File:** `apps/api/src/middleware/subscription-enforcement.ts`

Created for future use — NOT mounted on any route in Stage 44.

Purpose: Runs on frontoffice student-facing routes (future Stage 45+). Validates active subscription on every request.

Design:

```ts
// Allowlist of paths accessible without a subscription
const SUBSCRIPTION_BYPASS_PATHS = ["/profile", "/certificates", "/payment", "/login", "/logout"];

export async function subscriptionEnforcementMiddleware(c: Context, next: Next): Promise<void> {
  const path = c.req.path;
  if (SUBSCRIPTION_BYPASS_PATHS.some((p) => path.startsWith(p))) {
    return next();
  }

  const student = c.get("student");
  if (!student?.id) return next(); // No student context (handled by auth middleware)

  const { pool } = c.get("tenant");
  const sub = await getActiveSubscription(pool, student.id);

  if (!sub) {
    return c.json(
      {
        success: false,
        data: null,
        error: { code: "SUBSCRIPTION_REQUIRED", message: "Active subscription required" },
      },
      403,
    );
  }

  const now = await getServerTime(pool); // SELECT NOW()
  if (new Date(sub.expires_at) <= now) {
    // Expire within middleware (non-atomic accepted for enforcement-only path)
    await expireSubscriptionAndSyncStudent(pool, sub.id, student.id);
    return c.json(
      {
        success: false,
        data: null,
        error: { code: "SUBSCRIPTION_EXPIRED", message: "Subscription has expired" },
      },
      403,
    );
  }

  c.set("active_subscription", sub);
  return next();
}
```

---

## Phase 6 — Transaction Boundaries

| Operation              | Isolation Level         | Reason                                                                                                          |
| ---------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `activateSubscription` | SERIALIZABLE            | Concurrent activations for same student must be serialized — unique index + concurrent check needs serializable |
| `cancelSubscription`   | READ COMMITTED          | Single-student update, no concurrent conflict                                                                   |
| `createPlan`           | READ COMMITTED          | No concurrent limit check needed                                                                                |
| `deletePlan`           | READ COMMITTED          | Checks active subscription count, but row-level lock on plans row sufficient                                    |
| All repo reads         | READ COMMITTED (pooled) | Standard read, no transaction needed                                                                            |

**All multi-step writes atomically sync `students.subscription_status`** within the same transaction.

---

## Phase 7 — Error Response Contract

All handlers return the standard envelope:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "PLAN_NOT_FOUND",
    "message": "Plan not found"
  },
  "request_id": "..."
}
```

Domain errors map to HTTP status via `PLAN_ERROR_HTTP` and `SUBSCRIPTION_ERROR_HTTP` maps.

---

## Phase 8 — Logging Requirements

All API route handlers must log:

- `correlation_id` on every operation
- `workspace_id` and `workspace_slug` for tenant tracing
- Plan/subscription IDs on create/update/delete operations
- Subscription activation log: `student_id`, `plan_id`, `expires_at`, `previous_subscription_id` (if expired)
- Error log: `error.code`, `error.message`, severity

No sensitive fields in logs (price is acceptable metadata).

---

## Phase 9 — Integration Test Structure

### Plans Integration Tests

**File:** `apps/api/src/routes/backoffice/plans/__tests__/plans.integration.test.ts`

Test cases:

- `POST /plans` — creates plan, returns 201
- `POST /plans` — validation error (missing name), returns 422
- `GET /plans` — lists plans scoped to workspace
- `GET /plans/:id` — returns single plan
- `GET /plans/:id` — 404 for unknown ID
- `PATCH /plans/:id` — partial update
- `DELETE /plans/:id` — soft-deletes plan
- `DELETE /plans/:id` — 409 when active subscriptions exist

### Subscriptions Integration Tests

**File:** `apps/api/src/routes/backoffice/subscriptions/__tests__/subscriptions.integration.test.ts`

Test cases:

- `POST /subscriptions` — activates subscription, syncs student status
- `POST /subscriptions` — 409 when student already has ACTIVE subscription
- `POST /subscriptions` — previous ACTIVE expired atomically on new activation
- `GET /subscriptions` — lists with student_id filter
- `GET /subscriptions/:id` — returns single subscription
- `PATCH /subscriptions/:id/cancel` — cancels, syncs student status to NONE
- `PATCH /subscriptions/:id/cancel` — 404 on unknown ID

### Domain Unit Tests

**File:** `packages/domain-core/src/plans/__tests__/plans.service.test.ts`

- `createPlan` — maps input, calls repository
- `deletePlan` — blocks when active subscriptions > 0
- `toPlanRecord` — converts price string to number

**File:** `packages/domain-core/src/subscriptions/__tests__/subscriptions.service.test.ts`

- `activateSubscription` — expires previous, creates new, syncs student
- `activateSubscription` — rejects PLAN_INACTIVE plan
- `cancelSubscription` — cancels ACTIVE, syncs to NONE
- `cancelSubscription` — 404 on unknown subscription

---

## Implementation Order

1. **T001** Migration 023 file (no DB yet — file only)
2. **T002** Drizzle schemas (plans.schema.ts, subscriptions.schema.ts)
3. **T003** Schema barrel update (db/tenant/schemas/index.ts)
4. **T004** RBAC update (`rbac.types.ts` — add PLANS, SUBSCRIPTIONS)
5. **T005** Plans domain types + errors
6. **T006** Plans repository
7. **T007** Plans service + unit tests
8. **T008** Plans domain index barrel
9. **T009** Subscriptions domain types + errors
10. **T010** Subscriptions repository
11. **T011** Subscriptions service + unit tests
12. **T012** Subscriptions domain index barrel
13. **T013** Domain-core index update (export plans + subscriptions)
14. **T014** Validation — plans.schemas.ts
15. **T015** Validation — subscriptions.schemas.ts
16. **T016** Validation barrel update
17. **T017** Plans helpers + route handlers (list, create, get, update, delete)
18. **T018** Plans router index
19. **T019** Subscriptions helpers + route handlers (list, create, get, cancel)
20. **T020** Subscriptions router index
21. **T021** subscription-enforcement.ts middleware (create, DO NOT MOUNT)
22. **T022** Mount plansRouter + subscriptionsRouter in app.ts
23. **T023** Integration tests — plans
24. **T024** Integration tests — subscriptions

**Parallel groups:** T005–T008 (plans domain) can run in parallel with T014 (plans validation). T009–T012 (subscriptions domain) can run in parallel with T015 (subscriptions validation). T017 and T019 depend on domain and validation being complete.

---

## Architecture Compliance Checklist

- [x] No cross-tenant access — all plan/subscription queries include `workspace_id`
- [x] Tenant resolver only — `getDb(c)` extracts pool from context via `c.get('tenant')`
- [x] All writes transactional — activation uses SERIALIZABLE, cancel uses transaction
- [x] Server-authoritative time — `expires_at` computed via `SELECT NOW() + INTERVAL '$N days'`; started_at defaults to server NOW()
- [x] No client-authoritative time — `started_at` from client is validated ISO string, not used for security boundaries
- [x] Student status sync atomic — `UPDATE students` inside same transaction as subscription write
- [x] Forward-only migrations — migration 023 adds tables only, never modifies existing
- [x] Domain isolation — no HTTP imports in domain-core packages
- [x] Import boundaries — `apps/api` → `packages/domain-core` ✅; never reversed
- [x] Error contract — all responses use `{ success, data, error }` envelope
- [x] Unique partial index enforces at most ONE ACTIVE subscription per student at DB level
