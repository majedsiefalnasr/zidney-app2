# TASKS REPORT — Stage 46: Billing & Invoices

**Step:** 4 — Tasks  
**Stage:** STAGE_46_BILLING_AND_INVOICES  
**Phase:** 03_BACKOFFICE_CORE / 06_COMMERCIAL_LAYER  
**Branch:** `spec/046-billing-and-invoices`  
**Generated:** 2026-04-06T00:35:00.000Z  
**Tasks Total:** 28

---

## Summary

28 atomic tasks across 14 dependency-ordered waves. Tasks cover the full billing and invoices implementation:

- **Foundation (Wave 1–2):** Migration 025 + Drizzle schemas for `invoices` and `billing_audit_logs` + RBAC update + schema barrel
- **Domain module (Wave 3–6):** Types, errors, repository, webhook service, billing service, domain barrel
- **Root barrel + validation (Wave 7–8):** domain-core root export + validation schemas + validation barrel
- **API layer (Wave 9–12):** Route helpers, 7 route handlers (6 backoffice + 1 webhook), router indexes (invoices + webhooks), app.ts mounts
- **Tests (Wave 13–14):** 2 unit test files (billing.service + webhook.service) + 1 integration test file

---

## Full Task List

| Task | Wave | Parallel | User Story | Description                                     | File                                                                     |
| ---- | ---- | -------- | ---------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| T001 | 1    | ✅       | —          | Create migration 025                            | `apps/api/src/db/tenant/migrations/20260409_025_billing_and_invoices.ts` |
| T002 | 1    | ✅       | —          | Create invoices Drizzle schema                  | `apps/api/src/db/tenant/schemas/invoices.schema.ts`                      |
| T003 | 1    | ✅       | —          | Create billing_audit_logs Drizzle schema        | `apps/api/src/db/tenant/schemas/billing-audit-logs.schema.ts`            |
| T004 | 1    | ✅       | —          | Update RBAC PermissionModule (INVOICES)         | `packages/domain-core/src/rbac/rbac.types.ts`                            |
| T005 | 2    | —        | —          | Update tenant schema barrel                     | `apps/api/src/db/tenant/schemas/index.ts`                                |
| T006 | 3    | ✅       | —          | Create billing domain types                     | `packages/domain-core/src/billing/billing.types.ts`                      |
| T007 | 3    | ✅       | —          | Create billing domain errors                    | `packages/domain-core/src/billing/billing.errors.ts`                     |
| T008 | 4    | ✅       | US1        | Create billing repository                       | `packages/domain-core/src/billing/billing.repository.ts`                 |
| T009 | 4    | ✅       | —          | Create webhook service                          | `packages/domain-core/src/billing/webhook.service.ts`                    |
| T010 | 5    | —        | US1        | Create billing service                          | `packages/domain-core/src/billing/billing.service.ts`                    |
| T011 | 6    | —        | —          | Create billing domain barrel                    | `packages/domain-core/src/billing/index.ts`                              |
| T012 | 7    | ✅       | —          | Update domain-core root barrel                  | `packages/domain-core/src/index.ts`                                      |
| T013 | 7    | ✅       | —          | Create invoices validation schemas              | `packages/validation/src/backoffice/invoices.schemas.ts`                 |
| T014 | 8    | —        | —          | Update validation backoffice barrel             | `packages/validation/src/backoffice/index.ts`                            |
| T015 | 9    | —        | —          | Create invoices route helpers                   | `apps/api/src/routes/backoffice/invoices/helpers.ts`                     |
| T016 | 10   | ✅       | US2        | Create list-invoices handler                    | `apps/api/src/routes/backoffice/invoices/list-invoices.ts`               |
| T017 | 10   | ✅       | US2        | Create create-invoice handler                   | `apps/api/src/routes/backoffice/invoices/create-invoice.ts`              |
| T018 | 10   | ✅       | US2        | Create get-invoice handler                      | `apps/api/src/routes/backoffice/invoices/get-invoice.ts`                 |
| T019 | 10   | ✅       | US3        | Create cancel-invoice handler                   | `apps/api/src/routes/backoffice/invoices/cancel-invoice.ts`              |
| T020 | 10   | ✅       | US3        | Create upload-proof handler                     | `apps/api/src/routes/backoffice/invoices/upload-proof.ts`                |
| T021 | 10   | ✅       | US3        | Create approve-invoice handler                  | `apps/api/src/routes/backoffice/invoices/approve-invoice.ts`             |
| T022 | 10   | ✅       | US4        | Create gateway-billing webhook handler          | `apps/api/src/routes/webhooks/gateway-billing.ts`                        |
| T023 | 11   | ✅       | —          | Create backoffice invoices router index         | `apps/api/src/routes/backoffice/invoices/index.ts`                       |
| T024 | 11   | ✅       | —          | Create webhooks router index                    | `apps/api/src/routes/webhooks/index.ts`                                  |
| T025 | 12   | —        | —          | Mount invoicesRouter + webhooksRouter in app.ts | `apps/api/src/app.ts`                                                    |
| T026 | 13   | ✅       | —          | Billing service unit tests                      | `packages/domain-core/src/billing/__tests__/billing.service.test.ts`     |
| T027 | 13   | ✅       | —          | Webhook service unit tests                      | `packages/domain-core/src/billing/__tests__/webhook.service.test.ts`     |
| T028 | 14   | —        | —          | Invoices API integration tests                  | `tests/integration/backoffice/billing.routes.test.ts`                    |

---

## Risk-Ranked Task Summary

