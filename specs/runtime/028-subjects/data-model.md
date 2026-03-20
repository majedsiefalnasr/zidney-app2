# Data Model: Subjects (STAGE_28)

**Stage:** STAGE_28_SUBJECTS  
**Phase:** 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE  
**Database:** Tenant DB (database-per-tenant architecture)  
**Plan Date:** 2026-03-20

---

## New Table: `subjects`

### Column Definitions

| Column             | Type           | Nullable | Default             | Description                                                                                                  |
| ------------------ | -------------- | -------- | ------------------- | ------------------------------------------------------------------------------------------------------------ |
| `id`               | `UUID`         | NOT NULL | `gen_random_uuid()` | Primary key                                                                                                  |
| `name`             | `VARCHAR(255)` | NOT NULL | —                   | Display name; case-insensitively unique per workspace (active records)                                       |
| `code`             | `VARCHAR(100)` | NULL     | —                   | Optional short code; unique per workspace when provided                                                      |
| `division_id`      | `UUID`         | NULL     | —                   | FK → `divisions.id ON DELETE RESTRICT`; nullable at DB; auto-assigned by service when divisions are disabled |
| `semester_id`      | `UUID`         | NULL     | —                   | FK → `semesters.id ON DELETE RESTRICT`; optional                                                             |
| `is_multilanguage` | `BOOLEAN`      | NOT NULL | `false`             | Whether this subject uses multi-language translation entries                                                 |
| `default_language` | `VARCHAR(10)`  | NOT NULL | —                   | BCP-47 language code (e.g. `en`, `ar`); validated against workspace language settings                        |
| `description`      | `TEXT`         | NULL     | —                   | Optional freeform description; max 2,000 characters at application layer                                     |
| `status`           | `VARCHAR(20)`  | NOT NULL | `'DRAFT'`           | Workflow state: `DRAFT`, `ACTIVE`, or `ARCHIVED`                                                             |
| `deleted_at`       | `TIMESTAMPTZ`  | NULL     | —                   | Soft-delete timestamp; set to `NOW()` on deletion. Non-null = deleted                                        |
| `created_at`       | `TIMESTAMPTZ`  | NOT NULL | `NOW()`             | Row creation timestamp (server-set)                                                                          |
| `updated_at`       | `TIMESTAMPTZ`  | NOT NULL | `NOW()`             | Last update timestamp (server-set)                                                                           |

### Constraints

| Constraint Name         | Type        | Definition                                                |
| ----------------------- | ----------- | --------------------------------------------------------- |
| `subjects_pkey`         | PRIMARY KEY | `id`                                                      |
| `subjects_status_check` | CHECK       | `status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')`               |
| FK to `divisions`       | FOREIGN KEY | `division_id REFERENCES divisions(id) ON DELETE RESTRICT` |
| FK to `semesters`       | FOREIGN KEY | `semester_id REFERENCES semesters(id) ON DELETE RESTRICT` |

### Indexes

| Index Name                          | Type                        | Definition                                           | Purpose                                                        |
| ----------------------------------- | --------------------------- | ---------------------------------------------------- | -------------------------------------------------------------- |
| `subjects_name_lower_unique_active` | UNIQUE (partial functional) | `LOWER(name) WHERE deleted_at IS NULL`               | Case-insensitive name uniqueness among active records          |
| `subjects_code_unique_non_null`     | UNIQUE (partial)            | `code WHERE code IS NOT NULL AND deleted_at IS NULL` | Code uniqueness for non-null active records                    |
| `idx_subjects_division_id`          | B-tree (partial)            | `division_id WHERE deleted_at IS NULL`               | FK traversal for division-scoped queries                       |
| `idx_subjects_semester_id`          | B-tree (partial)            | `semester_id WHERE deleted_at IS NULL`               | FK traversal for semester-scoped queries                       |
| `idx_subjects_status`               | B-tree (partial)            | `status WHERE deleted_at IS NULL`                    | Status filter (especially `status = 'ACTIVE'` runtime queries) |
| `idx_subjects_division_status`      | B-tree (partial, composite) | `(division_id, status) WHERE deleted_at IS NULL`     | Combined division + status filter (runtime ACTIVE-by-division) |
| `idx_subjects_semester_status`      | B-tree (partial, composite) | `(semester_id, status) WHERE deleted_at IS NULL`     | Combined semester + status filter (runtime ACTIVE-by-semester) |
| `idx_subjects_deleted_at`           | B-tree                      | `deleted_at`                                         | Efficient soft-delete exclusion scan                           |

### DDL (authoritative)

