# Tasks: STAGE_34_MCQ_QUESTION_MODEL

**Input**: Design documents from `specs/runtime/034-mcq-question-model/`
**Branch**: `spec/034-mcq-question-model`
**Prerequisites**: plan.md ✅, spec.md ✅, data-model.md ✅, research.md ✅

**Tests**: Included — spec defines 3 unit test files + 8 integration test files.

**Organization**: Tasks grouped by implementation layer → user story. Domain-core module (repository + service) serves ALL user stories and is foundational. Individual API handler files map 1:1 to user stories.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US7 from spec.md)
- Exact file paths included in all descriptions

---

## Phase 1: Setup

**Purpose**: Install new dependency required by the MCQ questions module

- [ ] T001 Install `sanitize-html` and `@types/sanitize-html` in `packages/domain-core/` via `pnpm add sanitize-html` and `pnpm add -D @types/sanitize-html`

---

## Phase 2: Foundational — Database Layer

**Purpose**: Create tenant migration and Drizzle ORM schema definitions for all 5 tables

**⚠️ CRITICAL**: No domain logic or API work can begin until schemas exist

- [ ] T002 Create tenant migration with 5 tables, 7 indexes, 6 FKs, 2 CHECK constraints, and schema_version bump in `apps/api/src/db/tenant/migrations/20260330_012_mcq_questions.ts`
- [ ] T003 [P] Create Drizzle schema for `mcq_questions` table (17 columns, 2 checks, 6 indexes) in `apps/api/src/db/tenant/schemas/mcq-questions.schema.ts`
- [ ] T004 [P] Create Drizzle schema for `mcq_question_options` table (6 columns, UNIQUE constraint, 1 index) in `apps/api/src/db/tenant/schemas/mcq-question-options.schema.ts`
- [ ] T005 [P] Create Drizzle schema for `mcq_question_categories` join table in `apps/api/src/db/tenant/schemas/mcq-question-categories.schema.ts`
- [ ] T006 [P] Create Drizzle schema for `mcq_question_tags` join table in `apps/api/src/db/tenant/schemas/mcq-question-tags.schema.ts`
- [ ] T007 [P] Create Drizzle schema for `mcq_question_baskets` join table in `apps/api/src/db/tenant/schemas/mcq-question-baskets.schema.ts`
- [ ] T008 Add 5 new schema re-exports (mcqQuestions, mcqQuestionOptions, mcqQuestionCategories, mcqQuestionTags, mcqQuestionBaskets) to `apps/api/src/db/tenant/schemas/index.ts`

**Checkpoint**: All 5 tenant tables defined in migration + Drizzle schemas ready

---

## Phase 3: Foundational — Domain Core Module

**Purpose**: Build the complete `mcq-questions` domain module in `packages/domain-core/` — types, errors, validators, sanitizer, dependency registry, repository, service, and barrel export

**⚠️ CRITICAL**: Repository and service files contain ALL business logic for ALL user stories. This phase MUST complete before any API handler work begins.

