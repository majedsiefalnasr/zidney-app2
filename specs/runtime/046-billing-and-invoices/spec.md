# Stage 46 – Billing & Invoices

**Phase:** 3 – Backoffice Core
**Subdomain:** 06_COMMERCIAL_LAYER
**Branch:** `spec/046-billing-and-invoices`
**Stage File:** `specs/phases/03_BACKOFFICE_CORE/06_COMMERCIAL_LAYER/STAGE_46_BILLING_AND_INVOICES.md`

---

## Objective

Implement a deterministic billing and invoice system that:

1. Tracks all subscription-related payments (gateway and manual)
2. Controls subscription activation via invoice lifecycle — no activation without PAID invoice
3. Ensures financial auditability through immutable audit logs
4. Prevents double activation and invoice tampering via atomic status transitions
5. Exposes invoice listing and filtering in Backoffice
6. Integrates with subscription engine (Stage 44) for activation relay

Billing must be financially consistent, auditable, and idempotent. No Frontoffice monetization feature may be built without this stage being stable.

---

## Architecture Governance Declaration

✅ No cross-tenant access — all invoice/billing reads and writes scoped to tenant DB per ADR-0001
✅ No middleware bypass — license middleware remains mandatory on all workspace routes
✅ No grading outside Worker — not applicable to billing stage
✅ Tenant resolver only — no direct database instantiation anywhere in billing domain
✅ No weakening of snapshot integrity — not applicable (billing does not touch attempt engine)
✅ All writes transactional — invoice creation, status transitions, subscription activation all within SERIALIZABLE transactions
✅ Version compatibility enforced — migrations follow forward-only policy (ADR-0003)
✅ Server-authoritative time — all `created_at`, `activation_date`, `billing_period_start/end` use DB `NOW()` (ADR-0006)
✅ No client-authoritative time — client-supplied timestamps are rejected; server clock is authoritative

---

## Trust Chain Verification

- [x] Tenant isolation is the first gate (slug-based, database-per-tenant)
- [x] License validation occurs before any workspace operation
- [x] Authentication is checked after tenant resolution
- [x] Attempt engine: not applicable
- [x] Runtime enforces server-authoritative time for all billing timestamps
- [x] Frontoffice receives only subscription status flags — no raw billing records

---

## Import Boundary Compliance

- `apps/api` → `packages/domain-core` ✅
- `apps/backoffice` → `packages/api-client` ✅ (no direct DB imports)
- `packages/domain-core/billing` → `packages/domain-core/subscriptions` ✅ (internal cross-domain for activation relay)
- `packages/domain-core/billing` → `packages/domain-core/students` ✅ (for FK validation only)
- `packages/*` → `apps/*` ❌ FORBIDDEN
- UI → DB schemas ❌ FORBIDDEN

---

## Scope Clarification

**In scope:**

- Workspace-level invoice creation (PENDING state)
- Gateway payment flow (webhook confirmation → PAID → subscription activation)
- Manual payment flow (proof upload → staff verification → PAID → subscription activation)
- Invoice lifecycle state machine: PENDING → PAID | FAILED | CANCELLED
- Paid invoice immutability enforcement
- Subscription activation relay (single activation per invoice)
- Idempotency on gateway callback and renewal events
- Audit log for all billing actions
- Backoffice invoice listing and filtering
- Concurrency-safe status transitions

**Out of scope:**

- Global/platform-level billing (MMC)
- Refund engine (future stage)
- Accounting exports (future stage)
- Student credit/wallet engine
- Multi-currency support (future)

---

## Current State Analysis

### Existing (Stage 44)

The `subscriptions` table exists with columns: `id, student_id, plan_id, status, started_at, expires_at, payment_method, gateway_ref, notes`.

Subscriptions can currently be activated directly (manually or by gateway reference). There is NO dedicated invoice record tracking payment lifecycle — this leaves a financial audit gap.

