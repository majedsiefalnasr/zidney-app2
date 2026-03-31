# Data Model — STAGE_34_MCQ_QUESTION_MODEL

**Stage**: STAGE_34_MCQ_QUESTION_MODEL  
**Branch**: `spec/034-mcq-question-model`  
**Date**: 2026-03-30  
**Database**: Tenant DB only (zero master DB access)

---

## Entity Relationship Overview

```
subjects ──┐
divisions ──┤── mcq_questions ──┬── mcq_question_options
lessons ────┘        │          ├── mcq_question_categories ── category_values
                     │          ├── mcq_question_tags ── tags
                     │          └── mcq_question_baskets ── mcq_baskets
                     │
                workflow_logs (via shared workflow engine)
```

---

## Table: `mcq_questions`

**Purpose**: Core question entity. One row per MCQ question in the tenant.

| Column              | Type        | Nullable | Default             | Constraints / Notes                                                                      |
| ------------------- | ----------- | -------- | ------------------- | ---------------------------------------------------------------------------------------- |
| `id`                | UUID        | NO       | `gen_random_uuid()` | PRIMARY KEY                                                                              |
| `subject_id`        | UUID        | NO       | —                   | FK → `subjects.id` ON DELETE RESTRICT                                                    |
| `division_id`       | UUID        | YES      | NULL                | FK → `divisions.id` ON DELETE SET NULL                                                   |
| `lesson_id`         | UUID        | YES      | NULL                | FK → `lessons.id` ON DELETE SET NULL                                                     |
| `question_type`     | VARCHAR(20) | NO       | —                   | CHECK IN ('SINGLE', 'MULTIPLE', 'TRUE_FALSE', 'ARRANGEMENT')                             |
| `language`          | VARCHAR(10) | NO       | —                   | Non-empty (e.g., 'ar', 'en')                                                             |
| `content`           | TEXT        | NO       | —                   | Rich text; sanitized server-side before storage                                          |
| `explanation`       | TEXT        | YES      | NULL                | Rich text; sanitized server-side before storage                                          |
| `is_revision_only`  | BOOLEAN     | NO       | `false`             | Usage flag for filtering                                                                 |
| `is_exam_only`      | BOOLEAN     | NO       | `false`             | Usage flag for filtering                                                                 |
| `status`            | VARCHAR(30) | NO       | `'DRAFT'`           | Managed by workflow engine; CHECK IN (DRAFT, COMPLETED, UNDER_REVIEW, APPROVED, ENABLED) |
| `deleted_at`        | TIMESTAMPTZ | YES      | NULL                | Soft delete marker; NULL = active, NOT NULL = deleted                                    |
| `created_at`        | TIMESTAMPTZ | NO       | `NOW()`             | Server-set                                                                               |
| `updated_at`        | TIMESTAMPTZ | NO       | `NOW()`             | Server-set; used for optimistic concurrency                                              |
| `created_by`        | UUID        | YES      | NULL                | FK → backoffice_staff_users.id (migration-owned)                                         |
| `updated_by`        | UUID        | YES      | NULL                | FK → backoffice_staff_users.id (migration-owned)                                         |
| `status_updated_at` | TIMESTAMPTZ | YES      | NULL                | Set by workflow engine on every status transition                                        |
| `status_updated_by` | UUID        | YES      | NULL                | FK → backoffice_staff_users.id; set by workflow engine                                   |

**CHECK Constraints**:

- `mcq_questions_type_check`: `question_type IN ('SINGLE', 'MULTIPLE', 'TRUE_FALSE', 'ARRANGEMENT')`
- `mcq_questions_status_check`: `status IN ('DRAFT', 'COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED')`

**Indexes**:
| Index Name | Columns | Purpose |
| ---------------------------------- | -------------------------- | -------------------------------------------- |
| `idx_mcq_questions_subject_id` | `subject_id` | Subject-filtered queries + auto-selection |
| `idx_mcq_questions_division_id` | `division_id` | Division-filtered queries |
| `idx_mcq_questions_lesson_id` | `lesson_id` | Lesson-filtered queries |
| `idx_mcq_questions_question_type` | `question_type` | Type-filtered queries |
| `idx_mcq_questions_status` | `status` | Status-filtered queries |
| `idx_mcq_questions_deleted_at` | `deleted_at` | Exclude soft-deleted from list queries |

**Foreign Key Cascade Rules**:

