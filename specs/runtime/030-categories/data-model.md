# Data Model: Categories (Stage 030)

**Feature Branch**: `spec/030-categories`  
**Stage**: `STAGE_30_CATEGORIES`  
**Phase**: `03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION`  
**Schema Version**: `1.13.0 → 1.14.0`  
**Migration File**: `apps/api/src/db/tenant/migrations/20260322_008_categories.ts`

---

## Entity Relationship Diagram

```
divisions ──────────────────────────────────┐
                                            │ FK (CASCADE)
subjects ───────────────────────────────┐   │
                                        │   │
users ──┐ created_by / updated_by       │   │
        │ (SET NULL)                    │   │
        ▼                               ▼   ▼
   ┌─────────────┐    ┌──────────────────────┐    ┌──────────────────────────┐
   │  categories │◄───│  category_subjects   │    │  category_divisions      │
   │  (self-ref) │    │  (join table)        │    │  (join table)            │
   │  parent_id  │    └──────────────────────┘    └──────────────────────────┘
   │  RESTRICT   │───►(category_id FK CASCADE)     (category_id FK CASCADE)
   └─────────────┘
        │
        ▼
   (downstream) mcq_questions.category_value_id   [future stage]
   (downstream) traditional_questions.category_value_id [future stage]
```

---

## Table: `categories` (Tenant DB)

### DDL

```sql
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
);
```

### Columns

| Column        | PostgreSQL Type | Nullable | Default             | Notes                                            |
| ------------- | --------------- | -------- | ------------------- | ------------------------------------------------ |
| `id`          | `UUID`          | NOT NULL | `gen_random_uuid()` | PK                                               |
| `name`        | `VARCHAR(255)`  | NOT NULL | —                   | Case-insensitive uniqueness via functional index |
| `code`        | `VARCHAR(100)`  | NULL     | —                   | Optional; unique per tenant when non-null        |
| `description` | `TEXT`          | NULL     | —                   | Free-form                                        |
| `parent_id`   | `UUID`          | NULL     | —                   | Self-reference; NULL = root (depth 1)            |
| `status`      | `VARCHAR(20)`   | NOT NULL | `'ENABLED'`         | CHECK: `ENABLED \| DISABLED`                     |
| `created_at`  | `TIMESTAMPTZ`   | NOT NULL | `NOW()`             | Server-set at creation                           |
| `updated_at`  | `TIMESTAMPTZ`   | NOT NULL | `NOW()`             | Server-set on every write                        |
| `created_by`  | `UUID`          | NULL     | —                   | FK → `users.id` ON DELETE SET NULL               |
| `updated_by`  | `UUID`          | NULL     | —                   | FK → `users.id` ON DELETE SET NULL               |

### Constraints (migration-owned)

| Constraint Name              | Type        | Definition                                      |
| ---------------------------- | ----------- | ----------------------------------------------- |
| `categories_pkey`            | PRIMARY KEY | `id`                                            |
| `categories_status_check`    | CHECK       | `status IN ('ENABLED', 'DISABLED')`             |
| `categories_parent_id_fkey`  | FOREIGN KEY | `parent_id → categories(id) ON DELETE RESTRICT` |
| `categories_created_by_fkey` | FOREIGN KEY | `created_by → users(id) ON DELETE SET NULL`     |
| `categories_updated_by_fkey` | FOREIGN KEY | `updated_by → users(id) ON DELETE SET NULL`     |

### Indexes

| Index Name                 | Type                          | Expression                                       | Notes                                        |
| -------------------------- | ----------------------------- | ------------------------------------------------ | -------------------------------------------- |
| `unique_categories_name`   | UNIQUE CONCURRENTLY           | `categories(LOWER(name))`                        | Case-insensitive tenant-wide name uniqueness |
| `unique_categories_code`   | UNIQUE CONCURRENTLY (PARTIAL) | `categories(LOWER(code)) WHERE code IS NOT NULL` | Nulls excluded; prevents case variants       |
| `idx_categories_parent_id` | B-TREE                        | `categories(parent_id)`                          | Hierarchy queries, child lookup              |
| `idx_categories_status`    | B-TREE                        | `categories(status)`                             | Status-filtered list queries                 |

> **CONCURRENT note**: `unique_categories_name` and `unique_categories_code` are created with `CONCURRENTLY` **outside the migration transaction block** to avoid write-blocking on live tenant databases. All other indexes run inside the transaction.

---

## Table: `category_subjects` (Tenant DB)

### DDL

```sql
CREATE TABLE IF NOT EXISTS category_subjects (
  id           UUID NOT NULL DEFAULT gen_random_uuid(),
  category_id  UUID NOT NULL,
  subject_id   UUID NOT NULL,
  CONSTRAINT   category_subjects_pkey PRIMARY KEY (id),
  CONSTRAINT   unique_category_subjects UNIQUE (category_id, subject_id)
);
```

### Columns

| Column        | Type   | Nullable | Notes                                  |
| ------------- | ------ | -------- | -------------------------------------- |
| `id`          | `UUID` | NOT NULL | PK                                     |
| `category_id` | `UUID` | NOT NULL | FK → `categories.id` ON DELETE CASCADE |
| `subject_id`  | `UUID` | NOT NULL | FK → `subjects.id` ON DELETE CASCADE   |