- [ ] T009 Create domain types with QuestionType, QuestionStatus, DbClient, AuditContext, row types, and all input/output DTOs in `packages/domain-core/src/mcq-questions/mcq-questions.types.ts`
- [ ] T010 [P] Create error class with 20 error codes (QUESTION_NOT_FOUND through QUESTION_REFERENCED_IN_ACTIVE_ATTEMPT) and HTTP status mapping in `packages/domain-core/src/mcq-questions/mcq-questions.errors.ts`
- [ ] T011 [P] Create `validateOptionsForType()` pure function with rules for SINGLE, MULTIPLE, TRUE_FALSE, ARRANGEMENT types including orderIndex uniqueness and content non-empty checks in `packages/domain-core/src/mcq-questions/mcq-questions.validators.ts`
- [ ] T012 [P] Create `sanitizeRichText()` utility with sanitize-html whitelist config (allowedTags, allowedAttributes, allowedSchemes per R-001) in `packages/domain-core/src/mcq-questions/mcq-questions.sanitize.ts`
- [ ] T013 [P] Create pluggable deletion guard with `registerQuestionReferenceChecker()` and `checkQuestionReferences()` functions in `packages/domain-core/src/mcq-questions/mcq-questions.dependency-registry.ts`
- [ ] T014 Create repository with raw SQL data access for all operations (createQuestion, getQuestion, listQuestions, updateQuestion, deleteQuestion, link/unlink category/tag/basket) in `packages/domain-core/src/mcq-questions/mcq-questions.repository.ts`
- [ ] T015 Create service layer with business logic, transaction orchestration, sanitization, validation, academic boundary enforcement, and concurrency control for all 11 operations in `packages/domain-core/src/mcq-questions/mcq-questions.service.ts`
- [ ] T016 Create barrel export re-exporting all public types, errors, service functions, validators, sanitizer, and dependency registry in `packages/domain-core/src/mcq-questions/index.ts`
- [ ] T017 Register mcq-questions module export in `packages/domain-core/src/index.ts`

**Checkpoint**: Complete domain module ready — all business logic, validation, and data access encapsulated

---

## Phase 4: Foundational — Validation Schemas & Route Infrastructure

**Purpose**: Create Zod validation schemas and shared route helpers that all API handlers depend on

- [ ] T018 [P] Create 11 Zod validation schemas (questionIdParam, createQuestionBody, updateQuestionBody, listQuestionsQuery, transitionQuestionBody, linkCategory/Tag/Basket body, questionCategory/Tag/Basket param) in `packages/validation/src/backoffice/mcq-questions.schemas.ts`
- [ ] T019 [P] Add mcq-questions schema exports to validation package barrel in `packages/validation/src/backoffice/index.ts`
- [ ] T020 [P] Create shared route helpers (getDb, buildAuditCtx, successResponse, errorResponse) in `apps/api/src/routes/backoffice/mcq-questions/helpers.ts`

**Checkpoint**: Validation and route infrastructure ready — handler implementation can begin

---

## Phase 5: User Story 1 + 2 — Create & Retrieve Questions (Priority: P1) 🎯 MVP

**Goal**: Content authors can create MCQ questions of all 4 types (SINGLE, MULTIPLE, TRUE_FALSE, ARRANGEMENT) with type-specific option validation, academic boundary enforcement, and rich text sanitization. Retrieved with full detail including options and classifications.

**Independent Test**: POST a valid create request with `questionType = SINGLE`, valid `subjectId`, content, and 4 options (1 correct). Verify 201 response with `status = DRAFT`. GET the created question and verify all fields + options returned.

- [ ] T021 [P] [US1] Create POST handler with Zod validation, sanitization, academic boundary checks, and type-specific option validation in `apps/api/src/routes/backoffice/mcq-questions/create-question.ts`
- [ ] T022 [P] [US1] Create GET detail handler returning question with options, categories, tags, and baskets in `apps/api/src/routes/backoffice/mcq-questions/get-question.ts`

**Checkpoint**: Questions of all 4 types can be created and retrieved individually

---

## Phase 6: User Story 3 — Update Question & Options (Priority: P2)

**Goal**: Content authors can edit question metadata and replace the full option set atomically, with optimistic concurrency control, type immutability enforcement, and re-validation of academic boundaries and option rules.

**Independent Test**: Create a SINGLE question, PATCH with new content + 3 new options (1 correct) + correct `updatedAt`. Verify old options replaced. Then PATCH with stale `updatedAt` and verify 409.

- [ ] T023 [US3] Create PATCH handler with optimistic concurrency (updatedAt comparison), full option replacement in single transaction, type immutability guard, and re-validation in `apps/api/src/routes/backoffice/mcq-questions/update-question.ts`

**Checkpoint**: Question editing with concurrency control works end-to-end

---

## Phase 7: User Story 4 — Workflow Transitions (Priority: P2)

