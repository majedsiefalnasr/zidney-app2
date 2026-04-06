# Performance Checklist — Stage 46: Billing & Invoices

Generated: 2026-04-06

---

## Database Indexes

- [x] `idx_invoices_number_workspace` — unique, supports fast invoice_number lookup
- [x] `idx_invoices_idempotency` — partial unique index on non-null idempotency_key
- [x] `idx_invoices_subscriber` — supports per-student invoice listing
- [x] `idx_invoices_status` — supports status filter in list endpoint
- [x] `idx_invoices_created` — DESC index for default sort in listing
- [x] `idx_billing_audit_invoice` — supports per-invoice audit log retrieval
- [x] `idx_billing_audit_created` — DESC index for timeline queries

## Query Patterns

- [x] Invoice listing uses keyset/offset pagination — no full table scan
- [x] Status transition uses single atomic UPDATE with WHERE clause (no SELECT then UPDATE)
- [x] Audit log insert within parent transaction — no separate round trip
- [x] Idempotency key lookup uses index (not sequential scan)

## Transaction Scope

- [x] SERIALIZABLE isolation only used for status transitions and activation relay
- [x] READ COMMITTED used for non-conflicting reads (listing, detail fetch)
- [x] Transactions are short-lived — no external HTTP calls within transaction boundary

## Rate Limiting

- [x] Invoice creation: 30/min per workspace
- [x] Manual approval: 20/min per workspace
- [x] Webhook endpoint: 100/min per IP
- [x] Proof upload: 20/min per workspace
