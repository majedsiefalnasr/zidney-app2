# Implementation Report — Stage 46: Billing & Invoices

**Stage:** STAGE_46_BILLING_AND_INVOICES  
**Phase:** PHASE_03_BACKOFFICE_CORE / PHASE_06_COMMERCIAL_LAYER  
**Branch:** `spec/046-billing-and-invoices`  
**Completed:** 2026-04-06  
**Tasks:** 28 / 28 completed (0 deferred)

---

## Summary

Full implementation of the Billing & Invoices feature including:

- Database schema (migration 025) for `invoices` and `billing_audit_logs`
- Domain package `@zidney/domain-core/billing` — types, errors, repository, billing service, webhook service
- 6 Hono route handlers under `/api/v1/backoffice/workspace/invoices`
- Gateway webhook handler at `/api/v1/webhooks/billing/gateway`
- Full unit + integration test coverage (38 tests, all passing)

---

## Files Changed

### Database (Tenant)

| File                                                                     | Change                                                            |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `apps/api/src/db/tenant/migrations/20260409_025_billing_and_invoices.ts` | NEW — creates `invoices` and `billing_audit_logs` tables, indexes |
| `apps/api/src/db/tenant/schemas/invoices.schema.ts`                      | NEW — Drizzle schema for `invoices` table                         |
| `apps/api/src/db/tenant/schemas/billing-audit-logs.schema.ts`            | NEW — Drizzle schema for `billing_audit_logs` table (append-only) |
| `apps/api/src/db/tenant/schemas/index.ts`                                | MODIFIED — added `invoices` and `billingAuditLogs` exports        |

### Domain Package — `packages/domain-core/src/billing/`

| File                                | Change                                                                                                                                                                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `billing.types.ts`                  | NEW — `InvoiceRow`, `CreateInvoiceInput`, `InvoiceListQuery`, `InvoiceListResult`, `BillingAuditLogRow`, `InvoiceStatus`, `PaymentMethod`, `BillingEvent`, `AuditActorType`, `AuditContext`                                                         |
| `billing.errors.ts`                 | NEW — `BillingError` class, `BillingErrorCode` union (8 codes), `BILLING_ERROR_HTTP` status map                                                                                                                                                     |
| `billing.repository.ts`             | NEW — `createInvoice`, `getInvoiceById`, `getInvoiceByIdempotencyKey`, `listInvoices`, `transitionInvoiceStatus` (CAS), `updateInvoiceProof`, `appendAuditLog`, `generateInvoiceNumberSequence`                                                     |
| `billing.service.ts`                | NEW — `createInvoiceForSubscription`, `confirmGatewayPayment` (idempotent, SERIALIZABLE), `verifyManualPayment` (SERIALIZABLE, proof guard), `cancelInvoice` (READ COMMITTED), `getInvoiceByIdService`, `listInvoicesService`, `uploadInvoiceProof` |
| `webhook.service.ts`                | NEW — `verifyGatewaySignature` with HMAC-SHA256 + `timingSafeEqual`                                                                                                                                                                                 |
| `index.ts`                          | NEW — barrel exports for all billing domain exports                                                                                                                                                                                                 |
| `__tests__/billing.service.test.ts` | NEW — 17 unit tests covering all service functions                                                                                                                                                                                                  |
| `__tests__/webhook.service.test.ts` | NEW — 8 unit tests for HMAC signature verification                                                                                                                                                                                                  |

### Domain Package — `packages/domain-core/`

| File                     | Change                                                               |
| ------------------------ | -------------------------------------------------------------------- |
| `src/index.ts`           | MODIFIED — added `export * as billing from './billing'`              |
| `src/rbac/rbac.types.ts` | MODIFIED — added `INVOICES = 'invoices'` to `PermissionModule` enum  |
| `package.json`           | MODIFIED — added `"./billing": "./src/billing/index.ts"` export path |

### Validation Package — `packages/validation/`