**Goal**: Reviewers can progress questions through the lifecycle (DRAFT → COMPLETED → UNDER_REVIEW → APPROVED → ENABLED) with ENABLED transition guard validating type-specific option rules.

**Independent Test**: Create a question with valid options, submit sequential transitions through DRAFT → ENABLED. Verify ENABLED rejects questions with invalid options (422).

- [ ] T024 [US4] Create POST transition handler delegating to shared workflow engine with ENABLED transition guard validating option configuration in `apps/api/src/routes/backoffice/mcq-questions/transition-question.ts`

**Checkpoint**: Full question lifecycle from DRAFT to ENABLED works with guard enforcement

---

## Phase 8: User Story 5 — Classification Links (Priority: P3)

**Goal**: Content managers can link/unlink questions to category values, tags, and baskets with UNIQUE constraint enforcement, existence checks, and basket max_questions limit.

**Independent Test**: Create a question, link a category value + tag + basket. Verify all links appear in question detail. Attempt duplicate link → 409. Unlink → verify removal.

- [ ] T025 [P] [US5] Create POST handler for category linking with existence check and UNIQUE constraint catch in `apps/api/src/routes/backoffice/mcq-questions/link-category.ts`
- [ ] T026 [P] [US5] Create DELETE handler for category unlinking with existence check in `apps/api/src/routes/backoffice/mcq-questions/unlink-category.ts`
- [ ] T027 [P] [US5] Create POST handler for tag linking with existence check and UNIQUE constraint catch in `apps/api/src/routes/backoffice/mcq-questions/link-tag.ts`
- [ ] T028 [P] [US5] Create DELETE handler for tag unlinking with existence check in `apps/api/src/routes/backoffice/mcq-questions/unlink-tag.ts`
- [ ] T029 [P] [US5] Create POST handler for basket linking with max_questions count check and UNIQUE constraint catch in `apps/api/src/routes/backoffice/mcq-questions/link-basket.ts`
- [ ] T030 [P] [US5] Create DELETE handler for basket unlinking with existence check in `apps/api/src/routes/backoffice/mcq-questions/unlink-basket.ts`

**Checkpoint**: All classification link/unlink operations work with idempotent error handling

---

## Phase 9: User Story 6 — List & Filter Questions (Priority: P3)

**Goal**: Content managers can browse the question pool using multi-dimensional filters (subject, division, lesson, type, status, categoryValueId, tagId, basketId, isRevisionOnly, isExamOnly, search) with pagination and EXISTS subqueries for classification filters.

**Independent Test**: Create questions with different subjects and types, link classifications. Verify each filter narrows results correctly. Verify pagination returns correct total count.

- [ ] T031 [US6] Create GET list handler with all 12 query filters, EXISTS subqueries for classification filters, pagination, and `WHERE deleted_at IS NULL` in `apps/api/src/routes/backoffice/mcq-questions/list-questions.ts`

**Checkpoint**: Full question listing with all filter dimensions and pagination works

---

## Phase 10: User Story 7 — Delete Question (Priority: P3)

**Goal**: Content managers can delete questions with status-aware strategy — hard delete for DRAFT with no references, soft delete for all other cases, and 409 block for questions in active attempts.

**Independent Test**: Create a DRAFT question → DELETE → verify hard delete. Create an ENABLED question → DELETE → verify soft delete. Mock active attempt reference → verify 409.

- [ ] T032 [US7] Create DELETE handler with dependency registry guard, hard delete for DRAFT (cascade), soft delete (set deleted_at) for others, and active attempt block in `apps/api/src/routes/backoffice/mcq-questions/delete-question.ts`

**Checkpoint**: Deletion works with correct guard logic and status-aware strategy

---

## Phase 11: Route Wiring

**Purpose**: Wire all handlers into the router and register in the backoffice app

- [ ] T033 Create router factory with read/write/transition permission guards and all 14 route registrations in `apps/api/src/routes/backoffice/mcq-questions/index.ts`
- [ ] T034 Register `mcqQuestionsRouter` in the backoffice app workspace route group (`apps/api/src/routes/backoffice/index.ts`)

