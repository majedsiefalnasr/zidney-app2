# Clarify Report — Semesters

**Step:** 2 — Clarify  
**Timestamp:** 2026-03-20T00:10:00.000Z  
**Status:** COMPLETE

---

## Summary

5 targeted clarification questions were identified and resolved for the Semesters stage. The
clarification session addressed migration ordering safety, concurrent soft-delete locking,
pagination validation strategy, assignment race condition protection, and FK `ON DELETE` semantics.
All decisions align with Zidney Constitution v1.2.0 and forward-only migration rules. Spec.md
updated in-place with a `## Clarifications / ### Session 2026-03-20` section.

---

## Inputs Reviewed

- `specs/runtime/027-semesters/spec.md` (including `## Clarifications`)

---

## Clarifications Resolved

| #   | Question                                 | Resolution                                                                                     | Impact                                             |
| --- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | Migration ordering: subjects FK deferral | STAGE_27 does NOT touch subjects table at all; semester_id column and FK delegated to STAGE_28 | Migration simplified; no conditional DDL           |
| 2   | Concurrent soft-delete race condition    | `SELECT ... FOR UPDATE` on semester row before referential checks; second request gets 404     | Transaction boundaries tightened in implementation |
| 3   | Pagination limit out-of-range behavior   | Returns HTTP 422 `VALIDATION_ERROR`; no silent clamping; range 1–100 enforced                  | List endpoint validation contract clarified        |
| 4   | Assignment race: concurrent disable      | `SELECT status FOR UPDATE` before writing assignment; TOCTOU gap closed                        | Assignment handler must use row lock before write  |
| 5   | FK ON DELETE clause for semester_id      | `ON DELETE RESTRICT` on both students and subjects FKs                                         | DB-level safety net; hard delete guarded at DB too |

---

## Open Items

- None — all 5 clarification questions fully resolved.

---

## Spec Updates Applied

- `Isolation Impact Analysis → Tables modified`: Subjects entry corrected — this stage does NOT modify subjects
- `Data Model → students modified table`: `ON DELETE RESTRICT` replaces ambiguous clause
- `Data Model → subjects`: table row replaced with STAGE_28 delegation note
- `Migration Requirements`: subjects bullet replaced with explicit "does not modify subjects"
- `FR-10: Listing and Filtering`: 422 validation rule added for limit out-of-range
- `Transaction Boundaries`: `SELECT FOR UPDATE` semantics added to delete and assignment flows
- `Failure Modes & Recovery`: two new rows — concurrent soft-delete and concurrent assignment/disable
- `Assumptions`: subjects assumption rewired to reflect STAGE_28 full delegation
- `## Clarifications / ### Session 2026-03-20`: new section appended with all 5 Q→A entries

---

## Risk Level Assessment

Scoring factors present:

| Factor                                        | Points |
| --------------------------------------------- | ------ |
| Database migration (schema change)            | +3     |
| New table added (semesters)                   | +2     |
| Security-sensitive logic (none)               | 0      |
| Multi-tenant data isolation logic             | +3     |
| Worker interaction (none)                     | 0      |
| External API integration (none)               | 0      |
| More than 10 tasks (anticipated ~20-25 tasks) | +1     |
| New package dependency (none anticipated)     | 0      |

**Total: 9 → Risk Level: HIGH**

---

## Constitutional Compliance

| Check                                     | Status | Notes                                                                       |
| ----------------------------------------- | ------ | --------------------------------------------------------------------------- |
| All material ambiguities resolved         | ✅     | 5/5 clarification questions resolved with concrete decisions                |
| Transaction strategy confirmed            | ✅     | SELECT FOR UPDATE pattern confirmed for delete and assignment flows         |
| Idempotency strategy confirmed            | ✅     | PATCH idempotent; DELETE soft-delete pattern guards against double deletion |
| Isolation boundaries confirmed            | ✅     | Tenant DB only; division-first supremacy; no cross-tenant access            |
| Version and license constraints confirmed | ✅     | License middleware mandatory; schema version increment in migration         |

**Overall:** COMPLIANT

---

## Open Risks

- **FK deferral ownership**: STAGE_27 deliberately does not add the subjects FK. STAGE_28 must
  include `semester_id` in its `CREATE TABLE subjects` DDL. If STAGE_28 is skipped or reordered,
  subjects will lack semester association. This is documented in the spec assumptions.
