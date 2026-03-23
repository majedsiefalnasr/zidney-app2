# Technical Implementation Plan: MCQ Baskets (Stage 033)

**Stage**: `STAGE_33_MCQ_BASKETS`
**Phase**: `03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION`
**Branch**: `spec/033-mcq-baskets`
**Generated**: 2026-03-23
**Schema Version**: `1.16.0 → 1.17.0`

---

## Overview

This plan implements the MCQ Basket feature: a structured question-grouping container used in
exam composition and auto-selection engine filtering. Baskets live in the tenant DB, are
workflow-managed, and expose a CRUD + link/unlink + workflow-transition API under the Backoffice
workspace route namespace.

**Scope summary**:

- 1 DB migration (two tables + FK constraints + indexes)
- 2 Drizzle schema files
- Workflow engine extension (DRAFT state + mcq_basket entity registration)
- 1 domain package (`packages/domain-core/src/baskets/`)
- 1 validation schema file (`packages/validation/src/backoffice/baskets.schemas.ts`)
- 9 route handler files (`apps/api/src/routes/backoffice/baskets/`)
- Boot registry update (migration registration)
- Drizzle schema index update
- Unit tests + integration tests

---

## Architecture Decisions

### AD-001: Extend WorkflowState with DRAFT

**Problem**: The shared workflow engine's `WorkflowState` enum starts at `COMPLETED`. Baskets
require `DRAFT` as the initial status.

**Decision**: Extend `WorkflowState` enum to include `DRAFT` (prepend to order). Add
`DRAFT → COMPLETED` as a new forward transition edge with `actionKey: 'complete'`. Register
`mcq_basket` in `WORKFLOW_ENTITY_TYPES` and `ENTITY_TABLE_MAP`.

**Impact**: Additive-only change. Zero existing entities use `DRAFT`; no existing transitions
are invalidated. Entities starting at `COMPLETED` continue to behave identically.

### AD-002: Permission Bridging in Route Handler

**Problem**: The workflow engine checks `{entityType}.{actionKey}` format permissions
(e.g., `mcq_basket.complete`). The RBAC system stores coarse-grained codes
(`question_manage`, `content_manage`, `content_review`).

**Decision**: The basket workflow transition route handler derives engine-compatible permissions
from the actor's RBAC permissions at call time:

```
question_manage OR content_manage  →  mcq_basket.complete, mcq_basket.review
question_manage OR content_review  →  mcq_basket.approve, mcq_basket.enable
```

This adapter function lives in the basket route helper file. The engine remains generic.

### AD-003: questionCount Computed at Read Time

**Problem**: Basket deletion with cascade removes `mcq_basket_questions` rows silently. A stored
`question_count` column would drift on CASCADE deletes from `mcq_questions`.

**Decision**: Compute `question_count` via COUNT subquery at read time. For single-get: scalar
subquery on `mcq_basket_questions WHERE basket_id = ?`. For list: LEFT JOIN with GROUP BY.
No stored counter column.

### AD-004: Deletion Guard with Graceful Table Existence Check

**Problem**: `exam_configurations` and `auto_selection_rules` tables do not yet exist in Stage 033.
A hard FK reference query would throw a PostgreSQL `42P01` (undefined table) error.

**Decision**: The deletion guard queries `information_schema.tables` before the reference check.
If a target table does not exist, treat as zero references (no block). This pattern is established
in `tags.repository.ts` for `checkEntityExists`. Enforcement becomes automatic when those tables
are provisioned in future stages.

### AD-005: No status Column in PATCH Endpoint

**Decision**: The `PATCH /baskets/:basketId` endpoint MUST NOT accept a `status` field.
Status is managed exclusively by the workflow engine via the transition endpoint.
The `UpdateBasketBody` Zod schema omits `status`; if provided, it is silently ignored after Zod
strips unknown keys.

### AD-006: type Column Is Immutable After Creation

**Decision**: `type` (LINKED/UNLINKED) is set at creation and cannot be changed via `PATCH`.
The `UpdateBasketBody` schema does not include a `type` field.

### AD-007: Dedicated Basket Workflow Endpoint (Not Generic Router)

**Decision**: The basket workflow transition is exposed at
`POST /workspace/:slug/mcq-baskets/:basketId/workflow/transition`, not via the generic
`/workflow/:entityType/:entityId/transition` router. This allows:

- Basket-specific pre-transition guards (empty check, max_questions check on APPROVED→ENABLED)
- Permission bridging (AD-002) scoped to this endpoint only
- Entity-specific request body validation (`{ to: BasketStatus }` vs. `{ target_state: string }`)

