# Specify Report — MCQ Exam Configuration

**Step:** 1 — Specify  
**Timestamp:** 2026-04-01T00:00:00Z  
**Status:** COMPLETE

---

## Summary

Specification for STAGE_36_MCQ_EXAM_CONFIG completed. The feature defines a reusable MCQ exam
configuration entity managed by backoffice staff. It covers 4 tenant-scoped database tables,
14 API endpoints, workflow integration via the shared engine, manual and automatic question
selection modes, delivery configuration, and comprehensive validation rules including deletion
guards and immutability constraints.

---

## Inputs Reviewed

- `specs/runtime/036-mcq-exam-config/spec.md`
- `specs/runtime/036-mcq-exam-config/checklists/requirements.md`
- `specs/phases/03_BACKOFFICE_CORE/04_EXAM_ENGINE_CORE/STAGE_36_MCQ_EXAM_CONFIG.md`
- Existing codebase patterns: mcq-questions.schema.ts, workflow.engine.ts, exam-loader.ts

---

## Key Decisions

| #   | Decision                                           | Rationale                                                     |
| --- | -------------------------------------------------- | ------------------------------------------------------------- |
| 1   | Use shared workflow engine for status transitions  | Reuse existing ENTITY_TABLE_MAP; consistent with all entities |
| 2   | MANUAL and AUTOMATIC as selection modes            | Defined in stage file; covers hand-picked and criteria-based  |
| 3   | Settings as separate 1-to-1 table                  | Isolates delivery/result config from core exam metadata       |
| 4   | UUID arrays for auto criteria filter columns       | Flexible multi-value filtering without additional join tables |
| 5   | Percentage sum = 100 enforced at application level | Cannot be enforced with SQL CHECK across multiple rows        |
| 6   | Initial status COMPLETED per workflow convention   | Workflow engine starts entities at COMPLETED (first state)    |
| 7   | Soft-delete pattern with deleted_at column         | Consistent with existing entity patterns (MCQ questions)      |

---

## Functional Requirements Captured

- FR-001: Create MCQ Exam — full validation, subject FK, unique code
- FR-002: List MCQ Exams — paginated, filterable by status/subject/division/mode
- FR-003: Get MCQ Exam by ID — includes nested settings and counts
- FR-004: Update MCQ Exam — immutability rules, conditional mutability
- FR-005: Soft-Delete MCQ Exam — deletion guards, status check
- FR-006: Manage Exam Delivery Settings — upsert pattern, mode validation
- FR-007: Manual Question Selection — Add Questions with subject/division matching
- FR-008: Manual Question Selection — Remove Questions with lock check
- FR-009: Manual Question Selection — Reorder Questions with contiguous validation
- FR-010: Automatic Criteria Management — atomic replacement, percentage sum check
- FR-011: Workflow Status Transition — shared engine, pre-enable validation
- FR-012: Get Exam Delivery Settings — read-only retrieval
- FR-013: List Exam Questions (Manual Mode) — ordered listing
- FR-014: Get Exam Criteria (Automatic Mode) — criteria listing

---

## Clarifications Required

None — all requirements are fully specified in the stage file.

---

## Architecture Governance Compliance

| Check                                              | Status | Notes                                              |
| -------------------------------------------------- | ------ | -------------------------------------------------- |
| No cross-tenant access introduced (ADR-0001)       | ✅     | All tables in tenant DB only                       |
| License middleware requirement captured            | ✅     | All routes behind tenant resolver + license MW     |
| Snapshot integrity requirement captured (ADR-0002) | ✅     | Snapshot contract documented in NFR-006            |
| Idempotency strategy defined                       | ✅     | Code-based dedup, upsert settings, atomic criteria |
| Transaction boundaries identified                  | ✅     | NFR-004 requires all writes transactional          |
| Server-authoritative time enforced (ADR-0006)      | ✅     | NOW() for all timestamps, no client time           |
| Trust chain respected                              | ✅     | Isolation → License → Auth → Attempt               |
| Import boundaries respected                        | ✅     | Domain logic in packages/domain-core               |

**Overall:** COMPLIANT

---

## Open Risks

- Auto criteria with UUID arrays may require future indexing strategy (GIN indexes) if
  criteria-based question selection at runtime proves slow.
- Deletion guards for attempts and scheduled exams reference future tables — must be
  implemented as extensible guard checks.

---

## Next Step

Proceed to Step 2 — Clarify.
