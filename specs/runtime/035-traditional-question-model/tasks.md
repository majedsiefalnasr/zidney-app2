# Tasks — Traditional Question Model

**Stage:** STAGE_35_TRADITIONAL_QUESTION_MODEL  
**Generated from:** `spec.md` + `plan.md`  
**Total Tasks:** 30

---

## Phase 1 — Infrastructure (Migration + Schemas)

- [ ] T001 Create migration file `apps/api/src/db/tenant/migrations/20260331_013_traditional_questions.ts` — Phase 1 (inside transaction): CREATE TABLE traditional_exam_sections (stub: id, exam_id, created_at, updated_at), CREATE TABLE traditional_exam_subsections (stub: id, section_id FK, created_at, updated_at)
- [ ] T002 In same migration Phase 1: CREATE TABLE traditional_questions with all columns (id, subject_id FK RESTRICT, division_id FK RESTRICT, subsection_id FK RESTRICT, question_type VARCHAR CHECK, language, content, correct_answer JSONB, explanation, score NUMERIC CHECK > 0, is_revision_only, is_exam_only, difficulty_level, status VARCHAR CHECK, self_correction_type, self_correction_content, deleted_at, created_at, updated_at, created_by, updated_by, status_updated_at, status_updated_by), B-tree indexes on subject_id, division_id, subsection_id, question_type, status, deleted_at
- [ ] T003 In same migration Phase 1: CREATE TABLE traditional_question_categories (id, question_id FK CASCADE, category_value_id, timestamps) + B-tree index on question_id. CREATE TABLE traditional_question_tags (id, question_id FK CASCADE, tag_id, timestamps) + B-tree index on question_id. Bump schema_version to 1.19.0
- [ ] T004 In same migration Phase 2 (outside transaction): CREATE UNIQUE INDEX CONCURRENTLY on traditional_question_categories(question_id, category_value_id), CREATE UNIQUE INDEX CONCURRENTLY on traditional_question_tags(question_id, tag_id)
- [ ] T005 Create Drizzle schema `apps/api/src/db/tenant/schemas/traditional-exam-sections.schema.ts` — pgTable definition for traditional_exam_sections (stub)
- [ ] T006 Create Drizzle schema `apps/api/src/db/tenant/schemas/traditional-exam-subsections.schema.ts` — pgTable definition for traditional_exam_subsections (stub)
- [ ] T007 Create Drizzle schema `apps/api/src/db/tenant/schemas/traditional-questions.schema.ts` — pgTable definitions for traditional_questions, traditional_question_categories, traditional_question_tags with check constraints and relations

## Phase 2 — Domain Core Module

- [ ] T008 Create `packages/domain-core/src/traditional-questions/traditional-questions.types.ts` — DbClient interface, AuditContext, TraditionalQuestionType enum (TRUE_FALSE, FILL_BLANK, SHORT_ANSWER), TraditionalQuestionStatus enum, domain interfaces (TraditionalQuestion, TraditionalQuestionCategory, TraditionalQuestionTag), ListFilters, CreateInput, UpdateInput
- [ ] T009 Create `packages/domain-core/src/traditional-questions/traditional-questions.errors.ts` — error code union type (TRAD_QUESTION_NOT_FOUND through TRAD_QUESTION_SUBJECT_IMMUTABLE), HTTP status mapping Record, TraditionalQuestionError class
- [ ] T010 Create `packages/domain-core/src/traditional-questions/traditional-questions.validators.ts` — validateCorrectAnswer(questionType, correctAnswer) discriminated validation: TRUE_FALSE requires {value: boolean}, FILL_BLANK requires {accepted_values: string[]} min 1, SHORT_ANSWER requires {model_answer: string} min 1 char
- [ ] T011 Create `packages/domain-core/src/traditional-questions/traditional-questions.sanitize.ts` — sanitizeQuestionContent(content) and sanitizeExplanation(explanation) using shared rich text sanitization pattern
- [ ] T012 Create `packages/domain-core/src/traditional-questions/traditional-questions.repository.ts` — pure SQL functions: insertQuestion, updateQuestion, softDeleteQuestion, findById, findByIdForUpdate, listQuestions (with pagination, filters, ILIKE search), countQuestions, insertCategory, deleteCategory, insertTag, deleteTag, findCategoriesByQuestionId, findTagsByQuestionId, checkSubjectExists, checkDivisionExists, checkSubsectionExists
- [ ] T013 Create `packages/domain-core/src/traditional-questions/traditional-questions.service.ts` — business logic with TX orchestration: createQuestion (validate FKs, sanitize, validate correct_answer, BEGIN/INSERT/COMMIT), updateQuestion (SELECT FOR UPDATE, immutability guards for type/subject, validate, update), deleteQuestion (guard check, soft delete), getQuestion, listQuestions, transitionQuestion (delegate to workflow engine), linkCategory, unlinkCategory, linkTag, unlinkTag
- [ ] T014 Create `packages/domain-core/src/traditional-questions/traditional-questions.dependency-registry.ts` — pluggable deletion guard: TraditionalQuestionReferenceChecker type, checkers array, registerChecker(), checkQuestionReferences()
- [ ] T015 Create `packages/domain-core/src/traditional-questions/index.ts` — barrel export: service functions, errors (class + codes + HTTP map), dependency-registry, type-only exports for internal types

