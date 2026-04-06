# Plan Report — Stage 46: Billing & Invoices

**Generated:** 2026-04-06T00:20:00.000Z
**Step:** Plan (3/7)
**Status:** DRAFT — Planning
**Branch:** `spec/046-billing-and-invoices`
**Stage File:** `specs/phases/03_BACKOFFICE_CORE/06_COMMERCIAL_LAYER/STAGE_46_BILLING_AND_INVOICES.md`

---

## Summary

The technical plan for Stage 46 (Billing & Invoices) covers end-to-end implementation of a deterministic, idempotent billing engine layered on top of the Stage 44 plans-and-subscriptions foundation. The plan defines a forward-only migration (025), two domain tables, a full domain module in `packages/domain-core/src/billing/`, six backoffice route handlers, one public webhook endpoint, and a comprehensive test suite.

---

## Research Phase Summary

### Patterns Confirmed

| Pattern                   | Source Reference                                                     |
| ------------------------- | -------------------------------------------------------------------- |
| Repository (raw SQL)      | `packages/domain-core/src/subscriptions/subscriptions.repository.ts` |
| Drizzle schema definition | `apps/api/src/db/tenant/schemas/` (plans, subscriptions examples)    |
| Migration structure       | `apps/api/src/db/tenant/migrations/20260408_024_promocodes.ts`       |
| Route handler + helpers   | `apps/api/src/routes/backoffice/subscriptions/`                      |
| Service SERIALIZABLE tx   | `packages/domain-core/src/subscriptions/subscriptions.service.ts`    |
| Router mounting           | `apps/api/src/app.ts` (list of existing `.route()` calls)            |
| RBAC guard wiring         | `apps/api/src/routes/backoffice/plans/index.ts`                      |

### Key Findings

- No existing webhook route infrastructure — will create `apps/api/src/routes/webhooks/` directory
- Migration 025 follows 024 (promocodes) — date prefix `20260409`
- `media` table exists in tenant schema — `proof_file_id` FK is safe
- RBAC `PermissionModule` enum requires `INVOICES = 'invoices'` addition
- `subscriptions.service.activateSubscription()` accepts a `PoolClient` parameter — safely callable within the billing transaction

---

## Schema Changes

### New Table: `invoices`

| Column                 | Type          | Constraints                                       |
| ---------------------- | ------------- | ------------------------------------------------- |
| `id`                   | UUID PK       | `DEFAULT gen_random_uuid()`                       |
| `invoice_number`       | VARCHAR(64)   | NOT NULL; UNIQUE per workspace                    |
| `subscriber_id`        | UUID FK       | REFERENCES students(id) ON DELETE RESTRICT        |
| `subscription_plan_id` | UUID FK       | REFERENCES plans(id) ON DELETE RESTRICT           |
| `billing_period_start` | TIMESTAMPTZ   | NOT NULL; server-computed                         |
| `billing_period_end`   | TIMESTAMPTZ   | NOT NULL; server-computed; > start enforced       |
| `amount`               | NUMERIC(12,2) | NOT NULL; >= 0; derived from plan.price           |
| `currency`             | VARCHAR(10)   | NOT NULL DEFAULT 'SAR'                            |
| `payment_method`       | VARCHAR(20)   | NOT NULL; CHECK IN ('GATEWAY','MANUAL')           |
| `payment_reference`    | VARCHAR(255)  | Nullable; set by gateway callback                 |
| `proof_file_id`        | UUID FK       | Nullable; REFERENCES media(id) ON DELETE SET NULL |
| `status`               | VARCHAR(20)   | NOT NULL DEFAULT 'PENDING'; CHECK IN (4 values)   |
| `activation_date`      | TIMESTAMPTZ   | Nullable; set atomically at PAID transition       |
| `idempotency_key`      | VARCHAR(255)  | Nullable; partial UNIQUE index (non-null only)    |
| `created_at`           | TIMESTAMPTZ   | NOT NULL DEFAULT NOW()                            |
| `updated_at`           | TIMESTAMPTZ   | NOT NULL DEFAULT NOW()                            |

