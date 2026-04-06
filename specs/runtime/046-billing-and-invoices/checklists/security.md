# Security Checklist — Stage 46: Billing & Invoices

Generated: 2026-04-06

---

## Authentication & Authorization

- [x] All Backoffice billing routes require valid JWT + staff role
- [x] License middleware applied to all `/backoffice/*` routes
- [x] Webhook route uses HMAC-SHA256 signature verification instead of session auth
- [x] Invoice approval requires `actor_type = STAFF` with valid `actor_id`
- [x] No anonymous access to invoice data

## Input Validation

- [x] Invoice creation: amount not accepted from client — derived from plan
- [x] Invoice creation: billing period computed server-side from plan duration_days
- [x] Proof upload: file size and type validated before `proof_file_id` stored
- [x] Webhook payload: signature validated before processing
- [x] Status transition: only valid state machine transitions accepted

## Injection Prevention

- [x] All DB queries use parameterized statements via Drizzle ORM
- [x] JSONB metadata in audit logs validated before insertion
- [x] No raw SQL string interpolation in billing domain

## Data Exposure

- [x] Billing records not exposed to Frontoffice (subscription status flag only)
- [x] Invoice amount not recalculable from clientinfo
- [x] Proof file access requires session authentication
- [x] Gateway secret not exposed in API responses

## Replay Attack Prevention

- [x] `idempotency_key` unique index prevents webhook replay
- [x] `activation_date IS NULL` prevents double subscription activation
- [x] Manual approval blocked after invoice transitions to PAID

## Audit Trail

- [x] All billing events produce immutable audit log entries
- [x] Actor identification (actor_id, actor_type) mandatory on all audit logs
- [x] No UPDATE/DELETE on `billing_audit_logs` table