```sql
CREATE TABLE IF NOT EXISTS subjects (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name               VARCHAR(255) NOT NULL,
  code               VARCHAR(100),
  division_id        UUID         REFERENCES divisions(id) ON DELETE RESTRICT,
  semester_id        UUID         REFERENCES semesters(id) ON DELETE RESTRICT,
  is_multilanguage   BOOLEAN      NOT NULL DEFAULT false,
  default_language   VARCHAR(10)  NOT NULL,
  description        TEXT,
  status             VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
  deleted_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT subjects_status_check CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS subjects_name_lower_unique_active
  ON subjects (LOWER(name)) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subjects_code_unique_non_null
  ON subjects (code) WHERE code IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_subjects_division_id
  ON subjects (division_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_subjects_semester_id
  ON subjects (semester_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_subjects_status
  ON subjects (status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_subjects_division_status
  ON subjects (division_id, status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_subjects_semester_status
  ON subjects (semester_id, status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_subjects_deleted_at
  ON subjects (deleted_at);
```

---

## Schema Version Bump

| Field                                  | Before                        | After                                                        |
| -------------------------------------- | ----------------------------- | ------------------------------------------------------------ |
| `schema_version` in `_schema_versions` | `1.11.0` (STAGE_27_SEMESTERS) | `1.12.0`                                                     |
| Migration file                         | —                             | `apps/api/src/db/tenant/migrations/20260320_006_subjects.ts` |

---

## Foreign Key Relationships

```
subjects.division_id ──FK──▶ divisions.id  (ON DELETE RESTRICT)
subjects.semester_id ──FK──▶ semesters.id  (ON DELETE RESTRICT)
```

**RESTRICT rationale:** The application soft-deletes subjects (never hard-deletes). The DB-level
`ON DELETE RESTRICT` is a safety net preventing hard-deletion of a division or semester while
subjects reference it, in case application-level guards are bypassed.

**No modification to `divisions` or `semesters` tables.** The outbound FK on `subjects` does not
require any DDL change on the referenced tables. Both `divisions` and `semesters` tables were
pre-created in their respective stages.

---

## Workflow State Machine

```
DRAFT ──[DRAFT→ACTIVE]──▶ ACTIVE ──[ACTIVE→ARCHIVED]──▶ ARCHIVED
                                                             (terminal)
```

| Transition          | Allowed      |
| ------------------- | ------------ |
| `DRAFT → ACTIVE`    | ✓            |
| `ACTIVE → ARCHIVED` | ✓            |
| `DRAFT → ARCHIVED`  | ✗            |
| `ARCHIVED → *`      | ✗ (terminal) |
| `ACTIVE → DRAFT`    | ✗            |

Concurrency mechanism: CAS (`WHERE status = $expected_current`) — 0 rows affected → `SUBJECT_TRANSITION_CONFLICT` (409).

---

## Downstream References

At STAGE_28 launch, no downstream content tables exist. The subjects dependency check registry is
empty. Downstream stages register their FK checks additively:

| Future Stage  | Expected Dependency Check Entry                                                   |
| ------------- | --------------------------------------------------------------------------------- |
| MCQ Questions | `SELECT COUNT(*) FROM questions WHERE subject_id = $1 AND deleted_at IS NULL`     |
| Exams         | `SELECT COUNT(*) FROM exams WHERE subject_id = $1 AND deleted_at IS NULL`         |
| Exercises     | `SELECT COUNT(*) FROM exercises WHERE subject_id = $1 AND deleted_at IS NULL`     |
| Library Items | `SELECT COUNT(*) FROM library_items WHERE subject_id = $1 AND deleted_at IS NULL` |

---

## Drizzle ORM Schema Summary

```typescript
// File: apps/api/src/db/tenant/schemas/subjects.schema.ts

export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 100 }),
    division_id: uuid("division_id"),
    semester_id: uuid("semester_id"),
    is_multilanguage: boolean("is_multilanguage").notNull().default(false),
    default_language: varchar("default_language", { length: 10 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 20 }).notNull().default("DRAFT"),
    deleted_at: timestamp("deleted_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Index declarations (names align with migration DDL)
    divisionIdIdx: index("idx_subjects_division_id").on(table.division_id),
    semesterIdIdx: index("idx_subjects_semester_id").on(table.semester_id),
    statusIdx: index("idx_subjects_status").on(table.status),
    divisionStatusIdx: index("idx_subjects_division_status").on(table.division_id, table.status),
    semesterStatusIdx: index("idx_subjects_semester_status").on(table.semester_id, table.status),
    deletedAtIdx: index("idx_subjects_deleted_at").on(table.deleted_at),
    // Partial/functional indexes are migration-owned (Drizzle cannot represent them):
    //   subjects_name_lower_unique_active
    //   subjects_code_unique_non_null
    // FK constraints are migration-owned (avoids Drizzle FK/RESTRICT duality issues):
    //   division_id → divisions.id ON DELETE RESTRICT
    //   semester_id → semesters.id ON DELETE RESTRICT
  }),
);

export type Subject = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;
```
