# Implementation Plan: Category Values (Stage 031)

**Feature Branch**: `spec/031-category-values`  
**Stage**: `STAGE_31_CATEGORY_VALUES`  
**Phase**: `03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION`  
**Created**: 2026-03-22  
**Schema Version**: `1.14.0 → 1.15.0`  
**Depends On**: `spec/030-categories` (STAGE_30_CATEGORIES — must be merged first)  
**Status**: READY FOR IMPLEMENTATION

---

## Stage Alignment

- **Phase**: `03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION`
- **Stage**: `STAGE_31_CATEGORY_VALUES`
- **Related Spec File**: `specs/runtime/031-category-values/spec.md`
- **Related ADR**: ADR-0008 (forward-only migrations), ADR-0009 (database-per-tenant isolation)

Plan introduces no architecture outside the defined Stage 031 scope.

---

## Architectural Scope Confirmation

✓ No cross-tenant data access — all three new tables reside exclusively in the tenant DB  
✓ No middleware bypass — tenant resolver + license middleware run before every handler  
✓ No direct DB instantiation — all DB access via `c.get('tenant').pool` injected by middleware  
✓ No grading logic outside Worker — feature does not touch attempt or grading logic  
✓ No weakening of snapshot integrity — category value FKs in downstream content are snapshotted at attempt start  
✓ No weakening of version enforcement — schema version bumped, MIN_SCHEMA_VERSION = "1.15.0" enforced  
✓ No layer boundary violation — business logic in `packages/domain-core`, not in route handlers

No ADR exceptions required.

---

## Dependency Prerequisites

Before any implementation file is written, verify these tables exist in the tenant DB:

- `categories` — direct FK dependency (`category_values.category_id`)
- `subjects` — FK for `category_value_subjects.subject_id`
- `divisions` — FK for `category_value_divisions.division_id`
- `users` — FK for `category_values.created_by`, `updated_by`
- `translations` — shared table for name/description (entity_type = 'CATEGORY_VALUE')
- `workspace_settings` — language config reads

Migration `20260322_008_categories.ts` must be applied first (schema at `1.14.0`).

---

## Implementation File Map

```
apps/api/src/db/tenant/migrations/
  20260322_009_category_values.ts                        [1] Forward-only DDL migration

apps/api/src/db/tenant/schemas/
  category-values.schema.ts                              [2a] Drizzle ORM schema (category_values)
  category-value-subjects.schema.ts                      [2b] Drizzle ORM schema
  category-value-divisions.schema.ts                     [2c] Drizzle ORM schema
  index.ts                                               [2d] add three new exports

packages/domain-core/src/category-values/
  category-values.types.ts                               [3a] Types + interfaces
  category-values.errors.ts                              [3b] Error catalog + class
  category-values.repository.ts                          [3c] Pure SQL query functions
  category-values.service.ts                             [3d] Business logic + transactions
  category-values.dependency-registry.ts                 [3e] Extensible dependency stub
  index.ts                                               [3f] Public exports

packages/validation/src/backoffice/
  category-values.schemas.ts                             [4] Zod validation schemas

apps/api/src/routes/backoffice/category-values/
  index.ts                                               [5a] Router factory
  helpers.ts                                             [5b] getDb, buildAuditCtx, response helpers
  list-category-values.ts                                [5c] GET /category-values
  create-category-value.ts                               [5d] POST /category-values
  get-category-value.ts                                  [5e] GET /category-values/:id
  update-category-value.ts                               [5f] PATCH /category-values/:id
  delete-category-value.ts                               [5g] DELETE /category-values/:id

apps/api/src/routes/backoffice/
  index.ts                                               [6] Register categoryValuesRouter

packages/domain-core/src/category-values/__tests__/
  category-values.service.test.ts                        [7a] Unit tests

apps/api/src/routes/backoffice/category-values/__tests__/
  category-values.integration.test.ts                    [7b] Integration tests
```

---

## [1] Migration: `20260322_009_category_values.ts`

### Phase A — Inside BEGIN/COMMIT transaction

