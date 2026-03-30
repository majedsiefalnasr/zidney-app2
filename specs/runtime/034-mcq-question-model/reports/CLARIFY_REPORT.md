# Clarify Report — MCQ Question Model

**Step:** 2 — Clarify  
**Timestamp:** 2026-03-30T00:02:00Z  
**Status:** COMPLETE

---

## Summary

5 ambiguities identified and resolved. Spec updated with 2 new functional requirements (FR-019: optimistic concurrency, FR-020: rich text sanitization), clarified transaction boundaries, soft/hard delete strategy, and rate limiting references. 3 checklists generated (security: 48 items, performance: 38 items, accessibility: 35 items).

---

## Inputs Reviewed

- `specs/runtime/034-mcq-question-model/spec.md` (including `## Clarifications`)

---

## Clarifications Resolved

| #   | Question                           | Resolution                                                                                   | Impact                                          |
| --- | ---------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | Transaction scope for PATCH update | Single atomic transaction — metadata + option replacement + validation all rollback together | Updated FR-006, PATCH endpoint spec             |
| 2   | Concurrent update handling         | Optimistic concurrency via `updated_at` with 409 Conflict response                           | Added FR-019, User Story 3 scenario 5           |
| 3   | Rich text content sanitization     | Server-side sanitization with HTML whitelist before storage                                  | Added FR-020, all endpoints with content fields |
| 4   | Rate limiting specifics            | Follow platform standard from STAGE_08, no question-specific overrides                       | Updated Constitutional Compliance table         |
| 5   | Soft delete vs hard delete         | Soft delete primary (status-based); hard delete restricted to DRAFT with no exam refs        | Updated FR-011, FR-012, User Story 7            |

---

## Open Items

- None — all material ambiguities resolved.

---

## Spec Updates Applied

- Added `## Clarifications` section with `### Session 2026-03-30`
- Updated PATCH endpoint with atomic transaction and optimistic concurrency
- Updated DELETE endpoint for soft/hard delete dual strategy
- Added FR-019 (optimistic concurrency) and FR-020 (rich text sanitization)
- Updated User Story 3 (concurrent update scenario) and User Story 7 (delete scenarios)
- Rate limiting row in Constitutional Compliance now references STAGE_08

---

## Checklists Generated

| Checklist     | File                        | Items |
| ------------- | --------------------------- | ----- |
| Security      | checklists/security.md      | 48    |
| Performance   | checklists/performance.md   | 38    |
| Accessibility | checklists/accessibility.md | 35    |

---

## Constitutional Compliance

| Check                                     | Status | Notes                                                              |
| ----------------------------------------- | ------ | ------------------------------------------------------------------ |
| All material ambiguities resolved         | ✅     | 5/5 resolved                                                       |
| Transaction strategy confirmed            | ✅     | Single atomic transaction for PATCH updates                        |
| Idempotency strategy confirmed            | ✅     | Classification links UNIQUE-enforced, 409 on conflict              |
| Isolation boundaries confirmed            | ✅     | Database-per-tenant, tenant resolver required                      |
| Version and license constraints confirmed | ✅     | Optimistic concurrency via updated_at, license middleware required |

**Overall:** COMPLIANT

---

## Risk Level Assessment

| Factor                             | Points |
| ---------------------------------- | ------ |
| Database migration (schema change) | +3     |
| New tables added (5 tables)        | +2     |
| Multi-tenant data isolation logic  | +3     |
| More than 10 tasks expected        | +1     |
| **Total**                          | **9**  |

**Risk Level: HIGH**

---

## Open Risks

- None

---

## Next Step

Proceed to Step 3 — Plan.
