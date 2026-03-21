# Data Model: Lessons (STAGE_29)

**Stage**: `STAGE_29_LESSONS`
**Phase**: `03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE`
**Database**: Tenant DB only (database-per-tenant)
**Migration**: `apps/api/src/db/tenant/migrations/20260321_007_lessons.ts`
**Schema Version**: `1.12.0 → 1.13.0`
**Generated**: 2026-03-21

---

## Table Definition

### `lessons`

```sql
CREATE TABLE IF NOT EXISTS lessons (
  id          UUID          NOT NULL DEFAULT gen_random_uuid(),
  subject_id  UUID          NOT NULL,
  name        VARCHAR(255)  NOT NULL,
  code        VARCHAR(100),
  description TEXT,
  status      VARCHAR(20)   NOT NULL DEFAULT 'ENABLED'
                CONSTRAINT lessons_status_check CHECK (status IN ('ENABLED', 'DISABLED')),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by  UUID,
  updated_by  UUID,
  CONSTRAINT  lessons_pkey PRIMARY KEY (id)
)
```

### Column Reference

| Column        | Type           | Nullable | Default             | Description                                                     |
| ------------- | -------------- | -------- | ------------------- | --------------------------------------------------------------- |
| `id`          | `UUID`         | NOT NULL | `gen_random_uuid()` | Primary key, auto-generated                                     |
| `subject_id`  | `UUID`         | NOT NULL | —                   | FK → `subjects(id)`; mandatory parent; immutable after creation |
| `name`        | `VARCHAR(255)` | NOT NULL | —                   | Lesson name; unique within subject (case-insensitive)           |
| `code`        | `VARCHAR(100)` | NULL     | `NULL`              | Optional free-form reference code                               |
| `description` | `TEXT`         | NULL     | `NULL`              | Optional descriptive text; no DB-level max length               |
| `status`      | `VARCHAR(20)`  | NOT NULL | `'ENABLED'`         | Lifecycle state; values: `ENABLED`, `DISABLED`                  |
| `created_at`  | `TIMESTAMPTZ`  | NOT NULL | `NOW()`             | Server-set creation timestamp; never updated                    |
| `updated_at`  | `TIMESTAMPTZ`  | NOT NULL | `NOW()`             | Server-set; refreshed on every mutation                         |
| `created_by`  | `UUID`         | NULL     | `NULL`              | FK → `users(id)` ON DELETE SET NULL; audit: creator             |
| `updated_by`  | `UUID`         | NULL     | `NULL`              | FK → `users(id)` ON DELETE SET NULL; audit: last modifier       |

---

## Constraints

### Primary Key

```sql
CONSTRAINT lessons_pkey PRIMARY KEY (id)
```

### Status CHECK Constraint

```sql
CONSTRAINT lessons_status_check CHECK (status IN ('ENABLED', 'DISABLED'))
```

Enforces the two-state lifecycle at the DB level. No other status values are permitted.

---

## Foreign Key Constraints

| Constraint Name           | Column       | References     | On Delete  |
| ------------------------- | ------------ | -------------- | ---------- |
| `lessons_subject_id_fkey` | `subject_id` | `subjects(id)` | `RESTRICT` |
| `lessons_created_by_fkey` | `created_by` | `users(id)`    | `SET NULL` |
| `lessons_updated_by_fkey` | `updated_by` | `users(id)`    | `SET NULL` |

### `lessons_subject_id_fkey` — RESTRICT

`ON DELETE RESTRICT` prevents deletion of a subject row when one or more lessons reference it. This is the database-level enforcement of the academic hierarchy constraint:

```
subjects(id) ←── lessons(subject_id) [RESTRICT]
```

A `DELETE` on `subjects` where `id` matches any `lessons.subject_id` will raise a
`PG ERROR 23503 (foreign_key_violation)`.

**Service-layer guard (two layers)**:

1. `subjects.dependency-registry.ts` — checks `COUNT(*) FROM lessons WHERE subject_id = $1` before soft-deleting a subject
2. DB-level `RESTRICT` constraint — final safety net if guard is bypassed

### `lessons_created_by_fkey` / `lessons_updated_by_fkey` — SET NULL

`ON DELETE SET NULL` ensures that deleting a user account does not cascade-delete lessons. The audit columns (`created_by`, `updated_by`) are set to `NULL` when the referenced user is removed. Historical lesson data is preserved.

---

## Indexes