The generic workflow router remains intact. The basket service calls `executeTransition()` from
the domain engine internally after all guards pass.

---

## Data Model

See `data-model.md` for complete Drizzle schema definitions, migration source, and column tables.

### Tables

- `mcq_baskets` — basket entity with full workflow lifecycle
- `mcq_basket_questions` — junction table linking baskets to MCQ questions

### Workflow Engine Changes

- `WorkflowState` enum: add `DRAFT`
- `WORKFLOW_STATE_ORDER`: prepend `DRAFT`
- `WORKFLOW_TRANSITIONS`: add `DRAFT → COMPLETED` edge
- `WORKFLOW_ENTITY_TYPES`: add `'mcq_basket'`
- `ENTITY_TABLE_MAP`: add `mcq_basket: 'mcq_baskets'`

---

## Migration Plan

### File

`apps/api/src/db/tenant/migrations/20260323_011_mcq_baskets.ts`

### Version

`1.16.0 → 1.17.0`

### Phase 1 (inside transaction)

1. `CREATE TABLE IF NOT EXISTS mcq_baskets` — all columns + CHECK constraints
2. `CREATE TABLE IF NOT EXISTS mcq_basket_questions`
3. FK: `mcq_baskets.created_by → users.id` (SET NULL)
4. FK: `mcq_baskets.updated_by → users.id` (SET NULL)
5. FK: `mcq_baskets.status_updated_by → users.id` (SET NULL)
6. FK: `mcq_basket_questions.basket_id → mcq_baskets.id` (CASCADE)
7. FK: `mcq_basket_questions.question_id → mcq_questions.id` (CASCADE) — guarded by `information_schema` check
8. B-tree indexes: `idx_mcq_baskets_type`, `idx_mcq_baskets_status`, `idx_mcq_basket_questions_basket_id`, `idx_mcq_basket_questions_question_id`
9. Schema version bump: `1.16.0 → 1.17.0`
10. COMMIT

### Phase 2 (outside transaction — CONCURRENT)

1. `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_mcq_basket_code ON mcq_baskets (code)`
2. `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_mcq_basket_question ON mcq_basket_questions (basket_id, question_id)`

### Boot Registry

Add to `apps/api/src/boot/migration-registry.ts`:

```ts
const TENANT_MIGRATIONS_1_17_0_NAME = "20260323_011_mcq_baskets";
// In the boot loop: if (currentVersion < '1.17.0') { apply migration + record }
```

---

## Implementation Phases

### Phase 1: Foundation

**Files to create or modify:**

1. **`packages/domain-core/src/workflow/workflow.states.ts`** — add `DRAFT` state (AD-001)
2. **`packages/domain-core/src/workflow/workflow.engine.ts`** — add `mcq_basket` to table map (AD-001)
3. **`apps/api/src/db/tenant/migrations/20260323_011_mcq_baskets.ts`** — new migration
4. **`apps/api/src/db/tenant/schemas/baskets.schema.ts`** — Drizzle schema
5. **`apps/api/src/db/tenant/schemas/basket-questions.schema.ts`** — Drizzle schema
6. **`apps/api/src/db/tenant/schemas/index.ts`** — export new schemas
7. **`apps/api/src/boot/migration-registry.ts`** — register migration

**Validation gate**: Migration runs cleanly. Drizzle schema compiles. Workflow engine unit tests pass.

### Phase 2: Domain Package

**Directory**: `packages/domain-core/src/baskets/`

**Files to create:**

| File                             | Purpose                                           |
| -------------------------------- | ------------------------------------------------- |
| `baskets.types.ts`               | Domain types, interfaces, enums                   |
| `baskets.errors.ts`              | `BasketError` class, error codes, HTTP status map |
| `baskets.repository.ts`          | Pure SQL functions — no transactions              |
| `baskets.service.ts`             | Business logic — all TX management here           |
| `index.ts`                       | Public exports                                    |
| `baskets.dependency-registry.ts` | Module registry entry                             |

**Key repository functions:**