**Indexes:** `idx_invoices_number_workspace` (UNIQUE), `idx_invoices_idempotency` (UNIQUE partial), `idx_invoices_subscriber`, `idx_invoices_status`, `idx_invoices_created`

### New Table: `billing_audit_logs`

| Column       | Type        | Constraints                                    |
| ------------ | ----------- | ---------------------------------------------- |
| `id`         | UUID PK     | `DEFAULT gen_random_uuid()`                    |
| `invoice_id` | UUID FK     | REFERENCES invoices(id) ON DELETE RESTRICT     |
| `event`      | VARCHAR(64) | NOT NULL                                       |
| `actor_id`   | UUID        | Nullable                                       |
| `actor_type` | VARCHAR(20) | NOT NULL DEFAULT 'SYSTEM'; CHECK IN (3 values) |
| `metadata`   | JSONB       | NOT NULL DEFAULT '{}'                          |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW()                         |

**Immutability contract:** No UPDATE or DELETE operations. Append-only.

**Indexes:** `idx_billing_audit_invoice`, `idx_billing_audit_created`

---

## Domain Module Plan

**Location:** `packages/domain-core/src/billing/`

| File                    | Responsibility                                           |
| ----------------------- | -------------------------------------------------------- |
| `billing.types.ts`      | InvoiceRow, CreateInvoiceInput, BillingEvent enums, etc. |
| `billing.repository.ts` | Raw SQL CRUD + CAS transition + audit append             |
| `billing.service.ts`    | Transaction orchestration for all 5 business flows       |
| `billing.errors.ts`     | 8 DomainError subclasses with codes and HTTP status      |
| `billing.validators.ts` | Invoice number generation, status machine helpers        |
| `webhook.service.ts`    | HMAC-SHA256 signature verification (timingSafeEqual)     |
| `index.ts`              | Public barrel exports                                    |

### Error Registry

| Code                        | HTTP | Scenario                          |
| --------------------------- | ---- | --------------------------------- |
| `INVOICE_NOT_FOUND`         | 404  | Invoice ID does not exist         |
| `INVOICE_ALREADY_PAID`      | 409  | Attempt to re-pay PAID invoice    |
| `INVOICE_IMMUTABLE`         | 422  | Mutation of PAID invoice          |
| `DUPLICATE_ACTIVATION`      | 409  | Subscription already activated    |
| `INVALID_STATUS_TRANSITION` | 409  | CAS guard: concurrent update won  |
| `PROOF_REQUIRED`            | 422  | Manual approval without proof     |
| `INVALID_WEBHOOK_SIGNATURE` | 401  | HMAC mismatch on webhook          |
| `INVOICE_IDEMPOTENT`        | 200  | Webhook already processed (no-op) |

---

## API Endpoints

### Backoffice (auth + licenseMiddleware + RBAC)

| Method | Path                                         | RBAC Permission     |
| ------ | -------------------------------------------- | ------------------- |
| POST   | `/backoffice/workspace/invoices`             | INVOICES.can_create |
| GET    | `/backoffice/workspace/invoices`             | INVOICES.can_view   |
| GET    | `/backoffice/workspace/invoices/:id`         | INVOICES.can_view   |
| PATCH  | `/backoffice/workspace/invoices/:id/cancel`  | INVOICES.can_edit   |
| POST   | `/backoffice/workspace/invoices/:id/proof`   | INVOICES.can_edit   |
| POST   | `/backoffice/workspace/invoices/:id/approve` | INVOICES.can_edit   |

### Webhook (signature-verified, no auth middleware)

| Method | Path                               | Verification                      |
| ------ | ---------------------------------- | --------------------------------- |
| POST   | `/api/v1/webhooks/billing/gateway` | HMAC-SHA256 (X-Gateway-Signature) |

---

## Transaction Matrix

