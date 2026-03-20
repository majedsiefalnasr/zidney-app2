# Clarify Report — Teams & Work Team Types

**Step:** 2 — Clarify
**Timestamp:** 2026-03-19T00:00:00.000Z
**Status:** COMPLETE

---

## Summary

5 targeted clarification questions were raised and answered for the Teams & Work Team Types spec.
All ambiguities in RBAC, idempotency, unique index semantics, version enforcement, and error codes
were resolved. Two new functional requirements (FR-031, FR-032) were codified in spec.md. Zero
open items remain.

---

## Inputs Reviewed

- `specs/runtime/026-teams-work-team-types/spec.md` (including `## Clarifications`)

---

## Clarifications Resolved

| #   | Question                                                        | Resolution                                                                               | Impact                                                     |
| --- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | RBAC permission codes for team management vs staff assignment   | Three distinct codes: `team_types:manage`, `teams:manage`, `staff_teams:assign`          | FR-031 codified; granular role model defined               |
| 2   | SELECT FOR UPDATE: unconditional or after non-locking pre-check | Unconditional first; lock → check existing → check status → enforce max_members → insert | FR-014 clarified; TOCTOU risk eliminated                   |
| 3   | Unique indexes on name — include soft-deleted rows?             | Partial indexes `WHERE deleted_at IS NULL`; name reuse allowed after soft-delete         | FR-002, FR-005 updated; 409 codes scoped to live rows only |
| 4   | schema_version semantics: exact match or `>=` minimum?          | Minimum-version `>= MIN_SCHEMA_VERSION`; HTTP 409 `SCHEMA_VERSION_MISMATCH` on mismatch  | License enforcement section updated                        |
| 5   | TEAM_NOT_FOUND / TEAM_TYPE_NOT_FOUND codes defined?             | Both added: HTTP 404 on GET/PUT/DELETE by path ID for live records                       | FR-032 codified; Failure Modes table updated               |

---

## Open Items

None.

---

## Spec Updates Applied

- `## Clarifications / ### Session 2026-03-19` appended to spec.md
- Data model index definitions updated with partial index notation for name uniqueness
- FR-002 and FR-005 updated to reference partial index semantics
- FR-014 clarified with lock-first execution order
- FR-031: RBAC permission codes added with granular differentiation
- FR-032: TEAM_NOT_FOUND and TEAM_TYPE_NOT_FOUND error codes added
- License & Version Enforcement section: `>=` semantics documented
- Failure Modes & Recovery table: new 404 entries added
- Transaction Boundaries: idempotent short-circuit path explicitly documented

---

## Constitutional Compliance

| Check                                     | Status | Notes                                                                 |
| ----------------------------------------- | ------ | --------------------------------------------------------------------- |
| All material ambiguities resolved         | ✅     | 5 questions resolved; no open items                                   |
| Transaction strategy confirmed            | ✅     | Lock-first order explicit; covers TOCTOU and max_members enforcement  |
| Idempotency strategy confirmed            | ✅     | Unconditional SFU + INSERT ON CONFLICT DO NOTHING sequence mandated   |
| Isolation boundaries confirmed            | ✅     | Partial indexes prevent name-reuse leakage post soft-delete           |
| Version and license constraints confirmed | ✅     | Minimum-version semantics; SCHEMA_VERSION_MISMATCH error code defined |

**Overall:** COMPLIANT

---

## Open Risks

None.

---

## Next Step

Proceed to Step 3 — Plan.
