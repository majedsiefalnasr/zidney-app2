# STAGE 46 – Billing & Invoices

Phase: 3 – Backoffice Core  
Domain: 06_COMMERCIAL_LAYER  
Status: Critical  
Scope: Workspace-level billing, invoice lifecycle, and subscription activation integrity

---

## Stage Status

Status: IN PROGRESS
Step: analyze
Risk Level: HIGH
Last Updated: 2026-04-06T00:45:00.000Z

Drift Analysis: PASSED (all 9 criteria)
Implementation: AUTHORIZED

Scope Authorized:

- Migration 025: invoices + billing_audit_logs tables
- Domain module: packages/domain-core/src/billing/ (service, repository, errors, webhook)
- API: 6 backoffice invoice endpoints + 1 gateway-billing webhook endpoint
- Transaction boundaries: SERIALIZABLE for all PAID transitions
- Idempotency: idempotency_key partial index + service-level early-return
- 28 tasks across 14 execution waves

Deferred Scope:

- Refund engine (future stage)

Architecture Governance Compliance:

- All drift criteria passed — implementation authorized
- Guardian verdicts: Security PASS, Performance PASS, QA PASS, Code Review PASS

Notes:
Full drift analysis passed (9/9). Composite guardian audit PASS (4/4). Implementation gate open.

- Paid invoice immutability enforcement
- Subscription activation relay with SERIALIZABLE transaction
- Append-only billing audit logs
- Backoffice paginated invoice listing with filters

Deferred Scope:

- Refund engine (future stage)
- Accounting exports (future stage)
- Multi-currency support (future)
- Per-tenant gateway configuration (future stage)

Architecture Governance Compliance:

- Clarifications resolved — planning authorized

Notes:
All specification ambiguities resolved. Ready for technical planning.

---

## Objective

Implement a deterministic billing and invoice system that:

- Tracks all subscription-related payments
- Supports gateway and manual payments
- Controls subscription activation
- Ensures financial auditability
- Prevents double activation
- Prevents invoice tampering

Billing must be financially consistent, auditable, and idempotent.

---

## Scope Clarification

This stage applies to:

- Workspace-level commercial layer
- Student subscriptions
- Subscription renewals
- Subscription upgrades (future-safe)
- Manual and gateway payments

This stage does NOT include:

- Global platform billing (handled in MMC)
- Refund engine (future stage)
- Accounting exports (future stage)

---

## Core Entities

### Invoices Table

Required fields:

- id (uuid)
- invoice_number (unique, human-readable)
- subscriber_id (FK → students)
- subscription_plan_id (FK → plans)
- billing_period_start (timestamp)
- billing_period_end (timestamp)
- amount
- currency
- payment_method (GATEWAY | MANUAL)
- payment_reference (nullable)
- proof_file_id (nullable, FK → media)
- status (PENDING | PAID | FAILED | CANCELLED)
- activation_date (nullable)
- created_at
- updated_at

Invoice number must be unique within workspace.

---

## Payment Methods

### 1. Gateway Payment

Flow:

1. Invoice created in PENDING state.
2. Redirect to gateway.
3. Gateway webhook confirms payment.
4. Invoice marked PAID.
5. Subscription activated.
6. Activation date stored.

Rules:

- Gateway callback must be idempotent.
- Duplicate callbacks must not duplicate activation.
- Signature verification mandatory.

---

### 2. Manual Payment

Flow:

1. Invoice created in PENDING state.
2. Subscriber uploads proof of payment.
3. Staff verifies proof.
4. Staff marks invoice as PAID.
5. Subscription activated.

Rules:

- Proof upload required before manual approval.
- Approval action must be logged with staff_id.
- Manual payment cannot bypass approval.

---

## Invoice Lifecycle

PENDING → PAID  
PENDING → FAILED  
PENDING → CANCELLED

PAID is terminal.

Once invoice status = PAID:

- Invoice is immutable.
- Amount cannot change.
- Billing period cannot change.
- Subscriber cannot change.
- Plan cannot change.

Only read operations allowed after payment.

---

## Subscription Activation Rules

Subscription activation must:

- Occur only after invoice marked PAID.
- Be transactional with invoice update.
- Store activation timestamp.
- Extend billing period correctly.
- Prevent overlapping subscription periods.

If user already has active subscription:

- Renewal extends current period.
- Never override existing active period.

Activation must be idempotent.

---

## Idempotency Guarantees

Billing system must guarantee:

- No double activation.
- No double invoice creation for same renewal event.
- Webhook retries do not duplicate effects.
- Manual approval cannot be executed twice.

Use idempotency keys for:

- Gateway callback
- Renewal request
- Upgrade request (future)

---

## Concurrency Protection

Invoice status transition must be atomic.

Example:

UPDATE invoices SET status = 'PAID' WHERE id = ? AND status = 'PENDING'

If affected rows = 0:

- Reject duplicate activation attempt.

---

## Audit Logging

Every billing action must generate audit log:

- invoice_created
- proof_uploaded
- payment_verified
- payment_failed
- invoice_cancelled
- subscription_activated

Audit log must include:

- actor_id
- actor_type (SYSTEM | STAFF | GATEWAY)
- invoice_id
- timestamp

Audit log must be immutable.

---

## Security Requirements

- No client-side invoice status updates.
- Gateway webhooks must verify signature.
- Proof files must be stored securely.
- No invoice deletion allowed.
- Invoice cancellation must log reason.

---

## Subscription Enforcement Integration

Subscription status must:

- Be derived from subscription table.
- Be checked during Frontoffice login.
- Restrict dashboard access when expired.
- Allow certificate viewing even when expired.

Billing must not directly modify student permissions. It updates subscription state only.

---

## Reporting Requirements

Backoffice must support:

- Invoice listing (paginated)
- Filter by status
- Filter by date range
- Filter by subscriber
- Export to CSV (future-ready)

---

## Failure Handling

If gateway callback fails:

- Invoice remains PENDING.
- Retry allowed.

If manual approval reversed:

- Not allowed after PAID.
- Must create corrective invoice instead.

---

## Validation Criteria

Stage complete when:

- Invoice creation works.
- Gateway payment updates invoice correctly.
- Manual payment requires proof.
- Paid invoice becomes immutable.
- Subscription activates exactly once.
- Duplicate activation prevented.
- Audit logs generated.
- Concurrency race condition tested.
- Expired subscription blocks dashboard.

---

## Not Allowed

- Editing paid invoice.
- Deleting invoice.
- Activating subscription without invoice.
- Bypassing audit logs.
- Direct DB manipulation for activation.

---

Billing integrity is financial integrity.

No Frontoffice monetization feature may be built without this stage being stable.
