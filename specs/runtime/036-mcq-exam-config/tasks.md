# Tasks — MCQ Exam Configuration

**Stage:** STAGE_36_MCQ_EXAM_CONFIG
**Generated from:** plan.md, data-model.md, spec.md
**Total tasks:** 34

---

## Phase 1 — Database & Schema Foundation

- [x] T001 Create tenant migration `apps/api/src/db/tenant/migrations/20260401_014_mcq_exams.ts` — 4 tables, FK constraints, CHECK constraints, indexes, schema 1.19.0 → 1.20.0
- [x] T002 Create Drizzle schema `apps/api/src/db/tenant/schemas/mcq-exams.schema.ts` — pgTable for mcq_exams with all columns, relations
- [x] T003 [P] Create Drizzle schema `apps/api/src/db/tenant/schemas/mcq-exam-settings.schema.ts` — pgTable for mcq_exam_settings
- [x] T004 [P] Create Drizzle schema `apps/api/src/db/tenant/schemas/mcq-exam-questions.schema.ts` — pgTable for mcq_exam_questions
- [x] T005 [P] Create Drizzle schema `apps/api/src/db/tenant/schemas/mcq-exam-auto-criteria.schema.ts` — pgTable for mcq_exam_auto_criteria
- [x] T006 Update schema barrel `apps/api/src/db/tenant/schemas/index.ts` — add 4 new schema exports

## Phase 2 — Workflow Engine Integration

- [x] T007 Update `packages/domain-core/src/workflow/workflow.engine.ts` — add `mcq_exam: 'mcq_exams'` to ENTITY_TABLE_MAP
- [x] T008 Update `packages/domain-core/src/workflow/workflow.states.ts` — add `'mcq_exam'` to WORKFLOW_ENTITY_TYPES Set

## Phase 3 — Domain Types & Errors

- [x] T009 Create `packages/domain-core/src/mcq-exams/mcq-exams.types.ts` — DbClient, AuditContext re-exports, domain enums (SelectionMode, PassType, Status), all I/O interfaces
- [x] T010 Create `packages/domain-core/src/mcq-exams/mcq-exams.errors.ts` — 17 error codes, HTTP status map, McqExamError class

## Phase 4 — Repository Layer

- [x] T011 Create `packages/domain-core/src/mcq-exams/mcq-exams.repository.ts` — createExam, getExamById, listExams, updateExam, softDeleteExam
- [x] T012 Add settings repository functions to `mcq-exams.repository.ts` — upsertSettings, getSettings
- [x] T013 Add questions repository functions to `mcq-exams.repository.ts` — addQuestions, listQuestions, removeQuestion, replaceQuestionOrder
- [x] T014 Add criteria repository functions to `mcq-exams.repository.ts` — setCriteria, getCriteria
- [x] T015 Add workflow-support repository functions to `mcq-exams.repository.ts` — getExamForTransition (SELECT FOR UPDATE pattern)

## Phase 5 — Validators & Dependency Registry

- [x] T016 Create `packages/domain-core/src/mcq-exams/mcq-exams.validators.ts` — validatePreEnable (settings exist, delivery mode, chrono/duration, manual count, auto criteria sum)
- [x] T017 Create `packages/domain-core/src/mcq-exams/mcq-exams.dependency-registry.ts` — extensible deletion guard with registerExamReferenceChecker, checkExamReferences

## Phase 6 — Service Layer

- [x] T018 Create `packages/domain-core/src/mcq-exams/mcq-exams.service.ts` — createExam (TX, initial status COMPLETED), getExamById, listExams
- [x] T019 Add updateExam to service — TX, subject_id immutability check, selection_mode lock check
- [x] T020 Add deleteExam to service — TX, dependency guard, status ENABLED check
- [x] T021 Add settings service functions — upsertSettings (TX), getSettings
- [x] T022 Add question management service functions — addQuestions (TX, validate subject/division/enabled), removeQuestion, reorderQuestions
- [x] T023 Add criteria service functions — setCriteria (TX, validate sum = 100)
- [x] T024 Add transitionStatus to service — pre-enable validation hook, call executeTransition

## Phase 7 — Domain Barrel Export

- [x] T025 Create `packages/domain-core/src/mcq-exams/index.ts` — public API barrel (service, errors, types, dependency-registry)

## Phase 8 — Validation Schemas

- [x] T026 Create `packages/validation/src/backoffice/mcq-exams.schemas.ts` — Zod schemas for all 14 endpoints (path params, query, body)
- [x] T027 Update `packages/validation/src/backoffice/index.ts` — add mcq-exams.schemas export

## Phase 9 — Route Handlers

- [x] T028 Create `apps/api/src/routes/backoffice/mcq-exams/helpers.ts` — getDb, buildAuditCtx, successResponse, errorResponse
- [x] T029 Create `apps/api/src/routes/backoffice/mcq-exams/create-exam.ts` and `list-exams.ts` — POST /mcq-exams, GET /mcq-exams
- [x] T030 [P] Create `apps/api/src/routes/backoffice/mcq-exams/get-exam.ts`, `update-exam.ts`, `delete-exam.ts` — single exam CRUD
- [x] T031 [P] Create `apps/api/src/routes/backoffice/mcq-exams/upsert-settings.ts`, `get-settings.ts` — settings endpoints
- [x] T032 [P] Create `apps/api/src/routes/backoffice/mcq-exams/add-questions.ts`, `list-questions.ts`, `remove-question.ts`, `reorder-questions.ts` — question management endpoints
- [x] T033 [P] Create `apps/api/src/routes/backoffice/mcq-exams/set-criteria.ts`, `get-criteria.ts`, `transition-exam.ts` — criteria and workflow endpoints

## Phase 10 — Router Registration

- [x] T034 Create `apps/api/src/routes/backoffice/mcq-exams/index.ts` and register in `apps/api/src/routes/backoffice/index.ts` — permission guards, route mounting