```ts
findBasketById(db, basketId): Promise<BasketWithCount | null>
findBaskets(db, input): Promise<BasketWithCount[]>
countBaskets(db, input): Promise<number>
insertBasket(db, data, actorId): Promise<BasketRow>
updateBasketRow(db, basketId, data, actorId): Promise<BasketRow | null>
deleteBasketRow(db, basketId): Promise<void>
findBasketByCode(db, code): Promise<BasketRow | null>
findBasketQuestion(db, basketId, questionId): Promise<BasketQuestionRow | null>
countBasketQuestions(db, basketId): Promise<number>
insertBasketQuestion(db, basketId, questionId): Promise<BasketQuestionRow>
deleteBasketQuestion(db, basketId, questionId): Promise<boolean>
findBasketQuestions(db, input): Promise<BasketQuestionRow[]>
countBasketQuestionRows(db, input): Promise<number>
checkQuestionExists(db, questionId): Promise<boolean>
checkExamConfigReference(db, basketId): Promise<boolean>
checkAutoSelectionReference(db, basketId): Promise<boolean>
```

**Key service methods:**

```ts
createBasket(db, input, audit): Promise<BasketWithCount>
  // TX: findBasketByCode → if exists throw BASKET_CODE_DUPLICATE
  //     insertBasket (status=DRAFT, server timestamps)
  //     return basket with questionCount=0

getBasket(db, basketId, audit): Promise<BasketWithCount>
  // findBasketById or throw BASKET_NOT_FOUND

listBaskets(db, input, audit): Promise<ListBasketsResult>
  // countBaskets + findBaskets (parallel)

updateBasket(db, basketId, input, audit): Promise<BasketWithCount>
  // TX: findById FOR UPDATE → check exists → if code changing: check duplicate
  //     updateBasketRow → return updated

deleteBasket(db, basketId, audit): Promise<void>
  // TX: findById → checkExamConfigReference → checkAutoSelectionReference
  //     deleteBasketRow (cascade removes mcq_basket_questions)

transitionStatus(db, basketId, targetStatus, audit): Promise<{ id, status, updatedAt }>
  // Pre-guard for APPROVED→ENABLED:
  //   countBasketQuestions → if 0 throw BASKET_EMPTY_CANNOT_ENABLE
  //   if max_questions defined and count > max_questions throw BASKET_EXCEEDS_MAX_QUESTIONS
  // Call executeTransition(db, context)

linkQuestion(db, basketId, questionId, audit): Promise<BasketQuestionRow>
  // TX: checkBasketExists → checkQuestionExists → checkDuplicate
  //     if max_questions defined: countBasketQuestions >= max_questions → throw BASKET_MAX_QUESTIONS_REACHED
  //     insertBasketQuestion

unlinkQuestion(db, basketId, questionId, audit): Promise<void>
  // TX: checkBasketExists → findBasketQuestion (throw BASKET_QUESTION_NOT_FOUND if absent)
  //     deleteBasketQuestion

listBasketQuestions(db, basketId, input, audit): Promise<ListBasketQuestionsResult>
  // checkBasketExists → countBasketQuestionRows + findBasketQuestions (parallel)
```

**Validation gate**: Domain package unit tests pass. Repository functions return correct shapes.

### Phase 3: Validation Schema

**File**: `packages/validation/src/backoffice/baskets.schemas.ts`

All Zod schemas as defined in data-model.md. Export from `packages/validation/src/backoffice/index.ts`.

**Validation gate**: Schema tests pass (valid/invalid input cases).

### Phase 4: API Route Layer

**Directory**: `apps/api/src/routes/backoffice/baskets/`

**Files:**

| File                   | Handler                                                                                               | Route                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `index.ts`             | Router assembly                                                                                       | Registers all routes                                  |
| `helpers.ts`           | `getDb`, `buildAuditCtx`, `successResponse`, `basketsErrorResponse`, `buildBasketWorkflowPermissions` | Shared utilities                                      |
| `create-basket.ts`     | `createBasketHandler`                                                                                 | `POST /mcq-baskets`                                   |
| `list-baskets.ts`      | `listBasketsHandler`                                                                                  | `GET /mcq-baskets`                                    |
| `get-basket.ts`        | `getBasketHandler`                                                                                    | `GET /mcq-baskets/:basketId`                          |
| `update-basket.ts`     | `updateBasketHandler`                                                                                 | `PATCH /mcq-baskets/:basketId`                        |
| `delete-basket.ts`     | `deleteBasketHandler`                                                                                 | `DELETE /mcq-baskets/:basketId`                       |
| `transition-basket.ts` | `transitionBasketHandler`                                                                             | `POST /mcq-baskets/:basketId/workflow/transition`     |
| `link-question.ts`     | `linkQuestionHandler`                                                                                 | `POST /mcq-baskets/:basketId/questions`               |
| `unlink-question.ts`   | `unlinkQuestionHandler`                                                                               | `DELETE /mcq-baskets/:basketId/questions/:questionId` |
| `list-questions.ts`    | `listBasketQuestionsHandler`                                                                          | `GET /mcq-baskets/:basketId/questions`                |