```
1.  CREATE TABLE IF NOT EXISTS category_values
      (id, category_id, code, status CHECK, created_at, updated_at, created_by, updated_by, deleted_at)
2.  CREATE TABLE IF NOT EXISTS category_value_subjects
      (id, category_value_id, subject_id, UNIQUE)
3.  CREATE TABLE IF NOT EXISTS category_value_divisions
      (id, category_value_id, division_id, UNIQUE)
4.  FK: category_values.category_id        → categories(id) ON DELETE RESTRICT
5.  FK: category_values.created_by         → users(id) ON DELETE SET NULL
6.  FK: category_values.updated_by         → users(id) ON DELETE SET NULL
7.  FK: category_value_subjects.category_value_id → category_values(id) ON DELETE CASCADE
8.  FK: category_value_subjects.subject_id → subjects(id) ON DELETE CASCADE
9.  FK: category_value_divisions.category_value_id → category_values(id) ON DELETE CASCADE
10. FK: category_value_divisions.division_id → divisions(id) ON DELETE CASCADE
11. CREATE INDEX idx_category_values_category_id            ON category_values(category_id)
12. CREATE INDEX idx_category_values_status                 ON category_values(status)
13. CREATE INDEX idx_category_values_category_id_status     ON category_values(category_id, status)
14. CREATE INDEX idx_category_values_deleted_at             ON category_values(deleted_at) WHERE deleted_at IS NULL
15. CREATE INDEX idx_cv_subjects_category_value_id          ON category_value_subjects(category_value_id)
16. CREATE INDEX idx_cv_subjects_subject_id                 ON category_value_subjects(subject_id)
17. CREATE INDEX idx_cv_divisions_category_value_id         ON category_value_divisions(category_value_id)
18. CREATE INDEX idx_cv_divisions_division_id               ON category_value_divisions(division_id)
19. UPDATE _schema_versions SET version = '1.15.0'
20. COMMIT
```

### Phase B — After COMMIT (CONCURRENTLY outside transaction)

```
21. CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_category_values_code
      ON category_values (category_id, LOWER(code)) WHERE deleted_at IS NULL
```

Per `categories` migration pattern: CONCURRENTLY prevents SHARE lock on live tenant databases
during fan-out. Must execute after the transaction COMMIT.

### Migration Safety Checklist

- ✓ Forward-only — no `down()` function. ADR-0008.
- ✓ All DDL uses `IF NOT EXISTS` guards
- ✓ All FK constraints wrapped in `DO $$ BEGIN IF NOT EXISTS ... END $$`
- ✓ Schema version bumped inside the transaction atomically
- ✓ No DROP TABLE, no TRUNCATE, no unconditional DELETE
- ✓ No cross-tenant data operations

---

## [2] Drizzle ORM Schemas

Three new files in `apps/api/src/db/tenant/schemas/`:

| File                                 | Table                      | Key notes                                                           |
| ------------------------------------ | -------------------------- | ------------------------------------------------------------------- |
| `category-values.schema.ts`          | `category_values`          | status CHECK, category_id+status index, no name/description columns |
| `category-value-subjects.schema.ts`  | `category_value_subjects`  | composite unique, two B-tree indexes                                |
| `category-value-divisions.schema.ts` | `category_value_divisions` | composite unique, two B-tree indexes                                |

Add to `apps/api/src/db/tenant/schemas/index.ts`:

```typescript
export * from "./category-values.schema";
export * from "./category-value-subjects.schema";
export * from "./category-value-divisions.schema";
```

Full Drizzle column definitions and constraints are specified in `data-model.md`.

---

## [3] Domain Package: `packages/domain-core/src/category-values/`

### [3a] `category-values.types.ts`

Key types:

| Type                       | Description                                                                   |
| -------------------------- | ----------------------------------------------------------------------------- |
| `CategoryValueStatus`      | `'COMPLETED' \| 'UNDER_REVIEW' \| 'APPROVED' \| 'ENABLED' \| 'DISABLED'`      |
| `DbClient`                 | Minimal pg.Pool / pg.PoolClient duck-type interface                           |
| `AuditContext`             | `{ user_id, correlation_id, workspace_slug, workspace_id }`                   |
| `TranslationInput`         | `{ language_code, name, description? }`                                       |
| `TranslationRow`           | Translation as stored in the DB                                               |
| `CategoryValueRow`         | Flat DB row from `category_values`                                            |
| `ScopedCategoryValueRow`   | Extends `CategoryValueRow` with `subject_ids`, `division_ids`, `translations` |
| `FullCategoryValueRow`     | Extends `ScopedCategoryValueRow` with `category` summary                      |
| `ListCategoryValuesInput`  | Query params (category_id, status, search, page, limit, language_code)        |
| `ListCategoryValuesResult` | `{ items: ScopedCategoryValueRow[], total, page, limit }`                     |
| `CreateCategoryValueInput` | `{ category_id, code, translations, subject_ids?, division_ids? }`            |
| `UpdateCategoryValueInput` | All fields optional except constraints; at least one required                 |
| `WorkspaceLanguageConfig`  | `{ default_language, supported_languages: string[] }`                         |

