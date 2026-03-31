# Requirements Checklist: Traditional Question Model

**Purpose**: Verify that the specification for Traditional Question Model is complete, internally consistent, and meets
governance requirements before proceeding to the Plan step.
**Created**: 2026-03-31
**Feature**: spec.md

---

## Data Model Completeness

- [ ] CHK001 `traditional_questions` table defined with all required columns (id, subject_id, division_id, lesson_id, subsection_id, question_type, content, correct_answer, correction_criteria, score, language, status, timestamps, audit fields, deleted_at)
- [ ] CHK002 `traditional_question_categories` join table defined with UNIQUE constraint on (question_id, category_value_id)
- [ ] CHK003 `traditional_question_tags` join table defined with UNIQUE constraint on (question_id, tag_id)
- [ ] CHK004 All FK relationships documented with ON DELETE behavior (CASCADE for join tables, RESTRICT for academic refs)
- [ ] CHK005 All required indexes specified for filterable columns
- [ ] CHK006 Status column defined as VARCHAR (not pgEnum) — consistent with codebase convention
- [ ] CHK007 Score constraint (> 0) defined at DB level via CHECK constraint
- [ ] CHK008 Correct answer storage format defined per question type (TRUE_FALSE, FILL_BLANK, SHORT_ANSWER)

## Tenant Isolation

- [ ] CHK009 All tables reside exclusively in tenant DB — zero master DB access
- [ ] CHK010 Tenant resolver middleware is mandatory before all question route handlers
- [ ] CHK011 License middleware is mandatory before all question route handlers
- [ ] CHK012 No cross-tenant data access patterns exist in the specification

## API Endpoints

- [ ] CHK013 POST /workspace/:slug/traditional-questions — create question
- [ ] CHK014 GET /workspace/:slug/traditional-questions — list with filtering and pagination
- [ ] CHK015 GET /workspace/:slug/traditional-questions/:questionId — get single question with classifications
- [ ] CHK016 PATCH /workspace/:slug/traditional-questions/:questionId — partial update with optimistic concurrency
- [ ] CHK017 DELETE /workspace/:slug/traditional-questions/:questionId — soft/hard delete with deletion guard
- [ ] CHK018 POST /workspace/:slug/traditional-questions/:questionId/workflow/transition — status transitions
- [ ] CHK019 POST /workspace/:slug/traditional-questions/:questionId/categories — add category link
- [ ] CHK020 DELETE /workspace/:slug/traditional-questions/:questionId/categories/:categoryValueId — remove category link
- [ ] CHK021 POST /workspace/:slug/traditional-questions/:questionId/tags — add tag link
- [ ] CHK022 DELETE /workspace/:slug/traditional-questions/:questionId/tags/:tagId — remove tag link

## Type-Specific Validation

- [ ] CHK023 TRUE_FALSE: correctAnswer required, must be { value: boolean }
- [ ] CHK024 FILL_BLANK: correctAnswer required, must have at least one non-empty accepted_value
- [ ] CHK025 SHORT_ANSWER: correctAnswer optional; correctionCriteria optional
- [ ] CHK026 Type validation enforced at creation, update, and ENABLED transition

## Workflow Integration

- [ ] CHK027 Status lifecycle: DRAFT → COMPLETED → UNDER_REVIEW → APPROVED → ENABLED
- [ ] CHK028 ENABLED guard: valid correct answer (for applicable types) + positive score + non-empty content
- [ ] CHK029 No backward transitions allowed
- [ ] CHK030 Status not updatable via CRUD PATCH endpoint — workflow transitions only

## Academic Boundary Enforcement

- [ ] CHK031 subject_id is always required
- [ ] CHK032 lesson_id, when set, must belong to the same subject
- [ ] CHK033 division_id, when set, must belong to the workspace scope
- [ ] CHK034 subsection_id is always required and must be in the same subject's template
- [ ] CHK035 No cross-subject or cross-division assignment is possible

## Security & Validation

- [ ] CHK036 Permission checks documented for every endpoint and transition
- [ ] CHK037 Rich text content sanitization specified (whitelist approach, XSS prevention)
- [ ] CHK038 Optimistic concurrency control via updatedAt comparison
- [ ] CHK039 All timestamps set server-side — no client-supplied timestamps
- [ ] CHK040 Error response shape follows standard envelope { success, data, error }

## Deletion Guard

- [ ] CHK041 Soft delete as primary mechanism (deleted_at column)
- [ ] CHK042 Hard delete restricted to DRAFT status + zero references
- [ ] CHK043 Active attempt reference blocks ALL deletion types
- [ ] CHK044 Classification links cascade-deleted on hard delete, preserved on soft delete

## Edge Cases & Error Handling

- [ ] CHK045 Score = 0 and negative score rejected
- [ ] CHK046 Empty content rejected
- [ ] CHK047 Empty accepted_values array for FILL_BLANK rejected
- [ ] CHK048 Concurrent update conflict handling documented
- [ ] CHK049 Duplicate classification link returns 409 (idempotent behavior)
- [ ] CHK050 Subsection from different subject's template rejected

## Success Criteria

- [ ] CHK051 All 10 success criteria (SC-001 through SC-010) are measurable
- [ ] CHK052 Performance criteria defined (< 1s for filtered list up to 10K questions)
- [ ] CHK053 Zero cross-tenant data leakage criterion defined

---

## Notes

- Check items off as completed: `[x]`
- Items are numbered CHK001–CHK053 for cross-reference with spec.md sections
- All CHK items must be verified during the Clarify and Analyze steps