- `subject_id → subjects.id ON DELETE RESTRICT` — cannot delete subject with existing questions
- `division_id → divisions.id ON DELETE SET NULL` — division deletion nulls the reference
- `lesson_id → lessons.id ON DELETE SET NULL` — lesson deletion nulls the reference
- `created_by`, `updated_by`, `status_updated_by` — migration-owned FKs (no Drizzle-level reference)

---

## Table: `mcq_question_options`

**Purpose**: Normalized answer options for a question. One row per option.

| Column        | Type        | Nullable | Default             | Constraints / Notes                                        |
| ------------- | ----------- | -------- | ------------------- | ---------------------------------------------------------- |
| `id`          | UUID        | NO       | `gen_random_uuid()` | PRIMARY KEY                                                |
| `question_id` | UUID        | NO       | —                   | FK → `mcq_questions.id` ON DELETE CASCADE                  |
| `content`     | TEXT        | NO       | —                   | Rich text; sanitized server-side                           |
| `is_correct`  | BOOLEAN     | NO       | `false`             | Whether this option is a correct answer                    |
| `order_index` | INTEGER     | NO       | —                   | Display ordering; used as correct sequence for ARRANGEMENT |
| `created_at`  | TIMESTAMPTZ | NO       | `NOW()`             | Server-set                                                 |

**UNIQUE Constraints**:

- `uq_mcq_question_options_question_order`: `UNIQUE (question_id, order_index)` — prevents duplicate ordering

**Indexes**:
| Index Name | Columns | Purpose |
| --------------------------------------- | -------------- | ----------------------------- |
| `idx_mcq_question_options_question_id` | `question_id` | Question → options lookups |

**Cascade Rules**:

- `question_id → mcq_questions.id ON DELETE CASCADE` — deleting a question removes all its options

**Type-Specific Validation Rules** (enforced at application level, not DB constraints):

| Question Type | Option Count | Correct Count (`is_correct = true`) | `order_index` Semantics  |
| ------------- | ------------ | ----------------------------------- | ------------------------ |
| `SINGLE`      | ≥ 2          | Exactly 1                           | Display ordering         |
| `MULTIPLE`    | ≥ 2          | ≥ 1                                 | Display ordering         |
| `TRUE_FALSE`  | Exactly 2    | Exactly 1                           | Display ordering         |
| `ARRANGEMENT` | ≥ 2          | N/A (`is_correct` ignored)          | Defines correct sequence |

---

## Table: `mcq_question_categories`

**Purpose**: Many-to-many link between questions and category values.

| Column              | Type | Nullable | Default             | Constraints / Notes                         |
| ------------------- | ---- | -------- | ------------------- | ------------------------------------------- |
| `id`                | UUID | NO       | `gen_random_uuid()` | PRIMARY KEY                                 |
| `question_id`       | UUID | NO       | —                   | FK → `mcq_questions.id` ON DELETE CASCADE   |
| `category_value_id` | UUID | NO       | —                   | FK → `category_values.id` ON DELETE CASCADE |

**UNIQUE Constraints**:

- `uq_mcq_question_categories`: `UNIQUE (question_id, category_value_id)` — prevents duplicate links

**Indexes**:
| Index Name | Columns | Purpose |
| -------------------------------------------------- | -------------------- | ------------------------------------------- |
| `idx_mcq_question_categories_question_id` | `question_id` | Question → categories lookups |
| `idx_mcq_question_categories_category_value_id` | `category_value_id` | Category → questions lookups (auto-select) |

---

## Table: `mcq_question_tags`

**Purpose**: Many-to-many link between questions and tags.

| Column        | Type | Nullable | Default             | Constraints / Notes                       |
| ------------- | ---- | -------- | ------------------- | ----------------------------------------- |
| `id`          | UUID | NO       | `gen_random_uuid()` | PRIMARY KEY                               |
| `question_id` | UUID | NO       | —                   | FK → `mcq_questions.id` ON DELETE CASCADE |
| `tag_id`      | UUID | NO       | —                   | FK → `tags.id` ON DELETE CASCADE          |

**UNIQUE Constraints**:

- `uq_mcq_question_tags`: `UNIQUE (question_id, tag_id)` — prevents duplicate links

**Indexes**:
| Index Name | Columns | Purpose |
| ---------------------------------- | -------------- | ------------------------------------ |
| `idx_mcq_question_tags_question_id`| `question_id` | Question → tags lookups |
| `idx_mcq_question_tags_tag_id` | `tag_id` | Tag → questions lookups (auto-select)|

---

## Table: `mcq_question_baskets`

**Purpose**: Many-to-many link between questions and MCQ baskets.