## Phase 3 — Validation Schemas

- [ ] T016 Create `packages/validation/src/backoffice/traditional-questions.schemas.ts` — Zod schemas: questionIdParamSchema, questionCategoryParamSchema, questionTagParamSchema, listQuestionsQuerySchema (page, per_page, subject_id, division_id, subsection_id, question_type, status, search, sort_by, sort_order), createQuestionBodySchema (with superRefine for correct_answer vs question_type), updateQuestionBodySchema (partial, no type/subject), transitionQuestionBodySchema, linkCategoryBodySchema, linkTagBodySchema

## Phase 4 — API Route Handlers

- [ ] T017 Create `apps/api/src/routes/backoffice/traditional-questions/helpers.ts` — getDb(c), buildAuditCtx(c), successResponse<T>(), traditionalQuestionsErrorResponse() following MCQ helpers pattern
- [ ] T018 Create `apps/api/src/routes/backoffice/traditional-questions/create-question.ts` — POST handler: parse body with createQuestionBodySchema, getDb, buildAuditCtx, call service.createQuestion, return successResponse(201)
- [ ] T019 Create `apps/api/src/routes/backoffice/traditional-questions/list-questions.ts` — GET handler: parse query with listQuestionsQuerySchema, getDb, call service.listQuestions, return successResponse with pagination metadata
- [ ] T020 Create `apps/api/src/routes/backoffice/traditional-questions/get-question.ts` — GET /:questionId handler: parse params, getDb, call service.getQuestion (includes categories + tags), return successResponse
- [ ] T021 Create `apps/api/src/routes/backoffice/traditional-questions/update-question.ts` — PATCH /:questionId handler: parse params + body, getDb, buildAuditCtx, call service.updateQuestion, return successResponse
- [ ] T022 Create `apps/api/src/routes/backoffice/traditional-questions/delete-question.ts` — DELETE /:questionId handler: parse params, getDb, buildAuditCtx, call service.deleteQuestion, return successResponse(204)
- [ ] T023 Create `apps/api/src/routes/backoffice/traditional-questions/transition-question.ts` — POST /:questionId/workflow/transition handler: parse params + body, getDb, buildAuditCtx, bridge RBAC to workflow permissions, call service.transitionQuestion, return successResponse
- [ ] T024 [P] Create `apps/api/src/routes/backoffice/traditional-questions/link-category.ts` — POST /:questionId/categories handler + `apps/api/src/routes/backoffice/traditional-questions/unlink-category.ts` — DELETE /:questionId/categories/:categoryValueId handler
- [ ] T025 [P] Create `apps/api/src/routes/backoffice/traditional-questions/link-tag.ts` — POST /:questionId/tags handler + `apps/api/src/routes/backoffice/traditional-questions/unlink-tag.ts` — DELETE /:questionId/tags/:tagId handler
- [ ] T026 Create `apps/api/src/routes/backoffice/traditional-questions/index.ts` — router factory createTraditionalQuestionsRouter() with 3 permission guards (readGuard, writeGuard, transitionGuard), all route registrations, export as traditionalQuestionsRouter

## Phase 5 — App Registration

- [ ] T027 Modify `apps/api/src/app.ts` — import traditionalQuestionsRouter from routes/backoffice/traditional-questions, register with app.route('/api/v1/backoffice/workspace', traditionalQuestionsRouter)

## Phase 6 — Domain Core Barrel Export

- [ ] T028 Modify `packages/domain-core/src/index.ts` — add re-export for traditional-questions module (if barrel exists and follows MCQ export pattern)

## Phase 7 — Observability & Logging

- [ ] T029 [P] Add structured logging to all service operations in traditional-questions.service.ts — events: created, updated, deleted, transitioned, category.linked, category.unlinked, tag.linked, tag.unlinked, fetched, listed — with question_id, workspace_id, correlation_id

## Phase 8 — Architecture Guard Update

- [ ] T030 Run `bun run arch:audit` to regenerate architecture brain and verify new module is correctly indexed. Verify no import boundary violations detected.
