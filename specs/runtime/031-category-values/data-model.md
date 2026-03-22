# Data Model: Category Values (Stage 031)

**Stage**: STAGE_31_CATEGORY_VALUES  
**Phase**: 03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION  
**Schema Version Bump**: `1.14.0 → 1.15.0`  
**Migration File**: `apps/api/src/db/tenant/migrations/20260322_009_category_values.ts`  
**Date**: 2026-03-22

---

## Entity Relationships

```
categories (PK: id)
  └── category_values (category_id FK → categories.id ON DELETE RESTRICT)
        ├── translations (entity_type = "CATEGORY_VALUE", entity_id FK)
        ├── category_value_subjects (category_value_id FK ON DELETE CASCADE)
        │     └── subjects (subject_id FK ON DELETE CASCADE)
        └── category_value_divisions (category_value_id FK ON DELETE CASCADE)
              └── divisions (division_id FK ON DELETE CASCADE)

Downstream (future stages):
  category_values.id ← mcq_questions.category_value_id
  category_values.id ← traditional_questions.category_value_id
```

---

## Table: `category_values`

### DDL (PostgreSQL)

```sql
CREATE TABLE IF NOT EXISTS category_values (
  id           UUID         NOT NULL DEFAULT gen_random_uuid(),
  category_id  UUID         NOT NULL,
  code         VARCHAR(100) NOT NULL,
  status       VARCHAR(20)  NOT NULL DEFAULT 'COMPLETED'
                 CONSTRAINT category_values_status_check
                 CHECK (status IN ('COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED', 'DISABLED')),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by   UUID,
  updated_by   UUID,
  deleted_at   TIMESTAMPTZ,
  CONSTRAINT category_values_pkey PRIMARY KEY (id)
);
```

### Foreign Keys

```sql
-- category_id → categories.id (RESTRICT prevents deleting category with active values)
ALTER TABLE category_values
  ADD CONSTRAINT IF NOT EXISTS category_values_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT;

-- created_by → users.id (SET NULL when user is deleted)
ALTER TABLE category_values
  ADD CONSTRAINT IF NOT EXISTS category_values_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- updated_by → users.id (SET NULL when user is deleted)
ALTER TABLE category_values
  ADD CONSTRAINT IF NOT EXISTS category_values_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
```

### Unique Index (per-category, case-insensitive, active values only)

```sql
-- CONCURRENTLY — must run OUTSIDE transaction block
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_category_values_code
  ON category_values (category_id, LOWER(code))
  WHERE deleted_at IS NULL;
```

### Notes

- `name` and `description` are **not** columns on `category_values`. They are stored in the
  shared `translations` table with `entity_type = 'CATEGORY_VALUE'`.
- `code` uniqueness is per `category_id` (not tenant-wide). Two categories may share a code.
- `deleted_at IS NULL` → active; `deleted_at IS NOT NULL` → soft-deleted.
- `ON DELETE RESTRICT` on `category_id`: a Category with live (non-soft-deleted) Category Values
  cannot be hard-deleted.

---

## Table: `category_value_subjects`

### DDL (PostgreSQL)

```sql
CREATE TABLE IF NOT EXISTS category_value_subjects (
  id                   UUID NOT NULL DEFAULT gen_random_uuid(),
  category_value_id    UUID NOT NULL,
  subject_id           UUID NOT NULL,
  CONSTRAINT category_value_subjects_pkey PRIMARY KEY (id),
  CONSTRAINT unique_category_value_subjects
    UNIQUE (category_value_id, subject_id)
);
```

### Foreign Keys

```sql
ALTER TABLE category_value_subjects
  ADD CONSTRAINT IF NOT EXISTS cv_subjects_category_value_id_fkey
  FOREIGN KEY (category_value_id) REFERENCES category_values(id) ON DELETE CASCADE;

ALTER TABLE category_value_subjects
  ADD CONSTRAINT IF NOT EXISTS cv_subjects_subject_id_fkey
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
```

### Semantics

- Empty rows for a `category_value_id` → value applies globally within the parent Category's
  subject scope.
- Rows present → value is restricted to those subjects. Must be a subset of the parent
  Category's `category_subjects`.
- Full-replace semantics on PATCH: DELETE all + INSERT new set (atomic within transaction).

---

## Table: `category_value_divisions`

### DDL (PostgreSQL)