| Operation               | Isolation Level                 | Idempotency Mechanism                 |
| ----------------------- | ------------------------------- | ------------------------------------- |
| Invoice creation        | READ COMMITTED                  | `invoice_number` UNIQUE constraint    |
| Gateway payment (PAID)  | SERIALIZABLE                    | `idempotency_key` partial index       |
| Manual payment approval | SERIALIZABLE                    | Status CAS (`WHERE status='PENDING'`) |
| Subscription activation | SERIALIZABLE (within parent tx) | `activation_date IS NULL` guard       |
| Invoice cancellation    | READ COMMITTED                  | Status CAS (`WHERE status='PENDING'`) |
| Audit log append        | Within parent tx                | Append-only                           |

---

## File Change Summary

| File                                                                     | Action |
| ------------------------------------------------------------------------ | ------ |
| `apps/api/src/db/tenant/migrations/20260409_025_billing_and_invoices.ts` | CREATE |
| `apps/api/src/db/tenant/schemas/invoices.schema.ts`                      | CREATE |
| `apps/api/src/db/tenant/schemas/billing-audit-logs.schema.ts`            | CREATE |
| `apps/api/src/db/tenant/schemas/index.ts`                                | UPDATE |
| `packages/domain-core/src/billing/billing.types.ts`                      | CREATE |
| `packages/domain-core/src/billing/billing.errors.ts`                     | CREATE |
| `packages/domain-core/src/billing/billing.repository.ts`                 | CREATE |
| `packages/domain-core/src/billing/webhook.service.ts`                    | CREATE |
| `packages/domain-core/src/billing/billing.service.ts`                    | CREATE |
| `packages/domain-core/src/billing/index.ts`                              | CREATE |
| `packages/domain-core/src/rbac/` (PermissionModule)                      | UPDATE |
| `packages/domain-core/src/index.ts`                                      | UPDATE |
| `packages/validation/src/backoffice/invoices.schemas.ts`                 | CREATE |
| `packages/validation/src/backoffice/index.ts`                            | UPDATE |
| `apps/api/src/routes/backoffice/invoices/helpers.ts`                     | CREATE |
| `apps/api/src/routes/backoffice/invoices/list-invoices.ts`               | CREATE |
| `apps/api/src/routes/backoffice/invoices/create-invoice.ts`              | CREATE |
| `apps/api/src/routes/backoffice/invoices/get-invoice.ts`                 | CREATE |
| `apps/api/src/routes/backoffice/invoices/cancel-invoice.ts`              | CREATE |
| `apps/api/src/routes/backoffice/invoices/upload-proof.ts`                | CREATE |
| `apps/api/src/routes/backoffice/invoices/approve-invoice.ts`             | CREATE |
| `apps/api/src/routes/backoffice/invoices/index.ts`                       | CREATE |
| `apps/api/src/routes/webhooks/gateway-billing.ts`                        | CREATE |
| `apps/api/src/routes/webhooks/index.ts`                                  | CREATE |
| `apps/api/src/app.ts`                                                    | UPDATE |
| Unit test files (billing.service, webhook.service)                       | CREATE |
| Integration test files (invoices API)                                    | CREATE |

**Total files:** 28 (22 create + 6 update)

---

## Architecture Compliance

All ADR constraints verified:

| ADR      | Compliance                                                                       |
| -------- | -------------------------------------------------------------------------------- |
| ADR-0001 | Database-per-tenant enforced; no cross-tenant queries                            |
| ADR-0003 | Forward-only migration 025; no rollback                                          |
| ADR-0006 | Server-authoritative time: `NOW()` everywhere                                    |
| ADR-0007 | Schema version middleware active on backoffice                                   |
| ADR-0008 | Semantic versioning: no breaking contract changes                                |
| ADR-0009 | License middleware on all `/backoffice/*` routes; webhook intentionally excluded |

No architectural modifications required. No ADR escalation needed.

---

## Guardian Validation Results

| Guardian              | Verdict                                                                    |
| --------------------- | -------------------------------------------------------------------------- |
| Architecture Guardian | PASS — No new architecture introduced; follows established patterns        |
| API Designer          | PASS — RESTful endpoints, correct status codes, envelope contract followed |
