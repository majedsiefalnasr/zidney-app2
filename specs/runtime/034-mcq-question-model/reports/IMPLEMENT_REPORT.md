# Implement Report — STAGE_34_MCQ_QUESTION_MODEL

**Step:** 6 — Implement  
**Timestamp:** 2026-03-30T21:00:00.000Z  
**Status:** COMPLETE

---

## Summary

Full end-to-end implementation of the MCQ Question Model. All 48 tasks completed across 14 phases: database migration, Drizzle ORM schemas, domain-core module (types, errors, validators, sanitizer, repository, service, dependency registry), validation schemas, 14 API route handlers, route wiring, unit tests (3 files), integration tests (8 files), and final validation pipeline.

All tests pass: **66 integration tests**, **15 unit tests** — 0 failures. Lint clean. TypeScript typecheck exits 0.

---

## Inputs Reviewed

- `specs/runtime/034-mcq-question-model/tasks.md`
- `specs/runtime/034-mcq-question-model/plan.md`
- `specs/runtime/034-mcq-question-model/data-model.md`
- `specs/runtime/034-mcq-question-model/research.md`
- `specs/runtime/034-mcq-question-model/audits/ANALYZE_REPORT.md`

---

## Files Modified / Created

| File Path                                                                      | Change Type | Notes                                                      |
| ------------------------------------------------------------------------------ | ----------- | ---------------------------------------------------------- |
| `apps/api/src/db/tenant/migrations/20260330_012_mcq_questions.ts`              | Created     | 5 tables, 7 indexes, 6 FKs, 2 CHECK constraints            |
| `apps/api/src/db/tenant/schemas/mcq-questions.schema.ts`                       | Created     | Drizzle ORM schema — mcq_questions (17 columns)            |
| `apps/api/src/db/tenant/schemas/mcq-question-options.schema.ts`                | Created     | Drizzle ORM schema — mcq_question_options                  |
| `apps/api/src/db/tenant/schemas/mcq-question-categories.schema.ts`             | Created     | Drizzle ORM schema — mcq_question_categories               |
| `apps/api/src/db/tenant/schemas/mcq-question-tags.schema.ts`                   | Created     | Drizzle ORM schema — mcq_question_tags                     |
| `apps/api/src/db/tenant/schemas/mcq-question-baskets.schema.ts`                | Created     | Drizzle ORM schema — mcq_question_baskets                  |
| `apps/api/src/db/tenant/schemas/index.ts`                                      | Modified    | Added 5 new schema re-exports                              |
| `packages/domain-core/src/mcq-questions/mcq-questions.types.ts`                | Created     | DbClient, AuditContext, QuestionType, row types, DTOs      |
| `packages/domain-core/src/mcq-questions/mcq-questions.errors.ts`               | Created     | McqQuestionError class + 20 error codes + HTTP status map  |
| `packages/domain-core/src/mcq-questions/mcq-questions.validators.ts`           | Created     | validateOptionsForType() pure function (4 question types)  |
| `packages/domain-core/src/mcq-questions/mcq-questions.sanitize.ts`             | Created     | sanitizeRichText() with XSS whitelist config               |
| `packages/domain-core/src/mcq-questions/mcq-questions.dependency-registry.ts`  | Created     | Pluggable deletion guard with checkQuestionReferences()    |
| `packages/domain-core/src/mcq-questions/mcq-questions.repository.ts`           | Created     | Raw SQL data access for all 14+ operations                 |
| `packages/domain-core/src/mcq-questions/mcq-questions.service.ts`              | Created     | Business logic, transactions, validation — 11 operations   |
| `packages/domain-core/src/mcq-questions/index.ts`                              | Created     | Barrel export for domain module                            |
| `packages/domain-core/src/index.ts`                                            | Modified    | Added mcq-questions module re-export                       |
| `packages/validation/src/backoffice/mcq-questions.schemas.ts`                  | Created     | 11 Zod validation schemas                                  |
| `packages/validation/src/backoffice/index.ts`                                  | Modified    | Added mcq-questions schema exports                         |
| `apps/api/src/routes/backoffice/mcq-questions/helpers.ts`                      | Created     | getDb, buildAuditCtx, successResponse, errorResponse       |
| `apps/api/src/routes/backoffice/mcq-questions/create-question.ts`              | Created     | POST / handler                                             |
| `apps/api/src/routes/backoffice/mcq-questions/get-question.ts`                 | Created     | GET /:id handler                                           |
| `apps/api/src/routes/backoffice/mcq-questions/update-question.ts`              | Created     | PATCH /:id handler with optimistic concurrency             |
| `apps/api/src/routes/backoffice/mcq-questions/transition-question.ts`          | Created     | POST /:id/transition handler                               |
| `apps/api/src/routes/backoffice/mcq-questions/link-category.ts`                | Created     | POST /:id/categories handler                               |
| `apps/api/src/routes/backoffice/mcq-questions/unlink-category.ts`              | Created     | DELETE /:id/categories/:categoryValueId handler            |
| `apps/api/src/routes/backoffice/mcq-questions/link-tag.ts`                     | Created     | POST /:id/tags handler                                     |
| `apps/api/src/routes/backoffice/mcq-questions/unlink-tag.ts`                   | Created     | DELETE /:id/tags/:tagId handler                            |
| `apps/api/src/routes/backoffice/mcq-questions/link-basket.ts`                  | Created     | POST /:id/baskets handler                                  |
| `apps/api/src/routes/backoffice/mcq-questions/unlink-basket.ts`                | Created     | DELETE /:id/baskets/:basketId handler                      |
| `apps/api/src/routes/backoffice/mcq-questions/list-questions.ts`               | Created     | GET / handler with 12 filters + pagination                 |
| `apps/api/src/routes/backoffice/mcq-questions/delete-question.ts`              | Created     | DELETE /:id handler (hard/soft delete, guard)              |
| `apps/api/src/routes/backoffice/mcq-questions/index.ts`                        | Created     | Router factory with 14 route registrations                 |
| `apps/api/src/routes/backoffice/index.ts`                                      | Modified    | Registered mcqQuestionsRouter                              |
| `packages/domain-core/src/mcq-questions/__tests__/validators.test.ts`          | Created     | Unit tests for validateOptionsForType() — 15 cases         |
| `packages/domain-core/src/mcq-questions/__tests__/sanitize.test.ts`            | Created     | Unit tests for sanitizeRichText()                          |
| `packages/domain-core/src/mcq-questions/__tests__/dependency-registry.test.ts` | Created     | Unit tests for dependency registry                         |
| `tests/integration/mcq-questions/create-question.test.ts`                      | Created     | Integration tests — creation (all 4 types, errors)         |
| `tests/integration/mcq-questions/update-question.test.ts`                      | Created     | Integration tests — update, concurrency, type immutability |
| `tests/integration/mcq-questions/delete-question.test.ts`                      | Created     | Integration tests — deletion guard, hard/soft delete       |
| `tests/integration/mcq-questions/workflow-transition.test.ts`                  | Created     | Integration tests — full lifecycle DRAFT→ENABLED           |
| `tests/integration/mcq-questions/classification-links.test.ts`                 | Created     | Integration tests — category/tag/basket link/unlink        |
| `tests/integration/mcq-questions/list-questions.test.ts`                       | Created     | Integration tests — 12 filters, pagination                 |
| `tests/integration/mcq-questions/isolation.test.ts`                            | Created     | Tenant isolation tests                                     |
| `tests/integration/mcq-questions/concurrency.test.ts`                          | Created     | Concurrent PATCH + classification link tests               |

