# Tasks: Categories (Classification Dimensions)

**Feature**: Categories (Classification Dimensions) — Stage 030
**Stage**: `STAGE_30_CATEGORIES`
**Phase**: `03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION`
**Plan**: `specs/runtime/030-categories/plan.md`
**Spec**: `specs/runtime/030-categories/spec.md`
**Data Model**: `specs/runtime/030-categories/data-model.md`
**Research**: `specs/runtime/030-categories/research.md`
**Branch**: `spec/030-categories`
**Schema Version**: `1.13.0 → 1.14.0`
**Generated**: 2026-03-22

---

## Phase 1 — Foundation & Setup

**Goal**: Register new domain module in architecture registry; confirm prerequisite tables and schema version before writing any implementation files.

**Independent test criteria**: `bun scripts/infra-audit.ts` passes with `packages/domain-core/src/categories` registered; no architecture boundary violations detected before implementation begins.

- [x] T001 Register categories domain module via `bun run arch:add-module packages/domain-core/src/categories` — architecture registry
- [x] T002 Inspect `apps/api/src/db/tenant/migrations/` and confirm `subjects`, `divisions`, and `users` tables were created in migrations prior to `20260321_007_lessons.ts` — `apps/api/src/db/tenant/migrations/`
- [x] T003 Confirm current tenant schema version is `1.13.0` by reviewing the `_schema_versions` bump in `20260321_007_lessons.ts` before authoring the new migration — `apps/api/src/db/tenant/migrations/20260321_007_lessons.ts`

---

## Phase 2 — Migration (Tenant DB only)

**Goal**: Forward-only DDL migration creating all three tables, FK constraints, all B-tree indexes, and schema version bump `1.13.0 → 1.14.0`. No `down()` function.

**Independent test criteria**: Running migration against a fresh test tenant creates all three tables with correct FK constraints; `SELECT version FROM _schema_versions` returns `1.14.0`; `unique_categories_name` and `unique_categories_code` indexes are present.

- [x] T004 Create forward-only migration with **Phase A** (inside BEGIN/COMMIT: `CREATE TABLE IF NOT EXISTS categories` with status CHECK constraint; `CREATE TABLE IF NOT EXISTS category_subjects`; `CREATE TABLE IF NOT EXISTS category_divisions`; all FK constraints via `DO $$ IF NOT EXISTS $$` for `categories.parent_id → categories(id) RESTRICT`, `categories.created_by → users(id) SET NULL`, `categories.updated_by → users(id) SET NULL`, `category_subjects.category_id → categories(id) CASCADE`, `category_subjects.subject_id → subjects(id) CASCADE`, `category_divisions.category_id → categories(id) CASCADE`, `category_divisions.division_id → divisions(id) CASCADE`; six B-tree indexes: `idx_categories_parent_id`, `idx_categories_status`, `idx_category_subjects_category_id`, `idx_category_subjects_subject_id`, `idx_category_divisions_category_id`, `idx_category_divisions_division_id`; `UPDATE _schema_versions SET version = '1.14.0'`) and **Phase B** (after COMMIT, outside transaction: `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_categories_name ON categories (LOWER(name))` and `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_categories_code ON categories (LOWER(code)) WHERE code IS NOT NULL`) — `apps/api/src/db/tenant/migrations/20260322_008_categories.ts`

---

## Phase 3 — Drizzle ORM Schema (3 tables)

**Goal**: Drizzle ORM table definitions for `categories`, `category_subjects`, `category_divisions` with B-tree index declarations and inferred TypeScript types. Functional/partial unique indexes and FK constraints are migration-owned per established convention.

**Independent test criteria**: `bun run type-check` passes with new schema imported; Drizzle toolkit sees all three tables; exported inferred types resolve correctly.

- [x] T005 [P] Create Drizzle schema defining `categories` table (10 columns: `id`, `name`, `code`, `description`, `parent_id`, `status`, `created_at`, `updated_at`, `created_by`, `updated_by`; B-tree indexes for `parent_id` and `status`), `categorySubjects` table (3 columns; B-tree indexes for `category_id` and `subject_id`), and `categoryDivisions` table (3 columns; B-tree indexes for `category_id` and `division_id`); export inferred types `Category`, `NewCategory`, `CategorySubject`, `NewCategorySubject`, `CategoryDivision`, `NewCategoryDivision` — `apps/api/src/db/tenant/schemas/categories.schema.ts`
- [x] T006 Add `export * from "./categories.schema"` to tenant schemas barrel — `apps/api/src/db/tenant/schemas/index.ts`