### What Must Be Built (Stage 46)

| Concern                       | What is needed                                                             |
| ----------------------------- | -------------------------------------------------------------------------- |
| `invoices` table              | New tenant schema table for payment lifecycle records                      |
| Invoice domain module         | `packages/domain-core/src/billing/`                                        |
| Gateway webhook route         | `POST /backoffice/billing/webhooks/gateway`                                |
| Manual payment routes         | `POST /invoices`, `POST /invoices/:id/proof`, `POST /invoices/:id/approve` |
| Invoice listing routes        | `GET /invoices`, `GET /invoices/:id`                                       |
| Subscription activation relay | Upgrade `subscriptions.service.ts` to require invoice                      |
| Billing audit log             | Append-only `billing_audit_logs` table                                     |
| Backoffice Vue pages          | Invoice list, invoice detail, proof upload                                 |

---

## Database Schema

### New Table: `invoices`

```sql
CREATE TABLE invoices (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number        VARCHAR(64) NOT NULL,
  subscriber_id         UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  subscription_plan_id  UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  billing_period_start  TIMESTAMPTZ NOT NULL,
  billing_period_end    TIMESTAMPTZ NOT NULL,
  amount                NUMERIC(12,2) NOT NULL,
  currency              VARCHAR(10) NOT NULL DEFAULT 'SAR',
  payment_method        VARCHAR(20) NOT NULL,  -- 'GATEWAY' | 'MANUAL'
  payment_reference     VARCHAR(255),
  proof_file_id         UUID REFERENCES media(id) ON DELETE SET NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  activation_date       TIMESTAMPTZ,
  idempotency_key       VARCHAR(255),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_invoices_number_workspace ON invoices(invoice_number);
CREATE UNIQUE INDEX idx_invoices_idempotency ON invoices(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_invoices_subscriber ON invoices(subscriber_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_created ON invoices(created_at DESC);
```

**Constraints:**

- `status IN ('PENDING', 'PAID', 'FAILED', 'CANCELLED')`
- `payment_method IN ('GATEWAY', 'MANUAL')`
- `billing_period_end > billing_period_start`
- `amount >= 0`
- `invoice_number` unique per workspace (enforced at app level with sequence prefix)

### New Table: `billing_audit_logs`

```sql
CREATE TABLE billing_audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  event       VARCHAR(64) NOT NULL,
  actor_id    UUID,
  actor_type  VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_audit_invoice ON billing_audit_logs(invoice_id);
CREATE INDEX idx_billing_audit_created ON billing_audit_logs(created_at DESC);
```

**Immutability:** `billing_audit_logs` has no `UPDATE` or `DELETE` operations — append-only.

**Actor types:** `SYSTEM | STAFF | GATEWAY`

**Event types:**

- `invoice_created`
- `proof_uploaded`
- `payment_verified`
- `payment_failed`
- `invoice_cancelled`
- `subscription_activated`

---

## Migration Strategy

**Migration number:** 025 (follows Stage 45 promo codes at 024)
**Files:**

- `apps/api/src/db/tenant/migrations/20260407_025_billing_and_invoices.ts`

Steps:

1. Create `invoices` table with all indexes and constraints
2. Create `billing_audit_logs` table with indexes
3. No backfill required — existing subscriptions pre-date billing tracking

---

## Domain Modules

### New: `packages/domain-core/src/billing/`

```
billing.types.ts         — Pure types: InvoiceRow, InvoiceInput, BillingAuditLogRow, InvoiceStatus, PaymentMethod
billing.repository.ts    — createInvoice, getInvoice, getInvoiceByIdempotencyKey, listInvoices, transitionInvoiceStatus, appendAuditLog
billing.service.ts       — createInvoiceForSubscription, confirmGatewayPayment, verifyManualPayment, cancelInvoice, generateInvoiceNumber
billing.errors.ts        — Error codes: INVOICE_NOT_FOUND, INVOICE_ALREADY_PAID, INVOICE_IMMUTABLE, DUPLICATE_ACTIVATION, INVALID_STATUS_TRANSITION, PROOF_REQUIRED
webhook.service.ts       — Gateway webhook signature verification, idempotency check, payment confirmation
index.ts                 — Public exports
```

