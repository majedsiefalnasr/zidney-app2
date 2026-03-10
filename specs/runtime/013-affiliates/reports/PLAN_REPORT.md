# Plan Report — STAGE_13_AFFILIATES

**Step:** 3 — Plan  
**Timestamp:** 2026-02-25T00:15:00Z  
**Status:** COMPLETE

---

## Summary

Technical implementation plan successfully generated for B2B affiliate system. All Phase 1 design
artifacts (plan.md, data-model.md, research.md, quickstart.md, and 6 API contract documents) are
complete and locked. Constitutional compliance verified across 13 core principles. The design
addresses all 5 clarified edge cases and provides a complete implementation package ready for task
breakdown.

---

## Inputs Reviewed

- `specs/runtime/013-affiliates/spec.md` (locked specification with Clarifications)
- `specs/runtime/013-affiliates/checklists/requirements.md`
- Zidney Constitution v1.2.0 (architectural governance)

---

## Generated Artifacts

| Artifact                            | Size     | Status | Key Content                                                                                    |
| ----------------------------------- | -------- | ------ | ---------------------------------------------------------------------------------------------- |
| **plan.md**                         | 17 KB    | ✅     | Technical design, database schema, APIs, concurrency strategy, error handling, logging         |
| **data-model.md**                   | 19 KB    | ✅     | 3 tables (affiliates, affiliate_usages, affiliate_admin_audit), indexes, constraints, triggers |
| **research.md**                     | 12 KB    | ✅     | Edge case resolutions, technology stack decisions, performance assumptions                     |
| **quickstart.md**                   | 14 KB    | ✅     | Developer setup, testing workflows, concurrency scenarios, troubleshooting                     |
| **post-create-affiliate.md**        | Contract | ✅     | POST /v1/mmc/affiliates with full request/response specs                                       |
| **get-list-affiliates.md**          | Contract | ✅     | GET /v1/mmc/affiliates with filtering, pagination, sorting                                     |
| **patch-edit-affiliate.md**         | Contract | ✅     | PATCH /v1/mmc/affiliates/:id with audit trail                                                  |
| **post-disable-affiliate.md**       | Contract | ✅     | POST /v1/mmc/affiliates/:id/disable (soft delete)                                              |
| **get-affiliate-usages.md**         | Contract | ✅     | GET /v1/mmc/affiliates/:id/usages (reporting & reconciliation)                                 |
| **license-purchase-integration.md** | Contract | ✅     | Affiliate code validation in license purchase transaction                                      |

**Total Artifacts:** 10 documents across plan.md, data-model.md, research.md, quickstart.md, and
contracts/ directory

---

## Technical Design Highlights

### Database Schema (Master_DB Only)

**affiliates table (15 columns)**

- Immutable promo_code (UNIQUE, uppercase alphanumeric)
- Financial precision: discount_percentage, commission_percentage (NUMERIC(5,2))
- Usage limits: usage_limit_total, usage_limit_per_client (nullable for flexibility)
- Temporal validity: start_date, end_date (server-time validated)
- Lifecycle: status (ACTIVE/INACTIVE via soft delete), no hard deletes

**affiliate_usages table (8 columns, INSERT-ONLY)**

- Immutable audit log of every affiliate code application
- Financial reconciliation: base_amount, discount_amount, commission_amount (NUMERIC(12,2))
- Forensic completeness: license_id, client_id, created_at

**affiliate_admin_audit table (8 columns, INSERT-ONLY)**

- Admin action tracking: CREATE, UPDATE, DISABLE, DELETE_ATTEMPT_PREVENTED
- Forensic metadata: admin_id, old_values, new_values (JSON), ip_address

### API Endpoints (5 Operations)

1. **POST /v1/mmc/affiliates** — Create affiliate with validation
2. **GET /v1/mmc/affiliates** — List with status/date filtering, pagination
3. **PATCH /v1/mmc/affiliates/:id** — Edit (except promo_code)
4. **POST /v1/mmc/affiliates/:id/disable** — Deactivate (soft delete)
5. **GET /v1/mmc/affiliates/:id/usages** — Usage history & reconciliation data

Plus integration point: **License Purchase Transaction** (hook to validate affiliate code before
finalizing purchase)

### Concurrency Strategy

**Pessimistic Locking** with `SELECT ... FOR UPDATE`:

- Affiliate row locked during license purchase transaction
- Per-client limit checked within same transaction after acquiring lock
- Atomic increment of usage_count prevents double-counting under concurrent purchases
- Deterministic: second transaction sees incremented counter, rejects if over limit
- Consistent with Zidney's transactional integrity principle