---

## Phase 4 — Domain Package

**Goal**: Pure domain logic for all user stories — types contract, error catalog, repository functions, tree assembler, dependency registry stub, all six service functions, and public index.

**Independent test criteria**: All six service functions callable with a mock `DbClient`; unit tests pass for every service function covering all error branches identified in spec acceptance scenarios.

### Shared Infrastructure

- [x] T007 [P] Create all domain types: `CategoryStatus` (`'ENABLED' | 'DISABLED'`), `CategoryRow`, `ScopedCategoryRow` (extends `CategoryRow` with `subject_ids: string[]` and `division_ids: string[]`), `CategoryTreeNode` (with `children: CategoryTreeNode[]`), `ListCategoriesInput` (with `parent_id_filter: 'uuid' | 'null' | 'none'` discriminator), `ListCategoriesResult`, `CreateCategoryInput`, `UpdateCategoryInput`, `DbClient`, `AuditContext` — `packages/domain-core/src/categories/categories.types.ts`
- [x] T008 [P] Create error catalog: `CategoriesErrorCode` union of 14 codes (`CATEGORY_NOT_FOUND`, `CATEGORY_NAME_DUPLICATE`, `CATEGORY_CODE_DUPLICATE`, `CATEGORY_PARENT_NOT_FOUND`, `CATEGORY_MAX_DEPTH_EXCEEDED`, `CATEGORY_CIRCULAR_REFERENCE`, `CATEGORY_DISABLED`, `CATEGORY_ALREADY_DISABLED`, `CATEGORY_ALREADY_ENABLED`, `CATEGORY_HAS_ENABLED_CHILDREN`, `CATEGORY_HAS_DEPENDENT_CONTENT`, `CATEGORY_SUBJECT_NOT_FOUND`, `CATEGORY_DIVISION_NOT_FOUND`, `VALIDATION_ERROR`), `CategoryError` class, HTTP status map derived from `data-model.md` error registry — `packages/domain-core/src/categories/categories.errors.ts`
- [x] T009 Create all 18 pure SQL repository functions (no transaction ownership): `findCategoryById`, `findCategoryRowForUpdate` (`SELECT id, status, parent_id ... FOR UPDATE NOWAIT`), `findParentRowForUpdate`, `countCategories` (optional `parent_id`, `status`, `search` via ILIKE with parameterized `%search%`), `findCategories` (paginated + same filters), `findScopeForCategories` (bulk `ANY($1::uuid[])` fetch from both scope tables → `Map<categoryId, { subject_ids, division_ids }>`), `findAllEnabledCategories` (optional `rootId`), `insertCategory`, `updateCategoryRow` (explicit SET fields, always sets `updated_at = NOW()`), `deleteSubjectScope`, `insertSubjectScope` (batch), `deleteDivisionScope`, `insertDivisionScope` (batch), `categoryNameExists` (optional `excludeId`), `categoryCodeExists` (optional `excludeId`), `countDirectEnabledChildren`, `subjectsExistBatch`, `divisionsExistBatch` — `packages/domain-core/src/categories/categories.repository.ts`
- [x] T010 [P] Create O(N) in-memory tree assembler: `assembleCategoryTree(rows: CategoryRow[], rootId?: string): CategoryTreeNode[]` — build `Map<id, CategoryTreeNode>`, link children to parents in single pass, collect roots (null `parent_id`), return subtree if `rootId` provided — `packages/domain-core/src/categories/categories.tree.ts`
- [x] T011 [P] Create downstream dependency registry stub: `DependencyCheckFn` type, empty `categoryDependencyRegistry: DependencyCheckFn[]`, `checkCategoryDependencies(db, categoryId): Promise<number>` fan-out via `Promise.all` (pattern matches `lessons.dependency-registry.ts`) — `packages/domain-core/src/categories/categories.dependency-registry.ts`

### Service Functions (user story implementations)

