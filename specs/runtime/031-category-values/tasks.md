# Tasks — Category Values

**Stage:** Category Values (STAGE_31_CATEGORY_VALUES)
**Total Tasks:** 25
**Generated:** 2026-03-22T14:35:00.000Z

---

## Phase 0 — Database Migration

- [x] T001 Create forward-only tenant DB migration with all DDL: `category_values`, `category_value_subjects`, `category_value_divisions` tables; all FK constraints wrapped in `DO $$ BEGIN IF NOT EXISTS … END $$`; 8 B-tree indexes inside `BEGIN/COMMIT`; schema version bump to `1.15.0` inside transaction; `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_category_values_code ON category_values (category_id, LOWER(code)) WHERE deleted_at IS NULL` after `COMMIT` (outside transaction block) → `apps/api/src/db/tenant/migrations/20260322_009_category_values.ts`

---

## Phase 1 — Drizzle ORM Schema

- [x] T002 [P] Create Drizzle table definition for `category_values`: `id` (uuid, primaryKey, default `gen_random_uuid()`), `category_id` (uuid, notNull, FK ref categories), `code` (varchar 100, notNull), `status` (varchar 20, notNull, default `COMPLETED`, with CHECK enum), `created_at`, `updated_at` (timestamptz, notNull, default now), `created_by`, `updated_by` (uuid, nullable), `deleted_at` (timestamptz, nullable); export `CategoryValueInsert` and `CategoryValueSelect` inference types → `apps/api/src/db/tenant/schemas/category-values.schema.ts`

- [x] T003 [P] Create Drizzle table definition for `category_value_subjects`: `id` (uuid, primaryKey), `category_value_id` (uuid, notNull, FK ref category_values ON DELETE CASCADE), `subject_id` (uuid, notNull, FK ref subjects ON DELETE CASCADE), composite unique constraint `(category_value_id, subject_id)`; export `CategoryValueSubjectInsert` and `CategoryValueSubjectSelect` inference types → `apps/api/src/db/tenant/schemas/category-value-subjects.schema.ts`

- [x] T004 [P] Create Drizzle table definition for `category_value_divisions`: `id` (uuid, primaryKey), `category_value_id` (uuid, notNull, FK ref category_values ON DELETE CASCADE), `division_id` (uuid, notNull, FK ref divisions ON DELETE CASCADE), composite unique constraint `(category_value_id, division_id)`; export `CategoryValueDivisionInsert` and `CategoryValueDivisionSelect` inference types → `apps/api/src/db/tenant/schemas/category-value-divisions.schema.ts`

- [x] T005 Add `export * from "./category-values.schema"`, `export * from "./category-value-subjects.schema"`, and `export * from "./category-value-divisions.schema"` to the tenant schema barrel → `apps/api/src/db/tenant/schemas/index.ts`

---

## Phase 2 — Error Catalog

- [x] T006 Create all TypeScript types and interfaces for the domain: `CategoryValueStatus` union (`COMPLETED | UNDER_REVIEW | APPROVED | ENABLED | DISABLED`), `AuditContext`, `TranslationInput`, `TranslationRow`, `CategoryValueRow`, `ScopedCategoryValueRow`, `FullCategoryValueRow`, `ListCategoryValuesInput`, `ListCategoryValuesResult`, `CreateCategoryValueInput`, `UpdateCategoryValueInput`, `WorkspaceLanguageConfig`, `DbClient` duck-type interface → `packages/domain-core/src/category-values/category-values.types.ts`

- [x] T007 Create `CategoryValueErrorCode` union type (15 codes: `FORBIDDEN`, `CATEGORY_VALUE_NOT_FOUND`, `CATEGORY_VALUE_SUBJECT_NOT_FOUND`, `CATEGORY_VALUE_DIVISION_NOT_FOUND`, `CATEGORY_NOT_FOUND`, `CATEGORY_VALUE_CODE_DUPLICATE`, `CATEGORY_VALUE_LOCK_CONFLICT`, `CATEGORY_VALUE_IN_USE`, `CATEGORY_VALUE_CATEGORY_IMMUTABLE`, `CATEGORY_VALUE_NAME_REQUIRED`, `CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT`, `CATEGORY_DISABLED`, `INVALID_STATUS_TRANSITION`, `UNSUPPORTED_LANGUAGE`, `VALIDATION_ERROR`); `CATEGORY_VALUE_ERROR_HTTP_STATUS` lookup map (403/404/409/422 per code); `CategoryValueError extends Error` class with `code: CategoryValueErrorCode` and `httpStatus: number` → `packages/domain-core/src/category-values/category-values.errors.ts`

