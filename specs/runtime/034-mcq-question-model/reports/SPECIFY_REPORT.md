# Specify Report — MCQ Question Model

**Step:** 1 — Specify  
**Timestamp:** 2026-03-30T00:00:00Z  
**Status:** COMPLETE

---

## Summary

The MCQ Question Model specification defines 5 normalized tables, 13 API endpoints, 4 question types with type-specific validation, academic boundary enforcement, classification linking, workflow lifecycle, and deletion guards. 18 functional requirements captured across 7 user stories (P1–P3). No clarifications needed — the stage file was explicit.

---

## Inputs Reviewed

- `specs/runtime/034-mcq-question-model/spec.md`
- `specs/runtime/034-mcq-question-model/checklists/requirements.md`

---

## Key Decisions

| #   | Decision                                            | Rationale                                            |
| --- | --------------------------------------------------- | ---------------------------------------------------- |
| 1   | Normalized option storage (no JSON arrays)          | Stage spec explicitly requires FK-linked option rows |
| 2   | Question type immutable after creation              | Changing type would invalidate existing options      |
| 3   | Workflow engine delegation for status               | Reuse shared workflow engine from STAGE_20           |
| 4   | Soft delete guard (status-based) before hard delete | Prevent orphan exam references                       |
| 5   | All classification links optional but indexed       | Auto-selection engine requires performant filtering  |

---

## Functional Requirements Captured

- FR-001: CRUD for MCQ questions with 4 types (SINGLE, MULTIPLE, TRUE_FALSE, ARRANGEMENT)
- FR-002: Type-specific option validation at creation and update
- FR-003: Academic boundary enforcement (subject required, lesson → subject hierarchy)
- FR-004: DRAFT initial status via workflow engine
- FR-005: ENABLED transition blocked without valid options
- FR-006: Full option management (add, update, delete, reorder)
- FR-007: Question type immutable after creation
- FR-008: Classification linking (categories, tags, baskets)
- FR-009: Uniqueness enforcement on classification links
- FR-010: Multi-dimensional filtering and listing
- FR-011: Deletion guard (exam/scheduled/attempt references)
- FR-012: Cascade delete for options and classification links
- FR-013: Tenant isolation (database-per-tenant)
- FR-014: License middleware on all routes
- FR-015: Normalized tables with FKs only
- FR-016: All filterable columns indexed
- FR-017: Server-authoritative timestamps
- FR-018: Unique(question_id, order_index) on options

---

## Clarifications Required

- None — stage file was fully explicit on schemas, rules, and constraints.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                            |
| --------------------------------------- | ------ | ------------------------------------------------ |
| No cross-tenant access introduced       | ✅     | Database-per-tenant, tenant resolver required    |
| License middleware requirement captured | ✅     | FR-014 mandates license middleware on all routes |
| Snapshot integrity requirement captured | ✅     | MCQ model compatible with attempt snapshot model |
| Idempotency strategy defined            | ✅     | Classification link operations idempotent        |
| Transaction boundaries identified       | ✅     | Question+options creation in single transaction  |
| Server-authoritative time enforced      | ✅     | FR-017 — no client timestamps                    |

**Overall:** COMPLIANT

---

## Open Risks

- None identified at specification level.

---

## Next Step

Proceed to Step 2 — Clarify.
