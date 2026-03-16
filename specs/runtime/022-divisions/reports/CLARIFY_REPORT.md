# Clarify Report — Divisions

**Step:** 2 — Clarify
**Timestamp:** 2026-03-16T00:02:00Z
**Status:** COMPLETE

---

## Summary

Targeted ambiguity scan performed on `spec.md` across 8 focus areas (transactions, idempotency,
concurrency, version enforcement, middleware enforcement, security/RBAC, error contract
completeness, isolation boundaries). 5 high-priority ambiguities were identified and fully resolved.
All resolutions were written directly into `spec.md` under `## Clarifications / ### Session 2026-03-16`.
No `[NEEDS CLARIFICATION]` markers remain. The spec is ready for technical planning.

---

## Inputs Reviewed

- `specs/runtime/022-divisions/spec.md`

---

## Clarifications Resolved

### C1 — Staff_divisions PK collision strategy during disable-divisions

**Category:** Transactions / Data Integrity

**Question:** When re-inserting default division assignments for staff during the disable-divisions
transaction, a PK collision occurs for staff who already have the default division assigned.

**Resolution:** Use `INSERT INTO staff_divisions ... ON CONFLICT (staff_id, division_id) DO NOTHING`.
Atomic, idempotent, no pre-check required. Consistent with the staff assignment idempotency contract.

**Spec sections updated:** `POST /disable-divisions` transactional guarantees (step 2 rewritten).

---

### C2 — Transaction isolation level for disable-divisions

**Category:** Concurrency / Data Integrity

**Question:** Without specifying an isolation level, concurrent inserts referencing non-default
divisions between the read and delete steps could create integrity violations.

**Resolution:** `SERIALIZABLE` isolation level required for the disable-divisions transaction.
Prevents phantom reads; ensures the full reassignment is atomic and consistent.

**Spec sections updated:** `POST /disable-divisions` endpoint; Transaction Boundaries table.

---

### C3 — RBAC permission identifier for disable-divisions

**Category:** Security / RBAC

**Question:** The disable-divisions elevated permission was named but never linked to a specific
RBAC role identifier.

**Resolution:** `WORKSPACE_ADMIN` role (highest Backoffice role) is sufficient — no separate
super-admin role introduced. Operation additionally protected by rate limit (1 req/min/workspace),
explicit `confirm: true` body parameter, and workspace ACTIVE status check.

**Spec sections updated:** `POST /disable-divisions` Authorization; Security Requirements → RBAC.

---

### C4 — PATCH /divisions/:id/status missing VALIDATION_ERROR

**Category:** Error Contract Completeness

**Question:** Invalid `status` values (not `ENABLED | DISABLED`) had no error code defined for
the PATCH /status endpoint.

**Resolution:** `VALIDATION_ERROR` (422 Unprocessable Entity) now listed in PATCH /status error
responses. Consistent with global validation error contract.

**Spec sections updated:** `PATCH /divisions/:id/status` error responses.

---

### C5 — DELETE /staff/:staff_id/divisions/:division_id — unassigned division behavior

**Category:** Error Contract Completeness

**Question:** Deleting a division assignment that does not exist had undefined behavior, and the
minimum-one constraint was missing from this specific endpoint's error list.

**Resolution:**

- Unassigned division → `DIV_STAFF_ASSIGNMENT_NOT_FOUND` (404). Prevents silent no-ops.
- Zero-division result → `DIV_STAFF_MIN_DIVISION` (422). Already in error codes table; now
  explicitly listed on this endpoint.

**Spec sections updated:** `DELETE /staff/:staff_id/divisions/:division_id` error responses;
Error Codes Reference table (new row `DIV_STAFF_ASSIGNMENT_NOT_FOUND` added).

---

## Constitutional Compliance Check

| Check                                   | Status | Notes                                                         |
| --------------------------------------- | ------ | ------------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | Unchanged — all tables tenant-scoped                          |
| License middleware requirement captured | ✅     | Unchanged                                                     |
| Snapshot integrity requirement captured | ✅     | N/A for this stage                                            |
| Idempotency strategy defined            | ✅     | disable-divisions idempotency confirmed; staff assignment too |
| Transaction boundaries identified       | ✅     | SERIALIZABLE level added to disable-divisions                 |
| Server-authoritative time enforced      | ✅     | Unchanged — no client timestamps accepted                     |

**Overall:** COMPLIANT — planning authorized.

---

## Risk Assessment Update

| #   | Risk                                              | Severity | Status      |
| --- | ------------------------------------------------- | -------- | ----------- |
| 1   | Staff PK collision during disable-divisions       | Medium   | Resolved ✅ |
| 2   | Concurrency during disable-divisions              | Medium   | Resolved ✅ |
| 3   | RBAC elevation without role identifier            | Low      | Resolved ✅ |
| 4   | Incomplete error codes for status toggle endpoint | Low      | Resolved ✅ |
| 5   | Silent no-op for staff unassignment               | Low      | Resolved ✅ |

No remaining unresolved risks. Ready for planning.
