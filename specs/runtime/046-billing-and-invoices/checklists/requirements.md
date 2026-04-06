# Requirements Checklist — Stage 46: Billing & Invoices

Generated: 2026-04-06

---

## Architecture Governance

- [x] No cross-tenant access confirmed (ADR-0001)
- [x] License middleware mandatory on all `/backoffice/*` routes
- [x] Webhook route secured by signature verification (not license middleware)
- [x] No business logic in frontend layers
- [x] Tenant resolver used exclusively — no direct DB instantiation
- [x] All writes use transactions with correct isolation levels
- [x] Server-authoritative time for all billing timestamps (ADR-0006)
- [x] Forward-only migration policy confirmed (ADR-0003)
- [x] Import boundaries respected — UI → DB schemas FORBIDDEN

## Functional Requirements

- [x] FR-01: Invoice creation → PENDING state with server-generated number
- [x] FR-02: Gateway payment flow → webhook → PAID → subscription activation
- [x] FR-03: Manual payment flow → proof upload → staff approval → PAID → activation
- [x] FR-04: Paid invoice immutability enforced
- [x] FR-05: Invoice cancellation with reason (PENDING only)
- [x] FR-06: Subscription activation relay (idempotent)
- [x] FR-07: Invoice listing with pagination and filters

## Security

- [x] Gateway webhook signature verification (HMAC-SHA256)
- [x] No client-side status updates
- [x] Proof files accessed only via valid session
- [x] No invoice deletion (CANCELLED is soft terminal state)
- [x] Staff approval audit trail with actor_id
- [x] Amount derived from plan — not supplied by client

## Idempotency & Concurrency

- [x] Idempotency key column with unique index on invoices table
- [x] Optimistic lock pattern for status transitions (affected rows check)
- [x] Subscription activation idempotency via `activation_date IS NULL` check
- [x] Gateway duplicate webhook returns 200 (no-op)
- [x] Manual approval blocked on non-PENDING invoice

## Data Integrity

- [x] `invoices` schema defined with constraints
- [x] `billing_audit_logs` schema defined (append-only)
- [x] Migration number: 025
- [x] Unique invoice_number index per workspace
- [x] Foreign keys to `students`, `plans`, `media` with correct cascade actions

## Observability

- [x] Structured logging fields defined (request_id, workspace_slug, invoice_id, actor_id, event, status_before, status_after)
- [x] Double-activation attempts logged at ERROR level
- [x] Webhook authentication failures logged at WARN level

## Testing Coverage

- [ ] Invoice creation unit tests
- [ ] Gateway webhook integration test (success + duplicate)
- [ ] Manual payment approval integration test
- [ ] Immutability enforcement test (attempt to mutate PAID invoice)
- [ ] Concurrent activation race condition test
- [ ] Audit log generation test per event type
- [ ] Invoice listing filter tests (status, subscriber, date range)