Full type definitions in `data-model.md`.

### [3b] `category-values.errors.ts`

Error code union `CategoryValueErrorCode` and class `CategoryValueError extends Error`.

| Code                                  | HTTP |
| ------------------------------------- | ---- |
| `FORBIDDEN`                           | 403  |
| `CATEGORY_VALUE_NOT_FOUND`            | 404  |
| `CATEGORY_VALUE_SUBJECT_NOT_FOUND`    | 404  |
| `CATEGORY_VALUE_DIVISION_NOT_FOUND`   | 404  |
| `CATEGORY_NOT_FOUND`                  | 404  |
| `CATEGORY_VALUE_CODE_DUPLICATE`       | 409  |
| `CATEGORY_VALUE_LOCK_CONFLICT`        | 409  |
| `CATEGORY_VALUE_IN_USE`               | 422  |
| `CATEGORY_VALUE_CATEGORY_IMMUTABLE`   | 422  |
| `CATEGORY_VALUE_NAME_REQUIRED`        | 422  |
| `CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT` | 422  |
| `CATEGORY_DISABLED`                   | 422  |
| `INVALID_STATUS_TRANSITION`           | 422  |
| `UNSUPPORTED_LANGUAGE`                | 422  |
| `VALIDATION_ERROR`                    | 422  |

### [3c] `category-values.repository.ts`

Pure SQL functions — no transactions opened here.

| Function                                               | Purpose                                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `findCategoryValueById(db, id)`                        | SELECT single row WHERE id = $1 AND deleted_at IS NULL                                |
| `findCategoryValueForUpdate(db, id)`                   | SELECT .. FOR UPDATE NOWAIT (lock before writes)                                      |
| `findCategoryById(db, id)`                             | Check parent category exists + get status and scope                                   |
| `countCategoryValues(db, opts)`                        | COUNT with filters; search via translations JOIN                                      |
| `findCategoryValues(db, opts)`                         | SELECT rows with pagination, translation JOIN, scope via batch                        |
| `findScopeForValues(db, valueIds)`                     | Bulk SELECT from scope tables WHERE id = ANY($1::uuid[])                              |
| `findTranslationsForValues(db, valueIds)`              | SELECT from translations WHERE entity_type = 'CATEGORY_VALUE' AND entity_id = ANY($1) |
| `insertCategoryValue(db, input, audit)`                | INSERT INTO category_values RETURNING \*                                              |
| `updateCategoryValueRow(db, id, patch, audit)`         | UPDATE SET .. always updated_at = NOW() RETURNING \*                                  |
| `softDeleteCategoryValue(db, id, audit)`               | UPDATE SET deleted_at = NOW(), updated_by = $audit.user_id                            |
| `deleteValueSubjectScope(db, valueId)`                 | DELETE FROM category_value_subjects WHERE category_value_id = $1                      |
| `insertValueSubjectScope(db, valueId, ids)`            | INSERT batch into category_value_subjects                                             |
| `deleteValueDivisionScope(db, valueId)`                | DELETE FROM category_value_divisions WHERE category_value_id = $1                     |
| `insertValueDivisionScope(db, valueId, ids)`           | INSERT batch into category_value_divisions                                            |
| `categoryValueCodeExists(db, catId, code, excludeId?)` | Check LOWER(code) uniqueness within category                                          |
| `subjectsExistBatch(db, subjectIds)`                   | SELECT id FROM subjects WHERE id = ANY($1)                                            |
| `divisionsExistBatch(db, divisionIds)`                 | SELECT id FROM divisions WHERE id = ANY($1)                                           |
| `findCategorySubjectScope(db, categoryId)`             | Return parent category's subject_ids as a Set                                         |
| `findCategoryDivisionScope(db, categoryId)`            | Return parent category's division_ids as a Set                                        |
| `upsertTranslations(db, entityId, translations)`       | INSERT ... ON CONFLICT translations_composite_unique DO UPDATE                        |
| `findWorkspaceLanguageConfig(db)`                      | SELECT supported_languages + default_language from workspace_settings                 |
| `checkValueDependencies(db, valueId)`                  | Calls all registered dependency functions; returns total ref count                    |

**Search implementation (parameterised, injection-safe):**

```sql
LEFT JOIN translations t
  ON t.entity_type = 'CATEGORY_VALUE' AND t.entity_id = cv.id
  AND t.field_name = 'name' AND t.language_code = $lang
WHERE t.translated_value ILIKE $pattern
-- $pattern passed as a parameterised value, never string-interpolated
```

