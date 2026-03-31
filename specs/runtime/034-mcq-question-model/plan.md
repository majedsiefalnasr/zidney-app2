# Implementation Plan — STAGE_34_MCQ_QUESTION_MODEL

**Stage**: STAGE_34_MCQ_QUESTION_MODEL  
**Branch**: `spec/034-mcq-question-model`  
**Date**: 2026-03-30  
**Feature Spec**: `specs/runtime/034-mcq-question-model/spec.md`

---

## Stage Alignment

- **Phase**: `03_BACKOFFICE_CORE / 04_EXAM_ENGINE_CORE`
- **Stage**: `STAGE_34_MCQ_QUESTION_MODEL`
- **Related Spec File**: `specs/runtime/034-mcq-question-model/spec.md`
- **Related ADR**: None (no architectural exceptions detected)
- **Research**: `specs/runtime/034-mcq-question-model/research.md`
- **Data Model**: `specs/runtime/034-mcq-question-model/data-model.md`

---

## Architectural Scope Confirmation

- ✅ No cross-tenant data access — all 5 tables reside exclusively in tenant DB
- ✅ No middleware bypass — tenant resolver → license middleware mandatory on all routes
- ✅ No direct DB instantiation — all DB access via `c.get('tenant').pool`
- ✅ No grading logic outside Worker — feature does not touch attempt/grading logic
- ✅ No weakening of snapshot integrity — question data is snapshot-captured at attempt start
- ✅ No weakening of version enforcement — migration bumps schema_version; version check at request boundary
- ✅ No layer boundary violation — domain logic in `packages/domain-core`, routes in `apps/api`, validation in `packages/validation`

No exceptions requiring an ADR were detected.

---

## Constitution Check

| Rule                              | Status | Detail                                                                |
| --------------------------------- | ------ | --------------------------------------------------------------------- |
| Database-per-tenant isolation     | ✅     | All 5 tables in tenant DB only; zero master DB access                 |
| Middleware authority              | ✅     | Tenant resolver + license middleware on all routes                    |
| Authoritative license enforcement | ✅     | License status checked before handler; ACTIVE only                    |
| Snapshot-based attempt integrity  | ✅     | Not applicable — question model is content, not runtime               |
| Versioned evolution               | ✅     | Migration bumps schema_version; version compatibility enforced        |
| Runtime authoritative time        | ✅     | All timestamps server-set via `NOW()`                                 |
| Deterministic worker execution    | N/A    | No worker involvement in this stage                                   |
| Concurrency guarantees            | ✅     | Optimistic concurrency via `updated_at`; UNIQUE constraints on joins  |
| Strict separation of layers       | ✅     | Domain in domain-core, routes in API, validation in packages          |
| Security baseline                 | ✅     | RBAC server-side, structured logging, rate limiting, input validation |
| Operational integrity             | ✅     | All mutations in transactions; classification links idempotent        |

---

## Technical Context

| Concern                | Resolution                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| Rich text sanitization | `sanitize-html` with whitelist config (Research R-001)                                        |
| Concurrency control    | `updated_at` comparison in UPDATE WHERE clause (Research R-002)                               |
| Transaction pattern    | Raw SQL `BEGIN/COMMIT/ROLLBACK` via `db.connect()` (Research R-003)                           |
| Deletion guard         | Dependency registry pattern; future stages register reference checks (Research R-004)         |
| Academic boundary      | Targeted SELECT queries within create/update transaction (Research R-005)                     |
| Soft delete            | `deleted_at` TIMESTAMPTZ column; list queries add `WHERE deleted_at IS NULL` (Research R-006) |
| Classification filters | EXISTS subqueries with indexed join tables (Research R-007)                                   |
| Basket max_questions   | COUNT check within link transaction (Research R-008)                                          |
| Migration numbering    | `20260330_012_mcq_questions.ts` (Research R-009)                                              |
| Workflow integration   | `mcq_question` already registered in ENTITY_TABLE_MAP (Research R-010)                        |
| ENABLED guard          | Pre-transition validator for option rules (Research R-011)                                    |

---

## Implementation Layers

### Layer 1: Database Migration

**File**: `apps/api/src/db/tenant/migrations/20260330_012_mcq_questions.ts`

**Scope**: Create 5 tables with all constraints, indexes, and FK relationships. Bump schema_version.

