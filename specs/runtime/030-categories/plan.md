# Implementation Plan: Categories (Stage 030)

**Feature Branch**: `spec/030-categories`  
**Stage**: `STAGE_30_CATEGORIES`  
**Phase**: `03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION`  
**Created**: 2026-03-22  
**Schema Version**: `1.13.0 → 1.14.0`  
**Status**: READY FOR IMPLEMENTATION

---

## Dependency Prerequisites

Before any implementation file is written, verify these tables exist in the tenant DB:

- `categories` (subject of this migration)
- `subjects` (FK dependency for `category_subjects`)
- `divisions` (FK dependency for `category_divisions`)
- `users` (FK dependency for audit columns)

Migration `20260321_007_lessons.ts` bumped schema to `1.13.0` — this migration builds on that base.

---

## Implementation File Map

```
apps/api/src/db/tenant/migrations/
  20260322_008_categories.ts                  ← [1] Forward-only DDL migration

apps/api/src/db/tenant/schemas/
  categories.schema.ts                        ← [2] Drizzle ORM schema (3 tables)

packages/domain-core/src/categories/
  categories.types.ts                         ← [3a] Types
  categories.errors.ts                        ← [3b] Error catalog
  categories.repository.ts                    ← [3c] Pure SQL query functions
  categories.tree.ts                          ← [3d] Tree assembly helper
  categories.dependency-registry.ts           ← [3e] Downstream dependency stub
  categories.service.ts                       ← [3f] Business logic + transactions
  index.ts                                    ← [3g] Public exports
  __tests__/
    categories.service.test.ts               ← [7a] Unit tests

packages/validation/src/backoffice/
  categories.schemas.ts                       ← [4] Zod validation schemas

apps/api/src/routes/backoffice/categories/
  index.ts                                    ← [5a] Router factory
  helpers.ts                                  ← [5b] getDb, buildAuditCtx, response helpers
  list-categories.ts                          ← [5c] GET /categories
  create-category.ts                          ← [5d] POST /categories
  get-categories-tree.ts                      ← [5e] GET /categories/tree
  get-category.ts                             ← [5f] GET /categories/:id
  update-category.ts                          ← [5g] PATCH /categories/:id
  delete-category.ts                          ← [5h] DELETE /categories/:id
  __tests__/
    categories.integration.test.ts           ← [7b] Integration tests
```

---

## [1] Migration File

**File**: `apps/api/src/db/tenant/migrations/20260322_008_categories.ts`

### Structure

The migration `up()` function is split into two phases:

**Phase A — Inside Transaction** (BEGIN/COMMIT):

1. `CREATE TABLE IF NOT EXISTS categories` (with status CHECK constraint)
2. `CREATE TABLE IF NOT EXISTS category_subjects`
3. `CREATE TABLE IF NOT EXISTS category_divisions`
4. FK: `categories.parent_id → categories(id) ON DELETE RESTRICT` (via DO $$ IF NOT EXISTS $$)
5. FK: `categories.created_by → users(id) ON DELETE SET NULL`
6. FK: `categories.updated_by → users(id) ON DELETE SET NULL`
7. FK: `category_subjects.category_id → categories(id) ON DELETE CASCADE`
8. FK: `category_subjects.subject_id → subjects(id) ON DELETE CASCADE`
9. FK: `category_divisions.category_id → categories(id) ON DELETE CASCADE`
10. FK: `category_divisions.division_id → divisions(id) ON DELETE CASCADE`
11. `UNIQUE (category_id, subject_id)` constraint on `category_subjects`
12. `UNIQUE (category_id, division_id)` constraint on `category_divisions`
13. B-tree index: `idx_categories_parent_id ON categories(parent_id)`
14. B-tree index: `idx_categories_status ON categories(status)`
15. B-tree index: `idx_category_subjects_category_id ON category_subjects(category_id)`
16. B-tree index: `idx_category_subjects_subject_id ON category_subjects(subject_id)`
17. B-tree index: `idx_category_divisions_category_id ON category_divisions(category_id)`
18. B-tree index: `idx_category_divisions_division_id ON category_divisions(division_id)`
19. `UPDATE _schema_versions SET version = '1.14.0'` (schema version bump)
20. `COMMIT`

**Phase B — After COMMIT** (CONCURRENTLY — must run outside transaction): 21. `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_categories_name ON categories (LOWER(name))` 22. `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_categories_code ON categories (LOWER(code)) WHERE code IS NOT NULL`

> **Why CONCURRENTLY outside transaction?** PostgreSQL requires `CREATE INDEX CONCURRENTLY` to run outside an explicit transaction block. These two functional/partial indexes use `CONCURRENTLY` to avoid `SHARE` locks that would block reads and writes on live tenant databases during fan-out. The B-tree non-functional indexes remain inside the transaction (brief `SHARE` lock on newly-created empty tables is acceptable).

### Skeleton