| File                                | Change                                                                                                                                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/backoffice/billing.schemas.ts` | NEW — `createInvoiceBodySchema`, `uploadProofBodySchema`, `approveInvoiceBodySchema` (no body), `cancelInvoiceBodySchema`, `listInvoicesQuerySchema`, `invoiceIdParamsSchema`, `gatewayWebhookBodySchema` |
| `src/backoffice/index.ts`           | MODIFIED — added billing schema exports                                                                                                                                                                   |

### API Routes — `apps/api/src/routes/backoffice/invoices/`

| File                 | Change                                                               |
| -------------------- | -------------------------------------------------------------------- |
| `helpers.ts`         | NEW — `getDb(c)`, `buildAuditCtx(c)`, `invoiceErrorResponse(c, err)` |
| `list-invoices.ts`   | NEW — GET /invoices with status/subscriber/date filters, pagination  |
| `create-invoice.ts`  | NEW — POST /invoices → 201, idempotency key support                  |
| `get-invoice.ts`     | NEW — GET /invoices/:id                                              |
| `cancel-invoice.ts`  | NEW — PATCH /invoices/:id/cancel                                     |
| `upload-proof.ts`    | NEW — POST /invoices/:id/proof                                       |
| `approve-invoice.ts` | NEW — POST /invoices/:id/approve                                     |
| `index.ts`           | NEW — invoicesRouter with per-route RBAC guards                      |

### API Routes — `apps/api/src/routes/webhooks/`

| File                 | Change                                                              |
| -------------------- | ------------------------------------------------------------------- |
| `gateway-billing.ts` | NEW — POST /webhooks/billing/gateway; HMAC verification; idempotent |
| `index.ts`           | NEW — webhooksRouter (no auth or license middleware)                |

### App Entry

| File                  | Change                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| `apps/api/src/app.ts` | MODIFIED — mounts `invoicesRouter` at `/api/v1/backoffice/workspace`, `webhooksRouter` at `/api/v1` |

### Tests

| File                                                                 | Change                |
| -------------------------------------------------------------------- | --------------------- |
| `packages/domain-core/src/billing/__tests__/billing.service.test.ts` | NEW — 17 tests (T026) |
| `packages/domain-core/src/billing/__tests__/webhook.service.test.ts` | NEW — 8 tests (T027)  |
| `tests/integration/backoffice/billing.routes.test.ts`                | NEW — 13 tests (T028) |

---

## Route Table

| Method | Path                                                | Handler              | RBAC           |
| ------ | --------------------------------------------------- | -------------------- | -------------- |
| GET    | `/api/v1/backoffice/workspace/invoices`             | `list-invoices.ts`   | `CAN_VIEW`     |
| POST   | `/api/v1/backoffice/workspace/invoices`             | `create-invoice.ts`  | `CAN_CREATE`   |
| GET    | `/api/v1/backoffice/workspace/invoices/:id`         | `get-invoice.ts`     | `CAN_VIEW`     |
| PATCH  | `/api/v1/backoffice/workspace/invoices/:id/cancel`  | `cancel-invoice.ts`  | `CAN_EDIT`     |
| POST   | `/api/v1/backoffice/workspace/invoices/:id/proof`   | `upload-proof.ts`    | `CAN_EDIT`     |
| POST   | `/api/v1/backoffice/workspace/invoices/:id/approve` | `approve-invoice.ts` | `CAN_EDIT`     |
| POST   | `/api/v1/webhooks/billing/gateway`                  | `gateway-billing.ts` | Signature-only |

---

## Architecture Notes

### Two-Step Manual Payment Flow

1. Staff uploads proof: `POST /invoices/:id/proof` (sets `proof_file_id`)
2. Staff approves: `POST /invoices/:id/approve` — `verifyManualPayment` validates `proof_file_id` is non-null before transitioning to `PAID`; throws `PROOF_REQUIRED (422)` if missing

### Idempotency

- `createInvoiceForSubscription` checks `idempotency_key` before insert; returns existing record if key already exists (`INVOICE_IDEMPOTENT` code, still 201)
- `confirmGatewayPayment` uses SERIALIZABLE isolation + `getInvoiceByIdempotencyKey` to deduplicate webhook delivery

### HMAC-SHA256 Webhook Verification

`verifyGatewaySignature` uses Node's `crypto.timingSafeEqual` to prevent timing attacks. Signature expected as hex string in `x-gateway-signature` header.

### Audit Trail

Every status transition writes an immutable row to `billing_audit_logs` via `appendAuditLog` inside the same transaction.

### Tenant Isolation

All repository functions receive the tenant pool from `c.var.tenant.pool`. No global DB singleton. No cross-tenant joins.

---

## Test Coverage

| File                      | Tests  | Status         |
| ------------------------- | ------ | -------------- |
| `billing.service.test.ts` | 17     | ✅ All passing |
| `webhook.service.test.ts` | 8      | ✅ All passing |
| `billing.routes.test.ts`  | 13     | ✅ All passing |
| **Total**                 | **38** | **✅ 38 / 38** |

### Key Test Scenarios

**Unit (billing.service.test.ts)**

- `createInvoiceForSubscription` — success + idempotency key returns existing
- `cancelInvoice` — success, already cancelled, PAID guard, not found
- `uploadInvoiceProof` — success, not found, wrong status
- `verifyManualPayment` — success, not found, PROOF_REQUIRED, already paid
- `getInvoiceByIdService` — found, not found
- `listInvoicesService` — paginated list, empty result

**Unit (webhook.service.test.ts)**

- Valid HMAC-SHA256 signature passes
- Tampered payload, wrong secret, empty signature — all rejected
- Edge: empty secret, length mismatch, uppercase hex

**Integration (billing.routes.test.ts)**

- Full HTTP flow through Hono router with mocked service layer
- RBAC permission guard blocks (403) for users without roles
- Validation errors (422) for missing/invalid fields
- Error code pass-through: 404 INVOICE_NOT_FOUND, 409 INVOICE_ALREADY_PAID, 422 PROOF_REQUIRED

---

## Validation Summary

See `audits/VALIDATION_REPORT.md` for full evidence.

| Check                        | Status                                  |
| ---------------------------- | --------------------------------------- |
| Unit tests (38 total)        | ✅ Pass                                 |
| Integration tests (13 total) | ✅ Pass                                 |
| TypeScript typecheck         | ✅ Pass                                 |
| Lint (Biome)                 | ✅ Pass (run during prior steps)        |
| Migration validated          | ✅ Pass (forward-only, named correctly) |

---

## Deferred Tasks

None. All 28 tasks completed as specified.