**N+1 prevention:** `findScopeForValues` and `findTranslationsForValues` use `ANY($1::uuid[])` batch
queries and fold results into Maps before merging onto rows.

### [3d] `category-values.service.ts`

Read operations are transaction-free. All write operations manage their own transactions.

#### `listCategoryValues(db, input)` — read-only

```
0. If input.include_deleted == true:
   → Verify caller has classification_manage permission → else FORBIDDEN (403)
1. Validate: category_id present and valid UUID
2. [parallel] COUNT query + paginated SELECT with translations JOIN
   (adds WHERE deleted_at IS NULL unless include_deleted == true)
3. Collect value IDs from results
4. [parallel] findScopeForValues + findTranslationsForValues (batch)
5. Merge scope and translations onto each row
6. Return { items, total, page, limit }
```

#### `getCategoryValue(db, id)` — read-only

```
1. findCategoryValueById (checks deleted_at IS NULL)
2. If null → CATEGORY_VALUE_NOT_FOUND
3. [parallel] findScopeForValues + findTranslationsForValues + findCategoryById (for summary)
4. Return FullCategoryValueRow
```

#### `createCategoryValue(db, input, audit)` — transactional

```
TX: BEGIN
  1. findCategoryById(db, category_id)
     → null:                       CATEGORY_NOT_FOUND
     → status != 'ENABLED':        CATEGORY_DISABLED
  2. findWorkspaceLanguageConfig(db)
     → unknown language_code:      UNSUPPORTED_LANGUAGE
     → default_language name absent: CATEGORY_VALUE_NAME_REQUIRED
  3. categoryValueCodeExists(db, category_id, code)
     → true:                       CATEGORY_VALUE_CODE_DUPLICATE
  4. [if subject_ids non-empty]
     a. subjectsExistBatch         → CATEGORY_VALUE_SUBJECT_NOT_FOUND
     b. findCategorySubjectScope   → out of parent set: CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT
  5. [if division_ids non-empty]
     a. divisionsExistBatch        → CATEGORY_VALUE_DIVISION_NOT_FOUND
     b. findCategoryDivisionScope  → out of parent set: CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT
  6. insertCategoryValue (status = 'COMPLETED') → CategoryValueRow
  7. upsertTranslations(db, row.id, translations)
  8. [if subject_ids non-empty] insertValueSubjectScope(db, row.id, subject_ids)
  9. [if division_ids non-empty] insertValueDivisionScope(db, row.id, division_ids)
COMMIT
  10. [parallel] fetch scope + translations for new row
  11. Return ScopedCategoryValueRow with translations
ROLLBACK on error
  → Catch PG 23505 → re-throw as CATEGORY_VALUE_CODE_DUPLICATE
```

#### `updateCategoryValue(db, id, input, audit)` — transactional

```
TX: BEGIN (FOR UPDATE NOWAIT on the value row)
  1. findCategoryValueForUpdate(db, id)
     → null or deleted_at IS NOT NULL: CATEGORY_VALUE_NOT_FOUND
     → PG 55P03 lock timeout:          CATEGORY_VALUE_LOCK_CONFLICT
  2. [if input.category_id present] → CATEGORY_VALUE_CATEGORY_IMMUTABLE (immediate rejection)
  3. [if input.status present]
     → validateStatusTransition(current, new): INVALID_STATUS_TRANSITION
  4. [if input.code present] categoryValueCodeExists(db, category_id, input.code, excludeId=id)
     → CATEGORY_VALUE_CODE_DUPLICATE
  5. [if input.translations present] findWorkspaceLanguageConfig
     → UNSUPPORTED_LANGUAGE
  6. [if input.subject_ids present and non-empty]
     a. subjectsExistBatch         → CATEGORY_VALUE_SUBJECT_NOT_FOUND
     b. findCategorySubjectScope   → CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT
  7. [if input.division_ids present and non-empty]
     a. divisionsExistBatch        → CATEGORY_VALUE_DIVISION_NOT_FOUND
     b. findCategoryDivisionScope  → CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT
  8. updateCategoryValueRow(db, id, patch, audit) → CategoryValueRow
  9. [if input.translations present] upsertTranslations(db, id, translations)
 10. [if input.subject_ids present]
       deleteValueSubjectScope(db, id)
       [if non-empty] insertValueSubjectScope(db, id, input.subject_ids)
 11. [if input.division_ids present]
       deleteValueDivisionScope(db, id)
       [if non-empty] insertValueDivisionScope(db, id, input.division_ids)
COMMIT
 12. [parallel] fetch updated scope + translations
 13. Return ScopedCategoryValueRow
ROLLBACK on error
  → PG 55P03 → CATEGORY_VALUE_LOCK_CONFLICT
  → PG 23505 → CATEGORY_VALUE_CODE_DUPLICATE
```