**Router assembly in `index.ts`:**

```ts
export function createBasketsRouter(): Hono<BackofficeEnv> {
  const router = new Hono<BackofficeEnv>();

  const writeGuard = requireAnyPermission(["question_manage", "content_manage"]);
  const readGuard = requireAnyPermission(["question_manage", "content_manage", "content_read"]);
  const transitionGuard = requireAnyPermission([
    "question_manage",
    "content_manage",
    "content_review",
  ]);

  // Basket CRUD
  router.get("/mcq-baskets", readGuard, listBasketsHandler);
  router.post("/mcq-baskets", writeGuard, createBasketHandler);
  router.get("/mcq-baskets/:basketId", readGuard, getBasketHandler);
  router.patch("/mcq-baskets/:basketId", writeGuard, updateBasketHandler);
  router.delete("/mcq-baskets/:basketId", writeGuard, deleteBasketHandler);

  // Workflow transition (static path before parameterised)
  router.post(
    "/mcq-baskets/:basketId/workflow/transition",
    transitionGuard,
    transitionBasketHandler,
  );

  // Basket-Question linking
  router.post("/mcq-baskets/:basketId/questions", writeGuard, linkQuestionHandler);
  router.delete("/mcq-baskets/:basketId/questions/:questionId", writeGuard, unlinkQuestionHandler);
  router.get("/mcq-baskets/:basketId/questions", readGuard, listBasketQuestionsHandler);

  return router;
}
```

**Mount in backoffice router** (`apps/api/src/routes/backoffice/context.ts` or `ws.ts`):

```ts
// Following the same mount pattern as tagsRouter
import { createBasketsRouter } from "./baskets";
const basketsRouter = createBasketsRouter();
router.route("/", basketsRouter);
```

**`transition-basket.ts` — permission bridging:**

```ts
export async function transitionBasketHandler(c: Context): Promise<Response> {
  const body = await c.req.json();
  const parsed = transitionBasketBodySchema.safeParse(body);
  if (!parsed.success) return basketsErrorResponse(c, parsed.error);

  const { basketId } = c.req.param();
  const { to } = parsed.data;

  const db = getDb(c);
  const audit = buildAuditCtx(c);

  // Bridge RBAC permissions to workflow engine format
  const rbacPerms = (c.get("rbacContext")?.permissions ?? []) as string[];
  const enginePerms = buildBasketWorkflowPermissions(rbacPerms);

  const result = await transitionStatus(db, basketId, to, {
    ...audit,
    enginePermissions: enginePerms,
  });
  return c.json(successResponse(result), 200);
}
```

**Validation gate**: Manual smoke test of each endpoint via curl/HTTP client. `bun run typecheck` passes.

### Phase 5: Tests

#### Unit Tests — `packages/domain-core/src/baskets/__tests__/`

| Test file                    | Coverage                             |
| ---------------------------- | ------------------------------------ |
| `baskets.service.test.ts`    | All service methods, all error paths |
| `baskets.repository.test.ts` | Row mapping, query construction      |

**Service test cases** (full list):

