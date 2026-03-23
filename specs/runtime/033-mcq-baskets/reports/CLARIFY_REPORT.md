# Clarify Report — MCQ Baskets

**Step:** 2 — Clarify
**Timestamp:** 2026-03-23T00:15:00.000Z
**Status:** COMPLETE

---

## Summary

The clarification session resolved all 5 targeted ambiguities identified in the spec. The specification is now fully unambiguous and ready for technical planning. No `[NEEDS CLARIFICATION]` markers remain.

---

## Clarifications Resolved

### Session 2026-03-23

| #   | Question                                                                             | Answer                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Can a basket transition backwards (e.g. ENABLED → APPROVED)?                         | **No.** Forward-only transitions enforced. Backward transitions rejected with `INVALID_STATE_TRANSITION`.                                                                                                                                         |
| C2  | Which RBAC roles can perform workflow transitions vs. basic CRUD?                    | CRUD: any authenticated workspace user with `content:write`. Transitions: `DRAFT→COMPLETED` = content creator; `COMPLETED→UNDER_REVIEW` = content editor; `UNDER_REVIEW→APPROVED` = content reviewer; `APPROVED→ENABLED` = content manager/admin. |
| C3  | Exactly what happens when link endpoint receives duplicate (basket_id, question_id)? | **409 Conflict** — not idempotent success. DB UNIQUE constraint enforced; application layer translates to `BASKET_QUESTION_ALREADY_LINKED` error code.                                                                                            |
| C4  | What constitutes a "reference" that blocks basket deletion?                          | **All statuses** — any exam config referencing the basket_id blocks deletion regardless of config lifecycle status (DRAFT, ENABLED, ARCHIVED).                                                                                                    |
| C5  | If max_questions is null, is there a system-level default cap?                       | **No.** `null` = unlimited. No system default. If set, the cap is enforced at ENABLE time (prevents enabling if question count exceeds cap).                                                                                                      |

---

## Risk Assessment

**Risk Level: HIGH**

| Factor                                                                | Points                        |
| --------------------------------------------------------------------- | ----------------------------- |
| Database migration — 2 new tables (mcq_baskets, mcq_basket_questions) | +5 (schema +3, new tables +2) |
| RBAC/security logic — per-role workflow transition guards             | +3                            |
| Multi-tenant data isolation — all operations tenant-scoped            | +3                            |
| >10 tasks expected                                                    | +1                            |
| **Total**                                                             | **12 → HIGH**                 |

---

## Scope Update After Clarifications

Scope additions:

- Per-step RBAC role mapping for workflow transitions (per clarification C2)
- 409 error code `BASKET_QUESTION_ALREADY_LINKED` added to error registry (per C3)
- Deletion guard covers ALL exam config statuses, not just active ones (per C4)

Deferred scope:

- Rollback logging strategy for mid-transaction failures (planning concern, covered by FR-021)
- Concurrent duplicate link race condition handling (DB UNIQUE constraint is the guard; planning detail)
- Cascade timing specifics (FK-level CASCADE defined in migration — planning concern)
- Per-request observability signals (covered by platform standards)

---

## Constitutional Compliance

| Check                           | Status | Notes                                    |
| ------------------------------- | ------ | ---------------------------------------- |
| All ambiguities resolved        | ✅     | 5/5 clarifications answered              |
| Forward-only workflow confirmed | ✅     | Backward transitions explicitly rejected |
| RBAC mapping complete           | ✅     | Per-role requirements now in spec        |
| Error codes defined             | ✅     | 409 conflict code added                  |
| Deletion guard scoped correctly | ✅     | ALL config statuses block deletion       |
| Tenant isolation unambiguous    | ✅     | Deletion guard uses tenant-scoped query  |

**Overall:** COMPLIANT — Planning authorized