#### `deleteCategoryValue(db, id, audit)` — transactional

```
TX: BEGIN
  1. findCategoryValueForUpdate(db, id)
     → null: CATEGORY_VALUE_NOT_FOUND
     → deleted_at IS NOT NULL: early return { deleted: true } (idempotent — skip write, no error)
  2. checkValueDependencies(db, id) [calls dependency registry]
     → count > 0: CATEGORY_VALUE_IN_USE
  3. softDeleteCategoryValue(db, id, audit) [sets deleted_at = NOW()]
COMMIT
  4. Return { deleted: true }
ROLLBACK on error
  → PG 55P03 → CATEGORY_VALUE_LOCK_CONFLICT
```

#### `validateStatusTransition(from, to)` — pure function, no DB

```typescript
const ALLOWED_TRANSITIONS: Record<CategoryValueStatus, Set<CategoryValueStatus>> = {
  COMPLETED: new Set(["UNDER_REVIEW"]),
  UNDER_REVIEW: new Set(["APPROVED"]),
  APPROVED: new Set(["ENABLED", "DISABLED"]),
  ENABLED: new Set(["DISABLED"]),
  DISABLED: new Set(["ENABLED"]),
};
// throws CategoryValueError(INVALID_STATUS_TRANSITION) if not in allowed set
```

### [3e] `category-values.dependency-registry.ts`

```typescript
export type DependencyCheckFn = (db: DbClient, categoryValueId: string) => Promise<number>;
export const categoryValueDependencyRegistry: DependencyCheckFn[] = [];
export async function checkValueDependencies(db: DbClient, valueId: string): Promise<number> {
  const counts = await Promise.all(categoryValueDependencyRegistry.map((fn) => fn(db, valueId)));
  return counts.reduce((sum, n) => sum + n, 0);
}
```

Initially empty. Downstream MCQ/TQ stages push their check functions here at startup.

### [3f] `index.ts`

Exports all public surface of the domain package — types, errors, service functions, dependency
registry. No internal helpers exported.

---

## [4] Validation Schemas: `packages/validation/src/backoffice/category-values.schemas.ts`

| Schema                            | Used By                     |
| --------------------------------- | --------------------------- |
| `listCategoryValuesQuerySchema`   | GET /category-values        |
| `createCategoryValueBodySchema`   | POST /category-values       |
| `getCategoryValueParamsSchema`    | GET /category-values/:id    |
| `updateCategoryValueBodySchema`   | PATCH /category-values/:id  |
| `deleteCategoryValueParamsSchema` | DELETE /category-values/:id |

Key rules:

- `category_id`: `z.string().uuid()`
- `code`: `z.string().min(1).max(100).trim()`
- `status`: `z.enum(['COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED', 'DISABLED'])`
- `translations` on create: `z.array(translationItemSchema).nonempty()` (required)
- `translations` on update: `z.array(translationItemSchema).optional()`
- `subject_ids` / `division_ids`: `z.array(z.string().uuid()).optional()`
- `page`: `z.coerce.number().int().min(1).default(1)`
- `limit`: `z.coerce.number().int().min(1).max(100).default(20)`
- PATCH body: at least one field required: `.refine(obj => Object.keys(obj).length > 0)`

---

## [5] API Layer: `apps/api/src/routes/backoffice/category-values/`

### [5a] `index.ts` — Router Factory

```typescript
import { requireAnyPermission } from "../../../middleware/auth/resolve-rbac";

export function createCategoryValuesRouter(): Hono<BackofficeEnv> {
  const router = new Hono<BackofficeEnv>();
  const writeGuard = requireAnyPermission(["question_manage", "classification_manage"]);
  router.get("/category-values", listCategoryValuesHandler);
  router.post("/category-values", writeGuard, createCategoryValueHandler);
  router.get("/category-values/:id", getCategoryValueHandler);
  router.patch("/category-values/:id", writeGuard, updateCategoryValueHandler);
  router.delete("/category-values/:id", writeGuard, deleteCategoryValueHandler);
  return router;
}
```

### [5b] `helpers.ts`

Mirrors `apps/api/src/routes/backoffice/categories/helpers.ts` exactly:

- `getDb(c)` — returns `c.get('tenant').pool`
- `buildAuditCtx(c)` — extracts `user_id`, `correlation_id`, `workspace_slug`, `workspace_id`
- `successResponse<T>(data)` — `{ success: true, data, error: null }`
- `categoryValuesErrorResponse(c, err)` — maps `CategoryValueError` to HTTP response with structured logging

### [5c–5g] Handler Pattern

Each handler:

1. Parse + validate with the corresponding Zod schema (422 on failure)
2. Call `getDb(c)` and `buildAuditCtx(c)`
3. Delegate entirely to the domain service function
4. Return `successResponse()` on success
5. Catch `CategoryValueError` → `categoryValuesErrorResponse(c, err)`
6. Catch unexpected errors → log + return 500

HTTP status codes: list/get → 200; create → 201; update → 200; delete → 200.

### [6] Router Registration

In `apps/api/src/routes/backoffice/index.ts`:

```typescript
import { createCategoryValuesRouter } from "./category-values";
// ...
app.route("/", createCategoryValuesRouter());
```

---

## Database Impact

### Master DB

No tables touched. No migration required. No version bump.

### Tenant DB

| Table                      | Change            | Migration                         |
| -------------------------- | ----------------- | --------------------------------- |
| `category_values`          | New table         | `20260322_009_category_values.ts` |
| `category_value_subjects`  | New table         | same migration                    |
| `category_value_divisions` | New table         | same migration                    |
| `_schema_versions`         | `1.14.0 → 1.15.0` | same migration                    |

No existing columns removed or renamed.

---

## Transaction Design

| Operation             | Transactional | Atomic Operations                                | Isolation      | Concurrency         |
| --------------------- | ------------- | ------------------------------------------------ | -------------- | ------------------- |
| `createCategoryValue` | Yes           | INSERT + upsert translations + insert scope      | READ COMMITTED | unique index (code) |
| `updateCategoryValue` | Yes           | UPDATE row + upsert translations + replace scope | READ COMMITTED | FOR UPDATE NOWAIT   |
| `deleteCategoryValue` | Yes           | check deps + SET deleted_at                      | READ COMMITTED | FOR UPDATE NOWAIT   |
| `listCategoryValues`  | No            | —                                                | —              | —                   |
| `getCategoryValue`    | No            | —                                                | —              | —                   |

All `FOR UPDATE NOWAIT` failures (PG code `55P03`) surface as `CATEGORY_VALUE_LOCK_CONFLICT` (409).
Full ROLLBACK on any error in transactional operations.

---

## Translation Handling Strategy

Category Values have **no** `name` or `description` columns. All display text lives in the shared
`translations` table (`entity_type = 'CATEGORY_VALUE'`).

**Create:** upserted inside the create transaction. At least one translation for the workspace
default language with a non-empty `name` is required.

**List:** translations for the requested language are JOIN'd in the paginated SELECT query. The
`name` field on each list item is a flat string. Falls back to workspace default language if the
requested language has no entry.

**Get:** all translations for the value are returned as `translations[]`.

**Update:** partial upsert — only the languages present in the payload are updated. Other languages
are not touched.

**Delete (soft):** translations are NOT deleted. Preserved for audit and potential restore.

**Language validation:** before any write, `findWorkspaceLanguageConfig(db)` fetches
`workspace_settings.settings->>'default_language'` and `settings->'supported_languages'`. Any
unknown `language_code` → `UNSUPPORTED_LANGUAGE` (422) before DB mutations begin.

---

## Status Workflow Integration

Status transitions validated inline in the service layer via the static `ALLOWED_TRANSITIONS` map:

| From           | Allowed To            |
| -------------- | --------------------- |
| `COMPLETED`    | `UNDER_REVIEW`        |
| `UNDER_REVIEW` | `APPROVED`            |
| `APPROVED`     | `ENABLED`, `DISABLED` |
| `ENABLED`      | `DISABLED`            |
| `DISABLED`     | `ENABLED`             |

Initial status on creation: `COMPLETED` (hardcoded in `insertCategoryValue`; not client-supplied).

Status is updated via `updateCategoryValueRow` with `patch = { status: newStatus }` inside the
update transaction — atomic with scope and translation changes.

---

## Scope Validation Strategy

Parent scope containment enforced before any scope rows are written:

1. Fetch parent Category's `category_subjects` → `Set<string>` of allowed subject IDs
2. If parent set is **empty** (global scope): any subject_ids in value are valid
3. If parent set is **non-empty**: all value subject_ids must be ∈ parent set → `CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT`
4. Same logic for division_ids / `category_divisions`

`findCategorySubjectScope(db, categoryId)` and `findCategoryDivisionScope(db, categoryId)` encapsulate
this fetch.

