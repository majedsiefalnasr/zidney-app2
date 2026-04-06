# Technical Plan — Stage 46: Billing & Invoices

**Stage:** STAGE_46_BILLING_AND_INVOICES
**Phase:** 03_BACKOFFICE_CORE / 06_COMMERCIAL_LAYER
**Branch:** `spec/046-billing-and-invoices`
**Plan Date:** 2026-04-06

---

## Phase 0 — Research Summary

### Existing Code Patterns Confirmed

#### Repository Pattern (`packages/domain-core/src/subscriptions/subscriptions.repository.ts`)

- Raw SQL via `pg` `PoolClient` — no ORM
- Column sets defined as `const COLUMNS = '...'` at file top
- Function signature: `(client: DbClient, ...args): Promise<T | null>`
- Returns `rows[0] ?? null` for single-item queries
- Drizzle schema (`apps/api/src/db/tenant/schemas/`) defines structural reference; queries are raw SQL

#### Drizzle Schema Pattern (`apps/api/src/db/tenant/schemas/`)

- `pgTable('table_name', { columns }, (t) => indexes)`
- FK: `references(() => otherTable.id, { onDelete: 'restrict' })`
- Check constraints: `.check(sql\`col IN ('val1','val2')\`)`
- Index objects defined in third argument using `index()` / `uniqueIndex()`

#### Migration Pattern (latest: `20260408_024_promocodes.ts`)

- `async function up(client: PoolClient): Promise<void>`
- `BEGIN / try { ... COMMIT } catch { ROLLBACK; throw }`
- `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` for idempotency
- Date prefix follows sequential calendar ordering

#### Route Handler Pattern (`apps/api/src/routes/backoffice/subscriptions/`)

- `helpers.ts` exports: `getDb(c)`, `buildAuditCtx(c)`, `billingErrorResponse(c, err)`
- Handler: parse body → `safeParse` zod schema → get DB pool → call domain service → return envelope
- Error envelope: `{ success, data, error: { code, message }, request_id }`
- `DomainError` caught and mapped via helpers

#### Router Index Pattern

- `export const invoicesRouter = new Hono<BackofficeEnv>()`
- Per-route `createPermissionGuard(logger, PermissionModule.INVOICES, 'can_view')`
- Mounted at `app.route('/api/v1/backoffice/workspace', invoicesRouter)` in `app.ts`

#### Service Pattern (`packages/domain-core/src/subscriptions/subscriptions.service.ts`)

- Pure functions — no HTTP, no logger, no framework
- SERIALIZABLE isolation for concurrent-safe transitions
- `BEGIN ISOLATION LEVEL SERIALIZABLE` → writes → `COMMIT` / `ROLLBACK`
- Idempotency guard: read current state within transaction, check before write

#### Webhook Routing

- No existing webhook route; new dedicated router at `apps/api/src/routes/webhooks/`
- Mounted at `/api/v1/webhooks` in `app.ts` — bypasses licenseMiddleware (public endpoint)
- HMAC-SHA256 signature verification required before any processing

#### RBAC Pattern

- `PermissionModule` enum in `packages/domain-core/src/rbac`
- New module `INVOICES` must be added with permissions: `can_view`, `can_create`, `can_edit`

---

## Phase 1 — Data Model Design

### 1.1 Migration File

**File:** `apps/api/src/db/tenant/migrations/20260409_025_billing_and_invoices.ts`
**Migration number:** 025
**Follows:** `20260408_024_promocodes.ts`

