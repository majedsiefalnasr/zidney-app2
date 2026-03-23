# Task List: MCQ Baskets (Stage 033)

**Stage**: `STAGE_33_MCQ_BASKETS`
**Phase**: `03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION`
**Branch**: `spec/033-mcq-baskets`
**Generated**: 2026-03-23
**Total Tasks**: 35

---

## Phase 1 — Foundation (Infrastructure)

> DB migration, Drizzle schemas, workflow engine extension, boot registry.
> No user story labels — foundational tasks.

- [x] T001 Add `DRAFT` to `WorkflowState` enum, prepend to `WORKFLOW_STATE_ORDER`, add `DRAFT→COMPLETED` forward edge to `WORKFLOW_TRANSITIONS`, and add `'mcq_basket'` to `WORKFLOW_ENTITY_TYPES` in `packages/domain-core/src/workflow/workflow.states.ts`
- [x] T002 Add `mcq_basket: 'mcq_baskets'` to `ENTITY_TABLE_MAP` in `packages/domain-core/src/workflow/workflow.engine.ts`
- [x] T003 Create tenant DB migration `apps/api/src/db/tenant/migrations/20260323_011_mcq_baskets.ts` — Phase 1 (transactional: CREATE mcq_baskets, CREATE mcq_basket_questions, FK constraints, B-tree indexes, schema version bump 1.16.0→1.17.0) + Phase 2 (CONCURRENT unique indexes)
- [x] T004 Create Drizzle schema `apps/api/src/db/tenant/schemas/baskets.schema.ts` — maps `mcq_baskets` table with all columns (id, name, code, type, max_questions, description, status, timestamps, FK users)
- [x] T005 Create Drizzle schema `apps/api/src/db/tenant/schemas/basket-questions.schema.ts` — maps `mcq_basket_questions` join table (id, basket_id, question_id, created_at)
- [x] T006 Export new schemas from `apps/api/src/db/tenant/schemas/index.ts` — add `export * from './baskets.schema'` and `export * from './basket-questions.schema'`
- [x] T007 Register migration `20260323_011_mcq_baskets` (version 1.17.0) in `apps/api/src/boot/migration-registry.ts` following the existing tenant migration registration pattern

---

## Phase 2 — Domain Package

> Pure domain logic in `packages/domain-core/src/baskets/`.
> No user story labels — foundational domain layer.

- [x] T008 Create `packages/domain-core/src/baskets/baskets.types.ts` — domain types: `BasketType`, `BasketStatus`, `BasketRow`, `BasketWithCount`, `BasketQuestionRow`, `CreateBasketInput`, `UpdateBasketInput`, `ListBasketsInput`, `ListBasketsResult`, `ListBasketQuestionsInput`, `ListBasketQuestionsResult`, `BasketAuditCtx`
- [x] T009 Create `packages/domain-core/src/baskets/baskets.errors.ts` — `BasketError` class with error codes (`BASKET_NOT_FOUND`, `BASKET_CODE_DUPLICATE`, `BASKET_QUESTION_ALREADY_LINKED`, `BASKET_QUESTION_NOT_FOUND`, `BASKET_MAX_QUESTIONS_REACHED`, `BASKET_EMPTY_CANNOT_ENABLE`, `BASKET_EXCEEDS_MAX_QUESTIONS`, `BASKET_REFERENCED_IN_EXAM_CONFIG`, `BASKET_REFERENCED_IN_AUTO_SELECTION`, `QUESTION_NOT_FOUND`) and HTTP status map
- [x] T010 Create `packages/domain-core/src/baskets/baskets.repository.ts` — all pure repository functions (no transactions): `findBasketById`, `findBaskets`, `countBaskets`, `insertBasket`, `updateBasketRow`, `deleteBasketRow`, `findBasketByCode`, `findBasketQuestion`, `countBasketQuestions`, `insertBasketQuestion`, `deleteBasketQuestion`, `findBasketQuestions`, `countBasketQuestionRows`, `checkQuestionExists`, `checkExamConfigReference` (with information_schema guard per AD-004), `checkAutoSelectionReference` (with information_schema guard)
- [x] T011 Create `packages/domain-core/src/baskets/baskets.service.ts` — all service methods with explicit TX boundaries: `createBasket` (TX), `getBasket`, `listBaskets` (parallel count+fetch), `updateBasket` (TX: FOR UPDATE), `deleteBasket` (TX: deletion guard), `transitionStatus` (pre-guards + executeTransition; no outer TX per AD-003 note in plan), `linkQuestion` (TX: max_questions check), `unlinkQuestion` (TX), `listBasketQuestions`
- [x] T012 Create `packages/domain-core/src/baskets/baskets.dependency-registry.ts` — module registry entry following existing domain-core package conventions
- [x] T013 Create `packages/domain-core/src/baskets/index.ts` — public barrel exports for types, errors, service, repository

---

## Phase 3 — Validation Schema

> Zod validation schemas for basket request bodies.