- [x] T012 [US2] Implement `listCategories(db, input)`: build `parent_id_filter` discriminator from input, run COUNT and paginated SELECT in parallel, collect category IDs, bulk-fetch scope via `findScopeForCategories(db, ids)` (two `ANY($1)` queries), merge scope Map onto rows, return `ListCategoriesResult` — `packages/domain-core/src/categories/categories.service.ts`
- [x] T013 [US4] Implement `getCategory(db, id)`: `findCategoryById` → throw `CATEGORY_NOT_FOUND` on null → `findScopeForCategories(db, [id])` → return `ScopedCategoryRow` — `packages/domain-core/src/categories/categories.service.ts`
- [x] T014 [US3] Implement `getCategoriesTree(db, rootId?)`: `findAllEnabledCategories(db)` → `assembleCategoryTree(rows, rootId)` → return `CategoryTreeNode[]` — `packages/domain-core/src/categories/categories.service.ts`
- [x] T015 [US1] Implement `createCategory(db, input, audit)`: transaction (BEGIN/COMMIT/ROLLBACK); when `parent_id` provided lock parent via `findParentRowForUpdate`, traverse ancestor chain ≤3 hops to determine parent depth, throw `CATEGORY_MAX_DEPTH_EXCEEDED` if parent is at depth 3; `categoryNameExists` → `CATEGORY_NAME_DUPLICATE`; `categoryCodeExists` if code provided → `CATEGORY_CODE_DUPLICATE`; `subjectsExistBatch` if `subject_ids` non-empty → `CATEGORY_SUBJECT_NOT_FOUND` on count mismatch; `divisionsExistBatch` if `division_ids` non-empty → `CATEGORY_DIVISION_NOT_FOUND`; `insertCategory`; `insertSubjectScope` if any; `insertDivisionScope` if any; catch PG `23505` → rethrow as `CATEGORY_NAME_DUPLICATE` or `CATEGORY_CODE_DUPLICATE`; post-commit `findScopeForCategories` → return `ScopedCategoryRow` — `packages/domain-core/src/categories/categories.service.ts`
- [x] T016 [US5][US7] Implement `updateCategory(db, id, input, audit)`: transaction; `findCategoryRowForUpdate(db, id)` → `CATEGORY_NOT_FOUND`; if non-status fields present and category `DISABLED` → `CATEGORY_DISABLED`; if status in payload: `ALREADY_DISABLED` / `ALREADY_ENABLED` guard, if disabling run `countDirectEnabledChildren` → `CATEGORY_HAS_ENABLED_CHILDREN`; if `parent_id` in payload: circular ref traversal (3 hops, throw `CATEGORY_CIRCULAR_REFERENCE` if `ancestor.id === id`), depth check (`parent_depth + 1 + deepest_descendant_depth > 3` → `CATEGORY_MAX_DEPTH_EXCEEDED`); `categoryNameExists(db, name, id)` → `CATEGORY_NAME_DUPLICATE`; `categoryCodeExists` → `CATEGORY_CODE_DUPLICATE`; `subjectsExistBatch` → `CATEGORY_SUBJECT_NOT_FOUND`; `divisionsExistBatch` → `CATEGORY_DIVISION_NOT_FOUND`; `updateCategoryRow`; scope replace using `'subject_ids' in input` key-presence check (DELETE then INSERT, `[]` clears all); catch PG `23505`; return fresh `ScopedCategoryRow` — `packages/domain-core/src/categories/categories.service.ts`
- [x] T017 [US6] Implement `deleteCategory(db, id, audit)`: transaction; `findCategoryRowForUpdate(db, id)` → `CATEGORY_NOT_FOUND`; `status === 'DISABLED'` → `CATEGORY_ALREADY_DISABLED`; `countDirectEnabledChildren(db, id) > 0` → `CATEGORY_HAS_ENABLED_CHILDREN`; `updateCategoryRow(db, id, { status: 'DISABLED' }, audit)`; return `{ deleted: true }` — `packages/domain-core/src/categories/categories.service.ts`
- [x] T018 Create public barrel re-exporting all types, error codes, error class, and all six service functions — `packages/domain-core/src/categories/index.ts`

---

## Phase 5 — Validation Schemas (Zod)

**Goal**: Zod schemas for all query params, path params, and request bodies matching `data-model.md` field constraints.

**Independent test criteria**: `z.parse()` succeeds on valid inputs; rejects invalid UUIDs, page/limit out of range, and empty update body (`.refine` triggers).