**Transaction**: Single `BEGIN` → all DDL → `UPDATE schema_versions` → `COMMIT`

**Tables created (in order)**:

1. `mcq_questions` — 18 columns, 2 CHECK constraints, 6 indexes, 5 FK constraints
2. `mcq_question_options` — 6 columns, 1 UNIQUE constraint, 1 index, 1 FK
3. `mcq_question_categories` — 3 columns, 1 UNIQUE constraint, 2 indexes, 2 FKs
4. `mcq_question_tags` — 3 columns, 1 UNIQUE constraint, 2 indexes, 2 FKs
5. `mcq_question_baskets` — 3 columns, 1 UNIQUE constraint, 2 indexes, 2 FKs

All DDL uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` for idempotency.

### Layer 2: Drizzle ORM Schemas

**Files** (all in `apps/api/src/db/tenant/schemas/`):

- `mcq-questions.schema.ts` — pgTable definition + type exports
- `mcq-question-options.schema.ts` — pgTable definition + type exports
- `mcq-question-categories.schema.ts` — pgTable definition + type exports
- `mcq-question-tags.schema.ts` — pgTable definition + type exports
- `mcq-question-baskets.schema.ts` — pgTable definition + type exports
- `index.ts` — add 5 new re-exports

See `data-model.md` for complete schema definitions.

### Layer 3: Domain Core — MCQ Questions Module

**Location**: `packages/domain-core/src/mcq-questions/`

**Files**:

| File                                   | Purpose                                                 |
| -------------------------------------- | ------------------------------------------------------- |
| `index.ts`                             | Public barrel export                                    |
| `mcq-questions.types.ts`               | Domain types: DbClient, AuditContext, row types, DTOs   |
| `mcq-questions.errors.ts`              | Error class + error code registry + HTTP status mapping |
| `mcq-questions.repository.ts`          | Raw SQL data access: queries, inserts, updates, deletes |
| `mcq-questions.service.ts`             | Business logic: validation, transactions, orchestration |
| `mcq-questions.validators.ts`          | Type-specific option validation rules                   |
| `mcq-questions.sanitize.ts`            | Rich text sanitization utility                          |
| `mcq-questions.dependency-registry.ts` | Pluggable deletion guard reference checks               |

**Pattern**: Follows the baskets module convention exactly
(`baskets.types.ts`, `baskets.errors.ts`, `baskets.repository.ts`, `baskets.service.ts`).

#### `mcq-questions.types.ts`

```ts
// Domain types
export type QuestionType = 'SINGLE' | 'MULTIPLE' | 'TRUE_FALSE' | 'ARRANGEMENT'
export type QuestionStatus = 'DRAFT' | 'COMPLETED' | 'UNDER_REVIEW' | 'APPROVED' | 'ENABLED'

export interface DbClient { ... }      // Same as baskets pattern
export interface AuditContext { ... }   // Same as baskets pattern

export interface QuestionRow { ... }
export interface QuestionOptionRow { ... }
export interface QuestionWithOptions extends QuestionRow { options: QuestionOptionRow[] }
export interface QuestionDetail extends QuestionWithOptions {
  categories: { id: string; categoryValueId: string }[]
  tags: { id: string; tagId: string }[]
  baskets: { id: string; basketId: string }[]
}

export interface CreateQuestionInput { ... }
export interface UpdateQuestionInput { ... }
export interface ListQuestionsInput { ... }
export interface ListQuestionsResult { items: QuestionRow[]; total: number; page: number; perPage: number }

