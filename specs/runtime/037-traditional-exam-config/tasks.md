# Tasks — Traditional Exam Configuration

## Phase 1: Infrastructure (Migration + Schemas)

- [ ] T001 Create migration `apps/api/src/db/tenant/migrations/20260402_015_traditional_exams.ts` with Phase 1 DDL (CREATE TABLE traditional_exams, traditional_exam_settings, traditional_exam_questions; ALTER TABLE traditional_exam_sections, traditional_exam_subsections; FK constraints, CHECK constraints, B-tree indexes, schema_version bump 1.20.0→1.21.0) and Phase 2 CONCURRENT unique indexes
- [ ] T002 Create Drizzle schema `apps/api/src/db/tenant/schemas/traditional-exams.schema.ts` with all columns, constraints, and type exports (TraditionalExam, NewTraditionalExam)
- [ ] T003 Create Drizzle schema `apps/api/src/db/tenant/schemas/traditional-exam-settings.schema.ts` with FK reference to traditionalExams and 1:1 unique constraint on exam_id
- [ ] T004 Update stub schema `apps/api/src/db/tenant/schemas/traditional-exam-sections.schema.ts` adding template_section_id, header_content, order_index columns
- [ ] T005 Update stub schema `apps/api/src/db/tenant/schemas/traditional-exam-subsections.schema.ts` adding template_subsection_id, header_content, order_index columns
- [ ] T006 Create Drizzle schema `apps/api/src/db/tenant/schemas/traditional-exam-questions.schema.ts` with FK references to traditionalExamSubsections and traditionalQuestions, UNIQUE(subsection_id, question_id)

## Phase 2: Domain-Core Types & Errors

- [ ] T007 Create `packages/domain-core/src/traditional-exams/traditional-exams.types.ts` with DbClient, AuditContext interfaces, enums (TraditionalExamStatus, TraditionalExamModuleType), row types (TraditionalExamRow, SettingsRow, SectionRow, SubsectionRow, QuestionAssignmentRow), input DTOs (CreateExamInput, UpdateExamInput, ListExamsInput, UpsertSettingsInput, AssignQuestionsInput, ReorderQuestionsInput, UpdateSectionInput, UpdateSubsectionInput)
- [ ] T008 Create `packages/domain-core/src/traditional-exams/traditional-exams.errors.ts` with 19 error codes, HTTP status map, error messages, TraditionalExamError class following MCQ exam error pattern

## Phase 3: Domain-Core Validators & Dependency Registry

- [ ] T009 [P] Create `packages/domain-core/src/traditional-exams/traditional-exams.validators.ts` with validatePassPercentage, validateDeliveryMode (at least one of relax/chrono), validateChronoDuration (chrono requires duration), validateStatusForUpdate (DRAFT/UNDER_REVIEW only), validateStatusForDelete (DRAFT only)
- [ ] T010 [P] Create `packages/domain-core/src/traditional-exams/traditional-exams.dependency-registry.ts` with ExamReferenceChecker type, registerExamReferenceChecker, checkExamReferences pattern following MCQ exam dependency-registry

## Phase 4: Domain-Core Repository

- [ ] T011 Create `packages/domain-core/src/traditional-exams/traditional-exams.repository.ts` — exam CRUD queries: insertExam, findExamById, findExamByIdForUpdate (SELECT FOR UPDATE), listExams (paginated with filters: subject_id, division_id, module_type, status, search), countExams, updateExam, softDeleteExam, examExists, updateExamStatus
- [ ] T012 Add settings queries to repository: findSettingsByExamId, upsertSettings (INSERT ON CONFLICT DO UPDATE)
- [ ] T013 Add section/subsection queries to repository: findSectionsByExamId (with nested subsections), findSectionById, updateSection, findSubsectionById, updateSubsection, insertSections (bulk), insertSubsections (bulk)
- [ ] T014 Add question assignment queries to repository: findQuestionsBySubsectionId, assignQuestions (bulk INSERT ON CONFLICT), removeQuestion, deleteQuestionsBySubsection, insertQuestionsWithOrder (for reorder)

## Phase 5: Domain-Core Service

- [ ] T015 Create `packages/domain-core/src/traditional-exams/traditional-exams.service.ts` — createExam function with template initialization TX (insert exam → insert sections from template → insert subsections from template), template validation via raw SQL
- [ ] T016 Add listExams, getExam functions to service with division-scoped filtering WHERE clause
- [ ] T017 Add updateExam function to service with status guard (DRAFT/UNDER_REVIEW only) and SELECT FOR UPDATE pattern
- [ ] T018 Add deleteExam function to service with status guard (DRAFT only), dependency registry check, and soft delete
- [ ] T019 Add transitionExam function to service with custom transition table validation, SELECT FOR UPDATE, pre-enable structural validation (section count match, subsection count match, every subsection has ≥1 question, pass_percentage > 0, total score > 0, chrono requires duration)
- [ ] T020 Add getSettings, upsertSettings functions to service with delivery mode validation (at least relax or chrono) and chrono-duration validation
- [ ] T021 Add listSections, updateSection, updateSubsection functions to service
- [ ] T022 Add listSubsectionQuestions, assignQuestions (validate question subject match + ENABLED status, score snapshot), removeQuestion, reorderQuestions functions to service