---

## Observability Plan

**Logger namespace:** `category-values-route:{handler-name}` (e.g., `category-values-route:create`)

**Structured fields on all log entries:**

- `correlation_id` — from request context
- `workspace_id` — from tenant context
- `workspace_slug` — from tenant context

**Log levels:**

- `logger.info()` — successful create, update, delete (with `category_value_id`)
- `logger.warn()` — domain errors (`CategoryValueError`) with `error_code`
- `logger.error()` — unexpected errors (non-`CategoryValueError`) with `stack`

No `console.log` anywhere in production code.

---

## Rate Limiting

| Endpoint type               | Threshold                   |
| --------------------------- | --------------------------- |
| Write (POST, PATCH, DELETE) | ≤ 30 req/min per workspace  |
| Read (GET)                  | ≤ 120 req/min per workspace |

Platform rate-limiting middleware applied before all handlers.

---

## Version Enforcement

Schema version check occurs in the license middleware before any route handler executes.
Tenants below `MIN_SCHEMA_VERSION = "1.15.0"` receive 409 `SCHEMA_VERSION_MISMATCH`.

---

## Failure Mode Recovery

| Mode                        | Behavior                                                                    |
| --------------------------- | --------------------------------------------------------------------------- |
| DB unavailable              | Pool error propagates → 500 with structured log                             |
| Schema version mismatch     | License middleware → 409 SCHEMA_VERSION_MISMATCH                            |
| License SOFT_LOCKED         | License middleware → 423 LICENSE_LOCKED                                     |
| License ARCHIVED            | License middleware → 403 FORBIDDEN                                          |
| Concurrent write (55P03)    | FOR UPDATE NOWAIT → 409 CATEGORY_VALUE_LOCK_CONFLICT                        |
| Code duplicate (23505)      | Constraint catch in service → 409 CATEGORY_VALUE_CODE_DUPLICATE             |
| Partial transaction failure | ROLLBACK; error surfaced to handler; no partial state                       |
| Invalid status transition   | Service validates before DB write → 422 INVALID_STATUS_TRANSITION           |
| Scope exceeds parent        | Service validates before DB write → 422 CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT |

---

## Security Review

✓ RBAC enforcement server-side — permission guard checks `classification_manage` before handler executes  
✓ No role checks in frontend — frontoffice has no category-value CRUD routes  
✓ No secrets exposed — error responses use domain codes, never raw PG errors  
✓ JWT workspace scope enforced — tenant resolver validates workspace slug from JWT before any handler  
✓ No sensitive data in logs — translation content not logged; only IDs and error codes  
✓ No information leakage — cross-tenant reads return 404, not 403  
✓ SQL injection prevention — all user input as parameterised query values (`$N`), never string-interpolated

---

## Test Strategy

### Unit Tests: `packages/domain-core/src/category-values/__tests__/category-values.service.test.ts`

Approach: mock `DbClient` (query stub), no live DB.

| Test                       | Scenario                                                      |
| -------------------------- | ------------------------------------------------------------- |
| `createCategoryValue`      | Happy path: value created with translations and scope         |
| `createCategoryValue`      | CATEGORY_NOT_FOUND when category_id missing                   |
| `createCategoryValue`      | CATEGORY_DISABLED when parent category not ENABLED            |
| `createCategoryValue`      | CATEGORY_VALUE_CODE_DUPLICATE                                 |
| `createCategoryValue`      | CATEGORY_VALUE_NAME_REQUIRED                                  |
| `createCategoryValue`      | UNSUPPORTED_LANGUAGE for unknown language code                |
| `createCategoryValue`      | CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT                           |
| `validateStatusTransition` | All 5 valid transitions pass                                  |
| `validateStatusTransition` | All invalid transitions throw INVALID_STATUS_TRANSITION       |
| `updateCategoryValue`      | CATEGORY_VALUE_CATEGORY_IMMUTABLE when category_id in payload |
| `updateCategoryValue`      | Only listed translations updated; others unchanged            |
| `updateCategoryValue`      | subject_ids: [] clears scope                                  |
| `deleteCategoryValue`      | Happy path: deleted_at set                                    |
| `deleteCategoryValue`      | CATEGORY_VALUE_IN_USE when registry count > 0                 |
| `deleteCategoryValue`      | CATEGORY_VALUE_NOT_FOUND when already soft-deleted            |

### Integration Tests: `apps/api/src/routes/backoffice/category-values/__tests__/category-values.integration.test.ts`

Uses live test PostgreSQL DB (docker-compose.test.yml).