- [x] T019 [P] Create five Zod schemas: `listCategoriesQuerySchema` (`parent_id`: UUID string or literal `'null'`; `status`: `ENABLED | DISABLED` enum; `search` max-100; `page`/`limit` string→int transforms with defaults 1/20, `limit` max 100), `categoriesTreeQuerySchema` (`root_id` optional UUID), `categoryParamsSchema` (`id` UUID with message), `createCategoryBodySchema` (`name` min-1 max-255; nullable optional `code` max-100, `description`, `parent_id` UUID; optional `subject_ids`/`division_ids` UUID arrays), `updateCategoryBodySchema` (all fields optional, nullable `code`/`description`/`parent_id`, optional `status` enum, optional scope arrays, `.refine` requiring at least one key) — `packages/validation/src/backoffice/categories.schemas.ts`
- [x] T020 Export new schemas from validation package backoffice barrel — `packages/validation/src/backoffice/index.ts`

---

## Phase 6 — API Routes (router factory + 6 handlers)

**Goal**: Complete HTTP layer with tenant resolver middleware, license middleware, RBAC permission guard, Zod validation, and service delegation for all user stories.

**Independent test criteria**: All 6 route handlers return correct HTTP status codes with valid requests; 403 returned without `question_manage` or `classification_manage` permission; 401 returned for unauthenticated requests.

### Shared Helpers

- [x] T021 [P] Create route helpers: `getDb(c)` extracting tenant pool from Hono context (`c.get('tenant').pool`), `buildAuditCtx(c)` extracting `user_id`, `correlation_id`, `workspace_slug`, `workspace_id`; standard `ok(data)` and `fail(code, status, message)` response builders (pattern matches lessons helpers) — `apps/api/src/routes/backoffice/categories/helpers.ts`

### Read Handlers (parallelizable)

- [x] T022 [P] [US2] Implement list handler: parse query with `listCategoriesQuerySchema`, map `parent_id` query string to `parent_id_filter` discriminator (`'null'` string → `'null'`, valid UUID → `'uuid'`, absent → `'none'`), call `listCategories(db, input)`, return paginated `{ items, total, page, limit }` — `apps/api/src/routes/backoffice/categories/list-categories.ts`
- [x] T023 [P] [US3] Implement tree handler: parse query with `categoriesTreeQuerySchema`, call `getCategoriesTree(db, root_id)`, return `CategoryTreeNode[]` — `apps/api/src/routes/backoffice/categories/get-categories-tree.ts`
- [x] T024 [P] [US4] Implement get-by-id handler: parse params with `categoryParamsSchema`, call `getCategory(db, id)`, map `CATEGORY_NOT_FOUND` → 404, return `ScopedCategoryRow` — `apps/api/src/routes/backoffice/categories/get-category.ts`

### Write Handlers (parallelizable with each other)

- [x] T025 [P] [US1] Implement create handler: apply `requireAnyPermission(['question_manage', 'classification_manage'])`, parse body with `createCategoryBodySchema`, call `createCategory(db, body, audit)`, map all domain errors to HTTP via error catalog, return 201 with `ScopedCategoryRow` — `apps/api/src/routes/backoffice/categories/create-category.ts`
- [x] T026 [P] [US5][US7] Implement update handler: apply `requireAnyPermission(['question_manage', 'classification_manage'])`, parse params with `categoryParamsSchema` + body with `updateCategoryBodySchema`, call `updateCategory(db, id, body, audit)`, map all domain errors (including `CATEGORY_CIRCULAR_REFERENCE` → 422, `CATEGORY_DISABLED` → 422, `CATEGORY_ALREADY_ENABLED` → 422), return updated `ScopedCategoryRow` — `apps/api/src/routes/backoffice/categories/update-category.ts`
- [x] T027 [P] [US6] Implement delete handler: apply `requireAnyPermission(['question_manage', 'classification_manage'])`, parse params with `categoryParamsSchema`, call `deleteCategory(db, id, audit)`, map `CATEGORY_ALREADY_DISABLED` → 422 and `CATEGORY_HAS_ENABLED_CHILDREN` → 422, return `{ deleted: true }` — `apps/api/src/routes/backoffice/categories/delete-category.ts`

### Router Factory

- [x] T028 Create Hono router factory applying tenant resolver middleware, license middleware, and schema version middleware (`MIN_SCHEMA_VERSION = '1.14.0'`) to all routes; confirm platform-level rate-limiting middleware (30 req/min writes, 120 req/min reads) is inherited from the outer backoffice app — no per-router registration needed; mount handlers: `GET /` (list), `POST /` (create), `GET /tree` (tree — registered before `/:id` to avoid param shadowing), `GET /:id` (get), `PATCH /:id` (update), `DELETE /:id` (delete); export factory function — `apps/api/src/routes/backoffice/categories/index.ts`

