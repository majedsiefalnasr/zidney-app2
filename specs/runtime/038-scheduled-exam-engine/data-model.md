# Data Model — Stage 38: Scheduled Exam Engine

**Generated**: 2026-04-01
**Branch**: `spec/038-scheduled-exam-engine`
**Schema version after migrations**: 1.23.0

---

## Migration Files

### Migration 016 — Create `scheduled_exams` table

**File**: `apps/api/src/db/tenant/migrations/20260402_016_create_scheduled_exams.ts`
**Schema**: 1.21.0 → 1.22.0
**Stage**: STAGE_38_SCHEDULED_ENGINE

### Migration 017 — Add scheduling columns to `attempts`

**File**: `apps/api/src/db/tenant/migrations/20260402_017_add_scheduled_fields_to_attempts.ts`
**Schema**: 1.22.0 → 1.23.0
**Stage**: STAGE_38_SCHEDULED_ENGINE

---

## New Table: `scheduled_exams` (Migration 016)

### DDL (Phase 1 — inside transaction)

```sql
CREATE TABLE IF NOT EXISTS scheduled_exams (
  id                      UUID          NOT NULL DEFAULT gen_random_uuid(),
  base_exam_id            UUID          NOT NULL,
  exam_type               VARCHAR(20)   NOT NULL
                            CONSTRAINT scheduled_exams_exam_type_check
                            CHECK (exam_type IN ('MCQ', 'TRADITIONAL')),
  name                    VARCHAR(255)  NOT NULL,
  code                    VARCHAR(100)  NOT NULL,
  start_datetime          TIMESTAMPTZ   NOT NULL,
  end_datetime            TIMESTAMPTZ   NOT NULL,
  late_tolerance_minutes  INTEGER       NOT NULL DEFAULT 5
                            CONSTRAINT scheduled_exams_tolerance_check
                            CHECK (late_tolerance_minutes >= 0),
  allow_single_attempt    BOOLEAN       NOT NULL DEFAULT FALSE,
  reminder_before_start   BOOLEAN       NOT NULL DEFAULT FALSE,
  reminder_before_end     BOOLEAN       NOT NULL DEFAULT FALSE,
  workflow_status         VARCHAR(20)   NOT NULL DEFAULT 'APPROVED'
                            CONSTRAINT scheduled_exams_workflow_status_check
                            CHECK (workflow_status IN ('APPROVED', 'ENABLED')),
  base_exam_modified      BOOLEAN       NOT NULL DEFAULT FALSE,
  base_exam_snapshot_hash TEXT          NULL,
  deleted_at              TIMESTAMPTZ   NULL,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by              UUID          NULL,
  updated_by              UUID          NULL,

  CONSTRAINT scheduled_exams_pkey PRIMARY KEY (id),
  CONSTRAINT scheduled_exams_end_after_start
    CHECK (end_datetime > start_datetime)
);
```

### B-tree Indexes (Phase 1 — inside transaction)

```sql
CREATE INDEX IF NOT EXISTS idx_scheduled_exams_base_exam_id
  ON scheduled_exams (base_exam_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_exams_start_datetime
  ON scheduled_exams (start_datetime);

CREATE INDEX IF NOT EXISTS idx_scheduled_exams_end_datetime
  ON scheduled_exams (end_datetime);

CREATE INDEX IF NOT EXISTS idx_scheduled_exams_workflow_status
  ON scheduled_exams (workflow_status);

CREATE INDEX IF NOT EXISTS idx_scheduled_exams_deleted_at
  ON scheduled_exams (deleted_at);
```

### CONCURRENT Unique Indexes (Phase 2 — outside transaction)

```sql
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_scheduled_exams_code_unique
  ON scheduled_exams (LOWER(code))
  WHERE deleted_at IS NULL;
```

**Note**: `base_exam_id` is a **logical FK** only (no DB-level FOREIGN KEY constraint), since it references either `mcq_exams.id` OR `traditional_exams.id` based on `exam_type`. Application-layer validation enforces referential integrity.

---

## Drizzle Schema: `scheduled-exams.schema.ts`

**File**: `apps/api/src/db/tenant/schemas/scheduled-exams.schema.ts`