| Test                          | Scenario                                              |
| ----------------------------- | ----------------------------------------------------- |
| POST `/category-values`       | 201 — valid payload, ENABLED parent category          |
| POST `/category-values`       | 404 CATEGORY_NOT_FOUND                                |
| POST `/category-values`       | 422 CATEGORY_DISABLED                                 |
| POST `/category-values`       | 409 CATEGORY_VALUE_CODE_DUPLICATE (case-insensitive)  |
| POST `/category-values`       | 422 CATEGORY_VALUE_NAME_REQUIRED                      |
| POST `/category-values`       | 403 FORBIDDEN without permission                      |
| GET `/category-values`        | 200 — list with pagination                            |
| GET `/category-values`        | 200 — filtered by status                              |
| GET `/category-values`        | 404 CATEGORY_NOT_FOUND for bad category_id            |
| GET `/category-values/:id`    | 200 — full details with translations and scope        |
| GET `/category-values/:id`    | 404 for soft-deleted value                            |
| PATCH `/category-values/:id`  | 200 — code update                                     |
| PATCH `/category-values/:id`  | 200 — status transition COMPLETED → UNDER_REVIEW      |
| PATCH `/category-values/:id`  | 422 INVALID_STATUS_TRANSITION (COMPLETED → ENABLED)   |
| PATCH `/category-values/:id`  | 422 CATEGORY_VALUE_CATEGORY_IMMUTABLE                 |
| PATCH `/category-values/:id`  | translation upsert — only patched language updated    |
| DELETE `/category-values/:id` | 200 — soft delete                                     |
| DELETE `/category-values/:id` | 404 — second delete of same value                     |
| DELETE `/category-values/:id` | tenant isolation — cannot access other tenant's value |

All integration tests must verify tenant isolation: values created in tenant A are not accessible
from tenant B's request context.

---

## Rollback Strategy

This stage introduces only additive DDL changes (new tables, new indexes). Rollback procedure:

1. Feature flagged off in backoffice routing (remove router registration)
2. Application deployed without the route registration
3. Tables remain in place but are unreachable (safe orphaned tables)
4. If schema rollback required: manual `DROP TABLE category_values CASCADE` on affected tenants
   (requires ops decision — data loss warning)

No migration rollback file. ADR-0008: forward-only.

---

## Non-Goals

The following are explicitly out of scope for Stage 031:

- No MCQ Question classification tagging (Stage 032+)
- No Traditional Question classification tagging (Stage 033+)
- No Exam configuration classification (Stage 034+)
- No Frontoffice classification display
- No batch import/export of Category Values
- No Category Value analytics or reporting
- No hard-delete path
- No restore (un-delete) endpoint
- No background Worker processing for Category Values

---

## Quickstart: Implementing Stage 031

1. **Ensure Stage 030 is merged** and tenant DB is at schema `1.14.0`
2. **Write migration** `20260322_009_category_values.ts` (see `data-model.md` for full DDL)
3. **Write Drizzle schemas** (3 files, register in `schemas/index.ts`)
4. **Write domain package** in order: types → errors → repository → dependency-registry → service → index.ts
5. **Write Zod validation schemas** in `packages/validation/src/backoffice/`
6. **Write route handlers** (helpers.ts first, then one file per handler)
7. **Register router** in `apps/api/src/routes/backoffice/index.ts`
8. **Write unit tests** (service layer, mocked DB)
9. **Write integration tests** (live test DB)
10. **Run full validation suite:**
    ```bash
    bun scripts/ai-guard.ts && bun scripts/infra-audit.ts && bun run lint && bun run type-check && bun run test
    ```

---

## Constitutional Compliance Statement

Implementation plan compliant with **Zidney Constitution v1.2.0** — No violations detected.

All rules verified:

- ✓ Database-per-tenant: all three new tables in tenant DB only
- ✓ No middleware bypass: tenant resolver → license → permission guard on every route
- ✓ No inline business rules in routes: all logic in `packages/domain-core/src/category-values/`
- ✓ License middleware mandatory: enforced before any category-value route handler
- ✓ All writes transactional: BEGIN/COMMIT/ROLLBACK in every mutating service function
- ✓ Forward-only migration: no `down()`, IF NOT EXISTS guards, schema version bumped atomically
- ✓ Drizzle ORM patterns: matches Stage 030 categories schema conventions exactly
- ✓ Translation contract: no name/description on the table; shared `translations` table used
- ✓ Error contract: all responses `{ success, data, error }` shape
- ✓ Server time authoritative: `deleted_at = NOW()` set by DB, never by client