| Task ID   | Risk      | Description                                                                            |
| --------- | --------- | -------------------------------------------------------------------------------------- |
| T001      | 🔴 HIGH   | Migration 025: new tables `invoices` + `billing_audit_logs` with 5 indexes             |
| T008      | 🔴 HIGH   | Billing repository: raw SQL with CAS transaction (`transitionInvoiceStatus`)           |
| T009      | 🔴 HIGH   | Webhook service: HMAC-SHA256 signature verification with `timingSafeEqual`             |
| T010      | 🔴 HIGH   | Billing service: SERIALIZABLE transactions, idempotency, subscription activation relay |
| T028      | 🔴 HIGH   | Integration tests: concurrent scenario, cross-tenant isolation assertions              |
| T004      | 🟡 MEDIUM | RBAC PermissionModule update (adds INVOICES enum value)                                |
| T013      | 🟡 MEDIUM | Zod validation schemas for all 6 invoice endpoints                                     |
| T022      | 🟡 MEDIUM | Gateway-billing webhook handler (public webhook, signature-guarded)                    |
| T023      | 🟡 MEDIUM | Invoices backoffice router (6 endpoints with RBAC guards)                              |
| T024      | 🟡 MEDIUM | Webhooks router (public, no auth but signature-guarded)                                |
| T025      | 🟡 MEDIUM | app.ts route mounting (two new router mounts)                                          |
| T026      | 🟡 MEDIUM | Billing service unit tests (10 scenarios)                                              |
| T002      | 🟢 LOW    | Drizzle invoices schema                                                                |
| T003      | 🟢 LOW    | Drizzle billing_audit_logs schema                                                      |
| T005      | 🟢 LOW    | Schema barrel update                                                                   |
| T006      | 🟢 LOW    | Billing domain types                                                                   |
| T007      | 🟢 LOW    | Billing domain errors                                                                  |
| T011      | 🟢 LOW    | Billing domain barrel                                                                  |
| T012      | 🟢 LOW    | domain-core root barrel update                                                         |
| T014      | 🟢 LOW    | Validation barrel update                                                               |
| T015      | 🟢 LOW    | Route helpers                                                                          |
| T016–T021 | 🟢 LOW    | Backoffice route handlers (each simple, no shared state)                               |
| T027      | 🟢 LOW    | Webhook service unit tests (3 scenarios)                                               |

---

## Tasks with External Dependencies

| Task ID | Package        | Version Note                                                                           |
| ------- | -------------- | -------------------------------------------------------------------------------------- |
| T001    | drizzle-orm    | Migration uses raw SQL (no ORM API here)                                               |
| T002    | drizzle-orm    | `pgTable`, `text`, `integer`, `timestamp`, `uniqueIndex`, `index` — standard v0.30 API |
| T003    | drizzle-orm    | Same as T002                                                                           |
| T009    | Node.js crypto | `createHmac`, `timingSafeEqual` — built-in; no external dep                            |
| T013    | zod            | `z.object`, `z.enum`, `z.string`, `z.number`, `z.optional` — standard API              |

---

## High-Downstream-Impact Tasks

These tasks modify architectural hotspots — extra review attention recommended.

| Task ID | Module                                                | Impact | Description                                                               |
| ------- | ----------------------------------------------------- | ------ | ------------------------------------------------------------------------- |
| T004    | `packages/domain-core/src/rbac/rbac.types.ts`         | HIGH   | Adding INVOICES to PermissionModule enum affects all RBAC guards globally |
| T010    | `packages/domain-core/src/billing/billing.service.ts` | HIGH   | Core business logic — SERIALIZABLE tx + subscription activation relay     |
| T025    | `apps/api/src/app.ts`                                 | HIGH   | Mounting new routers affects all request routing; route order matters     |

---

## Wave Execution Plan

```
Wave 1  (parallel): T001 T002 T003 T004
Wave 2  (async):    T005
Wave 3  (parallel): T006 T007
Wave 4  (parallel): T008 T009
Wave 5  (async):    T010
Wave 6  (async):    T011
Wave 7  (parallel): T012 T013
Wave 8  (async):    T014
Wave 9  (async):    T015
Wave 10 (parallel): T016 T017 T018 T019 T020 T021 T022
Wave 11 (parallel): T023 T024
Wave 12 (async):    T025
Wave 13 (parallel): T026 T027
Wave 14 (async):    T028
```

---

## Architecture Compliance

| Rule                                   | Status  | Notes                                                              |
| -------------------------------------- | ------- | ------------------------------------------------------------------ |
| No cross-tenant logic                  | ✅ PASS | All DB access via tenant db pool from context                      |
| No direct DB instantiation             | ✅ PASS | `getDb(c)` helper from router context only                         |
| All PAID transitions SERIALIZABLE      | ✅ PASS | T010: confirmGatewayPayment + verifyManualPayment                  |
| Idempotency enforced                   | ✅ PASS | T008: getByIdempotencyKey; T010: early-return on already_processed |
| Append-only audit log                  | ✅ PASS | T008: appendAuditLog — insert only, no update                      |
| Webhook auth via HMAC-SHA256           | ✅ PASS | T009: timingSafeEqual comparison                                   |
| License middleware on workspace routes | ✅ PASS | T023: backoffice router inherits licenseMiddleware                 |
| No license middleware on webhook       | ✅ PASS | T024: webhooks router explicitly no licenseMiddleware              |
| Server-authoritative time only         | ✅ PASS | All timestamps use `sql\`now()\``                                  |
| Structured logging + correlation ID    | ✅ PASS | T015: helpers include requestId propagation                        |