```sql
CREATE TABLE IF NOT EXISTS category_value_divisions (
  id                   UUID NOT NULL DEFAULT gen_random_uuid(),
  category_value_id    UUID NOT NULL,
  division_id          UUID NOT NULL,
  CONSTRAINT category_value_divisions_pkey PRIMARY KEY (id),
  CONSTRAINT unique_category_value_divisions
    UNIQUE (category_value_id, division_id)
);
```

### Foreign Keys

```sql
ALTER TABLE category_value_divisions
  ADD CONSTRAINT IF NOT EXISTS cv_divisions_category_value_id_fkey
  FOREIGN KEY (category_value_id) REFERENCES category_values(id) ON DELETE CASCADE;

ALTER TABLE category_value_divisions
  ADD CONSTRAINT IF NOT EXISTS cv_divisions_division_id_fkey
  FOREIGN KEY (division_id) REFERENCES divisions(id) ON DELETE CASCADE;
```

---

## Indexes

### B-tree Indexes (inside transaction — safe on empty tables)

```sql
-- Lookup all values for a category
CREATE INDEX IF NOT EXISTS idx_category_values_category_id
  ON category_values (category_id);

-- Status-filtered queries
CREATE INDEX IF NOT EXISTS idx_category_values_status
  ON category_values (status);

-- Most common query: all active values for a category with a specific status
CREATE INDEX IF NOT EXISTS idx_category_values_category_id_status
  ON category_values (category_id, status);

-- Active-value scans (partial — only indexes non-null deleted_at = active rows as NULL)
CREATE INDEX IF NOT EXISTS idx_category_values_deleted_at
  ON category_values (deleted_at)
  WHERE deleted_at IS NULL;

-- Scope lookup: all values for a given subject
CREATE INDEX IF NOT EXISTS idx_cv_subjects_category_value_id
  ON category_value_subjects (category_value_id);

CREATE INDEX IF NOT EXISTS idx_cv_subjects_subject_id
  ON category_value_subjects (subject_id);

-- Scope lookup: all values for a given division
CREATE INDEX IF NOT EXISTS idx_cv_divisions_category_value_id
  ON category_value_divisions (category_value_id);

CREATE INDEX IF NOT EXISTS idx_cv_divisions_division_id
  ON category_value_divisions (division_id);
```

### Unique Functional Index (CONCURRENTLY — outside transaction)

```sql
-- Per-category case-insensitive code uniqueness for active values
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_category_values_code
  ON category_values (category_id, LOWER(code))
  WHERE deleted_at IS NULL;
```

> **Why CONCURRENTLY?** Prevents `SHARE` lock on tenant databases with existing rows. Avoids
> blocking reads/writes during fan-out migration across multiple tenants. Must run after COMMIT.

---

## Drizzle ORM Schema

### `apps/api/src/db/tenant/schemas/category-values.schema.ts`

```typescript
/**
 * Drizzle ORM Schema — category_values
 *
 * File: apps/api/src/db/tenant/schemas/category-values.schema.ts
 * Stage: STAGE_31_CATEGORY_VALUES
 *
 * NOTE: The functional unique index (unique_category_values_code) is migration-owned.
 * Drizzle cannot represent partial functional indexes. FK constraints are also migration-owned.
 */

import { check, index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const categoryValues = pgTable(
  "category_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category_id: uuid("category_id").notNull(),
    code: varchar("code", { length: 100 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("COMPLETED"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    created_by: uuid("created_by"),
    updated_by: uuid("updated_by"),
    deleted_at: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    statusCheck: check(
      "category_values_status_check",
      `${table.status.name} IN ('COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED', 'DISABLED')`,
    ),
    categoryIdIdx: index("idx_category_values_category_id").on(table.category_id),
    statusIdx: index("idx_category_values_status").on(table.status),
    categoryIdStatusIdx: index("idx_category_values_category_id_status").on(
      table.category_id,
      table.status,
    ),
    // unique_category_values_code: migration-owned partial functional index
    // FK constraints (category_id, created_by, updated_by): migration-owned
  }),
);

export type CategoryValue = typeof categoryValues.$inferSelect;
export type NewCategoryValue = typeof categoryValues.$inferInsert;
```

### `apps/api/src/db/tenant/schemas/category-value-subjects.schema.ts`

