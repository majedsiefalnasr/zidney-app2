# Clarify Report — STAGE_13_AFFILIATES

**Step:** 2 — Clarify  
**Timestamp:** 2026-02-25T00:10:00Z  
**Status:** COMPLETE

---

## Summary

Clarification session identified and resolved 5 edge case design decisions around concurrency,
financial precision, audit completeness, and data integrity. All clarifications have been appended
to `spec.md` as a `## Clarifications` section. No unresolved [NEEDS CLARIFICATION] markers remain.
Specification is locked and ready for planning.

---

## Inputs Reviewed

- `specs/runtime/013-affiliates/spec.md` (546 lines + Clarifications section appended)
- `specs/runtime/013-affiliates/checklists/requirements.md` (quality checklist)

---

## Clarifications Resolved

| #   | Question                                    | Resolution                                                                                    | Impact                                                                  |
| --- | ------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | Per-Client Limit Under Concurrent Purchases | Reject second transaction after first commits (Option C). Transactional, deterministic, safe. | Implementation: Lock semantics, error response codes                    |
| 2   | Fractional Cent Rounding                    | NUMERIC(12,2) with ROUND(amount, 2) in SQL. Deterministic, auditable, reproducible.           | Implementation: SQL calculation functions, financial audit trail        |
| 3   | Zero/Negative Base Amounts                  | Reject as invalid (HTTP 400). Prevents corrupted financial records.                           | Implementation: Upstream validation before affiliate code applied       |
| 4   | Affiliate Deletion During Transaction       | Prevent via ON DELETE RESTRICT foreign key. Soft delete only (status field).                  | Implementation: Referential integrity constraint, deactivation workflow |
| 5   | Admin Action Audit Trail                    | Separate `affiliate_admin_audit` table for all admin mutations (who, what, when, IP).         | Implementation: New audit table, interceptor on all admin operations    |

---

## Open Items

**None** — All edge case design decisions resolved and locked into specification.

---

## Spec Updates Applied

**New Section Added**: `## Clarifications → Session 2026-02-25`

Updates to specification:

1. **Q1 Decision + Rationale**: Per-client limit validation enforced per-transaction with row
   locking. Second transaction rejects with `AFFILIATE_USAGE_LIMIT_PER_CLIENT_EXCEEDED` after first
   commits.

2. **Q2 Decision + Rationale**: All financial math uses NUMERIC(12,2) type with ROUND(amount, 2) in
   SQL. Calculation audit trail includes pre-rounding and post-rounding values.

3. **Q3 Decision + Rationale**: License purchase validates base_amount > 0 before affiliate
   validation. Invalid amounts rejected with HTTP 400 / `INVALID_LICENSE_AMOUNT`.

4. **Q4 Decision + Rationale**: `affiliate_usages.affiliate_id` has `ON DELETE RESTRICT`. Physical
   deletion forbidden if usages exist. Deactivation via `status = INACTIVE`.

5. **Q5 Decision + Rationale**: New table
   `affiliate_admin_audit(id, affiliate_id, admin_id, action, old_values, new_values, ip_address, created_at)`
   tracks all admin mutations transactionally.

---

## Constitutional Compliance

| Check                                     | Status | Notes                                                                                  |
| ----------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| All material ambiguities resolved         | ✅     | 5 edge cases clarified, 0 unresolved                                                   |
| Transaction strategy confirmed            | ✅     | Concurrency: row lock + atomic counter increment + validation                          |
| Idempotency strategy confirmed            | ✅     | License purchase is idempotent; affiliate usage single-insert per transaction          |
| Isolation boundaries confirmed            | ✅     | Master_db only, no tenant table access, separate audit tables for admin/usage tracking |
| Version and license constraints confirmed | ✅     | Schema version bump required, forward-only migration, no breaking changes              |
| Financial integrity confirmed             | ✅     | NUMERIC types, deterministic rounding, immutable audit trail enabling reconciliation   |
| Server-authoritative time confirmed       | ✅     | Start_date/end_date validity checked via server `now()`, not client time               |

**Overall:** ✅ COMPLIANT — All clarifications reinforce Zidney Constitution alignment.

---

## Specification Readiness

After clarification session:

- ✅ No [NEEDS CLARIFICATION] markers remain
- ✅ All edge cases documented and decided
- ✅ Implementation strategy clear (concurrency, audit, financial math, referential integrity)
- ✅ Testing strategy derivable from clarifications
- ✅ No ambiguities blocking technical planning

**Status:** LOCKED — Ready for Step 3 — Plan