---

## Phase 7 — Tests (Unit + Integration)

**Goal**: Full coverage of all service error branches (unit) and all HTTP request/response scenarios including tenant isolation and RBAC (integration).

**Independent test criteria**: `bun vitest run packages/domain-core/src/categories` and `bun vitest run apps/api/src/routes/backoffice/categories` both pass with zero failures.

- [x] T029 [P] [US1][US2][US3][US4][US5][US6][US7] Create unit test suite covering: `createCategory` — parent depth 3 triggers `CATEGORY_MAX_DEPTH_EXCEEDED`, name uniqueness check triggers `CATEGORY_NAME_DUPLICATE`, code uniqueness check triggers `CATEGORY_CODE_DUPLICATE`, missing `parent_id` triggers `CATEGORY_PARENT_NOT_FOUND`, missing subject triggers `CATEGORY_SUBJECT_NOT_FOUND`, missing division triggers `CATEGORY_DIVISION_NOT_FOUND`, PG `23505` remapped, success path returns `ScopedCategoryRow`; `listCategories` — `parent_id_filter: 'null'` roots-only, `'uuid'` children-only, `'none'` all, scope merged via Map, pagination math; `getCategory` — found returns scoped row, not-found throws `CATEGORY_NOT_FOUND`; `getCategoriesTree` — empty tenant returns `[]`, nested returns tree, `rootId` returns subtree; `updateCategory` — circular ref detected, max depth exceeded on re-parent, `CATEGORY_DISABLED` guard, `CATEGORY_ALREADY_DISABLED`, `CATEGORY_ALREADY_ENABLED`, `CATEGORY_HAS_ENABLED_CHILDREN`, scope replace with `[]` clears all, `'subject_ids' in input` key-presence guard; `deleteCategory` — `CATEGORY_ALREADY_DISABLED`, `CATEGORY_HAS_ENABLED_CHILDREN`, success returns `{ deleted: true }` — `packages/domain-core/src/categories/__tests__/categories.service.test.ts`
- [x] T030 [P] [US1][US2][US3][US4][US5][US6][US7] Create integration test suite covering: all success paths (201 create with scope, 200 list paginated, 200 tree nested, 200 get scoped, 200 update, 200 soft-delete); all 422 paths (`CATEGORY_MAX_DEPTH_EXCEEDED`, `CATEGORY_CIRCULAR_REFERENCE`, `CATEGORY_DISABLED`, `CATEGORY_ALREADY_DISABLED`, `CATEGORY_ALREADY_ENABLED`, `CATEGORY_HAS_ENABLED_CHILDREN`, `VALIDATION_ERROR` on empty update body); all 409 paths (`CATEGORY_NAME_DUPLICATE`, `CATEGORY_CODE_DUPLICATE`); all 404 paths (`CATEGORY_NOT_FOUND`, `CATEGORY_PARENT_NOT_FOUND`, `CATEGORY_SUBJECT_NOT_FOUND`, `CATEGORY_DIVISION_NOT_FOUND`); 403 RBAC rejection (staff without `question_manage` AND without `classification_manage`); license enforcement (423 on `SOFT_LOCKED`, 403 on `ARCHIVED`); schema version mismatch (409 `SCHEMA_VERSION_MISMATCH`); tenant isolation (`GET /categories/:id` with another tenant's ID returns 404, not 403); `parent_id=null` query string returns only root categories; rate limit enforcement (write endpoint returns 429 `RATE_LIMIT_EXCEEDED` after exceeding 30 req/min per workspace) — `apps/api/src/routes/backoffice/categories/__tests__/categories.integration.test.ts`

---

## Phase 8 — Router Registration

**Goal**: Mount categories router into the main Hono application at the correct backoffice workspace route prefix.

**Independent test criteria**: `GET /workspaces/:slug/categories` returns 200 or 401/403 (not 404) confirming the route is registered in the app routing table.

- [x] T031 Import categories router factory and mount at the workspace backoffice prefix, following the same pattern as subjects and lessons routers — `apps/api/src/app.ts`

---

## Phase 9 — Seed: `classification_manage` Permission

**Goal**: Ensure `classification_manage` permission exists in the master DB seed so it can be assigned to Backoffice staff roles.

**Independent test criteria**: Seed script runs to completion without error; `SELECT name FROM permissions WHERE name = 'classification_manage'` returns exactly one row.

- [x] T032 Add `classification_manage` permission to the permissions seed data, inserted alongside `question_manage` and other content-management permissions in the master DB seed — `apps/api/src/db/master/seed/permissions.ts`

---

## Final Phase — Polish & Cross-Cutting Concerns

- [x] T033 [P] Run architecture and infra validation: `bun scripts/ai-guard.ts && bun scripts/infra-audit.ts` — resolve all import boundary violations and module registration gaps before merge — `scripts/`
- [x] T034 [P] Run quality gates: `bun run lint && bun run type-check` — resolve all lint errors and TypeScript errors introduced by new files — monorepo root
- [x] T035 Manually verify in `20260322_008_categories.ts` that `CREATE UNIQUE INDEX CONCURRENTLY` calls appear **after** the `COMMIT` call and that no concurrent index creation exists inside the `BEGIN` block — `apps/api/src/db/tenant/migrations/20260322_008_categories.ts`

---

## Dependencies

```
T001 ──► T002 ──► T003
                    │
                    ▼
                  T004 (migration — needs confirmed base schema version)
                    │
                    ▼
                  T005 [P] ──► T006
                                │
              ┌─────────────────┘
              ▼
   T007[P] T008[P] T010[P] T011[P]   ← parallel shared domain files
              │
              ▼
            T009 (repository — needs types + errors)
              │
              ▼
   T012 → T013 → T014 → T015 → T016 → T017  ← sequential, same file
              │
              ▼
            T018 (index.ts)
              │
         ┌────┴──────┐
         ▼           ▼
       T019[P]     T021[P]   ← validation schemas + helpers (parallel)
         │
         ▼
       T020 (validation barrel)
              │
         ┌────┴──────────────────────────────────────────┐
         ▼    ▼    ▼    ▼    ▼    ▼                      │
       T022[P] T023[P] T024[P] T025[P] T026[P] T027[P]  │
         └──────────────────────┬────────────────────────┘
                                ▼
                              T028 (router factory — needs all handlers)
                                │
                    ┌───────────┼──────────┐
                    ▼           ▼          ▼
                  T029[P]    T030[P]     T031
                  (unit)   (integration) (app.ts)
                    │
                    ▼
                  T032 (seed — independent, same stage)
                    │
              ┌─────┤
              ▼     ▼
           T033[P] T034[P]
              │
              ▼
            T035
```

### Story completion order

| Story          | Shortest path to independent testability          |
| -------------- | ------------------------------------------------- |
| US-2 List      | T001–T018 → T019–T020 → T021 → T022 → T028 → T031 |
| US-4 Get       | T001–T018 → T019–T020 → T021 → T024 → T028 → T031 |
| US-3 Tree      | T001–T018 → T019–T020 → T021 → T023 → T028 → T031 |
| US-1 Create    | T001–T018 → T019–T020 → T021 → T025 → T028 → T031 |
| US-5 Update    | T001–T018 → T019–T020 → T021 → T026 → T028 → T031 |
| US-7 Re-enable | Same as US-5 (handled by T026)                    |
| US-6 Disable   | T001–T018 → T019–T020 → T021 → T027 → T028 → T031 |

---

## Parallel Execution Batches

### Batch A — After T006 (schema barrel updated)

```
T007 [P]  categories.types.ts
T008 [P]  categories.errors.ts
T010 [P]  categories.tree.ts
T011 [P]  categories.dependency-registry.ts
```

### Batch B — After T009 (repository complete)

```
T012      listCategories     [US2]       ─┐
T013      getCategory        [US4]        │  sequential,
T014      getCategoriesTree  [US3]        │  same file
T015      createCategory     [US1]        │
T016      updateCategory     [US5][US7]   │
T017      deleteCategory     [US6]       ─┘
```

### Batch C — After T018 (domain index complete)

```
T019 [P]  categories.schemas.ts    (Zod validation)
T021 [P]  helpers.ts               (route helpers)
```

### Batch D — After T019 + T020 + T021

```
T022 [P]  list-categories.ts       [US2]
T023 [P]  get-categories-tree.ts   [US3]
T024 [P]  get-category.ts          [US4]
T025 [P]  create-category.ts       [US1]
T026 [P]  update-category.ts       [US5][US7]
T027 [P]  delete-category.ts       [US6]
```

### Batch E — After T028 (router factory complete)

```
T029 [P]  categories.service.test.ts       (unit tests)
T030 [P]  categories.integration.test.ts   (integration tests)
```

### Batch F — After T031 + T032

```
T033 [P]  ai-guard + infra-audit
T034 [P]  lint + type-check
```

---

## Implementation Strategy

**MVP scope (US-1 + US-2 + US-4)**: Create, list, and get single category. Validates the complete vertical stack — migration → schema → types/errors/repository → service → validation → handler → router → app.ts — with the smallest feature surface.

**Incremental delivery order:**

1. **Iteration 1 — MVP**: T001–T018 (all shared domain) + T019–T024 (validation + 3 read handlers + create) + T028 + T031 — covers US-1, US-2, US-4
2. **Iteration 2 — Lifecycle writes**: T027 (US-6 delete — simplest write) → independently testable soft-delete
3. **Iteration 3 — Complex update**: T026 (US-5/US-7 update — circular ref + depth check logic)
4. **Iteration 4 — Tree view**: T023 (US-3 tree) — adds tree endpoint using already-complete `assembleCategoryTree`
5. **Finalization**: T029–T030 (tests) + T032 (seed) + T033–T035 (validation pipeline)

---

## Summary

| Metric                            | Value                            |
| --------------------------------- | -------------------------------- |
| **Total tasks**                   | **35**                           |
| P1 user stories                   | 5 (US-1, US-2, US-4, US-5, US-6) |
| P2 user stories                   | 2 (US-3, US-7)                   |
| Tasks with `[P]` (parallelizable) | 17                               |
| MVP scope                         | US-1 + US-2 + US-4               |
| New files created                 | 20                               |
| Existing files modified           | 4                                |
| Migration files                   | 1                                |
| Test files                        | 2                                |

### New Files (20)

| #   | File                                                                                 |
| --- | ------------------------------------------------------------------------------------ |
| 1   | `apps/api/src/db/tenant/migrations/20260322_008_categories.ts`                       |
| 2   | `apps/api/src/db/tenant/schemas/categories.schema.ts`                                |
| 3   | `packages/domain-core/src/categories/categories.types.ts`                            |
| 4   | `packages/domain-core/src/categories/categories.errors.ts`                           |
| 5   | `packages/domain-core/src/categories/categories.repository.ts`                       |
| 6   | `packages/domain-core/src/categories/categories.tree.ts`                             |
| 7   | `packages/domain-core/src/categories/categories.dependency-registry.ts`              |
| 8   | `packages/domain-core/src/categories/categories.service.ts`                          |
| 9   | `packages/domain-core/src/categories/index.ts`                                       |
| 10  | `packages/validation/src/backoffice/categories.schemas.ts`                           |
| 11  | `apps/api/src/routes/backoffice/categories/helpers.ts`                               |
| 12  | `apps/api/src/routes/backoffice/categories/list-categories.ts`                       |
| 13  | `apps/api/src/routes/backoffice/categories/create-category.ts`                       |
| 14  | `apps/api/src/routes/backoffice/categories/get-categories-tree.ts`                   |
| 15  | `apps/api/src/routes/backoffice/categories/get-category.ts`                          |
| 16  | `apps/api/src/routes/backoffice/categories/update-category.ts`                       |
| 17  | `apps/api/src/routes/backoffice/categories/delete-category.ts`                       |
| 18  | `apps/api/src/routes/backoffice/categories/index.ts`                                 |
| 19  | `packages/domain-core/src/categories/__tests__/categories.service.test.ts`           |
| 20  | `apps/api/src/routes/backoffice/categories/__tests__/categories.integration.test.ts` |

### Modified Files (4)

| #   | File                                          | Change                                    |
| --- | --------------------------------------------- | ----------------------------------------- |
| 1   | `apps/api/src/db/tenant/schemas/index.ts`     | Add `export * from "./categories.schema"` |
| 2   | `packages/validation/src/backoffice/index.ts` | Add categories schemas export             |
| 3   | `apps/api/src/app.ts`                         | Register categories router                |
| 4   | `apps/api/src/db/master/seed/permissions.ts`  | Add `classification_manage` permission    |
