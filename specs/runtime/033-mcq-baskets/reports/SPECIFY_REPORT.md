# Specify Report — MCQ Baskets

**Step:** 1 — Specify
**Timestamp:** 2026-03-23T00:05:00.000Z
**Status:** COMPLETE

---

## Summary

The MCQ Baskets specification has been fully drafted. Baskets serve as a structured grouping tool for MCQ questions, enabling manual exam assembly and automatic question selection. The spec defines two basket types (LINKED and UNLINKED), a status workflow engine integration, basket-question linking mechanics, deletion guards, and full API contracts for 10 endpoints.

---

## Inputs Reviewed

- `specs/phases/03_BACKOFFICE_CORE/03_CONTENT_CLASSIFICATION/STAGE_33_MCQ_BASKETS.md`
- `specs/runtime/033-mcq-baskets/spec.md`
- `specs/runtime/033-mcq-baskets/checklists/requirements.md`

---

## Key Decisions

| #   | Decision                                                                         | Rationale                                                                             |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | Two basket types: LINKED (classification-enforced) and UNLINKED (free container) | Maps to stage objective — different use cases for exam assembly vs. marketing bundles |
| 2   | Basket code must be unique per workspace                                         | Enforced via DB unique index; code used for deterministic referencing                 |
| 3   | Deletion blocked if basket referenced in exam config or auto-selection rules     | Prevents orphan references that would break exam integrity                            |
| 4   | Only ENABLED baskets usable in exams                                             | Ensures approval workflow is respected before production use                          |
| 5   | Basket cannot be ENABLED if empty                                                | Prevents misconfigured baskets from reaching the exam engine                          |
| 6   | Basket filter uses subquery on mcq_basket_questions                              | Avoids N+1 queries, compatible with indexed lookup                                    |
| 7   | Status workflow: DRAFT → COMPLETED → UNDER_REVIEW → APPROVED → ENABLED           | Aligns with shared status workflow engine                                             |
| 8   | Questions may belong to multiple baskets                                         | Basket is a grouping layer, not an ownership claim                                    |

---

## Functional Requirements Captured

- FR-001: Create basket with name, code, type, max_questions, description
- FR-002: Code unique per workspace (DB constraint)
- FR-003: Update basket metadata while in DRAFT
- FR-004: Delete basket — blocked if referenced in exam config or auto-selection rules
- FR-005: List baskets with pagination, filtering by type/status
- FR-006: Get basket by ID
- FR-007: Transition basket status via workflow engine
- FR-008: Link question to basket (idempotent)
- FR-009: Unlink question from basket
- FR-010: List questions in basket with pagination
- FR-011: Block ENABLE if basket has 0 questions
- FR-012: Block ENABLE if question count exceeds max_questions (if set)
- FR-013: Cascade delete basket-question rows on basket deletion
- FR-014: Cascade delete basket-question rows on question deletion
- FR-015: Auto-selection engine: basket filter via subquery
- FR-016: Prevent duplicate question entries in same basket
- FR-017: All operations tenant-scoped
- FR-018: License middleware on all workspace routes
- FR-019: Structured logging with correlation ID
- FR-020: Error contract: { success, data, error: { code, message } }
- FR-021: All writes transactional
- FR-022: Forward-only migrations — no existing migration modification

---

## Clarifications Required

None — specification is complete and unambiguous.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                          |
| --------------------------------------- | ------ | -------------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | All queries scoped by workspace/tenant                         |
| License middleware requirement captured | ✅     | Mandatory on all workspace-scoped routes                       |
| Snapshot integrity requirement captured | ✅     | N/A for this stage (no exam attempt grading)                   |
| Idempotency strategy defined            | ✅     | Link endpoint is idempotent (duplicate ignored / 409 returned) |
| Transaction boundaries identified       | ✅     | All writes (create, link, status transition) are transactional |
| Server-authoritative time enforced      | ✅     | created_at/updated_at set server-side only                     |

**Overall:** COMPLIANT

---

## Open Risks

- Migration fan-out to all tenant DBs must be validated before enabling baskets in any exam workflow
- Auto-selection engine integration (basket filter) depends on exam config schema being finalized in a prior or parallel stage

---

## Checklist Validation

- [x] All 22 functional requirements captured
- [x] All 14 business rules articulated
- [x] 10 API endpoints defined with request/response shapes
- [x] 17 validation criteria itemized
- [x] 11 out-of-scope items documented
- [x] Constitutional compliance confirmed