```ts
/**
 * Drizzle Schema — scheduled_exams
 * Stage: STAGE_38_SCHEDULED_ENGINE
 */
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

export const scheduledExams = pgTable(
  "scheduled_exams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    base_exam_id: uuid("base_exam_id").notNull(),
    exam_type: varchar("exam_type", { length: 20 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 100 }).notNull(),
    start_datetime: timestamp("start_datetime", { withTimezone: true }).notNull(),
    end_datetime: timestamp("end_datetime", { withTimezone: true }).notNull(),
    late_tolerance_minutes: integer("late_tolerance_minutes").notNull().default(5),
    allow_single_attempt: boolean("allow_single_attempt").notNull().default(false),
    reminder_before_start: boolean("reminder_before_start").notNull().default(false),
    reminder_before_end: boolean("reminder_before_end").notNull().default(false),
    workflow_status: varchar("workflow_status", { length: 20 }).notNull().default("APPROVED"),
    base_exam_modified: boolean("base_exam_modified").notNull().default(false),
    base_exam_snapshot_hash: text("base_exam_snapshot_hash"),
    deleted_at: timestamp("deleted_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    created_by: uuid("created_by"),
    updated_by: uuid("updated_by"),
  },
  (table) => [
    check("scheduled_exams_exam_type_check", sql`${table.exam_type} IN ('MCQ', 'TRADITIONAL')`),
    check(
      "scheduled_exams_workflow_status_check",
      sql`${table.workflow_status} IN ('APPROVED', 'ENABLED')`,
    ),
    check("scheduled_exams_tolerance_check", sql`${table.late_tolerance_minutes} >= 0`),
    check("scheduled_exams_end_after_start", sql`${table.end_datetime} > ${table.start_datetime}`),
    index("idx_scheduled_exams_base_exam_id").on(table.base_exam_id),
    index("idx_scheduled_exams_start_datetime").on(table.start_datetime),
    index("idx_scheduled_exams_end_datetime").on(table.end_datetime),
    index("idx_scheduled_exams_workflow_status").on(table.workflow_status),
    index("idx_scheduled_exams_deleted_at").on(table.deleted_at),
  ],
);

export type ScheduledExam = typeof scheduledExams.$inferSelect;
export type NewScheduledExam = typeof scheduledExams.$inferInsert;
```

---

## Existing Table Additions: `attempts` (Migration 017)

### DDL (Phase 1 — inside transaction)

```sql
ALTER TABLE attempts
  ADD COLUMN IF NOT EXISTS is_scheduled              BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS scheduled_exam_id         UUID          NULL,
  ADD COLUMN IF NOT EXISTS scheduled_end_time        TIMESTAMPTZ   NULL,
  ADD COLUMN IF NOT EXISTS auto_submitted            BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS forced_submission_reason  VARCHAR(50)   NULL
    CONSTRAINT attempts_forced_submission_reason_check
    CHECK (forced_submission_reason IN (
      'ATTEMPT_TIME_EXCEEDED',
      'SCHEDULED_END_REACHED',
      'CONNECTION_TIMEOUT'
    )),
  ADD COLUMN IF NOT EXISTS last_heartbeat_at         TIMESTAMPTZ   NULL;
```

### B-tree Indexes (Phase 1 — inside transaction)

```sql
CREATE INDEX IF NOT EXISTS idx_attempts_scheduled_exam_id
  ON attempts (scheduled_exam_id)
  WHERE scheduled_exam_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attempts_is_scheduled_active
  ON attempts (scheduled_exam_id, is_scheduled, auto_submitted)
  WHERE is_scheduled = TRUE AND auto_submitted = FALSE;

CREATE INDEX IF NOT EXISTS idx_attempts_last_heartbeat_at
  ON attempts (last_heartbeat_at)
  WHERE is_scheduled = TRUE AND auto_submitted = FALSE;
```

**Note**: Migration 017 has no CONCURRENT indexes, so it uses a single-phase approach (all DDL inside one transaction). The partial indexes above are standard B-tree and do not require CONCURRENT creation.

### Drizzle Schema Addition

The existing `attempts.schema.ts` file must be updated to add the six new columns with Drizzle column definitions matching the migration DDL. The existing columns are preserved unchanged.

---

## Entity Relationships

```
mcq_exams (Stage 36)
  └─ [logical FK via exam_type='MCQ']
traditional_exams (Stage 37)
  └─ [logical FK via exam_type='TRADITIONAL']
        ↓
  scheduled_exams (Stage 38)
        ↓ [logical FK via scheduled_exam_id]
      attempts (extended, Stage 38)
```