export interface CreateOptionInput { content: string; isCorrect: boolean; orderIndex: number }
```

#### `mcq-questions.errors.ts`

Error codes:

- `QUESTION_NOT_FOUND` → 404
- `SUBJECT_NOT_FOUND` → 404
- `CATEGORY_VALUE_NOT_FOUND` → 404
- `TAG_NOT_FOUND` → 404
- `BASKET_NOT_FOUND` → 404
- `QUESTION_CATEGORY_NOT_FOUND` → 404
- `QUESTION_TAG_NOT_FOUND` → 404
- `QUESTION_BASKET_NOT_FOUND` → 404
- `VALIDATION_ERROR` → 422
- `INVALID_OPTION_CONFIGURATION` → 422
- `QUESTION_TYPE_IMMUTABLE` → 422
- `LESSON_SUBJECT_MISMATCH` → 422
- `DIVISION_SCOPE_VIOLATION` → 422
- `QUESTION_HAS_NO_OPTIONS` → 422
- `BASKET_MAX_QUESTIONS_REACHED` → 422
- `CONCURRENT_UPDATE_CONFLICT` → 409
- `QUESTION_CATEGORY_ALREADY_LINKED` → 409
- `QUESTION_TAG_ALREADY_LINKED` → 409
- `QUESTION_BASKET_ALREADY_LINKED` → 409
- `QUESTION_REFERENCED_IN_ACTIVE_ATTEMPT` → 409

#### `mcq-questions.validators.ts`

Pure functions for type-specific option validation:

```ts
export function validateOptionsForType(
  type: QuestionType,
  options: CreateOptionInput[],
): { valid: boolean; error?: string };
```

Rules:

- `SINGLE`: options.length >= 2 AND exactly 1 with `isCorrect === true`
- `MULTIPLE`: options.length >= 2 AND at least 1 with `isCorrect === true`
- `TRUE_FALSE`: options.length === 2 AND exactly 1 with `isCorrect === true`
- `ARRANGEMENT`: options.length >= 2 (isCorrect ignored; orderIndex defines correctness)

Additional validations:

- All `orderIndex` values must be unique within the option set
- All `content` values must be non-empty after trimming

#### `mcq-questions.sanitize.ts`

```ts
import sanitizeHtml from "sanitize-html";

const SANITIZE_OPTIONS = {
  /* whitelist config from Research R-001 */
};

export function sanitizeRichText(input: string): string {
  return sanitizeHtml(input, SANITIZE_OPTIONS);
}
```

#### `mcq-questions.service.ts`

Service functions (all accept `db: DbClient, input, audit: AuditContext`):

| Function         | Transaction | Description                                                |
| ---------------- | ----------- | ---------------------------------------------------------- |
| `createQuestion` | Yes         | Sanitize → validate → INSERT question + options atomically |
| `getQuestion`    | No          | SELECT question + options + classifications                |
| `listQuestions`  | No          | Filtered, paginated list with EXISTS subqueries            |
| `updateQuestion` | Yes         | Concurrency check → sanitize → validate → replace options  |
| `deleteQuestion` | Yes         | Guard check → hard delete (DRAFT) or soft delete           |
| `linkCategory`   | No          | INSERT with UNIQUE constraint catch                        |
| `unlinkCategory` | No          | DELETE with existence check                                |
| `linkTag`        | No          | INSERT with UNIQUE constraint catch                        |
| `unlinkTag`      | No          | DELETE with existence check                                |
| `linkBasket`     | Yes         | Check max_questions → INSERT                               |
| `unlinkBasket`   | No          | DELETE with existence check                                |

#### `mcq-questions.dependency-registry.ts`

```ts
type ReferenceChecker = (
  db: DbClient,
  questionId: string,
) => Promise<{
  hasReferences: boolean;
  isActiveAttempt: boolean;
}>;

const checkers: ReferenceChecker[] = [];

export function registerQuestionReferenceChecker(checker: ReferenceChecker): void {
  checkers.push(checker);
}