```
createBasket
  ✓ creates basket with status=DRAFT and questionCount=0
  ✓ throws BASKET_CODE_DUPLICATE on duplicate code
  ✓ rejects maxQuestions <= 0 (validation layer)

getBasket
  ✓ returns basket with correct questionCount
  ✓ throws BASKET_NOT_FOUND for unknown id

listBaskets
  ✓ returns paginated results with correct total
  ✓ filters by type=LINKED
  ✓ filters by status=ENABLED
  ✓ filters by search (name partial match)
  ✓ filters by search (code partial match)
  ✓ returns empty result when no baskets

updateBasket
  ✓ updates name, code, maxQuestions, description
  ✓ throws BASKET_NOT_FOUND for unknown id
  ✓ throws BASKET_CODE_DUPLICATE when new code conflicts

deleteBasket
  ✓ deletes successfully with no references
  ✓ throws BASKET_REFERENCED_IN_EXAM_CONFIG when referenced
  ✓ throws BASKET_REFERENCED_IN_AUTO_SELECTION when referenced
  ✓ throws BASKET_NOT_FOUND for unknown id

transitionStatus
  ✓ transitions DRAFT → COMPLETED
  ✓ transitions COMPLETED → UNDER_REVIEW
  ✓ transitions UNDER_REVIEW → APPROVED
  ✓ transitions APPROVED → ENABLED (with questions)
  ✓ throws BASKET_EMPTY_CANNOT_ENABLE on APPROVED→ENABLED with 0 questions
  ✓ throws BASKET_EXCEEDS_MAX_QUESTIONS when count > max_questions at ENABLED
  ✓ throws INVALID_STATE_TRANSITION on invalid edges
  ✓ throws BASKET_NOT_FOUND for unknown id

linkQuestion
  ✓ inserts basket-question relation
  ✓ throws BASKET_NOT_FOUND
  ✓ throws QUESTION_NOT_FOUND
  ✓ throws BASKET_QUESTION_ALREADY_LINKED on re-link
  ✓ throws BASKET_MAX_QUESTIONS_REACHED when at capacity (max_questions set)
  ✓ allows unlimited linking when max_questions is null

unlinkQuestion
  ✓ removes basket-question relation
  ✓ throws BASKET_NOT_FOUND
  ✓ throws BASKET_QUESTION_NOT_FOUND when not linked

listBasketQuestions
  ✓ returns paginated question links
  ✓ throws BASKET_NOT_FOUND
```

#### Integration Tests — `apps/api/src/routes/backoffice/baskets/__tests__/`

| Test file                        | Coverage                                                        |
| -------------------------------- | --------------------------------------------------------------- |
| `baskets.crud.test.ts`           | Create, list, get, update, delete against real tenant DB        |
| `baskets.workflow.test.ts`       | Complete transition flow + invalid transition cases             |
| `baskets.questions.test.ts`      | Link, unlink, list questions + duplicate + max cap              |
| `baskets.isolation.test.ts`      | Tenant isolation (basket from tenant A not visible in tenant B) |
| `baskets.deletion-guard.test.ts` | Deletion guard with mocked exam_config table existence          |

**Integration test scenarios:**

```
CRUD endpoints
  ✓ POST creates basket, returns 201 with correct shape
  ✓ GET /baskets returns paginated list
  ✓ GET /baskets/:id returns basket with questionCount
  ✓ PATCH updates allowed fields; status unaffected
  ✓ DELETE removes basket + cascade-removes linked questions
  ✓ POST returns 409 on duplicate code
  ✓ POST returns 422 on validation error
  ✓ PATCH returns 404 for unknown basket

Workflow transitions
  ✓ Full chain: DRAFT→COMPLETED→UNDER_REVIEW→APPROVED→ENABLED
  ✓ Returns 400 on DRAFT→APPROVED (skip steps)
  ✓ Returns 422 on APPROVED→ENABLED with empty basket
  ✓ Returns 422 on APPROVED→ENABLED when questionCount > max_questions
  ✓ Returns 403 when actor lacks transition permission

Link/unlink
  ✓ POST /mcq-baskets/:id/questions links question; GET shows questionCount=1
  ✓ POST returns 409 on duplicate link
  ✓ POST returns 422 when max_questions reached
  ✓ DELETE /mcq-baskets/:id/questions/:qid unlinks; GET shows questionCount=0
  ✓ DELETE returns 404 for non-existent link
  ✓ Deleting MCQ question cascades: question disappears from basket question list

Tenant isolation
  ✓ Basket created in tenant A is NOT accessible from tenant B (404)

Deletion guard
  ✓ Basket with exam config reference: DELETE returns 422
  ✓ Basket with auto-selection reference: DELETE returns 422
  ✓ Basket with no references: DELETE returns 200

Middleware
  ✓ All routes return 401 without auth token
  ✓ All routes return 403 with insufficient RBAC permissions
  ✓ SOFT_LOCKED tenant: all routes return 423
  ✓ ARCHIVED tenant: all routes return 403
```

---

## API Contracts

All routes prefixed under `GET /workspace/:slug/mcq-baskets*`. Middleware chain:
`tenant-resolver → license-enforcement → schema-version-check → rate-limit → authentication → rbac-resolve → [route-level guard] → handler`

### Request/Response Summary