```typescript
/**
 * Migration 008 — Categories
 *
 * File: apps/api/src/db/tenant/migrations/20260322_008_categories.ts
 * Stage: STAGE_30_CATEGORIES
 *
 * Creates categories, category_subjects, category_divisions tables.
 * Adds FK constraints, unique constraints, and all performance indexes.
 * Bumps schema version from 1.13.0 to 1.14.0.
 *
 * Forward-only (ADR-0008). No down() function.
 *
 * CONCURRENT index note:
 *   unique_categories_name and unique_categories_code use CREATE INDEX CONCURRENTLY
 *   and MUST run outside the explicit transaction block. They are executed after COMMIT.
 */

import type { PoolClient } from 'pg'

export const description =
  'Add categories, category_subjects, category_divisions tables with hierarchy, scope FKs, and indexes'

export async function up(client: PoolClient): Promise<void> {
  // ─── Phase A: Inside transaction ──────────────────────────────────────────
  await client.query('BEGIN')
  try {
    // 1. categories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id           UUID         NOT NULL DEFAULT gen_random_uuid(),
        name         VARCHAR(255) NOT NULL,
        code         VARCHAR(100),
        description  TEXT,
        parent_id    UUID,
        status       VARCHAR(20)  NOT NULL DEFAULT 'ENABLED'
                       CONSTRAINT categories_status_check CHECK (status IN ('ENABLED', 'DISABLED')),
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        created_by   UUID,
        updated_by   UUID,
        CONSTRAINT   categories_pkey PRIMARY KEY (id)
      )
    `)

    // 2. category_subjects table
    await client.query(`
      CREATE TABLE IF NOT EXISTS category_subjects (
        id           UUID NOT NULL DEFAULT gen_random_uuid(),
        category_id  UUID NOT NULL,
        subject_id   UUID NOT NULL,
        CONSTRAINT   category_subjects_pkey PRIMARY KEY (id),
        CONSTRAINT   unique_category_subjects UNIQUE (category_id, subject_id)
      )
    `)

    // 3. category_divisions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS category_divisions (
        id           UUID NOT NULL DEFAULT gen_random_uuid(),
        category_id  UUID NOT NULL,
        division_id  UUID NOT NULL,
        CONSTRAINT   category_divisions_pkey PRIMARY KEY (id),
        CONSTRAINT   unique_category_divisions UNIQUE (category_id, division_id)
      )
    `)

    // 4–6. categories self-ref FK + audit FKs
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'categories' AND constraint_name = 'categories_parent_id_fkey'
        ) THEN
          ALTER TABLE categories
            ADD CONSTRAINT categories_parent_id_fkey
            FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE RESTRICT;
        END IF;
      END
      $$
    `)
    -- (created_by, updated_by, scope table FKs follow same DO $$ pattern)

    -- 13–18. B-tree indexes (brief lock on empty tables; safe)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories (parent_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_categories_status ON categories (status)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_category_subjects_category_id ON category_subjects (category_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_category_subjects_subject_id ON category_subjects (subject_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_category_divisions_category_id ON category_divisions (category_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_category_divisions_division_id ON category_divisions (division_id)`)

    // 19. Schema version bump
    await client.query(`
      UPDATE _schema_versions
        SET version    = '1.14.0',
            updated_at = NOW()
        WHERE name = 'schema_version'
    `)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }

  // ─── Phase B: CONCURRENT indexes (must run OUTSIDE transaction) ───────────
  await client.query(`
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_categories_name
      ON categories (LOWER(name))
  `)
  await client.query(`
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_categories_code
      ON categories (LOWER(code)) WHERE code IS NOT NULL
  `)
}
```

### Migration Safety Checklist

- [x] Forward-only (no `down()`)
- [x] All DDL uses `IF NOT EXISTS` guards
- [x] FK constraints wrapped in `DO $$ IF NOT EXISTS $$`
- [x] `CONCURRENTLY` indexes run after COMMIT
- [x] Schema version incremented atomically inside transaction
- [x] No `DROP TABLE`, no `TRUNCATE`, no `DELETE` without WHERE
- [x] No cross-tenant data operations

---

## [2] Drizzle ORM Schema

**File**: `apps/api/src/db/tenant/schemas/categories.schema.ts`

Three tables with B-tree indexes declared in Drizzle. Functional/partial unique indexes and all FK constraints are migration-owned (Drizzle limitation — same convention as `subjects.schema.ts`).

See `data-model.md` for the complete Drizzle schema code.

Register the new schema tables in `apps/api/src/db/tenant/schemas/index.ts` by adding:

```typescript
export * from "./categories.schema";
```

---

## [3] Domain Package: `packages/domain-core/src/categories/`

### [3a] `categories.types.ts`

Key types (see `data-model.md` for full type definitions):

- `DbClient` — raw `pg` Pool/PoolClient duck-type interface (identical to lessons pattern)
- `AuditContext` — `{ user_id: string | null, correlation_id, workspace_slug, workspace_id }`
- `CategoryStatus` — `'ENABLED' | 'DISABLED'`
- `CategoryRow` — direct DB row shape
- `ScopedCategoryRow extends CategoryRow` — adds `subject_ids: string[]` and `division_ids: string[]`
- `CategoryTreeNode` — `{ id, name, code, children: CategoryTreeNode[] }`
- `ListCategoriesInput`, `ListCategoriesResult`
- `CreateCategoryInput`, `UpdateCategoryInput`

**parent_id filter disambiguation**: The `ListCategoriesInput` uses a `parent_id_filter` discriminator:

- `'none'` → no parent filter applied (all categories)
- `'null'` → only root categories (`WHERE parent_id IS NULL`)
- `'uuid'` → only direct children of specific UUID (`WHERE parent_id = $1`)

This avoids ambiguity between "absent" and "explicitly null" in the query builder.

---

### [3b] `categories.errors.ts`

```typescript
export type CategoriesErrorCode =
  | "CATEGORY_NOT_FOUND"
  | "CATEGORY_NAME_DUPLICATE"
  | "CATEGORY_CODE_DUPLICATE"
  | "CATEGORY_PARENT_NOT_FOUND"
  | "CATEGORY_MAX_DEPTH_EXCEEDED"
  | "CATEGORY_CIRCULAR_REFERENCE"
  | "CATEGORY_DISABLED"
  | "CATEGORY_ALREADY_DISABLED"
  | "CATEGORY_ALREADY_ENABLED"
  | "CATEGORY_HAS_ENABLED_CHILDREN"
  | "CATEGORY_HAS_DEPENDENT_CONTENT"
  | "CATEGORY_SUBJECT_NOT_FOUND"
  | "CATEGORY_DIVISION_NOT_FOUND"
  | "VALIDATION_ERROR";
```

HTTP status map and error messages derived from the spec error code registry (see `data-model.md`).

---

### [3c] `categories.repository.ts`

**Pure SQL query functions. No transactions opened here.**

Repository functions:

| Function                                           | Purpose                                                                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `findCategoryById(db, id)`                         | SELECT single row by ID. Returns `CategoryRow \| null`.                                                              |
| `findCategoryRowForUpdate(db, id)`                 | `SELECT id, status, parent_id FROM categories WHERE id = $1 FOR UPDATE NOWAIT` — lock row before hierarchy mutation. |
| `findParentRowForUpdate(db, parentId)`             | Same, locks parent row during `createCategory`.                                                                      |
| `countCategories(db, opts)`                        | COUNT with optional `parent_id`, `status`, `search` (ILIKE).                                                         |
| `findCategories(db, opts)`                         | SELECT with pagination + filters. Returns `CategoryRow[]`.                                                           |
| `findScopeForCategories(db, categoryIds)`          | Bulk SELECT from `category_subjects` + `category_divisions` WHERE category_id = ANY($1). Returns scope map.          |
| `findAllEnabledCategories(db, rootId?)`            | All ENABLED categories for tree assembly. Optional filter by subtree.                                                |
| `insertCategory(db, input, audit)`                 | INSERT single row, RETURNING \*.                                                                                     |
| `updateCategoryRow(db, id, patch, audit)`          | UPDATE with explicit SET fields, RETURNING \*. Always sets `updated_at = NOW()`.                                     |
| `deleteSubjectScope(db, categoryId)`               | DELETE FROM category_subjects WHERE category_id = $1.                                                                |
| `insertSubjectScope(db, categoryId, subjectIds)`   | INSERT INTO category_subjects (batch).                                                                               |
| `deleteDivisionScope(db, categoryId)`              | DELETE FROM category_divisions WHERE category_id = $1.                                                               |
| `insertDivisionScope(db, categoryId, divisionIds)` | INSERT INTO category_divisions (batch).                                                                              |
| `categoryNameExists(db, name, excludeId?)`         | Check LOWER(name) uniqueness. Optional `excludeId` for PATCH.                                                        |
| `categoryCodeExists(db, code, excludeId?)`         | Check LOWER(code) uniqueness (non-null).                                                                             |
| `countDirectEnabledChildren(db, categoryId)`       | COUNT children WHERE parent_id = $1 AND status = 'ENABLED'.                                                          |
| `subjectsExistBatch(db, subjectIds)`               | SELECT id FROM subjects WHERE id = ANY($1). Returns found IDs.                                                       |
| `divisionsExistBatch(db, divisionIds)`             | SELECT id FROM divisions WHERE id = ANY($1). Returns found IDs.                                                      |

**N+1 Prevention for Scope**:  
`findScopeForCategories` executes two queries:

```sql
SELECT category_id, subject_id FROM category_subjects WHERE category_id = ANY($1::uuid[])
SELECT category_id, division_id FROM category_divisions WHERE category_id = ANY($1::uuid[])
```

Results are grouped into a `Map<categoryId, { subject_ids, division_ids }>` in memory and merged onto each category row.

**Search (ILIKE — parameterized)**:

```sql
WHERE LOWER(name) LIKE LOWER($N)  -- NOT: WHERE name ILIKE '%' || user_input || '%'
-- Correct parameterized form:
params.push(`%${search}%`)
conditions.push(`name ILIKE $${params.length}`)
```

This prevents SQL injection by passing the `%search%` string as a parameter, never interpolated into the SQL string.

---

### [3d] `categories.tree.ts`

**Tree assembly helper (in-memory, O(N))**:

```typescript
export function assembleCategoryTree(rows: CategoryRow[], rootId?: string): CategoryTreeNode[] {
  // 1. Build Map<id, CategoryTreeNode>
  const nodeMap = new Map<string, CategoryTreeNode>();
  for (const row of rows) {
    nodeMap.set(row.id, { id: row.id, name: row.name, code: row.code, children: [] });
  }

  // 2. Link children to parents
  const roots: CategoryTreeNode[] = [];
  for (const row of rows) {
    const node = nodeMap.get(row.id)!;
    if (row.parent_id === null) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(row.parent_id);
      if (parent) parent.children.push(node);
    }
  }

  // 3. If rootId specified, return only that subtree
  if (rootId) {
    const rootNode = nodeMap.get(rootId);
    return rootNode ? [rootNode] : [];
  }

  return roots;
}
```

No recursive CTE needed. Max depth 3 means at most 3 levels of nesting in the returned array.

---

### [3e] `categories.dependency-registry.ts`

Stub — categories is not yet a leaf in the dependency chain (downstream MCQ/TQ stages will register here). Pattern matches `lessons.dependency-registry.ts`:

```typescript
export type DependencyCheckFn = (db: DbClient, categoryId: string) => Promise<number>;
export const categoryDependencyRegistry: DependencyCheckFn[] = [];
export async function checkCategoryDependencies(db: DbClient, categoryId: string): Promise<number> {
  const counts = await Promise.all(categoryDependencyRegistry.map((fn) => fn(db, categoryId)));
  return counts.reduce((sum, n) => sum + n, 0);
}
```

---

### [3f] `categories.service.ts`

**All write operations manage their own transactions (BEGIN/COMMIT/ROLLBACK).  
Read operations are transaction-free.**

#### `listCategories(db, input)` — read-only

```
1. Build parent_id filter mode from input
2. [parallel] COUNT query + paginated SELECT query
3. collect category IDs from results
4. [parallel] bulk scope fetch (subject_ids + division_ids) via ANY($1) queries
5. merge scope onto each row
6. return { items, total, page, limit }
```

#### `getCategory(db, id)` — read-only

```
1. SELECT category by id (with LEFT JOINs or two-pass scope fetch)
2. if not found → CATEGORY_NOT_FOUND
3. return ScopedCategoryRow
```

#### `getCategoriesTree(db, rootId?)` — read-only

```
1. SELECT all ENABLED categories WHERE status = 'ENABLED'
2. assembleCategoryTree(rows, rootId)
3. return CategoryTreeNode[]
```

#### `createCategory(db, input, audit)` — transactional

```
TX: BEGIN
  1. [if parent_id provided] findParentRowForUpdate(db, parent_id)
     → if null: CATEGORY_PARENT_NOT_FOUND
     → count ancestor hops to determine parent depth:
       if parent is at depth 3 → CATEGORY_MAX_DEPTH_EXCEEDED
  2. categoryNameExists(db, name) → CATEGORY_NAME_DUPLICATE
  3. [if code provided] categoryCodeExists(db, code) → CATEGORY_CODE_DUPLICATE
  4. [if subject_ids provided and non-empty]
     subjectsExistBatch(db, subject_ids) → compare count → CATEGORY_SUBJECT_NOT_FOUND
  5. [if division_ids provided and non-empty]
     divisionsExistBatch(db, division_ids) → CATEGORY_DIVISION_NOT_FOUND
  6. insertCategory(db, input, audit) → CategoryRow
  7. [if subject_ids provided] insertSubjectScope(db, row.id, subject_ids)
  8. [if division_ids provided] insertDivisionScope(db, row.id, division_ids)
COMMIT
  9. Fetch scope rows for new category
 10. Return ScopedCategoryRow
ROLLBACK on any error
  → Catch PG 23505 (unique violation) → re-throw as CATEGORY_NAME_DUPLICATE or CATEGORY_CODE_DUPLICATE
```

**Depth traversal for createCategory** (when parent_id is non-null):

```
parentRow = lockParentForUpdate(db, parent_id)
depth = 1  // parent is at least depth 1 (root)
current = parentRow.parent_id
while current != null:
  depth++
  if depth >= 3: throw CATEGORY_MAX_DEPTH_EXCEEDED  // parent is at depth 3
  row = SELECT parent_id FROM categories WHERE id = current
  current = row?.parent_id
// child will be at depth (depth + 1)
if depth + 1 > 3: throw CATEGORY_MAX_DEPTH_EXCEEDED
```

#### `updateCategory(db, id, input, audit)` — transactional

Guard ordering (from spec clarification Q8 guard ordering):

```
TX: BEGIN
  1. findCategoryRowForUpdate(db, id) [always lock target row]
     → if null: CATEGORY_NOT_FOUND
  2. [if non-status fields provided AND category is DISABLED] → CATEGORY_DISABLED
  3. [if status in payload]
     a. if status == DISABLED and category is already DISABLED → CATEGORY_ALREADY_DISABLED
     b. if status == ENABLED and category is already ENABLED → CATEGORY_ALREADY_ENABLED
     c. if status == DISABLED → countDirectEnabledChildren(db, id) > 0 → CATEGORY_HAS_ENABLED_CHILDREN
  4. [if parent_id in payload]
     Circular reference check:
       traverse new parent's ancestors (max 3 hops):
         if any ancestor.id == id → CATEGORY_CIRCULAR_REFERENCE
     Depth check:
       count new parent's depth (ancestor hops from root)
       count deepest descendant depth of current category
       if parent_depth + 1 + descendant_depth > 3 → CATEGORY_MAX_DEPTH_EXCEEDED
  5. [if name in payload] categoryNameExists(db, name, excludeId=id) → CATEGORY_NAME_DUPLICATE
  6. [if code in payload and code != null] categoryCodeExists(db, code, excludeId=id) → CATEGORY_CODE_DUPLICATE
  7. [if subject_ids in payload and non-empty] subjectsExistBatch → CATEGORY_SUBJECT_NOT_FOUND
  8. [if division_ids in payload and non-empty] divisionsExistBatch → CATEGORY_DIVISION_NOT_FOUND
  9. updateCategoryRow(db, id, patch, audit)
 10. [if subject_ids in payload (including [])]
     deleteSubjectScope(db, id)
     [if subject_ids.length > 0] insertSubjectScope(db, id, subject_ids)
 11. [if division_ids in payload (including [])]
     deleteDivisionScope(db, id)
     [if division_ids.length > 0] insertDivisionScope(db, id, division_ids)
COMMIT
 12. Fetch fresh ScopedCategoryRow and return
ROLLBACK on any error
  → Catch PG 23505 → re-throw as CATEGORY_NAME_DUPLICATE or CATEGORY_CODE_DUPLICATE
```

**Key**: Scope key presence is checked with `'subject_ids' in input` (not `input.subject_ids !== undefined`) to correctly handle `subject_ids: []`.

#### `deleteCategory(db, id, audit)` — transactional (soft delete)

```
TX: BEGIN
  1. findCategoryRowForUpdate(db, id) [always lock]
     → if null: CATEGORY_NOT_FOUND
  2. if category.status == DISABLED → CATEGORY_ALREADY_DISABLED
  3. countDirectEnabledChildren(db, id) > 0 → CATEGORY_HAS_ENABLED_CHILDREN
  4. updateCategoryRow(db, id, { status: 'DISABLED' }, audit)
COMMIT
  5. Return { deleted: true }
ROLLBACK on any error
```

---

### [3g] `index.ts`

Exports all public types, errors, and service functions from the categories domain. Pattern matches `packages/domain-core/src/lessons/index.ts`.

---

## [4] Validation Schemas

**File**: `packages/validation/src/backoffice/categories.schemas.ts`

### `listCategoriesQuerySchema`

```typescript
z.object({
  parent_id: z.union([z.string().uuid(), z.literal("null")]).optional(),
  status: z.enum(["ENABLED", "DISABLED"]).optional(),
  search: z.string().max(100).optional(),
  page: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
});
```

`parent_id = 'null'` (string literal) triggers root-only filter in service. UUID string triggers parent filter.

### `categoriesTreeQuerySchema`

```typescript
z.object({
  root_id: z.string().uuid().optional(),
});
```

### `categoryParamsSchema`

```typescript
z.object({
  id: z.string().uuid("id must be a valid UUID"),
});
```

### `createCategoryBodySchema`

```typescript
z.object({
  name: z.string().min(1).max(255),
  code: z.string().max(100).nullable().optional(),
  description: z.string().nullable().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  subject_ids: z.array(z.string().uuid()).optional(),
  division_ids: z.array(z.string().uuid()).optional(),
});
```

### `updateCategoryBodySchema`

```typescript
z.object({
  name: z.string().min(1).max(255).optional(),
  code: z.string().max(100).nullable().optional(),
  description: z.string().nullable().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  status: z.enum(["ENABLED", "DISABLED"]).optional(),
  subject_ids: z.array(z.string().uuid()).optional(),
  division_ids: z.array(z.string().uuid()).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one field must be provided",
});
```

---

## [5] Route Layer

### [5a] Router Factory — `index.ts`

```typescript
import { Hono } from "hono";
import { requireAnyPermission } from "../../../middleware/auth/resolve-rbac";
import type { BackofficeEnv } from "../types";
// ... handler imports

export function createCategoriesRouter(): Hono<BackofficeEnv> {
  const router = new Hono<BackofficeEnv>();
  const writeGuard = requireAnyPermission(["question_manage", "classification_manage"]);

  router.get("/categories", listCategoriesHandler);
  router.post("/categories", writeGuard, createCategoryHandler);
  // Static path MUST be declared before parameterised path
  router.get("/categories/tree", getCategoriesTreeHandler);
  router.get("/categories/:id", getCategoryHandler);
  router.patch("/categories/:id", writeGuard, updateCategoryHandler);
  router.delete("/categories/:id", writeGuard, deleteCategoryHandler);

  return router;
}

export const categoriesRouter = createCategoriesRouter();
```

**Route declaration order is mandatory**: `GET /categories/tree` (static) before `GET /categories/:id` (parameterised). Hono routes match first-declared — declaring `:id` first would capture the literal string `"tree"` as a UUID parameter.

### Middleware Stack (per request)

```
HTTP Request
    │
    ▼
tenant resolver middleware     → resolves tenant from subdomain/path slug
    │                            injects c.get('tenant').pool
    ▼
license middleware             → validates workspace license
    │                            ACTIVE: continue | SOFT_LOCKED: 423 | ARCHIVED: 403
    ▼
schema version middleware      → validates schema_version >= '1.14.0'
    │                            below minimum: 409 SCHEMA_VERSION_MISMATCH
    ▼
authentication middleware      → validates session token
    │
    ▼
RBAC resolver middleware       → resolves user permissions from DB
    │
    ▼
[write routes only]
requireAnyPermission(          → checks question_manage OR classification_manage
  ['question_manage',          → missing both: 403 FORBIDDEN
   'classification_manage'])
    │
    ▼
Route Handler
```

### [5b] `helpers.ts`

Identical structure to `apps/api/src/routes/backoffice/lessons/helpers.ts`:

- `getDb(c: Context): DbClient` — extracts `c.get('tenant').pool`
- `buildAuditCtx(c: Context): AuditContext` — builds audit context from context vars
- `successResponse<T>(data: T)` — standard `{ success: true, data, error: null }` envelope
- `categoriesErrorResponse(c, err)` — maps `CategoriesError` to JSON with HTTP status + structured logging

### [5c] `list-categories.ts` — GET /categories

```
1. Parse + validate query params via listCategoriesQuerySchema
2. Map parent_id query to parent_id_filter discriminator:
   - absent → { filter: 'none' }
   - 'null' → { filter: 'null' }
   - UUID string → { filter: 'uuid', value: uuid }
3. Call listCategories(db, input)
4. Return 200 { success, data: { items, total, page, limit }, error: null }
```

### [5d] `create-category.ts` — POST /categories

```
1. Parse body via createCategoryBodySchema
2. Call createCategory(db, body, audit)
3. Return 201 { success, data: ScopedCategoryRow, error: null }
```

### [5e] `get-categories-tree.ts` — GET /categories/tree

```
1. Parse query via categoriesTreeQuerySchema
2. Call getCategoriesTree(db, root_id?)
3. Return 200 { success, data: CategoryTreeNode[], error: null }
```

### [5f] `get-category.ts` — GET /categories/:id

```
1. Parse path params via categoryParamsSchema
2. Call getCategory(db, id)
3. Return 200 { success, data: ScopedCategoryRow, error: null }
```

### [5g] `update-category.ts` — PATCH /categories/:id

```
1. Parse path params via categoryParamsSchema
2. Parse body via updateCategoryBodySchema
3. Call updateCategory(db, id, body, audit)
4. Return 200 { success, data: ScopedCategoryRow, error: null }
```

### [5h] `delete-category.ts` — DELETE /categories/:id

```
1. Parse path params via categoryParamsSchema
2. Call deleteCategory(db, id, audit)
3. Return 200 { success, data: { deleted: true }, error: null }
```

---

## [6] Transaction Boundaries Summary

| Operation           | Lock                                                    | Scope Mutation                   | Rollback Trigger                                      |
| ------------------- | ------------------------------------------------------- | -------------------------------- | ----------------------------------------------------- |
| `createCategory`    | Parent row (if parent_id non-null): `FOR UPDATE NOWAIT` | INSERT scope rows in same TX     | Any guard failure, FK violation, constraint violation |
| `updateCategory`    | Target row: always `FOR UPDATE NOWAIT`                  | DELETE + INSERT scope in same TX | Any guard failure, FK violation, constraint violation |
| `deleteCategory`    | Target row: always `FOR UPDATE NOWAIT`                  | None                             | Any guard failure                                     |
| `listCategories`    | None                                                    | N/A                              | N/A                                                   |
| `getCategory`       | None                                                    | N/A                              | N/A                                                   |
| `getCategoriesTree` | None                                                    | N/A                              | N/A                                                   |

**Scope replacement is atomic**: All previous scope rows deleted, all new rows inserted within the same transaction as the main `categories` row mutation.

**NOWAIT semantics**: A locked row (concurrent request) raises PG error `55P03` immediately. This is caught by the error handler and returned as 409 (conflict signal to the client — retry).

---

## [7] Test Strategy

### [7a] Unit Tests — `packages/domain-core/src/categories/__tests__/categories.service.test.ts`

Uses mocked `DbClient` (same mock pattern as `lessons.service.test.ts`).

#### `createCategory` test cases

| Case                              | Input                                 | Expected                                                              |
| --------------------------------- | ------------------------------------- | --------------------------------------------------------------------- |
| Root category (no parent)         | `{ name: 'Difficulty' }`              | Returns ScopedCategoryRow with `parent_id: null`, `status: 'ENABLED'` |
| Child at depth 2                  | `{ name: 'Easy', parent_id: rootId }` | Returns row with correct parent_id                                    |
| Child at depth 3                  | Parent is depth-2 node                | Returns row at depth 3                                                |
| Parent at depth 3 → child blocked | Valid parent at depth 3               | Throws `CATEGORY_MAX_DEPTH_EXCEEDED`                                  |
| Duplicate name                    | Same name as existing                 | Throws `CATEGORY_NAME_DUPLICATE`                                      |
| Duplicate code                    | Same code (case-insensitive)          | Throws `CATEGORY_CODE_DUPLICATE`                                      |
| Parent not found                  | Non-existent parent_id                | Throws `CATEGORY_PARENT_NOT_FOUND`                                    |
| Subject not found                 | Invalid subject_id in subject_ids     | Throws `CATEGORY_SUBJECT_NOT_FOUND`                                   |
| Division not found                | Invalid division_id in division_ids   | Throws `CATEGORY_DIVISION_NOT_FOUND`                                  |
| With valid subject scope          | `{ subject_ids: [uuid1, uuid2] }`     | Scope rows inserted; returned subject_ids matches                     |
| Empty subject scope               | `{ subject_ids: [] }`                 | No scope rows; global scope                                           |

#### `updateCategory` test cases

| Case                                     | Expected                               |
| ---------------------------------------- | -------------------------------------- |
| Update name on ENABLED category          | Success; name updated                  |
| Non-status fields on DISABLED category   | Throws `CATEGORY_DISABLED`             |
| Status DISABLED on already-DISABLED      | Throws `CATEGORY_ALREADY_DISABLED`     |
| Status ENABLED on already-ENABLED        | Throws `CATEGORY_ALREADY_ENABLED`      |
| Status DISABLED with ENABLED children    | Throws `CATEGORY_HAS_ENABLED_CHILDREN` |
| Status DISABLED with no ENABLED children | Success; status updated                |
| Direct circular reference (A→A)          | Throws `CATEGORY_CIRCULAR_REFERENCE`   |
| Two-hop circular reference (A→B→A)       | Throws `CATEGORY_CIRCULAR_REFERENCE`   |
| Three-hop circular (A→B→C→A)             | Throws `CATEGORY_CIRCULAR_REFERENCE`   |
| Re-parent pushing descendant to depth 4  | Throws `CATEGORY_MAX_DEPTH_EXCEEDED`   |
| Promote to root (parent_id: null)        | Success; depth becomes 1               |
| Replace subject scope                    | scope rows deleted + re-inserted       |
| Clear subject scope (subject_ids: [])    | All subject scope deleted              |
| Absent subject_ids key                   | Existing scope unchanged               |
| Code duplicate (case-insensitive)        | Throws `CATEGORY_CODE_DUPLICATE`       |
| Name duplicate (case-insensitive)        | Throws `CATEGORY_NAME_DUPLICATE`       |

#### `deleteCategory` test cases

| Case                                       | Expected                                            |
| ------------------------------------------ | --------------------------------------------------- |
| ENABLED category, no ENABLED children      | Status set to DISABLED; returns `{ deleted: true }` |
| Already DISABLED category                  | Throws `CATEGORY_ALREADY_DISABLED`                  |
| ENABLED category with direct ENABLED child | Throws `CATEGORY_HAS_ENABLED_CHILDREN`              |
| Category not found                         | Throws `CATEGORY_NOT_FOUND`                         |

#### Additional cases

| Area              | Cases                                                        |
| ----------------- | ------------------------------------------------------------ |
| Depth computation | Depths 1, 2, 3 successfully; depth 4 blocked                 |
| Status re-enable  | DISABLED → ENABLED via PATCH                                 |
| Tree assembly     | Empty input → []; flat list → tree structure; root_id filter |

---

### [7b] Integration Tests — `apps/api/src/routes/backoffice/categories/__tests__/categories.integration.test.ts`

Uses real tenant DB (test isolation via transaction rollback per test).

| Test                                                          | Assertion                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `POST /categories` creates root category                      | 201, category row in DB, `subject_ids: []`, `division_ids: []`                       |
| `POST /categories` creates child category                     | 201, `parent_id` matches parent                                                      |
| `POST /categories` with valid subject scope                   | 201, `category_subjects` rows in DB                                                  |
| `POST /categories` rolls back on invalid subject_id           | 422/404; NO rows in `categories` OR `category_subjects`                              |
| `POST /categories` rolls back on invalid division_id          | 422/404; NO rows in `categories` OR `category_divisions`                             |
| `GET /categories` returns paginated list                      | 200, `{ items, total, page, limit }`                                                 |
| `GET /categories?status=ENABLED` filters correctly            | only ENABLED categories in items                                                     |
| `GET /categories?parent_id=null` returns only roots           | items with `parent_id: null` only                                                    |
| `GET /categories?parent_id=uuid` returns direct children      | items with `parent_id = uuid` only                                                   |
| `GET /categories?search=diff` matches name case-insensitively | items containing "diff" in name                                                      |
| `GET /categories/tree` returns nested structure               | depth-correct tree, only ENABLED                                                     |
| `GET /categories/tree` static path resolves before `/:id`     | 200, NOT 422 VALIDATION_ERROR                                                        |
| `GET /categories/:id` returns single with scope               | 200, subject_ids + division_ids populated                                            |
| `GET /categories/nonexistent` returns 404                     | 404 CATEGORY_NOT_FOUND                                                               |
| `PATCH /categories/:id` replaces scope atomically             | scope updated; absent key leaves old scope                                           |
| `PATCH /categories/:id` clears scope with []                  | `category_subjects` rows deleted                                                     |
| `DELETE /categories/:id` soft-deletes                         | 200 `{ deleted: true }`; status = DISABLED in DB                                     |
| `DELETE /categories/:id` with ENABLED children blocked        | 422 CATEGORY_HAS_ENABLED_CHILDREN                                                    |
| **Tenant isolation**                                          | Category from tenant-A not visible via tenant-B request                              |
| **License middleware**                                        | SOFT_LOCKED workspace → 423 on all routes                                            |
| **Schema version check**                                      | Tenant with schema_version < 1.14.0 → 409 SCHEMA_VERSION_MISMATCH                    |
| **Permission gate**                                           | User without question_manage OR classification_manage → 403 on POST/PATCH/DELETE     |
| **Transaction rollback**                                      | FK violation mid-transaction → no partial row in `categories` or `category_subjects` |

#### Migration Test

| Test                                                    | Assertion                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------ |
| `20260322_008_categories.ts` applies on empty tenant DB | All 3 tables created, all indexes created, schema version = 1.14.0 |
| Re-running migration is idempotent                      | `IF NOT EXISTS` guards prevent errors on re-run                    |

---

## Implementation Order

Execute in this order to satisfy dependencies:

1. **Migration** (`20260322_008_categories.ts`) — creates tables
2. **Drizzle schema** (`categories.schema.ts`) + register in `schemas/index.ts`
3. **Domain types** (`categories.types.ts`)
4. **Domain errors** (`categories.errors.ts`)
5. **Repository** (`categories.repository.ts`)
6. **Tree helper** (`categories.tree.ts`)
7. **Dependency registry** (`categories.dependency-registry.ts`)
8. **Service** (`categories.service.ts`)
9. **Domain index** (`categories/index.ts`)
10. **Validation schemas** (`packages/validation/src/backoffice/categories.schemas.ts`)
11. **Route helpers** (`helpers.ts`)
12. **Route handlers** (in any order): `list-categories.ts`, `create-category.ts`, `get-categories-tree.ts`, `get-category.ts`, `update-category.ts`, `delete-category.ts`
13. **Router factory** (`index.ts`) — register `categoriesRouter` in the Backoffice app
14. **Unit tests** (`categories.service.test.ts`)
15. **Integration tests** (`categories.integration.test.ts`)

---

## Constitution Check

| Rule                                  | Status                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------- |
| No cross-tenant access                | ✅ All tables in tenant DB; client from `c.get('tenant').pool`          |
| No middleware bypass                  | ✅ Tenant resolver → license → auth → RBAC → permission guard on writes |
| No grading outside worker             | ✅ Feature does not touch attempt/grading                               |
| No direct DB instantiation            | ✅ DB obtained from tenant resolver context only                        |
| No weakening of snapshot integrity    | ✅ Category FKs in downstream content are future-stage concern          |
| All writes transactional              | ✅ create/update/delete all wrapped in explicit BEGIN/COMMIT/ROLLBACK   |
| Server-authoritative time             | ✅ `created_at`/`updated_at` server-set; no client timestamps           |
| No console.log                        | ✅ All logging via `@zidney/logger` with required structured fields     |
| Forward-only migrations               | ✅ No `down()` function; `IF NOT EXISTS` guards                         |
| CONCURRENT for live indexes           | ✅ Two functional unique indexes run CONCURRENTLY outside transaction   |
| SELECT FOR UPDATE on hierarchy writes | ✅ Lock acquired before any ancestry traversal                          |
| Parameterized ILIKE queries           | ✅ `search` passed as parameter `$N`, never interpolated                |
| Soft delete only                      | ✅ No SQL DELETE path exposed via API                                   |
| Tenant isolation preserved            | ✅ No cross-tenant joins, no global DB singleton                        |