**Checkpoint**: All 14 API endpoints accessible through the backoffice workspace routes

---

## Phase 12: Unit Tests

**Purpose**: Test pure domain logic in isolation — validators, sanitizer, dependency registry

- [ ] T035 [P] Create unit tests for `validateOptionsForType()` covering all 4 question types × valid/invalid configurations (min 12 test cases) in `packages/domain-core/src/mcq-questions/__tests__/validators.test.ts`
- [ ] T036 [P] Create unit tests for `sanitizeRichText()` covering XSS vector stripping, allowed tag preservation, RTL dir attribute, and edge cases in `packages/domain-core/src/mcq-questions/__tests__/sanitize.test.ts`
- [ ] T037 [P] Create unit tests for dependency registry covering checker registration, result aggregation, active attempt priority, and empty registry default in `packages/domain-core/src/mcq-questions/__tests__/dependency-registry.test.ts`

**Checkpoint**: All pure domain functions have comprehensive unit test coverage

---

## Phase 13: Integration Tests

**Purpose**: End-to-end API testing covering all user stories, tenant isolation, and concurrency

- [ ] T038 [P] Create integration tests for question creation: all 4 types, option validation, academic boundary enforcement, sanitization, error cases in `tests/integration/mcq-questions/create-question.test.ts`
- [ ] T039 [P] Create integration tests for question update: metadata + option replacement, optimistic concurrency, type immutability, transaction rollback in `tests/integration/mcq-questions/update-question.test.ts`
- [ ] T040 [P] Create integration tests for question deletion: hard delete (DRAFT), soft delete (other status), deletion guard, cascade verification in `tests/integration/mcq-questions/delete-question.test.ts`
- [ ] T041 [P] Create integration tests for workflow transitions: full lifecycle DRAFT→ENABLED, ENABLED guard, invalid transitions, permission checks in `tests/integration/mcq-questions/workflow-transition.test.ts`
- [ ] T042 [P] Create integration tests for classification links: category/tag/basket link + unlink, duplicate handling (409), max_questions enforcement in `tests/integration/mcq-questions/classification-links.test.ts`
- [ ] T043 [P] Create integration tests for question listing: all 12 filters, EXISTS subqueries, pagination, soft-deleted exclusion in `tests/integration/mcq-questions/list-questions.test.ts`
- [ ] T044 [P] Create tenant isolation tests verifying zero cross-tenant data access across all question operations in `tests/integration/mcq-questions/isolation.test.ts`
- [ ] T045 [P] Create concurrency tests: concurrent PATCH → one succeeds + one 409, concurrent classification links → UNIQUE constraint handling in `tests/integration/mcq-questions/concurrency.test.ts`

**Checkpoint**: Full integration test coverage across all user stories and cross-cutting concerns

---

## Phase 14: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, migration verification, and governance checks