---

## Phase 3 — Repository Layer

- [x] T008 Create all 22 pure SQL repository functions (all parameterized — never string-interpolated; no transactions opened here): `findCategoryValueById`, `findCategoryValueForUpdate` (SELECT FOR UPDATE NOWAIT), `findCategoryById` (status + scope), `countCategoryValues` (with optional search via translated name ILIKE), `findCategoryValues` (paginated SELECT with translation LEFT JOIN, search as parameterized `$pattern`), `findScopeForValues` (batch ANY($1::uuid[]) from both scope tables), `findTranslationsForValues` (batch ANY($1::uuid[]) from translations where entity*type = 'CATEGORY_VALUE'), `insertCategoryValue` (status hardcoded COMPLETED, RETURNING *), `updateCategoryValueRow` (SET … updated*at = NOW(), RETURNING *), `softDeleteCategoryValue` (SET deleted_at = NOW()), `deleteValueSubjectScope`, `insertValueSubjectScope` (batch INSERT), `deleteValueDivisionScope`, `insertValueDivisionScope` (batch INSERT), `categoryValueCodeExists` (LOWER(code) uniqueness, optional excludeId), `subjectsExistBatch` (SELECT id WHERE id = ANY), `divisionsExistBatch`, `findCategorySubjectScope` (returns Set<string>), `findCategoryDivisionScope` (returns Set<string>), `upsertTranslations` (ON CONFLICT translations_composite_unique DO UPDATE), `findWorkspaceLanguageConfig` (reads workspace_settings.settings JSONB default_language + supported_languages) → `packages/domain-core/src/category-values/category-values.repository.ts`

---

## Phase 4 — Service Layer

- [x] T009 Create `DependencyCheckFn` type, empty `categoryValueDependencyRegistry: DependencyCheckFn[]` array, and async `checkValueDependencies(db, valueId)` function that fans out to all registered check functions via `Promise.all` and returns total ref count (initially 0 for this stage; downstream MCQ/TQ stages push check functions at startup) → `packages/domain-core/src/category-values/category-values.dependency-registry.ts`

- [x] T010 Create all 6 service functions with full transaction discipline: `listCategoryValues` (read-only; FORBIDDEN if `include_deleted=true` and caller lacks `classification_manage`; parallel COUNT + paginated SELECT; batch scope + translation merge); `getCategoryValue` (read-only; parallel scope + translations + category summary fetch; 404 on soft-deleted); `createCategoryValue` (TX: category exists + ENABLED check; language config + default-lang name check; code uniqueness; subject/division existence + parent scope containment; INSERT + upsert translations + insert scope; catch PG 23505 → CODE_DUPLICATE); `updateCategoryValue` (TX: FOR UPDATE NOWAIT; reject category_id in body as CATEGORY_VALUE_CATEGORY_IMMUTABLE; validate status transition; code uniqueness; scope validation; UPDATE row + upsert translations + full-replace scope); `deleteCategoryValue` (TX: FOR UPDATE NOWAIT; already-deleted → early return `{ deleted: true }` — idempotent; dependency check; softDelete); `validateStatusTransition` (pure function; static ALLOWED_TRANSITIONS map: COMPLETED→UNDER_REVIEW; UNDER_REVIEW→APPROVED; APPROVED→ENABLED,DISABLED; ENABLED→DISABLED; DISABLED→ENABLED; else INVALID_STATUS_TRANSITION) → `packages/domain-core/src/category-values/category-values.service.ts`

- [x] T011 Create module barrel exporting all public surface: types from `category-values.types.ts`, error class + code union from `category-values.errors.ts`, all repository functions, all service functions, and `categoryValueDependencyRegistry` + `checkValueDependencies` from the dependency registry; no internal helper exports → `packages/domain-core/src/category-values/index.ts`

- [x] T012 Add `export * from "./category-values"` to the domain-core package index so the new module is reachable from the package root → `packages/domain-core/src/index.ts`

---

## Phase 5 — Zod Validation Schemas

