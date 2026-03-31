# Specify Report — Traditional Question Model

**Step:** 1 — Specify
**Timestamp:** 2026-03-31T12:45:00Z
**Status:** COMPLETE

---

## Summary

The specification for **Traditional Question Model** (STAGE_35) was generated successfully.
The spec defines a complete data model for paper-style questions (TRUE_FALSE, FILL_BLANK,
SHORT_ANSWER), separated from the MCQ engine, with full CRUD API, workflow integration via the
shared status workflow engine, classification linking (categories + tags), academic boundary
enforcement, structural hierarchy to exam templates, type-specific validation, self-correction
model (v1), and deletion guard logic.

The spec follows the established pattern from Stage 034 (MCQ Question Model) adapted for the
three traditional question types with their distinct correct-answer schemas (JSONB).

---

## Inputs Reviewed

- `specs/phases/03_BACKOFFICE_CORE/04_EXAM_ENGINE_CORE/STAGE_35_TRADITIONAL_QUESTION_MODEL.md` — stage requirements
- `specs/runtime/034-mcq-question-model/spec.md` — reference spec (pattern template)
- `apps/api/src/db/tenant/schemas/subjects.schema.ts` — FK target
- `apps/api/src/db/tenant/schemas/divisions.schema.ts` — FK target
- `apps/api/src/db/tenant/schemas/categories.schema.ts` — FK target
- `apps/api/src/db/tenant/schemas/category-values.schema.ts` — FK target
- `apps/api/src/db/tenant/schemas/tags.schema.ts` — FK target
- `apps/api/src/db/tenant/schemas/mcq-questions.schema.ts` — schema pattern reference
- `specs/phases/03_BACKOFFICE_CORE/04_EXAM_ENGINE_CORE/STAGE_37_TRADITIONAL_EXAM_CONFIG.md` — subsection table definition
- `specs/runtime/035-traditional-question-model/checklists/requirements.md` — generated checklist

---

## Key Decisions

| #   | Decision                                                              | Rationale                                                                                       |
| --- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | Correct answer stored as JSONB with type-specific schemas             | Avoids polymorphic columns; allows type-safe validation per question type                       |
| 2   | Fully separate from MCQ engine — no shared tables or polymorphism     | Preserves engine boundary isolation per Zidney architecture; simpler evolution for each engine  |
| 3   | subsection_id is required and immutable after creation                | Structural binding ensures every question has a home in the exam template hierarchy             |
| 4   | questionType immutable after creation                                 | Changing type would invalidate the correct answer schema; safer to delete and recreate          |
| 5   | Soft delete as primary mechanism with guarded hard delete for DRAFT   | Protects referential integrity while allowing cleanup of unused drafts                          |
| 6   | Self-correction model defines data contract only; no attempt logic    | Question model exports the contract; attempt engine (future stage) implements the runtime logic |
| 7   | Workflow-managed status with ENABLED guard for correct answer + score | Prevents incomplete questions from being used in exams; uses shared workflow engine             |

---

## Functional Requirements Captured

- FR-001 through FR-023: 23 functional requirements covering creation, update, validation,
  workflow, classification, filtering, deletion, tenant isolation, timestamps, and content sanitization.
- 7 user stories with 26 acceptance scenarios.
- 9 edge case scenarios.
- 10 success criteria (SC-001 through SC-010).

---

## Clarifications Required

- **subsection_id FK dependency**: Stage 35 requires `traditional_exam_subsections` table (defined in
  Stage 37). This is a hard dependency — the migration cannot create the FK unless the target table
  exists. This must be resolved in Clarify (options: concurrent migration, nullable FK, deferred
  constraint, or Stage 37 is a prerequisite).

No other `[NEEDS CLARIFICATION]` markers were introduced.

---

## Architecture Governance Compliance

| Check                                              | Status | Notes                                                        |
| -------------------------------------------------- | ------ | ------------------------------------------------------------ |
| No cross-tenant access introduced (ADR-0001)       | ✅     | All tables in tenant DB only; zero master DB access          |
| License middleware requirement captured            | ✅     | Mandatory on all workspace question routes                   |
| Snapshot integrity requirement captured (ADR-0002) | ✅     | Question data snapshot-captured at attempt start             |
| Idempotency strategy defined                       | ✅     | UNIQUE constraints on classification links; 409 on duplicate |
| Transaction boundaries identified                  | ✅     | All writes inside explicit transaction                       |
| Server-authoritative time enforced (ADR-0006)      | ✅     | All timestamps set server-side                               |
| Trust chain respected                              | ✅     | Tenant resolver → license middleware → handler               |
| Import boundaries respected                        | ✅     | No cross-app imports; domain logic in packages               |

**Overall:** COMPLIANT

---

## Open Risks

- **Hard dependency on Stage 37**: The `subsection_id` FK targets `traditional_exam_subsections.id`,
  which is defined in Stage 37 (Traditional Exam Config). If Stage 37 is not implemented first or
  concurrently, the FK constraint cannot be created. This is the primary risk item for this stage.
- **JSONB correct answer validation**: JSONB schema validation must be enforced at the API layer
  (not DB-level) since PostgreSQL CHECK constraints on JSONB have limited expressiveness for
  nested schema validation.

---

## Next Step

Proceed to Step 2 — Clarify.