---

## Tasks Completion

| Task Range | Description                                                                                     | Layer                     | Status |
| ---------- | ----------------------------------------------------------------------------------------------- | ------------------------- | ------ |
| T001       | Install sanitize-html dependencies                                                              | Setup                     | ✅     |
| T002–T008  | Migration + 5 Drizzle ORM schemas + index export                                                | DB                        | ✅     |
| T009–T017  | Full domain-core module (types, errors, validators, sanitizer, registry, repo, service, barrel) | Domain                    | ✅     |
| T018–T020  | Zod validation schemas + route helpers                                                          | Validation/Infrastructure | ✅     |
| T021–T022  | Create + Get question handlers                                                                  | API (US1+US2)             | ✅     |
| T023       | Update question handler with optimistic concurrency                                             | API (US3)                 | ✅     |
| T024       | Workflow transition handler                                                                     | API (US4)                 | ✅     |
| T025–T030  | Classification link/unlink handlers (category, tag, basket)                                     | API (US5)                 | ✅     |
| T031       | List questions handler with 12 filters                                                          | API (US6)                 | ✅     |
| T032       | Delete question handler (hard/soft delete, guard)                                               | API (US7)                 | ✅     |
| T033–T034  | Router factory + backoffice registration                                                        | Wiring                    | ✅     |
| T035–T037  | Unit tests (validators, sanitizer, dependency registry)                                         | Tests                     | ✅     |
| T038–T045  | Integration tests (8 test files)                                                                | Tests                     | ✅     |
| T046       | Migration idempotency validation                                                                | Validation                | ✅     |
| T047       | Full validation pipeline (lint + typecheck + tests)                                             | Validation                | ✅     |

