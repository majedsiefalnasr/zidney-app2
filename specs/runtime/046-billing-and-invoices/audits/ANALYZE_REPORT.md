# ANALYZE REPORT — Stage 46: Billing & Invoices

**Step:** 5 — Analyze (Drift Detector)
**Stage:** STAGE_46_BILLING_AND_INVOICES
**Phase:** 03_BACKOFFICE_CORE / 06_COMMERCIAL_LAYER
**Branch:** `spec/046-billing-and-invoices`
**Generated:** 2026-04-06T00:45:00.000Z

---

## Final Gate Verdict

```
✅ ANALYZE GATE — APPROVED (Attempt 1)

All 9 structural drift criteria: PASS
Composite guardian audit: PASS (4/4 guardians)

Implementation: AUTHORIZED
```

---

## Structural Drift Audit (9/9)

| #   | Criterion                        | Verdict       | Evidence                                                                                                                                                                                                                                                                                                                 |
| --- | -------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `tenant_isolation`               | ✅ PASS       | All invoice/audit DB reads and writes go through `getDb(c)` helper, which retrieves the tenant-scoped pool from Hono context. No global db singleton referenced in plan or tasks.                                                                                                                                        |
| 2   | `license_middleware_enforcement` | ✅ PASS       | Backoffice invoices router (T023) inherits from workspace router which enforces licenseMiddleware. Webhook router (T024) is explicitly public by design and secured by HMAC-SHA256 signature verification — not a bypass.                                                                                                |
| 3   | `snapshot_integrity`             | ✅ PASS (N/A) | Stage 46 does not interact with the attempt or grading engine. No snapshot integrity concern applies.                                                                                                                                                                                                                    |
| 4   | `transaction_boundaries`         | ✅ PASS       | All PAID status transitions (`confirmGatewayPayment`, `verifyManualPayment`) use `BEGIN ISOLATION LEVEL SERIALIZABLE`. `createInvoice` uses READ COMMITTED (appropriate — no concurrent write risk at creation). `activateSubscriptionFromInvoice` is called within the SERIALIZABLE transaction of its parent function. |
| 5   | `idempotency_enforcement`        | ✅ PASS       | Partial unique index `idx_invoices_idempotency` on `idempotency_key WHERE idempotency_key IS NOT NULL` prevents DB-level duplicate. Service layer (`T010`) calls `getByIdempotencyKey` before write and returns `{ already_processed: true }` on duplicate.                                                              |
| 6   | `version_enforcement`            | ✅ PASS       | Migration 025 (`20260409_025_billing_and_invoices.ts`) follows forward-only policy (ADR-0003). No existing migration files are modified. `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` ensure safe re-run.                                                                                               |
| 7   | `api_vs_worker_authority`        | ✅ PASS       | All billing operations are synchronous within the HTTP request. Subscription activation relay is inline within the SERIALIZABLE transaction — no worker required. No background job authority violations in spec or tasks.                                                                                               |
| 8   | `logging_requirements`           | ✅ PASS       | Route helpers (T015) include `buildAuditCtx(c)` with correlation ID propagation. All service functions propagate `AuditContext`. `billing_audit_logs` table is append-only with `event`, `actor_id`, `actor_type`, and `metadata` JSONB for financial auditability.                                                      |
| 9   | `security_requirements`          | ✅ PASS       | Webhook uses HMAC-SHA256 + `crypto.timingSafeEqual` (T009). All server timestamps use `NOW()` — no client-supplied timestamps accepted. All route inputs validated via Zod schemas (T013). No stack traces leak to client (error envelope: `{ code, message }`).                                                         |

---

## Composite Guardian Audit

### Security Auditor — VERDICT: PASS

| Check                             | Result  | Notes                                                                        |
| --------------------------------- | ------- | ---------------------------------------------------------------------------- |
| Webhook authentication            | ✅ PASS | HMAC-SHA256 with `timingSafeEqual` — prevents timing attacks                 |
| No client-authoritative time      | ✅ PASS | All timestamps derived from DB `NOW()`                                       |
| Input validation coverage         | ✅ PASS | Zod schemas for all 6 endpoints + webhook payload                            |
| Error response sanitization       | ✅ PASS | `invoiceErrorResponse` helper uses coded error envelope, no internal details |
| Tenant isolation in invoice reads | ✅ PASS | All queries scoped to tenant DB pool                                         |
| Proof file ID validation          | ✅ PASS | `verifyManualPayment` checks `proof_file_id IS NOT NULL` before approval     |
| No OWASP injection risk           | ✅ PASS | Raw SQL uses parameterized queries (`$1`, `$2`) in plan Phase 2 patterns     |

### Performance Optimizer — VERDICT: PASS

| Check                       | Result  | Notes                                                                                        |
| --------------------------- | ------- | -------------------------------------------------------------------------------------------- |
| Invoice list query indexes  | ✅ PASS | `idx_invoices_status`, `idx_invoices_subscriber`, `idx_invoices_created` cover filter + sort |
| Concurrent PAID transitions | ✅ PASS | SERIALIZABLE + CAS `WHERE status = 'PENDING'` prevents race; only one writer wins            |
| Idempotency check overhead  | ✅ PASS | Partial index (`WHERE idempotency_key IS NOT NULL`) minimizes index size                     |
| NUMERIC(12,2) precision     | ✅ PASS | Appropriate for financial amounts; avoids float rounding                                     |
| Pagination on list endpoint | ✅ PASS | `ListInvoicesQuerySchema` includes `page + limit` — no unbounded result sets                 |
| Audit log insert overhead   | ✅ PASS | Append-only insert; indexed on `invoice_id` — no locking contention                          |