---

## API Endpoints

### Invoice Management (Backoffice — Admin/Staff)

| Method | Path                              | Handler           | Description                           |
| ------ | --------------------------------- | ----------------- | ------------------------------------- |
| GET    | `/backoffice/invoices`            | list-invoices.ts  | List invoices (paginated, filterable) |
| POST   | `/backoffice/invoices`            | create-invoice.ts | Create invoice in PENDING state       |
| GET    | `/backoffice/invoices/:id`        | get-invoice.ts    | Get invoice detail                    |
| PATCH  | `/backoffice/invoices/:id/cancel` | cancel-invoice.ts | Cancel PENDING invoice with reason    |

### Manual Payment Flow (Backoffice — Admin/Staff)

| Method | Path                               | Handler            | Description                            |
| ------ | ---------------------------------- | ------------------ | -------------------------------------- |
| POST   | `/backoffice/invoices/:id/proof`   | upload-proof.ts    | Upload payment proof (media reference) |
| POST   | `/backoffice/invoices/:id/approve` | approve-invoice.ts | Staff approves manual payment → PAID   |

### Gateway Webhook (Public — verified by signature)

| Method | Path                        | Handler            | Description                          |
| ------ | --------------------------- | ------------------ | ------------------------------------ |
| POST   | `/webhooks/billing/gateway` | gateway-webhook.ts | Gateway payment confirmation webhook |

### Query Parameters for List

- `status` — filter by invoice status
- `subscriber_id` — filter by student
- `from` — date range start (ISO)
- `to` — date range end (ISO)
- `page`, `limit` — pagination

---

## Functional Requirements

### FR-01 — Invoice Creation

Admin creates invoice for a student + plan combination:

- System generates unique `invoice_number` (e.g., `INV-<workspace>-<year>-<seq>`)
- `billing_period_start` and `billing_period_end` derived from plan `duration_days` (server-authoritative)
- `status = PENDING`
- Audit log: `invoice_created`

### FR-02 — Gateway Payment Flow

1. Invoice created in PENDING state with `payment_method = 'GATEWAY'`
2. System returns gateway redirect URL with invoice reference
3. Gateway sends webhook `POST /webhooks/billing/gateway`
4. Webhook handler verifies signature
5. Checks idempotency key (`idempotency_key` column) — if already PAID, returns 200 (no-op)
6. If `status = PENDING`: atomic transition `UPDATE invoices SET status = 'PAID' WHERE id = ? AND status = 'PENDING'` — if affected rows = 0, reject with conflict
7. On successful PAID transition: activate subscription via `billing.service.activateSubscriptionFromInvoice()`
8. Store `activation_date = NOW()`
9. Audit logs: `payment_verified`, `subscription_activated`

### FR-03 — Manual Payment Flow

1. Invoice created in PENDING state with `payment_method = 'MANUAL'`
2. Subscriber uploads proof file (`POST /invoices/:id/proof`) — media reference stored in `proof_file_id`
3. Audit log: `proof_uploaded`
4. Staff reviews and approves (`POST /invoices/:id/approve`) — logged with `actor_id = staff.id`, `actor_type = STAFF`
5. Atomic transition → PAID (same pattern as gateway)
6. Subscription activated, `activation_date = NOW()`
7. Audit logs: `payment_verified`, `subscription_activated`

**Rules:**

- Proof upload required before approval — approval without `proof_file_id` → validation error
- Approval action cannot be executed twice (idempotent by status check)

### FR-04 — Invoice Immutability (PAID)

Once `status = 'PAID'`:

- `amount`, `billing_period_start`, `billing_period_end`, `subscriber_id`, `subscription_plan_id` CANNOT change
- Only read operations permitted
- Any mutation attempt returns `INVOICE_IMMUTABLE` error

### FR-05 — Invoice Cancellation

Only PENDING invoices can be cancelled:

- Cancellation requires `reason` field (stored in audit log metadata)
- No cancellation after PAID
- Audit log: `invoice_cancelled` with reason

### FR-06 — Subscription Activation Relay

`billing.service.activateSubscriptionFromInvoice()` calls `subscriptions.service.activateSubscription()`:

- Checks for existing ACTIVE subscription — if present, expires it first
- Creates new ACTIVE subscription with `started_at = activation_date`, `expires_at = activation_date + plan.duration_days`
- Updates `students.subscription_status = 'ACTIVE'`
- All writes in a single SERIALIZABLE transaction
- Activation is idempotent — if `invoice.activation_date` is already set, no duplicate activation

### FR-07 — Invoice Listing

Backoffice paginated listing:

- Default sort: `created_at DESC`
- Filters: `status`, `subscriber_id`, date range
- Returns: invoice_number, subscriber name, plan name, amount, status, created_at, activation_date
- No raw financial data exposed to Frontoffice

---

## Transaction Boundaries

| Operation                       | Transaction Required       | Isolation Level | Idempotency                             |
| ------------------------------- | -------------------------- | --------------- | --------------------------------------- |
| Invoice creation                | ✅                         | READ COMMITTED  | `invoice_number` unique constraint      |
| Invoice status → PAID (gateway) | ✅                         | SERIALIZABLE    | `idempotency_key` column + status check |
| Invoice status → PAID (manual)  | ✅                         | SERIALIZABLE    | status check (only PENDING → PAID)      |
| Subscription activation import  | ✅                         | SERIALIZABLE    | `activation_date` null check            |
| Invoice cancellation            | ✅                         | READ COMMITTED  | status check (only PENDING → CANCELLED) |
| Audit log append                | ✅ (within parent tx)      | —               | append-only                             |
| Proof upload                    | ❌ (media ref update only) | READ COMMITTED  | idempotent media reference              |

**Concurrency pattern for status transitions:**

```sql
UPDATE invoices
SET status = $newStatus, updated_at = NOW()
WHERE id = $invoiceId AND status = $expectedCurrentStatus
RETURNING id
```

If `rows returned = 0` → throw `INVALID_STATUS_TRANSITION` (concurrent transition already happened).

---

## Idempotency Strategy

| Event                        | Mechanism                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------- |
| Gateway webhook              | `idempotency_key` column (unique index). Duplicate → 200 no-op                    |
| Invoice creation for renewal | No duplicate per billing period — `invoice_number` uniqueness + application guard |
| Subscription activation      | `activation_date IS NULL` check within transaction                                |
| Manual approval              | `status = PENDING` check before transition                                        |

---

## Authoritative Time Usage

- All billing timestamps use `NOW()` from the database server
- `billing_period_start` and `billing_period_end` — computed on server from plan `duration_days`
- `activation_date` — set at exact activation time within transaction
- No client-supplied timestamps accepted for any billing field

---

## License & Version Enforcement

- License middleware (`licenseMiddleware`) is mandatory on all `/backoffice/*` routes
- License must be `ACTIVE` for invoice creation and approval operations
- Webhook route `/webhooks/billing/gateway` bypasses license middleware (gateway callback may arrive after license expiry edge cases) — secured exclusively by signature verification
- Schema version check: `schema_version` enforced per ADR-0007
- Forward-only migration policy: ADR-0003

---

## Security Requirements