## Phase 6: Domain-Core Barrel Export

- [ ] T023 Create `packages/domain-core/src/traditional-exams/index.ts` barrel exporting service, errors, dependency-registry, and type-only exports for types

## Phase 7: Validation Schemas

- [ ] T024 Create `packages/validation/src/backoffice/traditional-exams.schemas.ts` with all 13 Zod schemas: examIdParamSchema, sectionIdParamSchema, subsectionIdParamSchema, questionIdParamSchema, listExamsQuerySchema, createExamBodySchema, updateExamBodySchema, upsertSettingsBodySchema, transitionBodySchema, assignQuestionsBodySchema, reorderQuestionsBodySchema, updateSectionBodySchema, updateSubsectionBodySchema

## Phase 8: Route Handlers — Core CRUD

- [ ] T025 Create `apps/api/src/routes/backoffice/traditional-exams/helpers.ts` with getDb, buildAuditCtx, successResponse, traditionalExamsErrorResponse utilities following MCQ exam helpers pattern
- [ ] T026 Create `apps/api/src/routes/backoffice/traditional-exams/create-exam.ts` handler — POST /traditional-exams, parse createExamBodySchema, call service.createExam, return 201
- [ ] T027 Create `apps/api/src/routes/backoffice/traditional-exams/list-exams.ts` handler — GET /traditional-exams, parse listExamsQuerySchema, call service.listExams, return paginated result
- [ ] T028 Create `apps/api/src/routes/backoffice/traditional-exams/get-exam.ts` handler — GET /traditional-exams/:examId, parse examIdParamSchema, call service.getExam, return exam detail
- [ ] T029 Create `apps/api/src/routes/backoffice/traditional-exams/update-exam.ts` handler — PATCH /traditional-exams/:examId, parse updateExamBodySchema, call service.updateExam
- [ ] T030 Create `apps/api/src/routes/backoffice/traditional-exams/delete-exam.ts` handler — DELETE /traditional-exams/:examId, parse examIdParamSchema, call service.deleteExam

## Phase 9: Route Handlers — Workflow

- [ ] T031 Create `apps/api/src/routes/backoffice/traditional-exams/transition-exam.ts` handler — POST /traditional-exams/:examId/workflow/transition, parse transitionBodySchema, call service.transitionExam

## Phase 10: Route Handlers — Settings

- [ ] T032 Create `apps/api/src/routes/backoffice/traditional-exams/get-settings.ts` handler — GET /traditional-exams/:examId/settings, call service.getSettings
- [ ] T033 Create `apps/api/src/routes/backoffice/traditional-exams/upsert-settings.ts` handler — PUT /traditional-exams/:examId/settings, parse upsertSettingsBodySchema, call service.upsertSettings

## Phase 11: Route Handlers — Content Structure

- [ ] T034 Create `apps/api/src/routes/backoffice/traditional-exams/list-sections.ts` handler — GET /traditional-exams/:examId/sections, call service.listSections
- [ ] T035 Create `apps/api/src/routes/backoffice/traditional-exams/update-section.ts` handler — PATCH /traditional-exams/:examId/sections/:sectionId, parse updateSectionBodySchema, call service.updateSection
- [ ] T036 Create `apps/api/src/routes/backoffice/traditional-exams/update-subsection.ts` handler — PATCH .../sections/:sectionId/subsections/:subsectionId, parse updateSubsectionBodySchema, call service.updateSubsection

## Phase 12: Route Handlers — Question Assignment

- [ ] T037 Create `apps/api/src/routes/backoffice/traditional-exams/list-subsection-questions.ts` handler — GET .../subsections/:subsectionId/questions, call service.listSubsectionQuestions
- [ ] T038 Create `apps/api/src/routes/backoffice/traditional-exams/assign-questions.ts` handler — POST .../subsections/:subsectionId/questions, parse assignQuestionsBodySchema, call service.assignQuestions
- [ ] T039 Create `apps/api/src/routes/backoffice/traditional-exams/remove-question.ts` handler — DELETE .../questions/:questionId, call service.removeQuestion
- [ ] T040 Create `apps/api/src/routes/backoffice/traditional-exams/reorder-questions.ts` handler — PUT .../subsections/:subsectionId/questions/reorder, parse reorderQuestionsBodySchema, call service.reorderQuestions

## Phase 13: Router Factory & Registration

- [ ] T041 Create `apps/api/src/routes/backoffice/traditional-exams/index.ts` router factory with 3 RBAC guard levels (read, write, transition), register all 16 route handlers
- [ ] T042 Register traditionalExamsRouter in `apps/api/src/app.ts` — import and mount on `/api/v1/backoffice/workspace`

## Phase 14: Validation & Governance

- [ ] T043 Run `bun run typecheck` to verify zero TypeScript errors across monorepo
- [ ] T044 Run `bun run lint` to verify zero Biome lint errors
- [ ] T045 Run architecture guard `bun run ai:guard` to confirm no architectural violations