| Index Name                    | Columns                     | Type              | Purpose                                      |
| ----------------------------- | --------------------------- | ----------------- | -------------------------------------------- |
| `lessons_pkey`                | `(id)`                      | B-tree (primary)  | Primary key lookup                           |
| `unique_lessons_subject_name` | `(subject_id, LOWER(name))` | Unique functional | Case-insensitive name uniqueness per subject |
| `idx_lessons_subject_id`      | `(subject_id)`              | B-tree            | All subject-scoped lesson queries            |
| `idx_lessons_status`          | `(status)`                  | B-tree            | Status-filtered list queries                 |

### DDL

```sql
-- Unique functional index (case-insensitive name deduplication per subject)
CREATE UNIQUE INDEX IF NOT EXISTS unique_lessons_subject_name
  ON lessons (subject_id, LOWER(name));

-- Subject FK traversal and subject-scoped list queries
CREATE INDEX IF NOT EXISTS idx_lessons_subject_id
  ON lessons (subject_id);

-- Status filter (ENABLED/DISABLED list queries)
CREATE INDEX IF NOT EXISTS idx_lessons_status
  ON lessons (status);
```

### Index Rationale

**`unique_lessons_subject_name`** — Functional unique index:

- `LOWER(name)` makes uniqueness enforcement case-insensitive: `"Algebra"` and `"algebra"` under the same subject collide.
- Composite `(subject_id, LOWER(name))` scopes uniqueness per subject. Two lessons in different subjects may share the same name.
- Serves as the authoritative correctness guarantee for concurrent duplicate-create races. PG raises error `23505` when violated.

**`idx_lessons_subject_id`**:

- Covers all subject-scoped queries: `GET /lessons?subject_id=...`, `GET /lessons/runtime?subject_id=...`, and the dependency-check COUNT used by the subjects soft-delete guard.
- Prevents full table scans as the `lessons` table grows.

**`idx_lessons_status`**:

- Covers `GET /lessons?status=ENABLED|DISABLED` filter queries.
- Combined with `idx_lessons_subject_id`, enables efficient compound filtering (subject + status) via index intersection.

---

## Entity Relationships

```
divisions (master DB or tenant)
    └── subjects (tenant DB)
              │  subject_id FK → lessons.subject_id
              └── lessons (tenant DB)   ← THIS STAGE
                        │
                        │  lesson_id FK (downstream — does not exist yet in STAGE_29)
                        ├── mcq_questions         (future stage)
                        ├── traditional_questions  (future stage)
                        ├── auto_selection_configs (future stage)
                        └── exam_configs           (future stage)
```

**Hierarchy**: Division → Subject → Lesson → Content

Lessons do not store `division_id` directly. Division-level access control is inherited from the parent Subject (BR-05). A lesson query always traverses `subject_id → subjects → division_id` for division-scoped permission checks.

---

## Lifecycle States

### Status Enumeration

| Status     | Description                                                                              |
| ---------- | ---------------------------------------------------------------------------------------- |
| `ENABLED`  | Active lesson. Can be selected for question tagging, auto-selection, and analytics.      |
| `DISABLED` | Inactive lesson. Read-only (no field edits). Cannot be selected in new content creation. |

### State Machine

```
       ┌────────────────────────────────────────────────────┐
       │                                                    │
       ▼                                                    │
   ENABLED  ──── DELETE /lessons/:id (soft-delete) ────► DISABLED
              ◄── PATCH { status: "ENABLED" } ──────────────
```

| Transition            | Trigger                                           | Notes                                   |
| --------------------- | ------------------------------------------------- | --------------------------------------- |
| `ENABLED → DISABLED`  | `DELETE /lessons/:id`                             | Soft delete; sets `status = DISABLED`   |
| `DISABLED → ENABLED`  | `PATCH /lessons/:id` with `{ status: "ENABLED" }` | Re-enable operation                     |
| `ENABLED → ENABLED`   | `PATCH` with `{ status: "ENABLED" }`              | Rejected: 422 `LESSON_ALREADY_ENABLED`  |
| `DISABLED → DISABLED` | `PATCH` with `{ status: "DISABLED" }` or `DELETE` | Rejected: 422 `LESSON_ALREADY_DISABLED` |

**Initial state on creation**: `ENABLED`

**No terminal state**: Lessons can cycle between `ENABLED` and `DISABLED` indefinitely.

---

## Data Integrity Rules

### IR-01: Subject Ownership is Immutable

`subject_id` is set at INSERT time and **never updated**. The PATCH schema (`updateLessonBodySchema`) forbids `subject_id` as a field. Any attempt to change the parent subject must be rejected at the validation layer.