All tables reside in the **tenant DB only**. Zero master DB involvement for Stage 38 runtime operations.

---

## State Machine: `workflow_status`

```
APPROVED  ──[operator: POST /workflow]──►  ENABLED
    ▲                                          │
    └──[operator: POST /re-approve]────────────┘
         (resets base_exam_modified=false)
```

| Status         | Description              | Immutability Level                   |
| -------------- | ------------------------ | ------------------------------------ |
| `APPROVED`     | Default creation state   | Key fields mutable (before attempts) |
| `ENABLED`      | Active delivery state    | Structural fields frozen             |
| (soft-deleted) | `deleted_at IS NOT NULL` | Terminal; no attempts allowed        |

---

## Field Mutability Matrix

| Field                    | APPROVED (no attempts) | APPROVED (with attempts) | ENABLED    |
| ------------------------ | ---------------------- | ------------------------ | ---------- |
| `name`                   | ✅ Mutable             | ✅ Mutable               | ✅ Mutable |
| `reminder_before_start`  | ✅ Mutable             | ✅ Mutable               | ✅ Mutable |
| `reminder_before_end`    | ✅ Mutable             | ✅ Mutable               | ✅ Mutable |
| `code`                   | ✅ Mutable             | ❌ Frozen                | ❌ Frozen  |
| `allow_single_attempt`   | ✅ Mutable             | ❌ Frozen                | ❌ Frozen  |
| `start_datetime`         | ✅ Mutable             | ❌ Frozen                | ❌ Frozen  |
| `end_datetime`           | ✅ Mutable             | ❌ Frozen                | ❌ Frozen  |
| `late_tolerance_minutes` | ✅ Mutable             | ❌ Frozen                | ❌ Frozen  |
| `base_exam_id`           | ✅ Mutable             | ❌ Frozen                | ❌ Frozen  |
| `exam_type`              | ✅ Mutable             | ❌ Frozen                | ❌ Frozen  |

---

## Error Code Reference (Stage 38)

| Code                                   | HTTP | Trigger                                             |
| -------------------------------------- | ---- | --------------------------------------------------- |
| `SCHEDULED_EXAM.NOT_FOUND`             | 404  | Record not found or soft-deleted                    |
| `SCHEDULED_EXAM.CODE_CONFLICT`         | 409  | `code` already exists in workspace                  |
| `SCHEDULED_EXAM.INVALID_TIME_WINDOW`   | 422  | `end_datetime <= start_datetime`                    |
| `SCHEDULED_EXAM.BASE_EXAM_NOT_ENABLED` | 422  | Base exam not in ENABLED status                     |
| `SCHEDULED_EXAM.BASE_EXAM_ARCHIVED`    | 422  | Base exam soft-deleted                              |
| `SCHEDULED_EXAM.BASE_EXAM_MODIFIED`    | 422  | `base_exam_modified=true` blocks ENABLED transition |
| `SCHEDULED_EXAM.FIELD_IMMUTABLE`       | 409  | PATCH on frozen field post-ENABLED                  |
| `SCHEDULED_EXAM.HAS_ATTEMPTS`          | 409  | Structural PATCH or DELETE blocked                  |
| `SCHEDULED_EXAM.CANNOT_DELETE_ENABLED` | 409  | Delete attempted on ENABLED exam                    |
| `SCHEDULED_EXAM.NOT_STARTED`           | 403  | Attempt start before window                         |
| `SCHEDULED_EXAM.CLOSED`                | 403  | Attempt start after `end_datetime`                  |
| `SCHEDULED_EXAM.ALREADY_ATTEMPTED`     | 403  | Single-attempt mode violation                       |
| `SCHEDULED_EXAM.INVALID_EXAM_TYPE`     | 422  | `exam_type` not MCQ/TRADITIONAL                     |
| `SCHEDULED_EXAM.INVALID_BASE_EXAM_REF` | 422  | `base_exam_id` not found                            |
| `ATTEMPT.ALREADY_SUBMITTED`            | 409  | Heartbeat/submit on terminal attempt                |
| `ATTEMPT.TIME_EXPIRED`                 | 410  | Heartbeat after `attempt_end_time`                  |
| `ATTEMPT.NOT_FOUND`                    | 404  | Attempt not found for user/workspace                |
| `ATTEMPT.UNAUTHORIZED`                 | 403  | Attempt owner mismatch                              |
