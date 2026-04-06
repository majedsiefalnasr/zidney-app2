# Testing Guide — STAGE 46 — Billing & Invoices

**Stage:** STAGE 46 – Billing & Invoices  
**Phase:** 03_BACKOFFICE_CORE / 06_COMMERCIAL_LAYER  
**Stage Directory:** specs/runtime/046-billing-and-invoices  
**Generated On:** 2026-04-06T14:30:00.000Z

---

## Purpose

This guide explains how to validate the Billing & Invoices implementation end-to-end for reviewers and QA.

---

## Summary of Delivered Behavior

Billing & Invoices implements workspace-scoped invoices, gateway webhook confirmation, manual proof upload and approval, idempotent transitions to `PAID`, and append-only audit logs.

Key outcomes:

- Create invoices with idempotency key support
- Gateway webhook verification (HMAC-SHA256) and idempotent payment confirmation
- Manual proof upload and staff approval flow with `PROOF_REQUIRED` guard

---

## Prerequisites

| Requirement        | Validation Command / Check                            |
| ------------------ | ----------------------------------------------------- |
| Bun installed      | `bun --version`                                       |
| Docker running     | `docker ps`                                           |
| Migrations applied | `bun run db:migrate`                                  |
| Branch checked out | `git branch` (ensure `spec/046-billing-and-invoices`) |

---

## Files in Scope

```
apps/api/src/db/tenant/migrations/20260409_025_billing_and_invoices.ts
packages/domain-core/src/billing/**
packages/validation/src/backoffice/billing.schemas.ts
apps/api/src/routes/backoffice/invoices/**
apps/api/src/routes/webhooks/gateway-billing.ts
specs/runtime/046-billing-and-invoices/reports/IMPLEMENT_REPORT.md
```

---

## Local Run Commands

```bash
# Install
bun install

# Apply tenant migrations
bun run db:migrate

# Start API
bun run dev:api

# Run unit + integration tests
bun test
```

---

## Automated Validation Commands

```bash
# Unit tests
bun test:unit

# Integration tests
bun test:integration

# Full test suite
bun test
```

Expected outcome: all tests pass (38/38) and lint/typecheck are clean.

---

## Manual Test Scenarios

### Scenario 1 — Create Invoice + Gateway Confirmation

**Purpose:** Verify create → gateway confirm → subscription activation.

1. POST `/api/v1/backoffice/workspace/invoices` with valid body and `idempotency_key`.
2. Verify response `201` and received `invoice_id` and `invoice_number`.
3. Simulate gateway callback: POST `/api/v1/webhooks/billing/gateway` with HMAC header computed using the workspace secret and payload containing the invoice id and payment reference.
4. Verify webhook returns `200` and the invoice status becomes `PAID`.
5. Confirm subscription activation was created/extended and `activation_date` is set.

Expected: invoice becomes `PAID` exactly once; duplicate webhook retries do not duplicate activation.

Troubleshooting: Verify idempotency_key and HMAC secret; check `billing_audit_logs` for events.

---

### Scenario 2 — Manual Proof Upload + Staff Approval

**Purpose:** Verify proof upload and staff approval flow.

1. POST `/api/v1/backoffice/workspace/invoices` to create invoice.
2. POST `/api/v1/backoffice/workspace/invoices/:id/proof` with multipart/form-data (file) as staff user.
3. Verify `204` or `200` and that `proof_file_id` is set in DB.
4. POST `/api/v1/backoffice/workspace/invoices/:id/approve` as staff user.
5. Verify invoice transitions to `PAID` and subscription activation occurs.

Expected: approval is blocked if `proof_file_id` missing and returns `422 PROOF_REQUIRED`.

---

### Scenario 3 — Idempotency & Concurrency Edge Case

**Purpose:** Ensure concurrent webhook / approval attempts do not double-activate.

1. Create invoice in `PENDING`.
2. Send two concurrent confirmation requests (simulate duplicates) — one via webhook, one via staff approval (or two webhooks).
3. Verify only one transition to `PAID` and only one activation record is created.

Expected: one successful PAID transition; other duplicate attempts return `409` or `INVOICE_IMMUTABLE`.

---

## Negative Cases

| Scenario                 | Trigger                                      | Expected Response                    |
| ------------------------ | -------------------------------------------- | ------------------------------------ |
| Missing proof on approve | POST approve without proof_file_id           | `422 PROOF_REQUIRED`                 |
| Duplicate webhook        | Repeat webhook payload with same idempotency | idempotent — no duplicate activation |
| Invalid HMAC             | Tampered payload or wrong secret             | `401` / signature error              |

---

## Multi-Tenant Isolation Verification

1. Create workspace A and B test tenants.
2. Create invoices under workspace A.
3. Using workspace B credentials, attempt to GET invoice from A — must return 404.

---

## Structured Log Verification

Check API logs during scenarios:

```bash
bun run dev:api | jq .
```

Confirm logs include `workspace_slug`, `correlation_id`, and `level`.

---

## Sign-Off Checklist

- [ ] All automated tests pass
- [ ] Manual scenarios pass
- [ ] Negative cases return correct error contract
- [ ] Multi-tenant isolation confirmed
- [ ] No console.log or stack traces exposed

---

References: `specs/runtime/046-billing-and-invoices/reports/IMPLEMENT_REPORT.md`, `specs/runtime/046-billing-and-invoices/audits/ANALYZE_REPORT.md`

Generated by Zidney Orchestrator.