- [x] T013 Create 5 Zod schemas: `listCategoryValuesQuerySchema` (`category_id` uuid required; optional `status` enum; optional `search` max 100 chars; optional `language` min 2 max 10; `page` coerce int min 1 default 1; `limit` coerce int min 1 max 100 default 20; `include_deleted` boolean optional default false); `createCategoryValueBodySchema` (`category_id` uuid required; `code` string min 1 max 100 trim; `translations` array nonempty with `language_code`, `name` min 1 max 500, optional `description` max 2000; optional `subject_ids` uuid array; optional `division_ids` uuid array); `getCategoryValueParamsSchema` (`id` uuid); `updateCategoryValueBodySchema` (all fields optional; `status` enum; at-least-one-field `.refine`; category_id field absent — reject it if present); `deleteCategoryValueParamsSchema` (`id` uuid) → `packages/validation/src/backoffice/category-values.schemas.ts`

---

## Phase 6 — Handler Layer

- [x] T014 Create handler utilities mirroring `apps/api/src/routes/backoffice/categories/helpers.ts`: `getDb(c)` returning `c.get('tenant').pool`; `buildAuditCtx(c)` extracting `user_id`, `correlation_id`, `workspace_slug`, `workspace_id`, and `caller_permissions` (from `c.get('permissions') ?? []`); `successResponse<T>(data)` returning `{ success: true, data, error: null }`; `categoryValuesErrorResponse(c, err)` mapping `CategoryValueError` to HTTP status via `CATEGORY_VALUE_ERROR_HTTP_STATUS` with `logger.warn` on domain errors and `logger.error` on unexpected errors; logger namespace pattern `category-values-route:{handler-name}` → `apps/api/src/routes/backoffice/category-values/helpers.ts`

- [x] T015 [P] [US2] Create `listCategoryValuesHandler`: parse query with `listCategoryValuesQuerySchema` (422 on failure); call `getDb(c)` and `buildAuditCtx(c)`; delegate to `listCategoryValues(db, input, audit)`; return 200 `successResponse`; catch `CategoryValueError` → `categoryValuesErrorResponse`; catch unexpected → `logger.error` + 500 → `apps/api/src/routes/backoffice/category-values/list-category-values.ts`

- [x] T016 [P] [US1] Create `createCategoryValueHandler`: parse body with `createCategoryValueBodySchema` (422 on failure); call `getDb(c)` and `buildAuditCtx(c)`; delegate to `createCategoryValue(db, input, audit)`; return 201 `successResponse`; catch `CategoryValueError` → `categoryValuesErrorResponse`; catch unexpected → `logger.error` + 500 → `apps/api/src/routes/backoffice/category-values/create-category-value.ts`

- [x] T017 [P] [US3] Create `getCategoryValueHandler`: parse path param with `getCategoryValueParamsSchema` (422 on invalid UUID); call `getDb(c)` and `buildAuditCtx(c)`; delegate to `getCategoryValue(db, id)`; return 200 `successResponse`; catch `CategoryValueError` → `categoryValuesErrorResponse`; catch unexpected → `logger.error` + 500 → `apps/api/src/routes/backoffice/category-values/get-category-value.ts`

- [x] T018 [P] [US4] Create `updateCategoryValueHandler`: parse path param with `getCategoryValueParamsSchema` and body with `updateCategoryValueBodySchema` (422 on failure); call `getDb(c)` and `buildAuditCtx(c)`; delegate to `updateCategoryValue(db, id, input, audit)`; return 200 `successResponse`; catch `CategoryValueError` → `categoryValuesErrorResponse`; catch unexpected → `logger.error` + 500 → `apps/api/src/routes/backoffice/category-values/update-category-value.ts`

- [x] T019 [P] [US5] Create `deleteCategoryValueHandler`: parse path param with `deleteCategoryValueParamsSchema` (422 on invalid UUID); call `getDb(c)` and `buildAuditCtx(c)`; delegate to `deleteCategoryValue(db, id, audit)`; return 200 `successResponse({ deleted: true })`; catch `CategoryValueError` → `categoryValuesErrorResponse`; catch unexpected → `logger.error` + 500 → `apps/api/src/routes/backoffice/category-values/delete-category-value.ts`

---

## Phase 7 — Router + Registration

