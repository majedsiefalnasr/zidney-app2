# Clarify Report — Categories (Classification Dimensions)

**Step:** 2 — Clarify
**Timestamp:** 2026-03-22T00:02:00.000Z
**Status:** COMPLETE

---

## Summary

Three targeted clarification questions were asked and resolved. The spec.md has been updated in-place with all answers encoded under `## Clarifications / ### Session 2026-03-22`. Zero `[NEEDS CLARIFICATION]` markers remain. Three supplemental checklists generated (requirements.md, security.md, performance.md).

---

## Clarifications Resolved

| #   | Question                                                | Answer Encoded                                                                                                                             |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Q1  | Concurrent parent_id hierarchy locking strategy         | `SELECT FOR UPDATE` on the target category row at the start of any hierarchy-mutating transaction                                          |
| Q2  | Soft-delete behavior when category has ENABLED children | Block with 422 `CATEGORY_HAS_ENABLED_CHILDREN`; operator must disable all children first                                                   |
| Q3  | RBAC permission check layer (middleware vs handler)     | `requirePermission('question_manage', 'classification_manage')` middleware on each write route (POST, PATCH, DELETE) in the router factory |

---

## Coverage Assessment

| Category                            | Status              |
| ----------------------------------- | ------------------- |
| Functional Scope & Behavior         | Clear               |
| Domain & Data Model                 | Clear               |
| Interaction & UX Flow               | Clear               |
| Non-Functional Quality Attributes   | Clear               |
| Integration & External Dependencies | Clear               |
| Edge Cases & Failure Handling       | Clear (Q2 resolved) |
| Constraints & Tradeoffs             | Clear               |
| Access Control / RBAC               | Clear (Q3 resolved) |
| Concurrency Safety                  | Clear (Q1 resolved) |
| Completion Signals                  | Clear               |

---

## Notable Gaps Surfaced (for Planning)

These items emerged from checklist generation and must be addressed in plan.md:

1. No max array size on `subject_ids`/`division_ids` (potential injection surface)
2. No explicit parameterized-query requirement for ILIKE `search` parameter
3. No TOCTOU guard for `CATEGORY_HAS_ENABLED_CHILDREN` under concurrent transactions
4. No N+1 prevention strategy for scope queries in list responses
5. No tree endpoint query strategy specified (bulk query vs per-node)
6. No `CONCURRENT` index creation guidance for live tenant migrations

---

## Risk Level Assessment

**Factors scoring:**

- Database migration (schema change): +3
- New tables added (3): +2 × 2 = +4 (capped at +2)
- Security-sensitive RBAC logic: +3
- Multi-tenant data isolation logic: +3

**Total score: 11 → Risk Level: HIGH**

---

## Constitutional Compliance

| Check                                | Status | Notes                                               |
| ------------------------------------ | ------ | --------------------------------------------------- |
| No cross-tenant access               | ✅     | All tables in tenant DB only                        |
| License middleware mandatory         | ✅     | Specified in middleware chain                       |
| Security boundaries defined          | ✅     | requirePermission middleware on all writes          |
| Transaction boundaries (concurrency) | ✅     | SELECT FOR UPDATE specified for hierarchy mutations |
| Error contract                       | ✅     | 13 domain error codes defined                       |
| Server-authoritative time            | ✅     | Confirmed in spec                                   |

**Overall:** COMPLIANT — Planning authorized

---

## Next Step

Proceed to Step 3 — Plan.