```typescript
/**
 * Drizzle ORM Schema — category_value_subjects
 *
 * File: apps/api/src/db/tenant/schemas/category-value-subjects.schema.ts
 * Stage: STAGE_31_CATEGORY_VALUES
 */

import { index, pgTable, unique, uuid } from "drizzle-orm/pg-core";

export const categoryValueSubjects = pgTable(
  "category_value_subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category_value_id: uuid("category_value_id").notNull(),
    subject_id: uuid("subject_id").notNull(),
  },
  (table) => ({
    uniqueCategoryValueSubjects: unique("unique_category_value_subjects").on(
      table.category_value_id,
      table.subject_id,
    ),
    categoryValueIdIdx: index("idx_cv_subjects_category_value_id").on(table.category_value_id),
    subjectIdIdx: index("idx_cv_subjects_subject_id").on(table.subject_id),
    // FK constraints: migration-owned
  }),
);

export type CategoryValueSubject = typeof categoryValueSubjects.$inferSelect;
export type NewCategoryValueSubject = typeof categoryValueSubjects.$inferInsert;
```

### `apps/api/src/db/tenant/schemas/category-value-divisions.schema.ts`

```typescript
/**
 * Drizzle ORM Schema — category_value_divisions
 *
 * File: apps/api/src/db/tenant/schemas/category-value-divisions.schema.ts
 * Stage: STAGE_31_CATEGORY_VALUES
 */

import { index, pgTable, unique, uuid } from "drizzle-orm/pg-core";

export const categoryValueDivisions = pgTable(
  "category_value_divisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category_value_id: uuid("category_value_id").notNull(),
    division_id: uuid("division_id").notNull(),
  },
  (table) => ({
    uniqueCategoryValueDivisions: unique("unique_category_value_divisions").on(
      table.category_value_id,
      table.division_id,
    ),
    categoryValueIdIdx: index("idx_cv_divisions_category_value_id").on(table.category_value_id),
    divisionIdIdx: index("idx_cv_divisions_division_id").on(table.division_id),
    // FK constraints: migration-owned
  }),
);

export type CategoryValueDivision = typeof categoryValueDivisions.$inferSelect;
export type NewCategoryValueDivision = typeof categoryValueDivisions.$inferInsert;
```

---

## Migration Plan: `20260322_009_category_values.ts`

### Migration Structure

```
Phase A — Inside BEGIN/COMMIT transaction:
  1. CREATE TABLE IF NOT EXISTS category_values (with status CHECK)
  2. CREATE TABLE IF NOT EXISTS category_value_subjects
  3. CREATE TABLE IF NOT EXISTS category_value_divisions
  4. FK: category_values.category_id → categories.id ON DELETE RESTRICT
  5. FK: category_values.created_by → users.id ON DELETE SET NULL
  6. FK: category_values.updated_by → users.id ON DELETE SET NULL
  7. FK: category_value_subjects.category_value_id → category_values.id ON DELETE CASCADE
  8. FK: category_value_subjects.subject_id → subjects.id ON DELETE CASCADE
  9. FK: category_value_divisions.category_value_id → category_values.id ON DELETE CASCADE
 10. FK: category_value_divisions.division_id → divisions.id ON DELETE CASCADE
 11. CREATE INDEX idx_category_values_category_id
 12. CREATE INDEX idx_category_values_status
 13. CREATE INDEX idx_category_values_category_id_status
 14. CREATE INDEX idx_category_values_deleted_at (partial: WHERE deleted_at IS NULL)
 15. CREATE INDEX idx_cv_subjects_category_value_id
 16. CREATE INDEX idx_cv_subjects_subject_id
 17. CREATE INDEX idx_cv_divisions_category_value_id
 18. CREATE INDEX idx_cv_divisions_division_id
 19. UPDATE _schema_versions SET version = '1.15.0'
 20. COMMIT

Phase B — After COMMIT (CONCURRENTLY — must run outside transaction):
 21. CREATE UNIQUE INDEX CONCURRENTLY unique_category_values_code
       ON category_values (category_id, LOWER(code)) WHERE deleted_at IS NULL
```

### Migration Safety Checklist