### Constraints (migration-owned)

| Constraint Name                      | Type        | Definition                                       |
| ------------------------------------ | ----------- | ------------------------------------------------ |
| `category_subjects_pkey`             | PRIMARY KEY | `id`                                             |
| `unique_category_subjects`           | UNIQUE      | `(category_id, subject_id)`                      |
| `category_subjects_category_id_fkey` | FOREIGN KEY | `category_id → categories(id) ON DELETE CASCADE` |
| `category_subjects_subject_id_fkey`  | FOREIGN KEY | `subject_id → subjects(id) ON DELETE CASCADE`    |

### Indexes

| Index Name                          | Type   | Expression                       | Notes                     |
| ----------------------------------- | ------ | -------------------------------- | ------------------------- |
| `idx_category_subjects_category_id` | B-TREE | `category_subjects(category_id)` | Scope lookup by category  |
| `idx_category_subjects_subject_id`  | B-TREE | `category_subjects(subject_id)`  | Reverse lookup by subject |

---

## Table: `category_divisions` (Tenant DB)

### DDL

```sql
CREATE TABLE IF NOT EXISTS category_divisions (
  id           UUID NOT NULL DEFAULT gen_random_uuid(),
  category_id  UUID NOT NULL,
  division_id  UUID NOT NULL,
  CONSTRAINT   category_divisions_pkey PRIMARY KEY (id),
  CONSTRAINT   unique_category_divisions UNIQUE (category_id, division_id)
);
```

### Columns

| Column        | Type   | Nullable | Notes                                  |
| ------------- | ------ | -------- | -------------------------------------- |
| `id`          | `UUID` | NOT NULL | PK                                     |
| `category_id` | `UUID` | NOT NULL | FK → `categories.id` ON DELETE CASCADE |
| `division_id` | `UUID` | NOT NULL | FK → `divisions.id` ON DELETE CASCADE  |

### Constraints (migration-owned)

| Constraint Name                       | Type        | Definition                                       |
| ------------------------------------- | ----------- | ------------------------------------------------ |
| `category_divisions_pkey`             | PRIMARY KEY | `id`                                             |
| `unique_category_divisions`           | UNIQUE      | `(category_id, division_id)`                     |
| `category_divisions_category_id_fkey` | FOREIGN KEY | `category_id → categories(id) ON DELETE CASCADE` |
| `category_divisions_division_id_fkey` | FOREIGN KEY | `division_id → divisions(id) ON DELETE CASCADE`  |

### Indexes

| Index Name                           | Type   | Expression                        | Notes                      |
| ------------------------------------ | ------ | --------------------------------- | -------------------------- |
| `idx_category_divisions_category_id` | B-TREE | `category_divisions(category_id)` | Scope lookup by category   |
| `idx_category_divisions_division_id` | B-TREE | `category_divisions(division_id)` | Reverse lookup by division |

---

## Drizzle ORM Schema

File: `apps/api/src/db/tenant/schemas/categories.schema.ts`

```typescript
/**
 * Drizzle ORM Schema — categories, category_subjects, category_divisions
 *
 * File: apps/api/src/db/tenant/schemas/categories.schema.ts
 * Stage: STAGE_30_CATEGORIES
 *
 * NOTE: Functional/partial unique indexes and FK constraints are migration-owned.
 * Drizzle cannot represent partial functional indexes, so they are intentionally
 * absent here. This follows the convention established for subjects.schema.ts.
 *
 * Unique indexes (migration-owned, CONCURRENT):
 *   - unique_categories_name: LOWER(name) — tenant-wide case-insensitive name uniqueness
 *   - unique_categories_code: LOWER(code) WHERE code IS NOT NULL
 *
 * FK constraints (migration-owned):
 *   - categories.parent_id → categories.id ON DELETE RESTRICT
 *   - categories.created_by → users.id ON DELETE SET NULL
 *   - categories.updated_by → users.id ON DELETE SET NULL
 *   - category_subjects.category_id → categories.id ON DELETE CASCADE
 *   - category_subjects.subject_id → subjects.id ON DELETE CASCADE
 *   - category_divisions.category_id → categories.id ON DELETE CASCADE
 *   - category_divisions.division_id → divisions.id ON DELETE CASCADE
 */

import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// categories
// ---------------------------------------------------------------------------

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 100 }),
    description: text("description"),
    parent_id: uuid("parent_id"),
    status: varchar("status", { length: 20 }).notNull().default("ENABLED"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    created_by: uuid("created_by"),
    updated_by: uuid("updated_by"),
  },
  (table) => ({
    parentIdIdx: index("idx_categories_parent_id").on(table.parent_id),
    statusIdx: index("idx_categories_status").on(table.status),
    // unique_categories_name: migration-owned functional index LOWER(name)
    // unique_categories_code: migration-owned partial functional index
    // FK constraints: migration-owned
  }),
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

// ---------------------------------------------------------------------------
// category_subjects
// ---------------------------------------------------------------------------

export const categorySubjects = pgTable(
  "category_subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category_id: uuid("category_id").notNull(),
    subject_id: uuid("subject_id").notNull(),
  },
  (table) => ({
    categoryIdIdx: index("idx_category_subjects_category_id").on(table.category_id),
    subjectIdIdx: index("idx_category_subjects_subject_id").on(table.subject_id),
    // unique_category_subjects: migration-owned UNIQUE constraint
    // FK constraints: migration-owned
  }),
);

export type CategorySubject = typeof categorySubjects.$inferSelect;
export type NewCategorySubject = typeof categorySubjects.$inferInsert;

// ---------------------------------------------------------------------------
// category_divisions
// ---------------------------------------------------------------------------

export const categoryDivisions = pgTable(
  "category_divisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category_id: uuid("category_id").notNull(),
    division_id: uuid("division_id").notNull(),
  },
  (table) => ({
    categoryIdIdx: index("idx_category_divisions_category_id").on(table.category_id),
    divisionIdIdx: index("idx_category_divisions_division_id").on(table.division_id),
    // unique_category_divisions: migration-owned UNIQUE constraint
    // FK constraints: migration-owned
  }),
);

export type CategoryDivision = typeof categoryDivisions.$inferSelect;
export type NewCategoryDivision = typeof categoryDivisions.$inferInsert;
```