| Column        | Type | Nullable | Default             | Constraints / Notes                       |
| ------------- | ---- | -------- | ------------------- | ----------------------------------------- |
| `id`          | UUID | NO       | `gen_random_uuid()` | PRIMARY KEY                               |
| `question_id` | UUID | NO       | —                   | FK → `mcq_questions.id` ON DELETE CASCADE |
| `basket_id`   | UUID | NO       | —                   | FK → `mcq_baskets.id` ON DELETE CASCADE   |

**UNIQUE Constraints**:

- `uq_mcq_question_baskets`: `UNIQUE (question_id, basket_id)` — prevents duplicate links

**Indexes**:
| Index Name | Columns | Purpose |
| --------------------------------------- | -------------- | ---------------------------------------- |
| `idx_mcq_question_baskets_question_id` | `question_id` | Question → baskets lookups |
| `idx_mcq_question_baskets_basket_id` | `basket_id` | Basket → questions lookups (auto-select) |

---

## Drizzle Schema Design

### `mcq-questions.schema.ts`

```ts
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { subjects } from "./subjects.schema";

export const mcqQuestions = pgTable(
  "mcq_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subject_id: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    division_id: uuid("division_id"),
    lesson_id: uuid("lesson_id"),
    question_type: varchar("question_type", { length: 20 }).notNull(),
    language: varchar("language", { length: 10 }).notNull(),
    content: text("content").notNull(),
    explanation: text("explanation"),
    is_revision_only: boolean("is_revision_only").notNull().default(false),
    is_exam_only: boolean("is_exam_only").notNull().default(false),
    status: varchar("status", { length: 30 }).notNull().default("DRAFT"),
    deleted_at: timestamp("deleted_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    created_by: uuid("created_by"),
    updated_by: uuid("updated_by"),
    status_updated_at: timestamp("status_updated_at", { withTimezone: true }),
    status_updated_by: uuid("status_updated_by"),
  },
  (table) => ({
    typeCheck: check(
      "mcq_questions_type_check",
      sql`${table.question_type} IN ('SINGLE', 'MULTIPLE', 'TRUE_FALSE', 'ARRANGEMENT')`,
    ),
    statusCheck: check(
      "mcq_questions_status_check",
      sql`${table.status} IN ('DRAFT', 'COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED')`,
    ),
    subjectIdIdx: index("idx_mcq_questions_subject_id").on(table.subject_id),
    divisionIdIdx: index("idx_mcq_questions_division_id").on(table.division_id),
    lessonIdIdx: index("idx_mcq_questions_lesson_id").on(table.lesson_id),
    questionTypeIdx: index("idx_mcq_questions_question_type").on(table.question_type),
    statusIdx: index("idx_mcq_questions_status").on(table.status),
    deletedAtIdx: index("idx_mcq_questions_deleted_at").on(table.deleted_at),
    // FK constraints (division_id → divisions.id, lesson_id → lessons.id,
    // created_by, updated_by, status_updated_by → backoffice_staff_users.id): migration-owned
  }),
);

export type McqQuestion = typeof mcqQuestions.$inferSelect;
export type NewMcqQuestion = typeof mcqQuestions.$inferInsert;
```

### `mcq-question-options.schema.ts`

```ts
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { mcqQuestions } from "./mcq-questions.schema";

export const mcqQuestionOptions = pgTable(
  "mcq_question_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    question_id: uuid("question_id")
      .notNull()
      .references(() => mcqQuestions.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    is_correct: boolean("is_correct").notNull().default(false),
    order_index: integer("order_index").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    questionOrderUnique: unique("uq_mcq_question_options_question_order").on(
      table.question_id,
      table.order_index,
    ),
    questionIdIdx: index("idx_mcq_question_options_question_id").on(table.question_id),
  }),
);

export type McqQuestionOption = typeof mcqQuestionOptions.$inferSelect;
export type NewMcqQuestionOption = typeof mcqQuestionOptions.$inferInsert;
```

### `mcq-question-categories.schema.ts`

```ts
import { index, pgTable, unique, uuid } from "drizzle-orm/pg-core";
import { mcqQuestions } from "./mcq-questions.schema";
import { categoryValues } from "./category-values.schema";

export const mcqQuestionCategories = pgTable(
  "mcq_question_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    question_id: uuid("question_id")
      .notNull()
      .references(() => mcqQuestions.id, { onDelete: "cascade" }),
    category_value_id: uuid("category_value_id")
      .notNull()
      .references(() => categoryValues.id, { onDelete: "cascade" }),
  },
  (table) => ({
    questionCategoryUnique: unique("uq_mcq_question_categories").on(
      table.question_id,
      table.category_value_id,
    ),
    questionIdIdx: index("idx_mcq_question_categories_question_id").on(table.question_id),
    categoryValueIdIdx: index("idx_mcq_question_categories_category_value_id").on(
      table.category_value_id,
    ),
  }),
);

export type McqQuestionCategory = typeof mcqQuestionCategories.$inferSelect;
export type NewMcqQuestionCategory = typeof mcqQuestionCategories.$inferInsert;
```

