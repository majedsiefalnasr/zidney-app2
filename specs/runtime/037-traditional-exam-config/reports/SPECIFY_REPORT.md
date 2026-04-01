# Specify Report — Traditional Exam Configuration

**Step:** 1 — Specify  
**Timestamp:** 2026-04-01T00:01:00Z  
**Status:** COMPLETE

---

## Summary

Specification for the Traditional Exam Configuration stage has been completed. The spec covers full CRUD for traditional exams, delivery settings, content structure management (sections/subsections/questions), workflow status transitions with structural validation, and division-scoped access control.

---

## Inputs Reviewed

- `specs/phases/03_BACKOFFICE_CORE/04_EXAM_ENGINE_CORE/STAGE_37_TRADITIONAL_EXAM_CONFIG.md`
- `apps/api/src/db/tenant/schemas/traditional-questions.schema.ts` (Stage 35 dependency)
- `apps/api/src/db/tenant/schemas/traditional-exam-sections.schema.ts` (stub from Stage 35)
- `apps/api/src/db/tenant/schemas/traditional-exam-subsections.schema.ts` (stub from Stage 35)
- `apps/api/src/routes/backoffice/mcq-exams/index.ts` (pattern reference from Stage 36)

---

## Key Decisions

| #   | Decision                                                        | Rationale                                             |
| --- | --------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | Follow MCQ exam router pattern (Stage 36) for consistency       | Same project, same team, same conventions             |
| 2   | template_id treated as opaque UUID — template CRUD is separate  | Stage file explicitly states templates are predefined |
| 3   | Sections/subsections initialized from template on exam creation | Template structure defines exam layout                |
| 4   | Score snapshot on question assignment (not live reference)      | Preserves exam integrity — matches stage spec         |
| 5   | Soft delete only (deleted_at column)                            | Cannot hard-delete exams that may have attempts       |
| 6   | No rush mode for traditional exams                              | Explicitly excluded in stage spec                     |

---

## Functional Requirements Captured

- FR-1: Full CRUD for traditional exams with division scoping
- FR-2: Delivery settings with mode constraints (no rush, chrono requires duration)
- FR-3: Section/subsection/question management with template binding
- FR-4: Workflow status machine (DRAFT → UNDER_REVIEW → APPROVED → ENABLED → DISABLED)
- FR-5: Structural validation gate for ENABLED transition
- FR-6: Division-scoped staff access control

---

## Clarifications Required

- None — stage file provided all required context.

---

## Architecture Governance Compliance

| Check                                              | Status | Notes                            |
| -------------------------------------------------- | ------ | -------------------------------- |
| No cross-tenant access introduced (ADR-0001)       | ✅     | All DB via tenant resolver       |
| License middleware requirement captured            | ✅     | Required on all workspace routes |
| Snapshot integrity requirement captured (ADR-0002) | ✅     | Score copied at assignment time  |
| Error contract followed                            | ✅     | { success, data, error }         |
| Structured logging required                        | ✅     | correlation_id + workspace_id    |
