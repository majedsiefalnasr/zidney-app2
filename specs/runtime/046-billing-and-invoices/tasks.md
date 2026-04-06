# Tasks — Stage 46: Billing & Invoices

**Stage:** STAGE_46_BILLING_AND_INVOICES
**Phase:** 03_BACKOFFICE_CORE / 06_COMMERCIAL_LAYER
**Branch:** `spec/046-billing-and-invoices`
**Tasks Total:** 28
**Generated:** 2026-04-06

---

## Task Format

```text
- [X] T001 [P] [US1] Description — exact/file/path.ts
```

- `[P]` = can run in parallel with other `[P]` tasks in the same wave
- `[USn]` = user story grouping (omitted for infrastructure tasks)
- Tasks in the same wave with `[P]` may be worked concurrently

---

## Wave 1 — Foundation (all parallel)

- [x] T001 [P] Create migration 025 (invoices + billing_audit_logs tables, all indexes and constraints) — `apps/api/src/db/tenant/migrations/20260409_025_billing_and_invoices.ts`
- [x] T002 [P] Create invoices Drizzle schema with uniqueIndex on invoice_number and partial uniqueIndex on idempotency_key — `apps/api/src/db/tenant/schemas/invoices.schema.ts`
- [x] T003 [P] Create billing_audit_logs Drizzle schema (append-only; no delete constraint documented) — `apps/api/src/db/tenant/schemas/billing-audit-logs.schema.ts`
- [x] T004 [P] Update RBAC PermissionModule: add `INVOICES = 'invoices'` — `packages/domain-core/src/rbac/rbac.types.ts`

---

## Wave 2 — Schema barrel (after T002 + T003)

- [x] T005 Update tenant schema barrel to export invoices and billing_audit_logs schemas — `apps/api/src/db/tenant/schemas/index.ts`

---

## Wave 3 — Domain types + errors (parallel, no inter-dependencies)

- [x] T006 [P] Create billing domain types (InvoiceRow, CreateInvoiceInput, InvoiceListQuery, InvoiceListResult, BillingAuditLogRow, InvoiceStatus, PaymentMethod, BillingEvent, AuditActorType, AuditContext) — `packages/domain-core/src/billing/billing.types.ts`
- [x] T007 [P] Create billing domain errors (8 error classes: INVOICE_NOT_FOUND, INVOICE_ALREADY_PAID, INVOICE_IMMUTABLE, DUPLICATE_ACTIVATION, INVALID_STATUS_TRANSITION, PROOF_REQUIRED, INVALID_WEBHOOK_SIGNATURE, INVOICE_IDEMPOTENT) — `packages/domain-core/src/billing/billing.errors.ts`

---

## Wave 4 — Repository + webhook service (parallel, after Wave 3)

- [x] T008 [P] [US1] Create billing repository: createInvoice, getInvoiceById, getInvoiceByIdempotencyKey, listInvoices, transitionInvoiceStatus (CAS), updateInvoiceProof, appendAuditLog, generateInvoiceNumberSequence — `packages/domain-core/src/billing/billing.repository.ts`
- [x] T009 [P] Create webhook service: verifyGatewaySignature (HMAC-SHA256 with timingSafeEqual) — `packages/domain-core/src/billing/webhook.service.ts`

---

## Wave 5 — Billing service (sequential, depends on T006 T007 T008 T009)

- [x] T010 [US1] Create billing service: createInvoiceForSubscription (READ COMMITTED), confirmGatewayPayment (SERIALIZABLE + idempotency), verifyManualPayment (SERIALIZABLE), cancelInvoice (READ COMMITTED), activateSubscriptionFromInvoice (within caller tx, activation_date guard) — `packages/domain-core/src/billing/billing.service.ts`

---

## Wave 6 — Billing domain barrel (after T010)

- [x] T011 Create billing domain barrel (export types, service, repository, errors, webhook service) — `packages/domain-core/src/billing/index.ts`

---

## Wave 7 — Domain-core root barrel + validation schemas (parallel, after T011)

- [x] T012 [P] Update domain-core root barrel: add `export * as billing from './billing'` — `packages/domain-core/src/index.ts`
- [x] T013 [P] Create billing validation schemas: CreateInvoiceSchema, UploadProofSchema, ApproveInvoiceSchema, CancelInvoiceSchema, ListInvoicesQuerySchema, GatewayWebhookSchema — `packages/validation/src/backoffice/billing.schemas.ts`

---

## Wave 8 — Validation barrel update (after T013)

- [x] T014 Update validation backoffice barrel (export invoices schemas) — `packages/validation/src/backoffice/index.ts`