- [x] T020 Create `createCategoryValuesRouter()` factory returning a `Hono<BackofficeEnv>` router with explicit route ordering (static `/category-values` before parameterised `/category-values/:id`): `GET /category-values` → `listCategoryValuesHandler`; `POST /category-values` → `writeGuard, createCategoryValueHandler`; `GET /category-values/:id` → `getCategoryValueHandler`; `PATCH /category-values/:id` → `writeGuard, updateCategoryValueHandler`; `DELETE /category-values/:id` → `writeGuard, deleteCategoryValueHandler`; `writeGuard = requireAnyPermission(['question_manage', 'classification_manage'])` → `apps/api/src/routes/backoffice/category-values/index.ts`

- [x] T021 Import `createCategoryValuesRouter` and mount via `app.route("/", createCategoryValuesRouter())` in the backoffice route barrel, following the existing `createCategoriesRouter` registration pattern → `apps/api/src/routes/backoffice/index.ts`

---

## Phase 8 — Unit Tests

- [x] T022 [P] Create service-layer unit tests covering: `listCategoryValues` — pagination math, include_deleted=true blocked for non-classification_manage caller (FORBIDDEN 403), include_deleted=true allowed for classification_manage caller, CATEGORY_NOT_FOUND when category_id is absent; `getCategoryValue` — returns FullCategoryValueRow with translations + scope + category summary, 404 on missing ID, 404 on soft-deleted ID; `createCategoryValue` — happy path returns ScopedCategoryValueRow with status=COMPLETED, CATEGORY_NOT_FOUND, CATEGORY_DISABLED, CATEGORY_VALUE_CODE_DUPLICATE, CATEGORY_VALUE_NAME_REQUIRED (no default-lang translation), UNSUPPORTED_LANGUAGE, CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT (subjects), CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT (divisions), CATEGORY_VALUE_SUBJECT_NOT_FOUND, CATEGORY_VALUE_DIVISION_NOT_FOUND; `updateCategoryValue` — CATEGORY_VALUE_CATEGORY_IMMUTABLE when category_id in body, all 6 INVALID_STATUS_TRANSITION rejection cases, valid transitions accepted, CATEGORY_VALUE_LOCK_CONFLICT on PG 55P03; `deleteCategoryValue` — happy path `{ deleted: true }`, already-deleted returns `{ deleted: true }` without error (idempotent), CATEGORY_VALUE_IN_USE when dependency count > 0, CATEGORY_VALUE_LOCK_CONFLICT on PG 55P03; `validateStatusTransition` — all 6 allowed transitions pass, 10 invalid transition combinations throw INVALID_STATUS_TRANSITION → `packages/domain-core/src/category-values/__tests__/category-values.service.test.ts`

- [x] T023 [P] Create repository unit tests covering: `findCategoryValues` search — verifies `search` value is passed as parameterised `$N` placeholder and never interpolated into SQL string; `findScopeForValues` — verifies `ANY($1::uuid[])` batch shape when multiple IDs provided; `findTranslationsForValues` — verifies `entity_type = 'CATEGORY_VALUE'` constant and `ANY($1::uuid[])` batch parameter; `upsertTranslations` — verifies conflict target is `translations_composite_unique` and SET clause updates `translated_value`; `categoryValueCodeExists` with `excludeId` — verifies exclusion clause present in parameterised query → `packages/domain-core/src/category-values/__tests__/category-values.repository.test.ts`

---

## Phase 9 — Integration Tests