### QA Engineer — VERDICT: PASS

| Check                       | Result  | Notes                                                                      |
| --------------------------- | ------- | -------------------------------------------------------------------------- |
| Unit test coverage          | ✅ PASS | T026: 10 scenarios covering all billing service functions                  |
| Webhook idempotency test    | ✅ PASS | T026 includes `confirmGatewayPayment` duplicate-call scenario              |
| PAID state guard test       | ✅ PASS | T026 includes `cancelInvoice` on PAID returns `INVOICE_IMMUTABLE`          |
| Proof upload required test  | ✅ PASS | T026 includes `verifyManualPayment` without proof returns `PROOF_REQUIRED` |
| Concurrent activation test  | ✅ PASS | T028 integration test includes concurrent webhook scenario (only one PAID) |
| Cross-tenant isolation test | ✅ PASS | T028 explicitly asserts invoice from Tenant A not visible in Tenant B      |
| Signature verification test | ✅ PASS | T027: valid HMAC, invalid HMAC, tampered payload scenarios                 |

### Code Reviewer — VERDICT: PASS

| Check                        | Result  | Notes                                                                                                 |
| ---------------------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| Repository pattern adherence | ✅ PASS | `billing.repository.ts` follows same `(client: DbClient, ...args)` pattern as subscriptions repo      |
| Service layer purity         | ✅ PASS | No HTTP, no logger, no framework imports in domain service files                                      |
| Error class consistency      | ✅ PASS | 8 typed error classes follow existing `DomainError` extension pattern                                 |
| Route handler pattern        | ✅ PASS | Parse → safeParse → getDb → service → envelope pattern matches existing handlers                      |
| RBAC guard consistency       | ✅ PASS | `createPermissionGuard(logger, PermissionModule.INVOICES, 'can_view')` matches existing guard usage   |
| Barrel export discipline     | ✅ PASS | Domain barrel exports named, router barrels export Hono app, validation barrel follows same structure |

---

## Ambiguity Resolution

No unresolved `[NEEDS CLARIFICATION]` markers exist in `spec.md`. All clarifications from Step 2 are encoded.

---

## Scope Drift Check

| Spec Item                         | Plan Coverage | Tasks Coverage | Verdict |
| --------------------------------- | ------------- | -------------- | ------- |
| Migration 025                     | Phase 1.1 ✅  | T001 ✅        | COVERED |
| invoices Drizzle schema           | Phase 1.2 ✅  | T002 ✅        | COVERED |
| billing_audit_logs Drizzle schema | Phase 1.2 ✅  | T003 ✅        | COVERED |
| RBAC PermissionModule.INVOICES    | Phase 2 ✅    | T004 ✅        | COVERED |
| billing.types.ts                  | Phase 2.2 ✅  | T006 ✅        | COVERED |
| billing.errors.ts (8 codes)       | Phase 2.3 ✅  | T007 ✅        | COVERED |
| billing.repository.ts             | Phase 2.4 ✅  | T008 ✅        | COVERED |
| webhook.service.ts (HMAC)         | Phase 2.5 ✅  | T009 ✅        | COVERED |
| billing.service.ts (5 functions)  | Phase 2.5 ✅  | T010 ✅        | COVERED |
| validation schemas (6 schemas)    | Phase 3 ✅    | T013 ✅        | COVERED |
| GET /invoices (list)              | Phase 3.1 ✅  | T016 ✅        | COVERED |
| POST /invoices                    | Phase 3.1 ✅  | T017 ✅        | COVERED |
| GET /invoices/:id                 | Phase 3.1 ✅  | T018 ✅        | COVERED |
| PATCH /invoices/:id/cancel        | Phase 3.1 ✅  | T019 ✅        | COVERED |
| POST /invoices/:id/proof          | Phase 3.1 ✅  | T020 ✅        | COVERED |
| POST /invoices/:id/approve        | Phase 3.1 ✅  | T021 ✅        | COVERED |
| POST /webhooks/billing/gateway    | Phase 3.2 ✅  | T022 ✅        | COVERED |
| app.ts route mounts               | Phase 3.3 ✅  | T025 ✅        | COVERED |
| Unit tests                        | Phase 5 ✅    | T026, T027 ✅  | COVERED |
| Integration tests                 | Phase 5 ✅    | T028 ✅        | COVERED |

No scope items from `spec.md` are missing from `plan.md` or `tasks.md`.

---

## Architecture Compliance Summary

| ADR      | Rule                                             | Status  |
| -------- | ------------------------------------------------ | ------- |
| ADR-0001 | Database-per-tenant isolation                    | ✅ PASS |
| ADR-0003 | Forward-only migrations                          | ✅ PASS |
| ADR-0006 | Server-authoritative time                        | ✅ PASS |
| ADR-0007 | Schema version compatibility                     | ✅ PASS |
| ADR-0009 | License middleware mandatory on workspace routes | ✅ PASS |

---

## Implementation Authorization

```
drift_passed:          true
implementation_allowed: true
guardian_verdicts:
  security_auditor:      PASS
  performance_optimizer: PASS
  qa_engineer:           PASS
  code_reviewer:         PASS
```