| Method | Path                                           | Permission  | Success Code | Key error codes                                                                                    |
| ------ | ---------------------------------------------- | ----------- | ------------ | -------------------------------------------------------------------------------------------------- |
| GET    | `/mcq-baskets`                                 | R/W/read    | 200          | —                                                                                                  |
| POST   | `/mcq-baskets`                                 | W           | 201          | BASKET_CODE_DUPLICATE, VALIDATION_ERROR                                                            |
| GET    | `/mcq-baskets/:basketId`                       | R/W/read    | 200          | BASKET_NOT_FOUND                                                                                   |
| PATCH  | `/mcq-baskets/:basketId`                       | W           | 200          | BASKET_NOT_FOUND, BASKET_CODE_DUPLICATE                                                            |
| DELETE | `/mcq-baskets/:basketId`                       | W           | 200          | BASKET*NOT_FOUND, BASKET_REFERENCED*\*                                                             |
| POST   | `/mcq-baskets/:basketId/workflow/transition`   | W or review | 200          | BASKET*NOT_FOUND, INVALID_STATE_TRANSITION, BASKET_EMPTY*_, BASKET*EXCEEDS*_                       |
| POST   | `/mcq-baskets/:basketId/questions`             | W           | 201          | BASKET_NOT_FOUND, QUESTION_NOT_FOUND, BASKET_QUESTION_ALREADY_LINKED, BASKET_MAX_QUESTIONS_REACHED |
| DELETE | `/mcq-baskets/:basketId/questions/:questionId` | W           | 200          | BASKET_NOT_FOUND, BASKET_QUESTION_NOT_FOUND                                                        |
| GET    | `/mcq-baskets/:basketId/questions`             | R/W/read    | 200          | BASKET_NOT_FOUND                                                                                   |

Full request/response schemas are defined in the spec at `spec.md §API Endpoints`.

### Standard Response Envelopes

```ts
// Success
{ success: true, data: T, error: null }

// Error
{ success: false, data: null, error: { code: string, message: string } }
```

---

## Transaction Boundaries

All write operations acquire a `PoolClient` and open explicit `BEGIN / COMMIT / ROLLBACK` blocks.
No write uses `db.query()` directly — all writes go through transactional blocks.