- [x] T024 Create integration tests covering all 5 endpoints and cross-cutting concerns: **List** — 200 with pagination metadata for valid category_id; 404 CATEGORY_NOT_FOUND for unknown category_id; 422 VALIDATION_ERROR for missing category_id; 422 for page=0; soft-deleted values excluded from default list; 403 FORBIDDEN when include_deleted=true without classification_manage; soft-deleted values visible when include_deleted=true with classification_manage; status filter returns only matching status; **Create** — 201 with status=COMPLETED and all translations; 404 CATEGORY_NOT_FOUND; 422 CATEGORY_DISABLED; 409 CATEGORY_VALUE_CODE_DUPLICATE (case-insensitive); 422 CATEGORY_VALUE_NAME_REQUIRED; 422 UNSUPPORTED_LANGUAGE; 422 CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT (subjects); 403 FORBIDDEN without permission; **Get** — 200 with full translations + scope + category summary; 404 CATEGORY_VALUE_NOT_FOUND for unknown ID; 404 for soft-deleted value; 422 VALIDATION_ERROR for non-UUID id; **Update** — 200 with updated fields; 422 CATEGORY_VALUE_CATEGORY_IMMUTABLE if category_id in body; 422 INVALID_STATUS_TRANSITION; 409 CATEGORY_VALUE_CODE_DUPLICATE; 403 FORBIDDEN without write permission; 409 CATEGORY_VALUE_LOCK_CONFLICT scenario; **Delete** — 200 `{ deleted: true }`; second DELETE on same ID returns 200 `{ deleted: true }` (idempotent); 422 CATEGORY_VALUE_IN_USE; 404 for non-existent ID; 403 FORBIDDEN without write permission; **Multi-tenant isolation** — category value created in tenant A returns 404 when queried from tenant B's workspace → `apps/api/src/routes/backoffice/category-values/__tests__/category-values.integration.test.ts`

---

## Phase 10 — Migration Validation

- [x] T025 Validate tenant DB migration by applying `20260322_009_category_values.ts` against a test database and asserting: (1) `schema_version` in `workspace_settings` settings JSONB equals `"1.15.0"`; (2) tables `category_values`, `category_value_subjects`, and `category_value_divisions` exist with correct column definitions; (3) FK constraints present: `category_values.category_id → categories.id`, `category_value_subjects.category_value_id → category_values.id ON DELETE CASCADE`, `category_value_divisions.category_value_id → category_values.id ON DELETE CASCADE`; (4) unique index `unique_category_values_code` exists on `(category_id, LOWER(code)) WHERE deleted_at IS NULL` → `apps/api/src/db/tenant/migrations/__tests__/009_category_values.migration.test.ts`

---

## File Index

| Task | File Path                                                                                      |
| ---- | ---------------------------------------------------------------------------------------------- |
| T001 | `apps/api/src/db/tenant/migrations/20260322_009_category_values.ts`                            |
| T002 | `apps/api/src/db/tenant/schemas/category-values.schema.ts`                                     |
| T003 | `apps/api/src/db/tenant/schemas/category-value-subjects.schema.ts`                             |
| T004 | `apps/api/src/db/tenant/schemas/category-value-divisions.schema.ts`                            |
| T005 | `apps/api/src/db/tenant/schemas/index.ts` _(update)_                                           |
| T006 | `packages/domain-core/src/category-values/category-values.types.ts`                            |
| T007 | `packages/domain-core/src/category-values/category-values.errors.ts`                           |
| T008 | `packages/domain-core/src/category-values/category-values.repository.ts`                       |
| T009 | `packages/domain-core/src/category-values/category-values.dependency-registry.ts`              |
| T010 | `packages/domain-core/src/category-values/category-values.service.ts`                          |
| T011 | `packages/domain-core/src/category-values/index.ts`                                            |
| T012 | `packages/domain-core/src/index.ts` _(update)_                                                 |
| T013 | `packages/validation/src/backoffice/category-values.schemas.ts`                                |
| T014 | `apps/api/src/routes/backoffice/category-values/helpers.ts`                                    |
| T015 | `apps/api/src/routes/backoffice/category-values/list-category-values.ts`                       |
| T016 | `apps/api/src/routes/backoffice/category-values/create-category-value.ts`                      |
| T017 | `apps/api/src/routes/backoffice/category-values/get-category-value.ts`                         |
| T018 | `apps/api/src/routes/backoffice/category-values/update-category-value.ts`                      |
| T019 | `apps/api/src/routes/backoffice/category-values/delete-category-value.ts`                      |
| T020 | `apps/api/src/routes/backoffice/category-values/index.ts`                                      |
| T021 | `apps/api/src/routes/backoffice/index.ts` _(update)_                                           |
| T022 | `packages/domain-core/src/category-values/__tests__/category-values.service.test.ts`           |
| T023 | `packages/domain-core/src/category-values/__tests__/category-values.repository.test.ts`        |
| T024 | `apps/api/src/routes/backoffice/category-values/__tests__/category-values.integration.test.ts` |
| T025 | `apps/api/src/db/tenant/migrations/__tests__/009_category_values.migration.test.ts`            |