```ts
/**
 * Migration 025 — Billing & Invoices
 *
 * Creates invoices and billing_audit_logs tables with
 * all constraints, unique indexes, and partial indexes.
 *
 * No data backfill — existing subscriptions predate invoice tracking.
 *
 * Stage: STAGE_46_BILLING_AND_INVOICES
 */
import type { PoolClient } from "pg";

export async function up(client: PoolClient): Promise<void> {
  await client.query("BEGIN");
  try {
    // -----------------------------------------------------------------------
    // 1. invoices table
    // -----------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_number       VARCHAR(64) NOT NULL,
        subscriber_id        UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
        subscription_plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
        billing_period_start TIMESTAMPTZ NOT NULL,
        billing_period_end   TIMESTAMPTZ NOT NULL,
        amount               NUMERIC(12,2) NOT NULL,
        currency             VARCHAR(10) NOT NULL DEFAULT 'SAR',
        payment_method       VARCHAR(20) NOT NULL,
        payment_reference    VARCHAR(255),
        proof_file_id        UUID REFERENCES media(id) ON DELETE SET NULL,
        status               VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        activation_date      TIMESTAMPTZ,
        idempotency_key      VARCHAR(255),
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT invoices_status_check CHECK (status IN ('PENDING','PAID','FAILED','CANCELLED')),
        CONSTRAINT invoices_payment_method_check CHECK (payment_method IN ('GATEWAY','MANUAL')),
        CONSTRAINT invoices_period_check CHECK (billing_period_end > billing_period_start),
        CONSTRAINT invoices_amount_check CHECK (amount >= 0)
      )
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number_workspace
        ON invoices(invoice_number)
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_idempotency
        ON invoices(idempotency_key)
        WHERE idempotency_key IS NOT NULL
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_subscriber
        ON invoices(subscriber_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_status
        ON invoices(status)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_created
        ON invoices(created_at DESC)
    `);

    // -----------------------------------------------------------------------
    // 2. billing_audit_logs table
    // -----------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS billing_audit_logs (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
        event      VARCHAR(64) NOT NULL,
        actor_id   UUID,
        actor_type VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
        metadata   JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT billing_audit_actor_type_check CHECK (actor_type IN ('SYSTEM','STAFF','GATEWAY'))
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_billing_audit_invoice
        ON billing_audit_logs(invoice_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_billing_audit_created
        ON billing_audit_logs(created_at DESC)
    `);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}
```

### 1.2 Drizzle Schema Files

**New files:**

- `apps/api/src/db/tenant/schemas/invoices.schema.ts`
- `apps/api/src/db/tenant/schemas/billing-audit-logs.schema.ts`

**`invoices.schema.ts` columns:**

```ts
import { index, pgTable, uniqueIndex } from "drizzle-orm/pg-core";
import { uuid, varchar, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { studentsTable } from "./students.schema";
import { plansTable } from "./plans.schema";
import { mediaTable } from "./media.schema";

export const invoicesTable = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceNumber: varchar("invoice_number", { length: 64 }).notNull(),
    subscriberId: uuid("subscriber_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "restrict" }),
    subscriptionPlanId: uuid("subscription_plan_id")
      .notNull()
      .references(() => plansTable.id, { onDelete: "restrict" }),
    billingPeriodStart: timestamp("billing_period_start", { withTimezone: true }).notNull(),
    billingPeriodEnd: timestamp("billing_period_end", { withTimezone: true }).notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("SAR"),
    paymentMethod: varchar("payment_method", { length: 20 }).notNull(),
    paymentReference: varchar("payment_reference", { length: 255 }),
    proofFileId: uuid("proof_file_id").references(() => mediaTable.id, { onDelete: "setNull" }),
    status: varchar("status", { length: 20 }).notNull().default("PENDING"),
    activationDate: timestamp("activation_date", { withTimezone: true }),
    idempotencyKey: varchar("idempotency_key", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("idx_invoices_number_workspace").on(t.invoiceNumber),
    uniqueIndex("idx_invoices_idempotency")
      .on(t.idempotencyKey)
      .where(sql`idempotency_key IS NOT NULL`),
    index("idx_invoices_subscriber").on(t.subscriberId),
    index("idx_invoices_status").on(t.status),
    index("idx_invoices_created").on(t.createdAt),
  ],
);
```

### 1.3 Schema Exports

Update `apps/api/src/db/tenant/schemas/index.ts` to export both new schema tables.

---

## Phase 2 — Domain Module Design

### 2.1 Module Location

`packages/domain-core/src/billing/`

### 2.2 Files

```
billing.types.ts           — Pure types only
billing.repository.ts      — Raw SQL CRUD + audit log
billing.service.ts         — Business logic + transaction orchestration
billing.errors.ts          — Typed DomainError subclasses
billing.validators.ts      — Invoice number generation, status machine guard
webhook.service.ts         — Signature verification + idempotency
index.ts                   — Public barrel exports
```

### 2.3 `billing.types.ts`

```ts
export type InvoiceStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED";
export type PaymentMethod = "GATEWAY" | "MANUAL";
export type AuditActorType = "SYSTEM" | "STAFF" | "GATEWAY";
export type BillingEvent =
  | "invoice_created"
  | "proof_uploaded"
  | "payment_verified"
  | "payment_failed"
  | "invoice_cancelled"
  | "subscription_activated";

export interface InvoiceRow {
  id: string;
  invoice_number: string;
  subscriber_id: string;
  subscription_plan_id: string;
  billing_period_start: Date;
  billing_period_end: Date;
  amount: string; // NUMERIC returned as string from pg
  currency: string;
  payment_method: PaymentMethod;
  payment_reference: string | null;
  proof_file_id: string | null;
  status: InvoiceStatus;
  activation_date: Date | null;
  idempotency_key: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface BillingAuditLogRow {
  id: string;
  invoice_id: string;
  event: BillingEvent;
  actor_id: string | null;
  actor_type: AuditActorType;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface CreateInvoiceInput {
  subscriber_id: string;
  subscription_plan_id: string;
  billing_period_start: Date; // server-derived
  billing_period_end: Date; // server-derived
  amount: number; // derived from plan.price
  currency?: string;
  payment_method: PaymentMethod;
  idempotency_key?: string;
}

export interface InvoiceListQuery {
  status?: InvoiceStatus;
  subscriber_id?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface InvoiceListResult {
  items: InvoiceRow[];
  total: number;
  page: number;
  limit: number;
}

export interface AuditContext {
  actorId: string | null;
  actorType: AuditActorType;
}

// Re-export DbClient for use in this module
export type { DbClient } from "../types";
```

### 2.4 `billing.errors.ts`

Error codes registered in `packages/domain-core/src/errors/`:

| Error Code                  | HTTP Status | Description                                   |
| --------------------------- | ----------- | --------------------------------------------- |
| `INVOICE_NOT_FOUND`         | 404         | Invoice does not exist in tenant DB           |
| `INVOICE_ALREADY_PAID`      | 409         | Invoice is already in PAID state              |
| `INVOICE_IMMUTABLE`         | 422         | Attempt to mutate a PAID invoice              |
| `DUPLICATE_ACTIVATION`      | 409         | Subscription already activated for invoice    |
| `INVALID_STATUS_TRANSITION` | 409         | CAS transition failed (concurrent write)      |
| `PROOF_REQUIRED`            | 422         | Manual approval attempted without proof       |
| `INVALID_WEBHOOK_SIGNATURE` | 401         | Gateway webhook HMAC verification failed      |
| `INVOICE_IDEMPOTENT`        | 200         | Webhook already processed (no-op return path) |

### 2.5 `billing.repository.ts` — Key Functions

```ts
// Read
createInvoice(client, input: CreateInvoiceInput): Promise<InvoiceRow>
getInvoiceById(client, invoiceId: string): Promise<InvoiceRow | null>
getInvoiceByIdempotencyKey(client, key: string): Promise<InvoiceRow | null>
listInvoices(client, query: InvoiceListQuery): Promise<InvoiceListResult>

// Write
updateInvoiceProof(client, invoiceId: string, mediaId: string): Promise<void>

// CAS transition (returns affected row count — 0 means concurrent collision)
transitionInvoiceStatus(
  client,
  invoiceId: string,
  fromStatus: InvoiceStatus,
  toStatus: InvoiceStatus,
  extra?: Partial<Pick<InvoiceRow, 'activation_date' | 'payment_reference'>>
): Promise<InvoiceRow | null>  // null = CAS failed

// Audit — append only, no UPDATE/DELETE
appendAuditLog(
  client,
  invoiceId: string,
  event: BillingEvent,
  auditCtx: AuditContext,
  metadata?: Record<string, unknown>
): Promise<void>

generateInvoiceNumberSequence(client, workspaceSlug: string, year: number): Promise<string>
```

**`transitionInvoiceStatus` CAS query:**

```sql
UPDATE invoices
SET
  status = $newStatus,
  updated_at = NOW(),
  activation_date = CASE WHEN $activationDate IS NOT NULL THEN $activationDate ELSE activation_date END,
  payment_reference = CASE WHEN $paymentReference IS NOT NULL THEN $paymentReference ELSE payment_reference END
WHERE id = $invoiceId AND status = $fromStatus
RETURNING *
```

Returns `null` if affected rows = 0 (concurrent transition already happened).

### 2.6 `billing.service.ts` — Transaction Orchestration

**`createInvoiceForSubscription`** (READ COMMITTED):

1. Fetch plan by `subscription_plan_id` — error if not found or inactive
2. Compute `billing_period_start = NOW()`, `billing_period_end = NOW() + plan.duration_days`
3. `amount` = `plan.price` (no client price accepted)
4. Generate `invoice_number` via sequence
5. `createInvoice()` — returns new invoice row
6. `appendAuditLog('invoice_created', { actor_type: 'STAFF' })`
7. Return `InvoiceRow`

**`confirmGatewayPayment`** (SERIALIZABLE):

1. Check `idempotency_key` — if exists and status = PAID → return `{ already_processed: true }`
2. `transitionInvoiceStatus(PENDING → PAID)` — if `null` → throw `INVALID_STATUS_TRANSITION`
3. `activateSubscriptionFromInvoice(invoiceRow, client)` — must be within same transaction
4. `appendAuditLog('payment_verified', { actor_type: 'GATEWAY', metadata: { payment_reference } })`
5. `appendAuditLog('subscription_activated')`
6. Return updated invoice

**`verifyManualPayment`** (SERIALIZABLE):

1. Fetch invoice — 404 if missing
2. Validate `proof_file_id IS NOT NULL` — 422 if missing
3. Validate `status = PENDING`
4. `transitionInvoiceStatus(PENDING → PAID)`
5. `activateSubscriptionFromInvoice(invoiceRow, client)`
6. `appendAuditLog('payment_verified', { actor_type: 'STAFF', actor_id, metadata: { reason } })`
7. `appendAuditLog('subscription_activated')`
8. Return updated invoice

**`cancelInvoice`** (READ COMMITTED):

1. Fetch invoice — 404 if missing
2. Guard `status !== PAID` — 409 if PAID (immutable)
3. Guard `status = PENDING` — 409 if already cancelled
4. `transitionInvoiceStatus(PENDING → CANCELLED)`
5. `appendAuditLog('invoice_cancelled', { metadata: { reason } })`
6. Return updated invoice

**`activateSubscriptionFromInvoice`** (within caller's SERIALIZABLE transaction):

1. Guard: if `invoice.activation_date IS NOT NULL` → throw `DUPLICATE_ACTIVATION` (idempotency)
2. Call `subscriptions.service.activateSubscription({ student_id, plan_id, started_at: invoice.activation_date })` within same `PoolClient`

### 2.7 `webhook.service.ts`

```ts
verifyGatewaySignature(
  rawBody: string,
  signature: string,   // from X-Gateway-Signature header
  secret: string       // from env: GATEWAY_WEBHOOK_SECRET
): boolean

// HMAC-SHA256 comparison using timingSafeEqual
```

### 2.8 Domain Index Registration

Update `packages/domain-core/src/index.ts`:

```ts
export * as billing from "./billing";
```

### 2.9 RBAC PermissionModule Addition

Add `INVOICES = 'invoices'` to `PermissionModule` enum in `packages/domain-core/src/rbac/`.

---

## Phase 3 — API Layer Design

### 3.1 Validation Schemas

**File:** `packages/validation/src/backoffice/invoices.schemas.ts`

```ts
// CreateInvoiceSchema
{
  subscriber_id: z.string().uuid(),
  subscription_plan_id: z.string().uuid(),
  payment_method: z.enum(['GATEWAY', 'MANUAL']),
  idempotency_key: z.string().max(255).optional(),
}

// UploadProofSchema
{
  proof_file_id: z.string().uuid(),
}

// ApproveInvoiceSchema
{
  reason: z.string().min(3).max(500).optional(),
}

// CancelInvoiceSchema
{
  reason: z.string().min(3).max(500),
}

// ListInvoicesQuerySchema
{
  status: z.enum(['PENDING','PAID','FAILED','CANCELLED']).optional(),
  subscriber_id: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
}

// GatewayWebhookSchema
{
  idempotency_key: z.string().max(255),
  invoice_id: z.string().uuid(),
  payment_reference: z.string().max(255),
  status: z.enum(['paid', 'failed']),
}
```

Export in `packages/validation/src/backoffice/index.ts`.

### 3.2 Route Handler Files

**Directory:** `apps/api/src/routes/backoffice/invoices/`

| File                 | Handler                                          | Description                |
| -------------------- | ------------------------------------------------ | -------------------------- |
| `helpers.ts`         | `getDb`, `buildAuditCtx`, `invoiceErrorResponse` | Shared helpers             |
| `list-invoices.ts`   | `handleListInvoices`                             | GET /invoices (paginated)  |
| `create-invoice.ts`  | `handleCreateInvoice`                            | POST /invoices → PENDING   |
| `get-invoice.ts`     | `handleGetInvoice`                               | GET /invoices/:id          |
| `cancel-invoice.ts`  | `handleCancelInvoice`                            | PATCH /invoices/:id/cancel |
| `upload-proof.ts`    | `handleUploadProof`                              | POST /invoices/:id/proof   |
| `approve-invoice.ts` | `handleApproveInvoice`                           | POST /invoices/:id/approve |
| `index.ts`           | `invoicesRouter`                                 | Hono router + guard wiring |

**Directory:** `apps/api/src/routes/webhooks/`

| File                 | Handler                | Description                        |
| -------------------- | ---------------------- | ---------------------------------- |
| `gateway-billing.ts` | `handleGatewayBilling` | POST /webhooks/billing/gateway     |
| `index.ts`           | `webhooksRouter`       | Hono router (no licenseMiddleware) |

### 3.3 `invoices/index.ts` Router

```ts
export const invoicesRouter = new Hono<BackofficeEnv>();

// Order matters: specific paths before :id
invoicesRouter.post("/invoices", guard(INVOICES, "can_create"), handleCreateInvoice);
invoicesRouter.get("/invoices", guard(INVOICES, "can_view"), handleListInvoices);
invoicesRouter.get("/invoices/:id", guard(INVOICES, "can_view"), handleGetInvoice);
invoicesRouter.patch("/invoices/:id/cancel", guard(INVOICES, "can_edit"), handleCancelInvoice);
invoicesRouter.post("/invoices/:id/proof", guard(INVOICES, "can_edit"), handleUploadProof);
invoicesRouter.post("/invoices/:id/approve", guard(INVOICES, "can_edit"), handleApproveInvoice);
```

### 3.4 `webhooks/index.ts` Router

```ts
export const webhooksRouter = new Hono();
// No licenseMiddleware, no auth middleware — public endpoint
// Rate limited at app.ts level: 100/min per IP
webhooksRouter.post("/webhooks/billing/gateway", handleGatewayBilling);
```

### 3.5 `app.ts` Additions

```ts
// Import
import { invoicesRouter } from "./routes/backoffice/invoices/index";
import { webhooksRouter } from "./routes/webhooks/index";

// Mount (after subscriptions, before closing)
app.route("/api/v1/backoffice/workspace", invoicesRouter);
app.route("/api/v1", webhooksRouter);
```

---

## Phase 4 — Observability & Integration

### 4.1 Structured Logging Fields

All billing route handlers set these structured log attributes:

```ts
{
  request_id: string,
  workspace_slug: string,
  invoice_id: string,
  actor_id: string | null,
  event: string,
  status_before: string | null,
  status_after: string | null,
}
```

- Status transitions logged at `INFO`
- Webhook signature mismatches at `WARN`
- CAS collision / double-activation at `ERROR`

### 4.2 Rate Limiting

Applied via `createRateLimitMiddleware` in `app.ts`:

| Route                                             | Limit            |
| ------------------------------------------------- | ---------------- |
| `POST /backoffice/workspace/invoices`             | 30/min/workspace |
| `POST /backoffice/workspace/invoices/:id/approve` | 20/min/workspace |
| `POST /backoffice/workspace/invoices/:id/proof`   | 20/min/workspace |
| `POST /webhooks/billing/gateway`                  | 100/min/IP       |

---

## Phase 5 — Test Plan

### 5.1 Unit Tests

**`packages/domain-core/src/billing/__tests__/billing.service.test.ts`**

| Test                                                                  | Type |
| --------------------------------------------------------------------- | ---- |
| createInvoiceForSubscription: creates PENDING record                  | unit |
| createInvoiceForSubscription: rejects inactive plan                   | unit |
| confirmGatewayPayment: transitions PENDING → PAID                     | unit |
| confirmGatewayPayment: idempotent on duplicate key                    | unit |
| confirmGatewayPayment: CAS failure throws INVALID_STATUS_TRANSITION   | unit |
| verifyManualPayment: rejects without proof_file_id                    | unit |
| verifyManualPayment: transitions PENDING → PAID                       | unit |
| cancelInvoice: cancels PENDING with reason                            | unit |
| cancelInvoice: rejects cancel of PAID invoice                         | unit |
| activateSubscriptionFromInvoice: idempotent (no duplicate activation) | unit |

**`packages/domain-core/src/billing/__tests__/webhook.service.test.ts`**

| Test                                         | Type |
| -------------------------------------------- | ---- |
| verifyGatewaySignature: accepts valid HMAC   | unit |
| verifyGatewaySignature: rejects invalid HMAC | unit |
| verifyGatewaySignature: uses timingSafeEqual | unit |

### 5.2 Integration Tests

**`tests/api/backoffice/invoices/`**

| Test                                               | Scope       |
| -------------------------------------------------- | ----------- |
| POST /invoices: creates invoice in PENDING state   | integration |
| POST /invoices: requires auth + RBAC               | integration |
| POST /webhooks/billing/gateway: confirms payment   | integration |
| POST /webhooks/billing/gateway: idempotent (200)   | integration |
| POST /invoices/:id/approve: requires proof first   | integration |
| Concurrent gateway webhook: only one PAID succeeds | integration |
| Invoice list: filters by status, subscriber        | integration |
| Cross-tenant: invoice B not visible from tenant A  | integration |

---

## Phase 6 — Implementation Order

Tasks execute in this order (dependencies respected):

1. Migration 025 (`billing_and_invoices`)
2. Drizzle schema: `invoices.schema.ts` + `billing-audit-logs.schema.ts`
3. Domain types: `billing.types.ts`
4. Domain errors: `billing.errors.ts`
5. Domain repository: `billing.repository.ts`
6. Webhook service: `webhook.service.ts`
7. Domain service: `billing.service.ts`
8. Validation schemas: `invoices.schemas.ts`
9. RBAC: add `INVOICES` to `PermissionModule`
10. Route helpers: `invoices/helpers.ts`
11. Route handlers: one file per handler
12. Invoice router: `invoices/index.ts`
13. Webhook router: `webhooks/index.ts`; `webhooks/gateway-billing.ts`
14. `app.ts` route mounts
15. Domain index barrel update
16. Unit tests: billing service + webhook service
17. Integration tests: invoice API flows

---

## Architecture Compliance Check

| Check                                    | Status                                        |
| ---------------------------------------- | --------------------------------------------- |
| Database-per-tenant preserved            | ✅ ADR-0001 — tenant DB only                  |
| No cross-tenant reads                    | ✅ Tenant resolver enforced                   |
| License middleware on all /backoffice/\* | ✅ Webhook bypassed via separate router mount |
| Forward-only migration                   | ✅ Migration 025 — no rollback                |
| Server-authoritative time                | ✅ All timestamps from DB NOW()               |
| Atomic status transitions (CAS)          | ✅ `WHERE status = 'PENDING'` guard           |
| Idempotency on webhook                   | ✅ `idempotency_key` unique index             |
| No business logic in API layer           | ✅ Delegates to domain-core                   |
| No direct DB from Backoffice UI          | ✅ Via packages/api-client                    |
| Audit log append-only                    | ✅ No UPDATE/DELETE on audit table            |

---

## Open Decisions

| Decision                        | Resolution                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------- |
| Invoice sequence prefix         | `INV-<workspace_slug>-<YYYY>-<NNNNNN>` — 6-digit zero-padded sequence           |
| Webhook mount path              | `/api/v1/webhooks/billing/gateway` (not under `/backoffice/workspace`)          |
| gateway_webhook_secret env      | `GATEWAY_WEBHOOK_SECRET` — platform environment — not per-tenant                |
| Frontoffice subscription gating | Status already enforced in Stage 44 via `subscription_status` field on students |
| media table FK for proof        | Assumes `media` table exists — Stage 41 or earlier creates it                   |
