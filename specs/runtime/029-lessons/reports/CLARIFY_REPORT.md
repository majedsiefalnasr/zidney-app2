# Clarify Report — Lessons

**Step:** 2 — Clarify
**Timestamp:** 2026-03-21T00:02:00.000Z
**Status:** COMPLETE

---

## Summary

10 clarifications resolved during ambiguity audit of Lessons spec. No blockers or open items
remain. Risk Level computed at **HIGH** (score: 12). Spec is ready for technical planning.

---

## Inputs Reviewed

- `specs/runtime/029-lessons/spec.md` (including `## Clarifications`)
- `specs/phases/03_BACKOFFICE_CORE/02_ACADEMIC_STRUCTURE/STAGE_29_LESSONS.md`
- Zidney Constitution v1.2.0 rules

---

## Clarifications Resolved

| #   | Question                               | Resolution                                                                                                         | Impact                        |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| Q1  | Transaction partial failure behavior   | Full atomic rollback via `db.transaction()`; no partial-write state possible                                       | Enforces write safety         |
| Q2  | Idempotent duplicate create (POST)     | Pre-insert check + catch PostgreSQL `23505` → 409 `LESSON_NAME_DUPLICATE`                                          | Explicit conflict response    |
| Q3  | Concurrent duplicate creates           | DB unique constraint is authoritative guard; first INSERT wins; second gets 409                                    | No race condition risk        |
| Q4  | `MIN_SCHEMA_VERSION` value             | `1.13.0` — post-migration version from `20260321_007_lessons.ts`                                                   | Schema version gate confirmed |
| Q5  | Audit `created_by`/`updated_by` source | Read from `c.get('auth').userId`; `created_by` set once at INSERT; `updated_by` on every mutation                  | Audit trail secured           |
| Q6  | Error registry completeness            | `FORBIDDEN`, `LICENSE_*`, `SCHEMA_VERSION_MISMATCH` are middleware-owned; excluded from lesson error map           | No duplication                |
| Q7  | Mixed PATCH on disabled lesson         | Fails 422 `LESSON_DISABLED` — re-enable first, then edit (two requests required)                                   | Clear UX contract             |
| Q8  | Hard-delete guard dependency tables    | Stub returning `{hasContent: false}`; downstream tables are future stages; `LESSON_HAS_DEPENDENT_CONTENT` reserved | Future-safe                   |
| Q9  | Pagination COUNT query pattern         | Two-query pattern: data query + `COUNT(*)` with same filters; `total` is filtered count; offset-based only         | Consistent pagination         |
| Q10 | PATCH guard ordering                   | (1) existence → (2) disabled guard → (3) idempotent status flip → (4) name uniqueness → (5) UPDATE + catch `23505` | Deterministic behavior        |

---

## Open Items

None.

---

## Spec Updates Applied

- Appended `## Clarifications` → `### Session 2026-03-21` to `spec.md` with all 10 resolutions
- `MIN_SCHEMA_VERSION = 1.13.0` documented
- PATCH guard ordering documented as sequence contract
- Hard-delete dependency stub pattern documented
- Pagination two-query pattern documented

## Checklists Generated

| File                        | Items                       |
| --------------------------- | --------------------------- |
| checklists/security.md      | 26 items                    |
| checklists/performance.md   | 23 items                    |
| checklists/accessibility.md | 18 items                    |
| checklists/requirements.md  | (from Step 1, all complete) |

---

## Risk Level

**HIGH** (Score: 12)

| Factor                                                         | Points |
| -------------------------------------------------------------- | ------ |
| Database migration (tenant)                                    | +3     |
| New table (lessons)                                            | +2     |
| Security-sensitive logic (tenant isolation, permission gating) | +3     |
| Multi-tenant data isolation logic                              | +3     |
| Task estimate ~15–20                                           | +1     |
| **Total**                                                      | **12** |

---

## Constitutional Compliance

| Check                                     | Status | Notes                                                     |
| ----------------------------------------- | ------ | --------------------------------------------------------- |
| All material ambiguities resolved         | ✅     | 10/10 clarifications complete                             |
| Transaction strategy confirmed            | ✅     | Full atomic rollback via `db.transaction()`               |
| Idempotency strategy confirmed            | ✅     | Pre-check + PostgreSQL `23505` catch                      |
| Isolation boundaries confirmed            | ✅     | Tenant DB only, cross-tenant 404 masking                  |
| Version and license constraints confirmed | ✅     | MIN_SCHEMA_VERSION = 1.13.0; license middleware mandatory |

**Overall:** COMPLIANT

---

## Open Risks

None identified.

---

## Next Step

Proceed to Step 3 — Plan.