- **Signature verification mandatory** on all gateway webhook requests — HMAC-SHA256 with shared secret from environment config
- **No client-side invoice status updates** — status transitions only via verified server-side routes
- **Proof files stored securely** — referenced via `media` table; file access requires valid session
- **No invoice deletion** — CANCELLED state is terminal alternative
- **Staff action audit** — every manual approval logged with `actor_id` and `actor_type = STAFF`
- **No payment amount from client** — amount derived from plan at invoice creation time
- **Webhook rate limiting** — 100 req/min per IP on webhook endpoint

---

## Observability Requirements

Structured log fields for all billing routes:

```
request_id      string   — correlation ID
workspace_slug  string   — tenant identifier
invoice_id      uuid     — invoice being processed
actor_id        uuid     — staff or system actor (if applicable)
event           string   — billing event name
status_before   string   — previous invoice status
status_after    string   — new invoice status (if transition)
```

All status transitions log at `INFO` level.
Gateway webhook failures (signature mismatch, missing key) log at `WARN` level.
Double-activation attempts log at `ERROR` level.

---

## Rate Limiting & Abuse Protection

| Endpoint                                | Classification | Rate Limit           |
| --------------------------------------- | -------------- | -------------------- |
| `POST /backoffice/invoices`             | auth/admin     | 30/min per workspace |
| `POST /backoffice/invoices/:id/approve` | auth/admin     | 20/min per workspace |
| `POST /webhooks/billing/gateway`        | public/signed  | 100/min per IP       |
| `POST /backoffice/invoices/:id/proof`   | auth/admin     | 20/min per workspace |

---

## Layer Separation Confirmation

- ✅ Backoffice Vue pages contain no billing business logic — all via `packages/api-client`
- ✅ API routes delegate to `packages/domain-core/billing` service layer
- ✅ Subscription activation is coordinated through `packages/domain-core/subscriptions` — never directly from route handler
- ✅ No grading logic in billing domain
- ✅ MMC does not access tenant billing DB

---

## Validation Criteria

Stage complete when:

- [ ] Invoice creation creates PENDING record with correct fields
- [ ] Gateway webhook confirms payment atomically and idempotently
- [ ] Manual payment requires proof before approval is accepted
- [ ] Paid invoice rejects all mutation attempts
- [ ] Subscription activates exactly once per PAID invoice
- [ ] Duplicate gateway webhook returns 200 without re-activating
- [ ] Concurrent activation attempts: only one succeeds via optimistic lock
- [ ] Audit log generated for every billing event
- [ ] Invoice cancellation records reason in audit log
- [ ] Invoice listing returns correct paginated results with filters
- [ ] Expired subscription blocks Frontoffice dashboard
- [ ] All tests pass: unit + integration
- [ ] Lint and typecheck pass
- [ ] Migration validated

---

## Clarifications

### Session 2026-04-06

**Q1: Should invoice_number be globally unique across all tenants, or only within a workspace?**
A: Within workspace only. The unique index is on the tenant DB per ADR-0001. This matches the invoice_number pattern `INV-<workspace_slug>-<year>-<sequence>`.

**Q2: When a gateway webhook arrives for an already-PAID invoice (retry), should the response be 200 or 4xx?**
A: 200 OK with a `{ "already_processed": true }` flag. This ensures gateway retry logic does not treat it as a failure.

**Q3: Can a student have multiple PENDING invoices simultaneously (e.g., two payment attempt windows)?**
A: Yes — multiple PENDING invoices are allowed. Only one PAID activation is allowed per subscription period. The unique constraint on subscription ACTIVE state (from Stage 44) enforces this.

**Q4: Should proof upload replace an existing proof (re-upload) or append?**
A: Replace. The `proof_file_id` column is updated to the latest upload. Previous proof reference is discarded (not audited as separate event). The `proof_uploaded` audit log is appended each time.

**Q5: Is the gateway webhook secret stored in environment config only, or also in tenant DB?**
A: Environment config only (`GATEWAY_WEBHOOK_SECRET`). Not per-tenant — gateway integration is workspace-level but uses the same platform-level secret. If per-tenant gateway config is needed, that is a future stage.