---

## Domain Types

File: `packages/domain-core/src/categories/categories.types.ts`

### Key Types

```typescript
export type CategoryStatus = "ENABLED" | "DISABLED";

export interface CategoryRow {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  parent_id: string | null;
  status: CategoryStatus;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
}

export interface ScopedCategoryRow extends CategoryRow {
  subject_ids: string[];
  division_ids: string[];
}

export interface ListCategoriesInput {
  page: number;
  limit: number;
  parent_id?: string | null; // string UUID = filter by parent, null = root-only filter
  parent_id_filter?: "uuid" | "null" | "none"; // disambiguates absent vs explicit null
  status?: CategoryStatus;
  search?: string;
}

export interface ListCategoriesResult {
  items: ScopedCategoryRow[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateCategoryInput {
  name: string;
  code?: string | null;
  description?: string | null;
  parent_id?: string | null;
  subject_ids?: string[];
  division_ids?: string[];
}

export interface UpdateCategoryInput {
  name?: string;
  code?: string | null;
  description?: string | null;
  parent_id?: string | null;
  status?: CategoryStatus;
  subject_ids?: string[]; // undefined = no change; [] = clear all; [ids] = replace
  division_ids?: string[]; // same semantics
}

export interface CategoryTreeNode {
  id: string;
  name: string;
  code: string | null;
  children: CategoryTreeNode[];
}
```

---

## Status Lifecycle

```
         CREATE
           │
           ▼
        ENABLED ◄──────────────────────────────────────────────┐
           │                                                    │
           │  DELETE /categories/:id                           │
           │  PATCH { status: 'DISABLED' }                     │
           │  (blocked if direct ENABLED children exist)       │
           ▼                                                    │
        DISABLED ───── PATCH { status: 'ENABLED' } ───────────┘
```

Initial state on `createCategory`: `ENABLED`  
Hard SQL DELETE: NEVER exposed via API. `ON DELETE RESTRICT` on `parent_id` and future downstream FKs prevent physical deletion.

---

## Hierarchy Rules

| Depth | Meaning                  | parent_id                           |
| ----- | ------------------------ | ----------------------------------- |
| 1     | Root category            | `NULL`                              |
| 2     | Child of root            | Root's `id`                         |
| 3     | Grandchild (max allowed) | Child's `id`                        |
| 4     | **FORBIDDEN**            | → 422 `CATEGORY_MAX_DEPTH_EXCEEDED` |

- Max depth enforced at service layer via ancestor chain traversal (max 3 hops)
- Re-parenting via PATCH: entire subtree moves with the category; combined depth checked
- `ON DELETE RESTRICT` on `parent_id`: DB-level prevention of parent hard-delete when children exist

---

## Error Code → HTTP Status Map

| Error Code                       | HTTP |
| -------------------------------- | ---- |
| `CATEGORY_NOT_FOUND`             | 404  |
| `CATEGORY_NAME_DUPLICATE`        | 409  |
| `CATEGORY_CODE_DUPLICATE`        | 409  |
| `CATEGORY_PARENT_NOT_FOUND`      | 404  |
| `CATEGORY_MAX_DEPTH_EXCEEDED`    | 422  |
| `CATEGORY_CIRCULAR_REFERENCE`    | 422  |
| `CATEGORY_DISABLED`              | 422  |
| `CATEGORY_ALREADY_DISABLED`      | 422  |
| `CATEGORY_ALREADY_ENABLED`       | 422  |
| `CATEGORY_HAS_ENABLED_CHILDREN`  | 422  |
| `CATEGORY_HAS_DEPENDENT_CONTENT` | 409  |
| `CATEGORY_SUBJECT_NOT_FOUND`     | 404  |
| `CATEGORY_DIVISION_NOT_FOUND`    | 404  |
| `VALIDATION_ERROR`               | 422  |