**Completed:** 48 / 48

---

## Tests Added or Updated

| Test File                                                                      | Type        | Scope                                                                                    |
| ------------------------------------------------------------------------------ | ----------- | ---------------------------------------------------------------------------------------- |
| `packages/domain-core/src/mcq-questions/__tests__/validators.test.ts`          | Unit        | validateOptionsForType() — all 4 question types                                          |
| `packages/domain-core/src/mcq-questions/__tests__/sanitize.test.ts`            | Unit        | sanitizeRichText() — XSS, allowed tags, edge cases                                       |
| `packages/domain-core/src/mcq-questions/__tests__/dependency-registry.test.ts` | Unit        | checkQuestionReferences() — registration, aggregation                                    |
| `tests/integration/mcq-questions/create-question.test.ts`                      | Integration | POST / — 4 question types, validation, academic boundaries, XSS sanitization             |
| `tests/integration/mcq-questions/update-question.test.ts`                      | Integration | PATCH /:id — metadata update, option replacement, concurrency (409), type immutability   |
| `tests/integration/mcq-questions/delete-question.test.ts`                      | Integration | DELETE /:id — hard delete DRAFT, soft delete others, guard (409)                         |
| `tests/integration/mcq-questions/workflow-transition.test.ts`                  | Integration | POST /:id/transition — full DRAFT→ENABLED lifecycle, ENABLED guard                       |
| `tests/integration/mcq-questions/classification-links.test.ts`                 | Integration | Link/unlink category/tag/basket — transaction verification, duplicate 409, max_questions |
| `tests/integration/mcq-questions/list-questions.test.ts`                       | Integration | GET / — all 12 filters, pagination, soft-deleted exclusion                               |
| `tests/integration/mcq-questions/isolation.test.ts`                            | Integration | Zero cross-tenant data access across all operations                                      |
| `tests/integration/mcq-questions/concurrency.test.ts`                          | Integration | Concurrent PATCH (one 409), concurrent basket links (UNIQUE constraint)                  |

**Result:** 66 integration tests ✅ | 15 unit tests ✅ | 0 failures

---

## Validation Summary

See full evidence in `audits/VALIDATION_REPORT.md`.

| Check                              | Result                                  |
| ---------------------------------- | --------------------------------------- |
| `bun run lint` (Biome check)       | ✅ PASS — 0 errors                      |
| `bun run typecheck` (tsc --noEmit) | ✅ PASS — exit 0                        |
| Integration tests (66 tests)       | ✅ PASS — 0 failures                    |
| Unit tests (15 tests)              | ✅ PASS — 0 failures                    |
| Migration idempotency              | ✅ PASS — IF NOT EXISTS guards verified |

---

## Constitutional Compliance

| Check                                             | Status | Notes                                                                    |
| ------------------------------------------------- | ------ | ------------------------------------------------------------------------ |
| Tenant resolver context used for tenant DB access | ✅     | `c.get('tenant').pool` via `getDb(c)` in all handlers                    |
| All write operations are transactional            | ✅     | `linkBasket` uses BEGIN/COMMIT with `getTransactionClient` + `release()` |
| Idempotency is enforced where required            | ✅     | UNIQUE constraints + explicit 409 on duplicates                          |
| Structured logging is present                     | ✅     | logger.info/warn with correlation_id and workspace_id in all service ops |
| `console.log` is absent                           | ✅     | No console.log in any production file                                    |
| No stack traces exposed to clients                | ✅     | Only error code + message in API responses                               |
| UI layer has no business logic                    | ✅     | N/A — API-only stage                                                     |
| API error contract is preserved                   | ✅     | `{ success, data, error: { code, message } }` on all responses           |
| Database-per-tenant isolation                     | ✅     | All queries routed through tenant-scoped pool                            |
| License middleware mandatory                      | ✅     | Enforced at backoffice router level                                      |
| No direct Pool instantiation in domain            | ✅     | DbClient injected — no `new Pool()` in domain-core                       |

**Overall:** COMPLIANT

---

## Open Risks

None. All tasks completed. Zero test failures. No deferred items.

---

## Next Step

Proceed to Step 7 — Closure.