### `mcq-question-tags.schema.ts`

```ts
import { index, pgTable, unique, uuid } from "drizzle-orm/pg-core";
import { mcqQuestions } from "./mcq-questions.schema";
import { tags } from "./tags.schema";

export const mcqQuestionTags = pgTable(
  "mcq_question_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    question_id: uuid("question_id")
      .notNull()
      .references(() => mcqQuestions.id, { onDelete: "cascade" }),
    tag_id: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => ({
    questionTagUnique: unique("uq_mcq_question_tags").on(table.question_id, table.tag_id),
    questionIdIdx: index("idx_mcq_question_tags_question_id").on(table.question_id),
    tagIdIdx: index("idx_mcq_question_tags_tag_id").on(table.tag_id),
  }),
);

export type McqQuestionTag = typeof mcqQuestionTags.$inferSelect;
export type NewMcqQuestionTag = typeof mcqQuestionTags.$inferInsert;
```

### `mcq-question-baskets.schema.ts`

```ts
import { index, pgTable, unique, uuid } from "drizzle-orm/pg-core";
import { mcqQuestions } from "./mcq-questions.schema";
import { mcqBaskets } from "./baskets.schema";

export const mcqQuestionBaskets = pgTable(
  "mcq_question_baskets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    question_id: uuid("question_id")
      .notNull()
      .references(() => mcqQuestions.id, { onDelete: "cascade" }),
    basket_id: uuid("basket_id")
      .notNull()
      .references(() => mcqBaskets.id, { onDelete: "cascade" }),
  },
  (table) => ({
    questionBasketUnique: unique("uq_mcq_question_baskets").on(table.question_id, table.basket_id),
    questionIdIdx: index("idx_mcq_question_baskets_question_id").on(table.question_id),
    basketIdIdx: index("idx_mcq_question_baskets_basket_id").on(table.basket_id),
  }),
);

export type McqQuestionBasket = typeof mcqQuestionBaskets.$inferSelect;
export type NewMcqQuestionBasket = typeof mcqQuestionBaskets.$inferInsert;
```

---

## Migration Design

**File**: `apps/api/src/db/tenant/migrations/20260330_012_mcq_questions.ts`

**Transaction boundary**: Single `BEGIN` → all DDL → `UPDATE schema_version` → `COMMIT`

**DDL Sequence**:

1. CREATE TABLE `mcq_questions` with columns, CHECK constraints
2. CREATE INDEX (6 indexes on mcq_questions)
3. ADD FK constraints (division_id, lesson_id, created_by, updated_by, status_updated_by)
4. CREATE TABLE `mcq_question_options` with columns, UNIQUE constraint
5. CREATE INDEX (1 index on mcq_question_options)
6. CREATE TABLE `mcq_question_categories` with columns, UNIQUE constraint
7. CREATE INDEX (2 indexes on mcq_question_categories)
8. CREATE TABLE `mcq_question_tags` with columns, UNIQUE constraint
9. CREATE INDEX (2 indexes on mcq_question_tags)
10. CREATE TABLE `mcq_question_baskets` with columns, UNIQUE constraint
11. CREATE INDEX (2 indexes on mcq_question_baskets)
12. UPDATE `schema_versions` SET `version = '...'`

All DDL uses `IF NOT EXISTS` for idempotency.
`down()` throws per ADR-0008 (forward-only migrations).

---

## State Machine

```
     ┌──────────────────────────────────────────────────────┐
     │                                                      │
  DRAFT ───→ COMPLETED ───→ UNDER_REVIEW ───→ APPROVED ───→ ENABLED
     │                                                      │
     └──── (deleted_at set) ── SOFT DELETED ────────────────┘
                    │
          DRAFT only + no refs
                    ↓
              HARD DELETED
```

- Status transitions are FORWARD-ONLY (no backward transitions for MCQ questions)
- `ENABLED` transition requires valid type-specific option configuration
- Soft delete sets `deleted_at` on any status
- Hard delete physically removes the row (DRAFT + no references only)