---

## Wave 9 — Route helpers (after T010 + T014)

- [x] T015 Create route helpers: getDb(c), buildAuditCtx(c), invoiceErrorResponse(c, err) — `apps/api/src/routes/backoffice/invoices/helpers.ts`

---

## Wave 10 — Route handlers (all parallel after T015)

- [x] T016 [P] [US2] Create list-invoices handler: GET /invoices with status/subscriber/date filters and pagination — `apps/api/src/routes/backoffice/invoices/list-invoices.ts`
- [x] T017 [P] [US2] Create create-invoice handler: POST /invoices → PENDING; amount derived from plan.price server-side — `apps/api/src/routes/backoffice/invoices/create-invoice.ts`
- [x] T018 [P] [US2] Create get-invoice handler: GET /invoices/:id with full detail — `apps/api/src/routes/backoffice/invoices/get-invoice.ts`
- [x] T019 [P] [US3] Create cancel-invoice handler: PATCH /invoices/:id/cancel; only PENDING can be cancelled; reason required in audit log — `apps/api/src/routes/backoffice/invoices/cancel-invoice.ts`
- [x] T020 [P] [US3] Create upload-proof handler: POST /invoices/:id/proof; updates proof_file_id, appends proof_uploaded audit log — `apps/api/src/routes/backoffice/invoices/upload-proof.ts`
- [x] T021 [P] [US3] Create approve-invoice handler: POST /invoices/:id/approve; validates proof_file_id present; calls verifyManualPayment (SERIALIZABLE) — `apps/api/src/routes/backoffice/invoices/approve-invoice.ts`
- [x] T022 [P] [US4] Create gateway-billing webhook handler: verify HMAC-SHA256 signature; call confirmGatewayPayment; return 200 with already_processed flag on duplicate — `apps/api/src/routes/webhooks/gateway-billing.ts`

---

## Wave 11 — Router indexes (parallel after T016–T022)

- [x] T023 [P] Create backoffice invoices router (POST /invoices, GET /invoices, GET /invoices/:id, PATCH /invoices/:id/cancel, POST /invoices/:id/proof, POST /invoices/:id/approve; per-route RBAC guards; no business logic) — `apps/api/src/routes/backoffice/invoices/index.ts`
- [x] T024 [P] Create webhooks router (POST /webhooks/billing/gateway; no licenseMiddleware; no auth middleware; signature-only security) — `apps/api/src/routes/webhooks/index.ts`

---

## Wave 12 — app.ts route mounting (after T023 + T024)

- [x] T025 Mount invoicesRouter at `/api/v1/backoffice/workspace` and webhooksRouter at `/api/v1` in app.ts — `apps/api/src/app.ts`

---

## Wave 13 — Unit tests (parallel after T009 + T010)

- [x] T026 [P] Write billing service unit tests: 10 scenarios covering all service functions (createInvoiceForSubscription, confirmGatewayPayment idempotency, verifyManualPayment proof guard, cancelInvoice PAID guard, activateSubscriptionFromInvoice dedup) — `packages/domain-core/src/billing/__tests__/billing.service.test.ts`
- [x] T027 [P] Write webhook service unit tests: verifyGatewaySignature happy path, invalid HMAC, timingSafeEqual usage — `packages/domain-core/src/billing/__tests__/webhook.service.test.ts`

---

## Wave 14 — Integration tests (after Wave 12 + Wave 13)

- [x] T028 Write integration tests: POST /invoices creates PENDING; gateway webhook confirms payment idempotently; manual approval requires proof; concurrent webhook only one PAID; invoice list pagination + filters; cross-tenant isolation — `tests/integration/backoffice/billing.routes.test.ts`

---

## Summary

| Wave | Tasks     | Type                                |
| ---- | --------- | ----------------------------------- |
| 1    | T001–T004 | Foundation (parallel)               |
| 2    | T005      | Schema barrel                       |
| 3    | T006–T007 | Types + errors (parallel)           |
| 4    | T008–T009 | Repository + webhook (parallel)     |
| 5    | T010      | Service (sequential)                |
| 6    | T011      | Domain barrel                       |
| 7    | T012–T013 | Root barrel + validation (parallel) |
| 8    | T014      | Validation barrel                   |
| 9    | T015      | Route helpers                       |
| 10   | T016–T022 | Route handlers (parallel)           |
| 11   | T023–T024 | Router indexes (parallel)           |
| 12   | T025      | app.ts mounts                       |
| 13   | T026–T027 | Unit tests (parallel)               |
| 14   | T028      | Integration tests                   |