### Financial Precision

**NUMERIC(12,2) Type + Database ROUND()**:

- discount_amount = ROUND(base_amount \* discount_percentage / 100, 2)
- commission_amount = ROUND(base_amount \* commission_percentage / 100, 2)
- Deterministic across all systems (no floating-point variance)
- Audit trail captures pre-rounding and post-rounding for reconciliation

### Error Handling (8 Affiliate-Specific Codes)

- AFFILIATE_NOT_FOUND
- AFFILIATE_INVALID_STATE (inactive, expired, etc.)
- AFFILIATE_USAGE_LIMIT_TOTAL_EXCEEDED
- AFFILIATE_USAGE_LIMIT_PER_CLIENT_EXCEEDED
- AFFILIATE_INVALID_DATE_RANGE (start_date after end_date)
- AFFILIATE_PROMO_CODE_DUPLICATE
- AFFILIATE_PROMO_CODE_IMMUTABLE (cannot edit after creation)
- All errors use Zidney standard error format with correlation ID

---

## Constitutional Compliance Verification

**Result: 13/13 Core Principles PASS**

| Principle                     | Verification | Evidence                                                                             |
| ----------------------------- | ------------ | ------------------------------------------------------------------------------------ |
| Database Per-Tenant Isolation | ✓            | Master_db only; no tenant table access; no cross-tenant joins                        |
| Middleware Authority Chain    | ✓            | License middleware intact; affiliate validation as substep within authorized session |
| License Enforcement Invariant | ✓            | Affiliate does not override license status or limits; admin-only feature             |
| Attempt Engine Untouched      | ✓            | Affiliate system is commercial feature; attempt engine N/A                           |
| Versioned Evolution           | ✓            | Forward-only migration; schema_version bump required; no breaking changes            |
| Runtime Authoritative Time    | ✓            | Affiliate start_date/end_date validation via server NOW(); not client time           |
| Concurrency Safety            | ✓            | Row-level locking prevents race conditions; usage_count atomic                       |
| Transaction Boundaries        | ✓            | License purchase + affiliate validation in single atomic transaction                 |
| Layer Separation              | ✓            | UI (admin interface) → API (routes) → Domain (business logic) properly isolated      |
| Security Baseline             | ✓            | RBAC enforced (admin-only); correlation ID propagated; structured logging            |
| Error Handling Standard       | ✓            | All errors use Zidney error format: `{success, data/null, error {code, message}}`    |
| Idempotency Guarantee         | ✓            | License purchase is idempotent; affiliate usage is single-insert per purchase        |
| Operational Safety            | ✓            | No silent failures; all state changes transactional; audit trail complete            |

---

## Edge Case Resolutions in Plan

All 5 clarified edge cases are addressed in contracts/ and plan.md:

| Edge Case                         | Plan Section                           | Implementation Detail                                                                |
| --------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------ |
| Per-Client Limit Concurrency (Q1) | license-purchase-integration.md        | Row lock acquired before checking usage; per-client count checked within transaction |
| Fractional Cent Rounding (Q2)     | data-model.md, plan.md                 | NUMERIC(12,2) + ROUND(amount, 2) in SQL; audit trail captures precision              |
| Zero/Negative Amounts (Q3)        | post-create-affiliate.md               | Validation on license purchase endpoint before affiliate validation                  |
| Affiliate Deletion Safety (Q4)    | data-model.md                          | ON DELETE RESTRICT on affiliate_usages.affiliate_id; soft delete via status          |
| Admin Audit Trail (Q5)            | data-model.md, patch-edit-affiliate.md | affiliate_admin_audit table; interceptor logs all admin mutations                    |

---

## Observability & Audit

**Structured Logging**:

- Every affiliate operation logs: timestamp, correlation_id, admin_id/user_id, action, old/new
  values
- No stack traces exposed to client; errors logged server-side with full context

**Audit Trail**:

- affiliate_usages: Immutable log of all code applications (forensically complete)
- affiliate_admin_audit: Immutable log of all admin actions (compliance ready)
- Reconciliation queries included for financial audits

---

## Implementation Readiness

**Phase 1 Complete** ✅

- Architecture locked
- Database design locked
- API contracts locked
- Concurrency strategy locked
- Error codes defined

**Phase 2 Ready** (Next Step: speckit.tasks)

- Detailed task breakdown
- Implementation order
- Dependency graph
- Effort estimation

All Phase 1 artifacts in: `specs/runtime/013-affiliates/`

---

## Next Step

✅ **Approved for Step 4 — Tasks**

Proceed to task generation to produce detailed, dependency-ordered implementation tasks.