### IR-02: Name Uniqueness is Subject-Scoped and Case-Insensitive

Name uniqueness is enforced per `subject_id` via the `unique_lessons_subject_name` functional index on `(subject_id, LOWER(name))`. Two lessons in the same subject with names differing only in case are treated as duplicates. Enforcement occurs at two layers:

1. **Service-layer pre-check**: `SELECT EXISTS(… WHERE LOWER(name) = LOWER($2) …)` before INSERT/UPDATE
2. **DB constraint**: `UNIQUE (subject_id, LOWER(name))` index; PG raises `23505` on violation

### IR-03: Write Prohibition on DISABLED Lessons (BR-04)

A `DISABLED` lesson has its `name`, `code`, and `description` fields frozen. Only `status` is mutable on a DISABLED lesson (to re-enable it). Any PATCH payload that contains a non-status field while the lesson is `DISABLED` is rejected with `LESSON_DISABLED (422)`.

**Clarification Q7 rule**: If a payload contains both `status: ENABLED` and any non-status field, the request fails with `LESSON_DISABLED`. Clients must issue two sequential requests: (1) re-enable, (2) update other fields.

### IR-04: Audit Column Semantics

| Column       | Set At                            | Updated     | Default                    |
| ------------ | --------------------------------- | ----------- | -------------------------- |
| `created_by` | INSERT (once)                     | Never       | `NULL` (anonymous context) |
| `updated_by` | INSERT + every UPDATE/soft-delete | Every write | `NULL` (anonymous context) |
| `created_at` | INSERT (DB `DEFAULT NOW()`)       | Never       | —                          |
| `updated_at` | INSERT + every UPDATE/soft-delete | Every write | —                          |

Both `created_by` and `updated_by` are sourced from `c.get('auth').userId` via `buildAuditCtx` (Clarification Q5). They are `NULL` when the context carries no user ID (anonymous).

### IR-05: Server-Authoritative Timestamps

`created_at` and `updated_at` are set by the database via `DEFAULT NOW()` and explicit `SET updated_at = NOW()` (or `SET updated_at = $n` from server-generated timestamp). No client-supplied timestamp values are accepted.

### IR-06: No Hard Delete

No SQL `DELETE` is ever issued against the `lessons` table via the API. The `DELETE /lessons/:id` endpoint performs a status transition to `DISABLED` only. The `ON DELETE RESTRICT` FK constraints on downstream tables (when added in future stages) prevent accidental hard deletion from internal tooling.

### IR-07: Tenant Scope

The `lessons` table resides exclusively in the tenant database. There is no `workspace_id` or `tenant_id` column — tenant isolation is physical (separate database per tenant). All queries run against the tenant-specific DB client resolved from the request context.

---

## Downstream FK Registration (STAGE_29 status)

In this stage, no downstream tables reference `lesson_id`. The `lessonDependencyRegistry` is an empty stub.

When future stages introduce `lesson_id` FKs, they must:

1. Add `lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT` to their table DDL
2. Register a `DependencyCheckFn` in `packages/domain-core/src/lessons/lessons.dependency-registry.ts`

Downstream tables expected to reference `lesson_id` in future stages:

| Table                    | Stage | FK Constraint                                |
| ------------------------ | ----- | -------------------------------------------- |
| `mcq_questions`          | TBD   | `lesson_id → lessons(id) ON DELETE RESTRICT` |
| `traditional_questions`  | TBD   | `lesson_id → lessons(id) ON DELETE RESTRICT` |
| `auto_selection_configs` | TBD   | `lesson_id → lessons(id) ON DELETE RESTRICT` |
| `exam_question_configs`  | TBD   | `lesson_id → lessons(id) ON DELETE RESTRICT` |

---

## Schema Version Context

| Migration                     | Version After | Tables Added  |
| ----------------------------- | ------------- | ------------- |
| `20260315_001_initial.ts`     | `1.0.0`       | Base schema   |
| `20260318_002_*.ts`           | `1.x.x`       | ...           |
| `20260319_003_*.ts`           | `1.x.x`       | ...           |
| `20260319_004_*.ts`           | `1.x.x`       | ...           |
| `20260319_005_*.ts`           | `1.x.x`       | ...           |
| `20260320_006_subjects.ts`    | `1.12.0`      | `subjects`    |
| **`20260321_007_lessons.ts`** | **`1.13.0`**  | **`lessons`** |

`MIN_SCHEMA_VERSION` for all lesson routes: **`1.13.0`**