- [x] T014 Create `packages/validation/src/backoffice/baskets.schemas.ts` — Zod schemas: `CreateBasketBodySchema` (name, code, type, maxQuestions optional, description optional), `UpdateBasketBodySchema` (all optional except none required; type and status omitted per AD-005/006), `TransitionBasketBodySchema` ({ to: BasketStatus }), `LinkQuestionBodySchema` ({ questionId: uuid }), `ListBasketsQuerySchema` (type?, status?, search?, page, per_page), `ListBasketQuestionsQuerySchema` (page, per_page)
- [x] T015 Export basket schemas from `packages/validation/src/backoffice/index.ts` — add `export * from './baskets.schemas'`

---

## Phase 4 — API Route Layer

> Hono route handlers for all basket endpoints.
> All handlers follow tenant resolver → license middleware → RBAC guard → handler chain.

- [x] T016 [US1] Create `apps/api/src/routes/backoffice/baskets/helpers.ts` — shared utilities: `getDb(c)`, `buildAuditCtx(c)`, `successResponse(data)`, `basketsErrorResponse(c, err)`, `buildBasketWorkflowPermissions(rbacPerms)` permission bridge (AD-002)
- [x] T017 [P] [US1] Create `apps/api/src/routes/backoffice/baskets/create-basket.ts` — POST handler; parse `CreateBasketBodySchema`, call `createBasket` service, return 201
- [x] T018 [P] [US2] Create `apps/api/src/routes/backoffice/baskets/list-baskets.ts` — GET handler; parse `ListBasketsQuerySchema`, call `listBaskets` service, return 200 paginated
- [x] T019 [P] [US2] Create `apps/api/src/routes/backoffice/baskets/get-basket.ts` — GET handler; extract `:basketId`, call `getBasket` service, return 200
- [x] T020 [P] [US2] Create `apps/api/src/routes/backoffice/baskets/update-basket.ts` — PATCH handler; extract `:basketId`, parse `UpdateBasketBodySchema`, call `updateBasket` service, return 200
- [x] T021 [P] [US5] Create `apps/api/src/routes/backoffice/baskets/delete-basket.ts` — DELETE handler; extract `:basketId`, call `deleteBasket` service, return 200 `{ deleted: true }`
- [x] T022 [P] [US4] Create `apps/api/src/routes/backoffice/baskets/transition-basket.ts` — POST handler; extract `:basketId`, parse `TransitionBasketBodySchema`, bridge RBAC permissions via `buildBasketWorkflowPermissions`, call `transitionStatus` service, return 200
- [x] T023 [P] [US3] Create `apps/api/src/routes/backoffice/baskets/link-question.ts` — POST handler; extract `:basketId`, parse `LinkQuestionBodySchema`, call `linkQuestion` service, return 201
- [x] T024 [P] [US3] Create `apps/api/src/routes/backoffice/baskets/unlink-question.ts` — DELETE handler; extract `:basketId` and `:questionId`, call `unlinkQuestion` service, return 200 `{ deleted: true }`
- [x] T025 [P] [US3] Create `apps/api/src/routes/backoffice/baskets/list-questions.ts` — GET handler; extract `:basketId`, parse `ListBasketQuestionsQuerySchema`, call `listBasketQuestions` service, return 200 paginated
- [x] T026 Create `apps/api/src/routes/backoffice/baskets/index.ts` — router assembly; mount all 9 route handlers with correct permission guards (`writeGuard`, `readGuard`, `transitionGuard`); export `createBasketsRouter()` and `const basketsRouter`
- [x] T027 Mount `basketsRouter` in `apps/api/src/app.ts` — add `import { basketsRouter } from './routes/backoffice/baskets'` and `app.route('/api/v1/backoffice/workspace', basketsRouter)` following the same pattern as `tagsRouter`

---

## Phase 5 — Tests

> Unit tests for domain package, integration tests for API routes.
> All test tasks within this phase can run in parallel after Phase 4 is complete.

- [x] T028 [P] [US1] Create `packages/domain-core/src/baskets/__tests__/baskets.service.test.ts` — unit tests for all service methods and all error paths (35 test cases as defined in plan.md Phase 5)
- [x] T029 [P] [US1] Create `packages/domain-core/src/baskets/__tests__/baskets.repository.test.ts` — unit tests for repository functions: row mapping correctness, query construction, null returns
- [x] T030 [P] [US1] Create `apps/api/src/routes/backoffice/baskets/__tests__/baskets.crud.test.ts` — integration tests for create/list/get/update/delete against real tenant DB (12 test cases)
- [x] T031 [P] [US4] Create `apps/api/src/routes/backoffice/baskets/__tests__/baskets.workflow.test.ts` — integration tests for full transition chain + invalid transitions + permission enforcement (9 test cases)
- [x] T032 [P] [US3] Create `apps/api/src/routes/backoffice/baskets/__tests__/baskets.questions.test.ts` — integration tests for link/unlink/list + duplicate + max cap + cascade (7 test cases)
- [x] T033 [P] [US2] Create `apps/api/src/routes/backoffice/baskets/__tests__/baskets.isolation.test.ts` — integration tests for tenant isolation: basket created in tenant A is not visible from tenant B (1 test case)
- [x] T034 [P] [US5] Create `apps/api/src/routes/backoffice/baskets/__tests__/baskets.deletion-guard.test.ts` — integration tests for deletion guard: referenced basket blocked + unreferenced basket deleted + middleware auth/permission/license tests (6 test cases)