- [ ] T046 Validate migration idempotency by running migration twice and confirming no errors (IF NOT EXISTS)
- [ ] T047 Run full validation pipeline: `bun run lint && bun run typecheck && bun run test`
- [ ] T048 Verify structured logging uses `@zidney/logger` with correct correlation fields (correlation_id, workspace_slug, workspace_id, question_id) — no console.log

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) ─────────────────────────────────────────────────────→ Start immediately
Phase 2 (Database) ──────────────────────────────────────────────────→ After Phase 1
Phase 3 (Domain Core) ──────────────────────────────────────────────→ After Phase 2 (needs schemas)
Phase 4 (Validation + Route Infra) ─────────────────────────────────→ After Phase 3 (needs types)
Phase 5–10 (User Story handlers) ───────────────────────────────────→ After Phase 4
Phase 11 (Route Wiring) ────────────────────────────────────────────→ After Phase 5–10 (all handlers)
Phase 12 (Unit Tests) ──────────────────────────────────────────────→ After Phase 3 (domain module)
Phase 13 (Integration Tests) ───────────────────────────────────────→ After Phase 11 (all wired up)
Phase 14 (Polish) ──────────────────────────────────────────────────→ After Phase 13
```

### User Story Dependencies

| Story        | Phase | Can Start After | Depends On Other Stories?                   |
| ------------ | ----- | --------------- | ------------------------------------------- |
| US1+US2 (P1) | 5     | Phase 4         | No — foundational                           |
| US3 (P2)     | 6     | Phase 4         | No — independent of US1 at handler level    |
| US4 (P2)     | 7     | Phase 4         | No — uses shared workflow engine            |
| US5 (P3)     | 8     | Phase 4         | No — link/unlink are standalone operations  |
| US6 (P3)     | 9     | Phase 4         | No — read-only list endpoint                |
| US7 (P3)     | 10    | Phase 4         | No — delete is standalone with dep registry |

All user stories share the same foundational domain module (Phase 3) — that is why it MUST complete first. After Phase 4, all user story handler phases (5–10) can proceed **in parallel**.

### Within Each Phase

- Tasks marked [P] can run in parallel within the same phase
- Unmarked tasks run sequentially in listed order
- Domain core: T009 (types) first → T010–T013 parallel → T014 (repository) → T015 (service) → T016–T017 (barrel + registration)

### Parallel Opportunities

After Phase 4 completes, **maximum parallelism** is available:

```
                    ┌─ Phase 5: US1+US2 (T021, T022)
                    ├─ Phase 6: US3 (T023)
Phase 4 complete ───├─ Phase 7: US4 (T024)
                    ├─ Phase 8: US5 (T025–T030)
                    ├─ Phase 9: US6 (T031)
                    ├─ Phase 10: US7 (T032)
                    └─ Phase 12: Unit Tests (T035–T037)
```

---

## Implementation Strategy

### MVP Scope (Recommended)

**Phases 1–5**: Setup + Database + Domain Core + Validation + Create/Get endpoints

- Delivers: Content authors can create and retrieve all 4 question types
- Validates: Migration, schema, domain logic, sanitization, type-specific validation, academic boundaries
- Total tasks: T001–T022 (22 tasks)

### Incremental Delivery

1. **MVP** (Phases 1–5): Create + Get → validates the entire stack vertically
2. **+Update** (Phase 6): PATCH with concurrency control
3. **+Workflow** (Phase 7): Full lifecycle management
4. **+Classification** (Phase 8): Category/tag/basket linking
5. **+List/Delete** (Phases 9–10): Complete CRUD
6. **+Wiring** (Phase 11): All endpoints accessible
7. **+Tests** (Phases 12–13): Full coverage
8. **+Polish** (Phase 14): Final validation

---

## Summary

| Metric                           | Count                                |
| -------------------------------- | ------------------------------------ |
| **Total tasks**                  | 48                                   |
| **Phase 1 (Setup)**              | 1                                    |
| **Phase 2 (Database)**           | 7                                    |
| **Phase 3 (Domain Core)**        | 9                                    |
| **Phase 4 (Validation/Infra)**   | 3                                    |
| **Phase 5 — US1+US2 (P1)**       | 2                                    |
| **Phase 6 — US3 (P2)**           | 1                                    |
| **Phase 7 — US4 (P2)**           | 1                                    |
| **Phase 8 — US5 (P3)**           | 6                                    |
| **Phase 9 — US6 (P3)**           | 1                                    |
| **Phase 10 — US7 (P3)**          | 1                                    |
| **Phase 11 (Route Wiring)**      | 2                                    |
| **Phase 12 (Unit Tests)**        | 3                                    |
| **Phase 13 (Integration Tests)** | 8                                    |
| **Phase 14 (Polish)**            | 3                                    |
| **Parallel-safe tasks [P]**      | 28                                   |
| **New files**                    | 40                                   |
| **Modified files**               | 4                                    |
| **New dependency**               | sanitize-html + @types/sanitize-html |
