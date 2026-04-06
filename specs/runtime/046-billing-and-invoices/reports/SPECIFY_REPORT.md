# Specify Report — STAGE 46: Billing & Invoices

**Step:** 1 — Specify
**Timestamp:** 2026-04-06T00:05:00.000Z
**Status:** COMPLETE

---

## Summary

The billing and invoices specification for Stage 46 is complete. The spec defines a deterministic, financially consistent invoice lifecycle system that:

- Tracks all subscription payments via an `invoices` table (PENDING → PAID/FAILED/CANCELLED)
- Supports two payment paths: Gateway (webhook-based) and Manual (proof upload + staff approval)
- Enforces paid invoice immutability
- Activates subscriptions idempotently via a relay to Stage 44's subscription engine
- Generates append-only audit logs for every billing event
- Exposes paginated/filterable invoice listing in Backoffice

All architecture governance rules are confirmed. No ADR violations. 5 clarifications have been resolved inline.

---

## Inputs Reviewed

- `specs/phases/03_BACKOFFICE_CORE/06_COMMERCIAL_LAYER/STAGE_46_BILLING_AND_INVOICES.md`
- `specs/runtime/044-plans-and-subscriptions/spec.md` (dependency for subscription relay)
- `specs/runtime/046-billing-and-invoices/checklists/requirements.md`

---

## Key Decisions

| #   | Decision                                                           | Rationale                                                                                           |
| --- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| 1   | `invoice_number` unique per workspace (not globally)               | Matches database-per-tenant architecture (ADR-0001); no cross-tenant invoice references             |
| 2   | Gateway webhook route bypasses license middleware                  | Gateway callbacks may arrive after license edge cases; secured exclusively by HMAC-SHA256 signature |
| 3   | Optimistic lock via `UPDATE ... WHERE status = 'PENDING'`          | Prevents race conditions without pessimistic locking overhead for concurrent webhook retries        |
| 4   | `idempotency_key` column + unique index                            | Gateway retry safety without distributed lock dependency                                            |
| 5   | `activation_date IS NULL` check for double-activation guard        | Activation relay is idempotent without extra idempotency key                                        |
| 6   | `billing_audit_logs` is append-only, no UPDATE/DELETE              | Financial auditability requirement; immutable event sourcing pattern                                |
| 7   | Amount derived from plan at invoice creation — not client-supplied | Prevents amount tampering; plan price is the single source of truth                                 |
| 8   | Multiple PENDING invoices per student allowed                      | ACTIVE subscription uniqueness is enforced at subscription layer (Stage 44 unique partial index)    |

---

## Functional Requirements Captured

- FR-01: Invoice creation in PENDING state with server-generated invoice number
- FR-02: Gateway payment confirmation via webhook (idempotent, signature-verified)
- FR-03: Manual payment flow: proof upload → staff approval → PAID
- FR-04: Paid invoice immutability (amount, period, subscriber, plan locked)
- FR-05: Invoice cancellation with reason (PENDING only)
- FR-06: Subscription activation relay (idempotent, transactional, within SERIALIZABLE tx)
- FR-07: Backoffice invoice listing with pagination and filters (status, subscriber, date range)

---

## Data Model

- **New table:** `invoices` (with `idempotency_key`, `proof_file_id`, `activation_date`)
- **New table:** `billing_audit_logs` (append-only, actor_type SYSTEM|STAFF|GATEWAY)
- **Migration:** `20260409_025_billing_and_invoices.ts` (number 025)
- **Domain module:** `packages/domain-core/src/billing/`

---

## Clarifications Resolved

All 5 clarifications resolved inline in spec.md:

1. `invoice_number` unique within workspace only
2. Duplicate gateway webhook → 200 with `already_processed: true`
3. Multiple PENDING invoices per student → allowed
4. Proof re-upload → replaces previous reference
5. Gateway webhook secret in environment config only (not per-tenant DB)

---

## Risks

| Risk                                         | Severity | Mitigation                                                 |
| -------------------------------------------- | -------- | ---------------------------------------------------------- |
| Race condition on concurrent webhook retries | HIGH     | Optimistic lock + idempotency_key unique index             |
| Double subscription activation               | HIGH     | `activation_date IS NULL` guard + SERIALIZABLE transaction |
| Gateway secret misconfiguration              | HIGH     | Environment config validation at startup                   |
| Proof file exposure                          | MEDIUM   | Media reference secured by session auth                    |