- [x] Forward-only (no `down()`)
- [x] All DDL uses `IF NOT EXISTS` guards
- [x] FK constraints wrapped in `DO $$ BEGIN IF NOT EXISTS ... END $$` blocks
- [x] `CONCURRENTLY` index runs after COMMIT outside transaction
- [x] Schema version incremented atomically inside transaction
- [x] No `DROP TABLE`, no `TRUNCATE`, no unconditional `DELETE`
- [x] No cross-tenant data operations
- [x] All tables are tenant DB only (no master DB tables touched)
- [x] Pre-requisite tables: `categories`, `subjects`, `divisions`, `users` — all exist after migration 008

---

## Translation Data Shape

Category Values do **not** have `name` or `description` columns. All display text is stored in
the shared `translations` table (no migration needed — table already exists since Stage 019).

| Column             | Value                                 |
| ------------------ | ------------------------------------- |
| `entity_type`      | `"CATEGORY_VALUE"` (string constant)  |
| `entity_id`        | `category_values.id` (UUID reference) |
| `field_name`       | `"name"` or `"description"`           |
| `language_code`    | `"ar"`, `"en"`, etc.                  |
| `translated_value` | The human-readable text               |

Upsert conflict target: `translations_composite_unique (entity_type, entity_id, field_name, language_code)`

---

## Type Definitions (`category-values.types.ts`)

```typescript
export type CategoryValueStatus =
  | "COMPLETED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "ENABLED"
  | "DISABLED";

export interface DbClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
}

export interface AuditContext {
  user_id: string | null;
  correlation_id: string;
  workspace_slug: string;
  workspace_id: string;
}

export interface TranslationInput {
  language_code: string;
  name: string;
  description?: string | null;
}

export interface TranslationRow {
  language_code: string;
  name: string;
  description: string | null;
}

export interface CategoryValueRow {
  id: string;
  category_id: string;
  code: string;
  status: CategoryValueStatus;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: Date | null;
}

export interface ScopedCategoryValueRow extends CategoryValueRow {
  subject_ids: string[];
  division_ids: string[];
  translations: TranslationRow[];
}

export interface FullCategoryValueRow extends ScopedCategoryValueRow {
  category: {
    id: string;
    name: string;
    status: string;
  };
}

export interface ListCategoryValuesInput {
  category_id: string;
  page: number;
  limit: number;
  status?: CategoryValueStatus;
  search?: string;
  language?: string;
  include_deleted?: boolean;
}

export interface ListCategoryValuesResult {
  items: ScopedCategoryValueRow[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateCategoryValueInput {
  category_id: string;
  code: string;
  translations: TranslationInput[];
  subject_ids?: string[];
  division_ids?: string[];
}

export interface UpdateCategoryValueInput {
  code?: string;
  status?: CategoryValueStatus;
  translations?: TranslationInput[];
  subject_ids?: string[];
  division_ids?: string[];
}

export interface WorkspaceLanguageConfig {
  default_language: string;
  supported_languages: string[];
}
```

---

## Error Code Catalog (`category-values.errors.ts`)

| Error Code                            | HTTP | Condition                                              |
| ------------------------------------- | ---- | ------------------------------------------------------ |
| `CATEGORY_VALUE_NOT_FOUND`            | 404  | Value not found or soft-deleted                        |
| `CATEGORY_VALUE_SUBJECT_NOT_FOUND`    | 404  | A subject_id in scope not found                        |
| `CATEGORY_VALUE_DIVISION_NOT_FOUND`   | 404  | A division_id in scope not found                       |
| `CATEGORY_NOT_FOUND`                  | 404  | Parent category not found                              |
| `CATEGORY_VALUE_CODE_DUPLICATE`       | 409  | code (case-insensitive) already taken in this category |
| `CATEGORY_VALUE_IN_USE`               | 422  | Value referenced by questions/exams                    |
| `CATEGORY_VALUE_CATEGORY_IMMUTABLE`   | 422  | Attempt to change category_id                          |
| `CATEGORY_VALUE_NAME_REQUIRED`        | 422  | No name translation for default language               |
| `CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT` | 422  | Scope IDs not a subset of parent category scope        |
| `CATEGORY_DISABLED`                   | 422  | Parent category is disabled                            |
| `INVALID_STATUS_TRANSITION`           | 422  | Invalid status transition                              |
| `UNSUPPORTED_LANGUAGE`                | 422  | language_code not in workspace config                  |
| `CATEGORY_VALUE_LOCK_CONFLICT`        | 409  | Row locked by concurrent request (55P03)               |
| `VALIDATION_ERROR`                    | 422  | Request validation failed                              |