export async function checkQuestionReferences(
  db: DbClient,
  questionId: string,
): Promise<{
  hasReferences: boolean;
  isActiveAttempt: boolean;
}> {
  for (const checker of checkers) {
    const result = await checker(db, questionId);
    if (result.isActiveAttempt) return { hasReferences: true, isActiveAttempt: true };
    if (result.hasReferences) return { hasReferences: true, isActiveAttempt: false };
  }
  return { hasReferences: false, isActiveAttempt: false };
}
```

### Layer 4: Validation Schemas (Zod)

**File**: `packages/validation/src/backoffice/mcq-questions.schemas.ts`

**Schemas**:

| Schema                         | Purpose                                     |
| ------------------------------ | ------------------------------------------- |
| `questionIdParamSchema`        | Path param: `{ questionId: uuid }`          |
| `createQuestionBodySchema`     | POST body with options array                |
| `updateQuestionBodySchema`     | PATCH body with optional fields + updatedAt |
| `listQuestionsQuerySchema`     | GET query params with all filters           |
| `transitionQuestionBodySchema` | Workflow transition body: `{ to: status }`  |
| `linkCategoryBodySchema`       | `{ categoryValueId: uuid }`                 |
| `linkTagBodySchema`            | `{ tagId: uuid }`                           |
| `linkBasketBodySchema`         | `{ basketId: uuid }`                        |
| `questionCategoryParamSchema`  | Path: `{ questionId, categoryValueId }`     |
| `questionTagParamSchema`       | Path: `{ questionId, tagId }`               |
| `questionBasketParamSchema`    | Path: `{ questionId, basketId }`            |

**Key Zod rules for `createQuestionBodySchema`**:

- `subjectId`: `z.string().uuid()` required
- `divisionId`: `z.string().uuid().nullable().optional()`
- `lessonId`: `z.string().uuid().nullable().optional()`
- `questionType`: `z.enum(['SINGLE', 'MULTIPLE', 'TRUE_FALSE', 'ARRANGEMENT'])`
- `language`: `z.string().min(1).max(10)`
- `content`: `z.string().min(1).max(50000)` (rich text)
- `explanation`: `z.string().max(50000).nullable().optional()`
- `isRevisionOnly`: `z.boolean().optional().default(false)`
- `isExamOnly`: `z.boolean().optional().default(false)`
- `options`: `z.array(optionSchema).min(1)` where option has `content`, `isCorrect`, `orderIndex`

### Layer 5: API Routes

**Location**: `apps/api/src/routes/backoffice/mcq-questions/`

**Files**:

| File                     | Route                                                           | Method |
| ------------------------ | --------------------------------------------------------------- | ------ |
| `index.ts`               | Router factory + route registration                             | —      |
| `helpers.ts`             | Shared: getDb, buildAuditCtx, successResponse, errorResponse    | —      |
| `create-question.ts`     | `POST /mcq-questions`                                           | POST   |
| `list-questions.ts`      | `GET /mcq-questions`                                            | GET    |
| `get-question.ts`        | `GET /mcq-questions/:questionId`                                | GET    |
| `update-question.ts`     | `PATCH /mcq-questions/:questionId`                              | PATCH  |
| `delete-question.ts`     | `DELETE /mcq-questions/:questionId`                             | DELETE |
| `transition-question.ts` | `POST /mcq-questions/:questionId/workflow/transition`           | POST   |
| `link-category.ts`       | `POST /mcq-questions/:questionId/categories`                    | POST   |
| `unlink-category.ts`     | `DELETE /mcq-questions/:questionId/categories/:categoryValueId` | DELETE |
| `link-tag.ts`            | `POST /mcq-questions/:questionId/tags`                          | POST   |
| `unlink-tag.ts`          | `DELETE /mcq-questions/:questionId/tags/:tagId`                 | DELETE |
| `link-basket.ts`         | `POST /mcq-questions/:questionId/baskets`                       | POST   |
| `unlink-basket.ts`       | `DELETE /mcq-questions/:questionId/baskets/:basketId`           | DELETE |

**Router (`index.ts`) pattern** (follows baskets router exactly):

```ts
export function createMcqQuestionsRouter(): Hono<BackofficeEnv> {
  const router = new Hono<BackofficeEnv>();
  const readGuard = requireAnyPermission(["question_manage", "content_manage", "content_read"]);
  const writeGuard = requireAnyPermission(["question_manage", "content_manage"]);
  const transitionGuard = requireAnyPermission([
    "question_manage",
    "content_manage",
    "content_review",
  ]);

  router.get("/mcq-questions", readGuard, listQuestionsHandler);
  router.post("/mcq-questions", writeGuard, createQuestionHandler);
  router.get("/mcq-questions/:questionId", readGuard, getQuestionHandler);
  router.patch("/mcq-questions/:questionId", writeGuard, updateQuestionHandler);
  router.delete("/mcq-questions/:questionId", writeGuard, deleteQuestionHandler);
  router.post(
    "/mcq-questions/:questionId/workflow/transition",
    transitionGuard,
    transitionQuestionHandler,
  );
  router.post("/mcq-questions/:questionId/categories", writeGuard, linkCategoryHandler);
  router.delete(
    "/mcq-questions/:questionId/categories/:categoryValueId",
    writeGuard,
    unlinkCategoryHandler,
  );
  router.post("/mcq-questions/:questionId/tags", writeGuard, linkTagHandler);
  router.delete("/mcq-questions/:questionId/tags/:tagId", writeGuard, unlinkTagHandler);
  router.post("/mcq-questions/:questionId/baskets", writeGuard, linkBasketHandler);
  router.delete("/mcq-questions/:questionId/baskets/:basketId", writeGuard, unlinkBasketHandler);

  return router;
}
```

**Router registration**: Add `mcqQuestionsRouter` to the backoffice app in the workspace route group.

### Layer 6: Worker Layer

Not applicable. This stage has no worker involvement. Question CRUD is synchronous.

### Layer 7: Frontend Layer

Not applicable. MCQ Question management is a Backoffice concern. No student-facing exposure in this stage.

---

## Database Impact

### Master DB

- Tables touched: None
- Migration required: No
- Version bump: No

### Tenant DB

- Tables touched: 5 new tables (`mcq_questions`, `mcq_question_options`, `mcq_question_categories`, `mcq_question_tags`, `mcq_question_baskets`)
- Migration required: Yes — `20260330_012_mcq_questions.ts`
- schema_version change: Yes — bump to next version
- product_version compatibility impact: None (additive-only; no existing table modifications)

---

## Transaction Design

| Operation           | Transaction | Isolation Level | Concurrency Protection                      | Rollback Behavior               |
| ------------------- | ----------- | --------------- | ------------------------------------------- | ------------------------------- |
| Create question     | Yes         | READ COMMITTED  | UNIQUE constraint on option order_index     | Full rollback on any failure    |
| Update question     | Yes         | READ COMMITTED  | `updated_at` WHERE clause (optimistic lock) | Full rollback on any failure    |
| Delete question     | Yes         | READ COMMITTED  | SELECT + DELETE in single transaction       | Full rollback                   |
| Link category       | No\*        | READ COMMITTED  | UNIQUE constraint catch (→ 409)             | Single statement                |
| Unlink category     | No\*        | —               | DELETE with rowCount check                  | Single statement                |
| Link tag            | No\*        | READ COMMITTED  | UNIQUE constraint catch (→ 409)             | Single statement                |
| Unlink tag          | No\*        | —               | DELETE with rowCount check                  | Single statement                |
| Link basket         | Yes         | READ COMMITTED  | Count check + UNIQUE constraint             | Full rollback                   |
| Unlink basket       | No\*        | —               | DELETE with rowCount check                  | Single statement                |
| Workflow transition | Yes         | READ COMMITTED  | SELECT FOR UPDATE (workflow engine)         | Full rollback (workflow engine) |

\*Single-statement operations are auto-committed by PostgreSQL.

---

## Idempotency Plan

| Operation           | Idempotency Mechanism                                               |
| ------------------- | ------------------------------------------------------------------- |
| Create question     | Not idempotent — each call creates a new question                   |
| Update question     | Optimistic lock — stale `updatedAt` → 409 (no data change)          |
| Delete (soft)       | Idempotent — setting `deleted_at` on already-deleted → no-op or 404 |
| Delete (hard)       | Idempotent — DELETE on non-existent → 404                           |
| Link category       | UNIQUE constraint → duplicate → 409 (no data corruption)            |
| Link tag            | UNIQUE constraint → duplicate → 409 (no data corruption)            |
| Link basket         | UNIQUE constraint → duplicate → 409 (no data corruption)            |
| Workflow transition | Workflow engine enforces state machine — invalid → 400              |

---

## Version Enforcement Strategy

- **schema_version**: Validated by tenant resolver middleware at request boundary. Migration bumps version.
- **product_version**: Validated by license middleware. No breaking changes (additive-only).
- **On mismatch**: 409 `SCHEMA_VERSION_MISMATCH` (tenant too old) or 426 `UPGRADE_REQUIRED`.
- **Backward compatibility**: This stage is additive — new tables only. No modification to existing tables. Tenants that haven't migrated simply don't have the tables; requests return appropriate errors.

---

## Authoritative Time Handling

- All `created_at`, `updated_at`, `status_updated_at`, `deleted_at` timestamps are set server-side via `NOW()`.
- No client-supplied timestamps are accepted (per Constitution).
- The `updatedAt` field in the PATCH request body is for optimistic concurrency comparison only — it is NOT stored; the server sets `updated_at = NOW()` on every update.

---

## Rate Limiting

Per STAGE_08 platform standard (no question-specific overrides):

| Endpoint Class            | Limit         | Key                                           |
| ------------------------- | ------------- | --------------------------------------------- |
| Write (POST/PATCH/DELETE) | ≤ 30 req/min  | `{actor_id}:{endpoint_group}`                 |
| Read (GET)                | ≤ 120 req/min | `{actor_id}:{endpoint_group}`                 |
| Workflow transition       | ≤ 20 req/min  | `workflow-transition:{actor_id}:mcq_question` |

---

## Observability & Logging

- **Logger**: `createLogger('mcq-questions-route:*')` per handler file
- **Domain logger**: `createLogger('mcq-questions-service')` in service layer
- **Structured fields**: `correlation_id`, `workspace_slug`, `workspace_id`, `question_id`
- **Events logged**:
  - `mcq_question.created` — question creation
  - `mcq_question.updated` — question update
  - `mcq_question.deleted` — question deletion (soft/hard type)
  - `mcq_question.classification.linked` — category/tag/basket link
  - `mcq_question.classification.unlinked` — category/tag/basket unlink
  - `mcq_question.concurrent_update_rejected` — optimistic lock failure
- **Error contract**: `{ success: false, data: null, error: { code, message } }`
- **No console.log** — all through `@zidney/logger`

---

## Security Review

- ✅ RBAC enforcement server-side via `requireAnyPermission` middleware
- ✅ No role checks in frontend (no frontend in this stage)
- ✅ No secrets exposed — no sensitive data in responses or logs
- ✅ JWT workspace scope enforced by authentication middleware
- ✅ Rich text sanitized server-side (XSS prevention)
- ✅ All inputs validated via Zod schemas
- ✅ SQL injection prevented via parameterized queries
- ✅ Rate limiting applied per STAGE_08

---

## Failure Modes

| Failure                     | Impact                              | Recovery                            |
| --------------------------- | ----------------------------------- | ----------------------------------- |
| DB unavailable              | All endpoints return 503            | Automatic retry via connection pool |
| Version mismatch            | Requests rejected with 409/426      | Tenant must run migration           |
| License not ACTIVE          | 423 (SOFT_LOCKED) or 403 (ARCHIVED) | License renewal via MMC             |
| Concurrent update conflict  | 409 on PATCH                        | Client refreshes and retries        |
| UNIQUE constraint violation | 409 on classification links         | Client receives clear error code    |
| Option validation failure   | 422 on create/update/transition     | Client corrects options and retries |
| Partial transaction failure | Full rollback                       | Client retries entire operation     |
| FK reference missing        | 404 (SUBJECT_NOT_FOUND, etc.)       | Client corrects references          |

---

## Test Strategy

### Unit Tests

**Location**: `packages/domain-core/src/mcq-questions/__tests__/`

| Test File                     | Coverage                                                      |
| ----------------------------- | ------------------------------------------------------------- |
| `validators.test.ts`          | Type-specific option validation (all 4 types × valid/invalid) |
| `sanitize.test.ts`            | Rich text sanitization: XSS stripping, allowed tags preserved |
| `dependency-registry.test.ts` | Reference checker registration, result aggregation            |

### Integration Tests

**Location**: `tests/integration/mcq-questions/`

| Test File                      | Coverage                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------ |
| `create-question.test.ts`      | US-1: 4 question types, option validation, academic boundary enforcement       |
| `update-question.test.ts`      | US-3: Metadata + option replacement, optimistic concurrency, type immutability |
| `delete-question.test.ts`      | US-7: Hard delete (DRAFT), soft delete (other), deletion guard                 |
| `workflow-transition.test.ts`  | US-4: Full lifecycle, ENABLED guard, invalid transitions                       |
| `classification-links.test.ts` | US-5: Category/tag/basket link + unlink + duplicate handling                   |
| `list-questions.test.ts`       | US-6: All filters, pagination, classification subqueries                       |
| `isolation.test.ts`            | SC-008: Cross-tenant isolation verification                                    |
| `concurrency.test.ts`          | Concurrent PATCH → one succeeds, one 409                                       |

### Test Checklist

- [ ] Unit tests for option validators (all 4 types)
- [ ] Unit tests for sanitization (XSS vectors)
- [ ] Integration: CRUD operations
- [ ] Integration: Workflow transitions
- [ ] Integration: Classification links (categories, tags, baskets)
- [ ] Integration: Optimistic concurrency conflict
- [ ] Integration: Academic boundary enforcement (lesson-subject, division scope)
- [ ] Integration: Deletion guard (active attempt, exam reference)
- [ ] Integration: Rate limiting (429 on breach)
- [ ] Integration: License enforcement (423 for SOFT_LOCKED)
- [ ] Integration: Tenant isolation (no cross-tenant data)
- [ ] Integration: Transaction rollback on partial failure
- [ ] Migration idempotency test

---

## Rollback Strategy

- **Migration rollback**: Forward-only per ADR-0008. Rollback requires a new forward migration that drops the 5 tables (only safe if no data exists).
- **Code rollback**: Revert the branch. Routes, domain-core module, and validation schemas are all additive — removal has no impact on existing functionality.
- **Feature flag**: Not needed. New tables + new routes. Existing functionality untouched.
- **Data integrity**: No existing tables modified. All changes are additive.

---

## Non-Goals

- **MCQ Exam Configuration** — linking questions to exam configurations is a separate stage
- **Auto-Selection Engine** — consuming the indexed columns for automated question selection is a future stage
- **Attempt Engine Integration** — snapshot capture of question data at attempt start is a future runtime phase
- **Frontoffice UI** — question authoring is a Backoffice concern; no student-facing exposure
- **Bulk Operations** — bulk import/export of questions is not in scope for this stage
- **Question Versioning** — version history tracking for question edits is not in scope
- **Content Translation** — multi-language question content management is not in scope

---

## Implementation Sequence

| Step | Layer               | Files                                                        | Dependencies |
| ---- | ------------------- | ------------------------------------------------------------ | ------------ |
| 1    | Migration           | `20260330_012_mcq_questions.ts`                              | None         |
| 2    | Drizzle Schemas     | 5 schema files + index.ts update                             | Step 1       |
| 3    | Domain Types        | `mcq-questions.types.ts`                                     | None         |
| 4    | Domain Errors       | `mcq-questions.errors.ts`                                    | Step 3       |
| 5    | Validators          | `mcq-questions.validators.ts`                                | Step 3       |
| 6    | Sanitizer           | `mcq-questions.sanitize.ts`                                  | None         |
| 7    | Dependency Registry | `mcq-questions.dependency-registry.ts`                       | Step 3       |
| 8    | Repository          | `mcq-questions.repository.ts`                                | Steps 3–4    |
| 9    | Service             | `mcq-questions.service.ts`                                   | Steps 5–8    |
| 10   | Barrel Export       | `index.ts` (domain-core)                                     | Steps 3–9    |
| 11   | Validation Schemas  | `mcq-questions.schemas.ts` (validation package)              | None         |
| 12   | Route Helpers       | `helpers.ts` (API routes)                                    | Step 10      |
| 13   | Route Handlers      | 13 handler files + `index.ts`                                | Steps 10–12  |
| 14   | Router Registration | Mount in backoffice app                                      | Step 13      |
| 15   | Unit Tests          | Validators, sanitizer, dependency registry tests             | Steps 5–7    |
| 16   | Integration Tests   | CRUD, workflow, classification, concurrency, isolation       | Steps 1–14   |
| 17   | Install Dependency  | `pnpm add sanitize-html && pnpm add -D @types/sanitize-html` | None         |

---

## New Dependency

| Package                | Version | Scope      | Purpose                       |
| ---------------------- | ------- | ---------- | ----------------------------- |
| `sanitize-html`        | latest  | production | Server-side HTML sanitization |
| `@types/sanitize-html` | latest  | dev        | TypeScript type definitions   |

Install in `packages/domain-core` (where the sanitizer utility lives).

---

## File Inventory

| #   | File Path                                                                      | Action |
| --- | ------------------------------------------------------------------------------ | ------ |
| 1   | `apps/api/src/db/tenant/migrations/20260330_012_mcq_questions.ts`              | CREATE |
| 2   | `apps/api/src/db/tenant/schemas/mcq-questions.schema.ts`                       | CREATE |
| 3   | `apps/api/src/db/tenant/schemas/mcq-question-options.schema.ts`                | CREATE |
| 4   | `apps/api/src/db/tenant/schemas/mcq-question-categories.schema.ts`             | CREATE |
| 5   | `apps/api/src/db/tenant/schemas/mcq-question-tags.schema.ts`                   | CREATE |
| 6   | `apps/api/src/db/tenant/schemas/mcq-question-baskets.schema.ts`                | CREATE |
| 7   | `apps/api/src/db/tenant/schemas/index.ts`                                      | MODIFY |
| 8   | `packages/domain-core/src/mcq-questions/index.ts`                              | CREATE |
| 9   | `packages/domain-core/src/mcq-questions/mcq-questions.types.ts`                | CREATE |
| 10  | `packages/domain-core/src/mcq-questions/mcq-questions.errors.ts`               | CREATE |
| 11  | `packages/domain-core/src/mcq-questions/mcq-questions.validators.ts`           | CREATE |
| 12  | `packages/domain-core/src/mcq-questions/mcq-questions.sanitize.ts`             | CREATE |
| 13  | `packages/domain-core/src/mcq-questions/mcq-questions.dependency-registry.ts`  | CREATE |
| 14  | `packages/domain-core/src/mcq-questions/mcq-questions.repository.ts`           | CREATE |
| 15  | `packages/domain-core/src/mcq-questions/mcq-questions.service.ts`              | CREATE |
| 16  | `packages/validation/src/backoffice/mcq-questions.schemas.ts`                  | CREATE |
| 17  | `apps/api/src/routes/backoffice/mcq-questions/index.ts`                        | CREATE |
| 18  | `apps/api/src/routes/backoffice/mcq-questions/helpers.ts`                      | CREATE |
| 19  | `apps/api/src/routes/backoffice/mcq-questions/create-question.ts`              | CREATE |
| 20  | `apps/api/src/routes/backoffice/mcq-questions/list-questions.ts`               | CREATE |
| 21  | `apps/api/src/routes/backoffice/mcq-questions/get-question.ts`                 | CREATE |
| 22  | `apps/api/src/routes/backoffice/mcq-questions/update-question.ts`              | CREATE |
| 23  | `apps/api/src/routes/backoffice/mcq-questions/delete-question.ts`              | CREATE |
| 24  | `apps/api/src/routes/backoffice/mcq-questions/transition-question.ts`          | CREATE |
| 25  | `apps/api/src/routes/backoffice/mcq-questions/link-category.ts`                | CREATE |
| 26  | `apps/api/src/routes/backoffice/mcq-questions/unlink-category.ts`              | CREATE |
| 27  | `apps/api/src/routes/backoffice/mcq-questions/link-tag.ts`                     | CREATE |
| 28  | `apps/api/src/routes/backoffice/mcq-questions/unlink-tag.ts`                   | CREATE |
| 29  | `apps/api/src/routes/backoffice/mcq-questions/link-basket.ts`                  | CREATE |
| 30  | `apps/api/src/routes/backoffice/mcq-questions/unlink-basket.ts`                | CREATE |
| 31  | `packages/domain-core/src/mcq-questions/__tests__/validators.test.ts`          | CREATE |
| 32  | `packages/domain-core/src/mcq-questions/__tests__/sanitize.test.ts`            | CREATE |
| 33  | `packages/domain-core/src/mcq-questions/__tests__/dependency-registry.test.ts` | CREATE |
| 34  | `tests/integration/mcq-questions/create-question.test.ts`                      | CREATE |
| 35  | `tests/integration/mcq-questions/update-question.test.ts`                      | CREATE |
| 36  | `tests/integration/mcq-questions/delete-question.test.ts`                      | CREATE |
| 37  | `tests/integration/mcq-questions/workflow-transition.test.ts`                  | CREATE |
| 38  | `tests/integration/mcq-questions/classification-links.test.ts`                 | CREATE |
| 39  | `tests/integration/mcq-questions/list-questions.test.ts`                       | CREATE |
| 40  | `tests/integration/mcq-questions/isolation.test.ts`                            | CREATE |
| 41  | `tests/integration/mcq-questions/concurrency.test.ts`                          | CREATE |
| 42  | `packages/domain-core/src/index.ts`                                            | MODIFY |
| 43  | `packages/validation/src/backoffice/index.ts`                                  | MODIFY |
| 44  | `apps/api/src/routes/backoffice/index.ts`                                      | MODIFY |

**Total**: 40 new files, 4 modified files

---

## Final Compliance Statement

Implementation plan compliant with Zidney Constitution v1.2.0 — No violations detected.

All architectural boundaries, tenant isolation rules, middleware authority, transaction requirements, and operational integrity standards are satisfied. No ADR exceptions required.