| Operation          | Transaction steps                                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createBasket`     | BEGIN → check code uniqueness → INSERT basket → COMMIT (cascade: none)                                                                                         |
| `updateBasket`     | BEGIN → SELECT FOR UPDATE → check code if changing → UPDATE basket → COMMIT                                                                                    |
| `deleteBasket`     | BEGIN → SELECT FOR UPDATE → check deletion guard → DELETE basket (CASCADE removes basket_questions) → COMMIT                                                   |
| `transitionStatus` | (no outer TX) → read basket exists → `countBasketQuestions` (read) → check max_questions (read) → `executeTransition()` [engine-owned BEGIN/FOR UPDATE/COMMIT] |
| `linkQuestion`     | BEGIN → check basket exists → check question exists → check duplicate → check max_questions → INSERT basket_question → COMMIT                                  |
| `unlinkQuestion`   | BEGIN → check basket exists → find basket_question → DELETE basket_question → COMMIT                                                                           |

**Note on `transitionStatus`**: The workflow engine opens its own `PoolClient` via `db.connect()` and manages its own `BEGIN/COMMIT`. The service layer wraps the pre-guard checks in a separate query sequence before calling `executeTransition()`. The pre-guards (countQuestions, check max_questions) do NOT need to be in the same transaction as the engine TX — they are read-only checks. The engine TX is authoritative.

---

## Idempotency Strategy

| Operation      | Idempotency mechanism                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `linkQuestion` | `UNIQUE (basket_id, question_id)` DB constraint + application pre-check. Duplicate returns 409, not 500.                                                |
| Migration      | `CREATE TABLE IF NOT EXISTS`, `DO $$ BEGIN IF NOT EXISTS ...` FK guards, `CREATE INDEX IF NOT EXISTS`, `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS` |
| Boot registry  | Migration checked against `migration_history` table before applying                                                                                     |

The link endpoint is NOT idempotent-200 by design (per spec clarification 2026-03-23): duplicates always return 409.

---

## Error Code Mapping

| Error Code                            | HTTP Status | Trigger                                            |
| ------------------------------------- | ----------- | -------------------------------------------------- |
| `BASKET_NOT_FOUND`                    | 404         | Basket ID not found in tenant DB                   |
| `QUESTION_NOT_FOUND`                  | 404         | Question ID not found in tenant DB                 |
| `BASKET_QUESTION_NOT_FOUND`           | 404         | (basket_id, question_id) pair not in join table    |
| `BASKET_CODE_DUPLICATE`               | 409         | `code` conflicts with existing basket              |
| `BASKET_QUESTION_ALREADY_LINKED`      | 409         | `(basket_id, question_id)` already linked          |
| `INVALID_STATE_TRANSITION`            | 400         | Requested `to` state not valid from current status |
| `BASKET_MAX_QUESTIONS_REACHED`        | 422         | Adding question would exceed `max_questions` cap   |
| `BASKET_EMPTY_CANNOT_ENABLE`          | 422         | APPROVED→ENABLED with zero questions               |
| `BASKET_EXCEEDS_MAX_QUESTIONS`        | 422         | APPROVED→ENABLED when count > max_questions        |
| `BASKET_REFERENCED_IN_EXAM_CONFIG`    | 409         | Deletion blocked by exam configuration reference   |
| `BASKET_REFERENCED_IN_AUTO_SELECTION` | 409         | Deletion blocked by auto-selection rule reference  |
| `FORBIDDEN`                           | 403         | Actor lacks required permission                    |
| `VALIDATION_ERROR`                    | 422         | Zod schema validation failure                      |

---

## Logging Requirements

All log calls MUST include:

| Field            | Source                                                 | Required              |
| ---------------- | ------------------------------------------------------ | --------------------- |
| `correlation_id` | `c.get('correlation_id')` or `x-correlation-id` header | YES                   |
| `workspace_id`   | `c.get('workspace_id')`                                | YES                   |
| `workspace_slug` | `c.get('workspace_slug')`                              | YES                   |
| `actor_id`       | `c.get('staff_user')?.user_id`                         | YES                   |
| `basket_id`      | from path param or result                              | YES (when applicable) |
| `error_code`     | `err.code`                                             | YES (error paths)     |

Log levels:

| Event                                | Level   |
| ------------------------------------ | ------- |
| Basket created                       | `info`  |
| Basket updated                       | `info`  |
| Basket deleted                       | `info`  |
| Question linked                      | `info`  |
| Question unlinked                    | `info`  |
| Status transitioned                  | `info`  |
| Domain error (e.g. BASKET_NOT_FOUND) | `warn`  |
| Unexpected error                     | `error` |

Use `createLogger('baskets:service')` in service, `createLogger('baskets-route:{operation}')` in handlers.

---

## Test Strategy

### Validation Checklist (matches spec Validation Criteria)

- [ ] Basket CRUD (create, list, get, update, delete) — all endpoints return `{success, data, error}` envelope
- [ ] Basket code uniqueness — 409 `BASKET_CODE_DUPLICATE` on duplicate
- [ ] Workflow transitions `DRAFT→ENABLED` — enforced strictly; out-of-order returns 400
- [ ] ENABLED guard — empty basket returns 422
- [ ] ENABLED guard — count > max_questions returns 422
- [ ] Link/unlink — add, list, remove questions
- [ ] Duplicate link guard — 409 `BASKET_QUESTION_ALREADY_LINKED`
- [ ] max_questions cap at link time — 422 `BASKET_MAX_QUESTIONS_REACHED`
- [ ] Deletion guard — 409 when referenced in exam config or auto-selection
- [ ] CASCADE — deleting MCQ question removes orphaned basket_question rows
- [ ] Indexed subquery performance — `idx_mcq_basket_questions_basket_id` used for basket filter
- [ ] All 5 required indexes verified in migration output
- [ ] License middleware enforced — SOFT_LOCKED → 423, ARCHIVED → 403
- [ ] All writes transactional
- [ ] Server-side timestamps only
- [ ] Response contract conformance
- [ ] Unit tests pass
- [ ] Integration tests pass (no regression)
- [ ] `bun run lint` passes
- [ ] `bun run typecheck` passes
- [ ] Forward-only migration validated

### Test Infrastructure

Tests use `tests/db-manager.ts` for tenant DB provisioning and cleanup.
Tenant isolation tests spin up two separate tenant connections via `db-manager`.
Deletion guard tests inject rows into `exam_configurations` / `auto_selection_rules` (if tables
exist in the test DB) or mock the repository function for the guard check.

---

## File Creation Checklist

### New Files

| Path                                                                              | Description               |
| --------------------------------------------------------------------------------- | ------------------------- |
| `apps/api/src/db/tenant/migrations/20260323_011_mcq_baskets.ts`                   | DB migration              |
| `apps/api/src/db/tenant/schemas/baskets.schema.ts`                                | Drizzle schema            |
| `apps/api/src/db/tenant/schemas/basket-questions.schema.ts`                       | Drizzle schema            |
| `packages/domain-core/src/baskets/baskets.types.ts`                               | Domain types              |
| `packages/domain-core/src/baskets/baskets.errors.ts`                              | Error class + codes       |
| `packages/domain-core/src/baskets/baskets.repository.ts`                          | SQL query functions       |
| `packages/domain-core/src/baskets/baskets.service.ts`                             | Business logic + TX       |
| `packages/domain-core/src/baskets/baskets.dependency-registry.ts`                 | Module registry           |
| `packages/domain-core/src/baskets/index.ts`                                       | Public exports            |
| `packages/domain-core/src/baskets/__tests__/baskets.service.test.ts`              | Unit tests                |
| `packages/validation/src/backoffice/baskets.schemas.ts`                           | Zod schemas               |
| `apps/api/src/routes/backoffice/baskets/helpers.ts`                               | Route helpers             |
| `apps/api/src/routes/backoffice/baskets/create-basket.ts`                         | POST /mcq-baskets         |
| `apps/api/src/routes/backoffice/baskets/list-baskets.ts`                          | GET /mcq-baskets          |
| `apps/api/src/routes/backoffice/baskets/get-basket.ts`                            | GET /mcq-baskets/:id      |
| `apps/api/src/routes/backoffice/baskets/update-basket.ts`                         | PATCH /mcq-baskets/:id    |
| `apps/api/src/routes/backoffice/baskets/delete-basket.ts`                         | DELETE /mcq-baskets/:id   |
| `apps/api/src/routes/backoffice/baskets/transition-basket.ts`                     | POST /workflow/transition |
| `apps/api/src/routes/backoffice/baskets/link-question.ts`                         | POST /questions           |
| `apps/api/src/routes/backoffice/baskets/unlink-question.ts`                       | DELETE /questions/:qid    |
| `apps/api/src/routes/backoffice/baskets/list-questions.ts`                        | GET /questions            |
| `apps/api/src/routes/backoffice/baskets/index.ts`                                 | Router assembly           |
| `apps/api/src/routes/backoffice/baskets/__tests__/baskets.crud.test.ts`           | Integration tests         |
| `apps/api/src/routes/backoffice/baskets/__tests__/baskets.workflow.test.ts`       | Integration tests         |
| `apps/api/src/routes/backoffice/baskets/__tests__/baskets.questions.test.ts`      | Integration tests         |
| `apps/api/src/routes/backoffice/baskets/__tests__/baskets.isolation.test.ts`      | Tenant isolation          |
| `apps/api/src/routes/backoffice/baskets/__tests__/baskets.deletion-guard.test.ts` | Guard tests               |

### Modified Files

| Path                                                   | Change                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| `packages/domain-core/src/workflow/workflow.states.ts` | Add DRAFT state + DRAFT→COMPLETED edge + mcq_basket entity |
| `packages/domain-core/src/workflow/workflow.engine.ts` | Add `mcq_basket: 'mcq_baskets'` to ENTITY_TABLE_MAP        |
| `packages/domain-core/src/index.ts`                    | Export baskets domain module                               |
| `apps/api/src/db/tenant/schemas/index.ts`              | Export baskets + basket-questions schemas                  |
| `apps/api/src/boot/migration-registry.ts`              | Register `20260323_011_mcq_baskets`                        |
| `apps/api/src/routes/backoffice/ws.ts` (or context.ts) | Mount `createBasketsRouter()`                              |
| `packages/validation/src/backoffice/index.ts`          | Export baskets schemas                                     |

---

## Dependency Graph

```
Tenant DB (mcq_baskets, mcq_basket_questions)
    ↑
packages/domain-core/src/baskets/
    baskets.types.ts
    baskets.errors.ts
    baskets.repository.ts  ← uses DbClient (raw SQL, no framework)
    baskets.service.ts     ← uses repository + workflow.engine.executeTransition()
    ↑
packages/validation/src/backoffice/baskets.schemas.ts
    ↑
apps/api/src/routes/backoffice/baskets/
    helpers.ts             ← extracts db/audit/permissions from Hono context
    [handler files]        ← validate → call service → return response
    index.ts               ← router assembly
    ↑
Backoffice workspace router (apps/api/src/routes/backoffice/ws.ts)
```

---

## Out of Scope (Per Spec)

The following are confirmed out of scope for this implementation:

- Bulk basket creation
- Basket versioning
- Frontoffice basket endpoints
- Backward workflow transitions
- Soft-delete
- Basket analytics
- Division-scoped basket visibility
- `TRADITIONAL_QUESTION` basket support
