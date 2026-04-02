# Data Model — Grading Core

**Stage:** STAGE_40_GRADING_CORE  
**Schema Version:** 1.24.0 → 1.25.0

---

## 1. New Table: `grading_results`

Stores one aggregate grading result per attempt.

```sql
CREATE TABLE grading_results (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         UUID NOT NULL,
  attempt_id           UUID NOT NULL,
  total_score          NUMERIC(10,2) NOT NULL,
  total_possible_score NUMERIC(10,2) NOT NULL,
  percentage           NUMERIC(5,2) NOT NULL,
  passed               BOOLEAN NOT NULL,
  pass_type            VARCHAR(20) NOT NULL,
  pass_value           NUMERIC(10,2) NOT NULL,
  grading_version      VARCHAR(20) NOT NULL,
  graded_at            TIMESTAMPTZ NOT NULL,
  graded_by            VARCHAR(50) NOT NULL,
  metadata             JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_grading_results_attempt_id UNIQUE (attempt_id),
  CONSTRAINT valid_pass_type CHECK (pass_type IN ('PERCENTAGE', 'SCORE')),
  CONSTRAINT valid_graded_by CHECK (graded_by IN ('ENGINE', 'SELF', 'ADMIN')),
  CONSTRAINT valid_percentage_range CHECK (percentage >= 0 AND percentage <= 100)
);

CREATE INDEX idx_grading_results_workspace_attempt
  ON grading_results (workspace_id, attempt_id);
```

### Drizzle Schema

```typescript
// apps/api/src/db/tenant/schemas/grading-results.schema.ts
export const gradingResults = pgTable(
  "grading_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspace_id: uuid("workspace_id").notNull(),
    attempt_id: uuid("attempt_id").notNull(),
    total_score: numeric("total_score", { precision: 10, scale: 2 }).notNull(),
    total_possible_score: numeric("total_possible_score", { precision: 10, scale: 2 }).notNull(),
    percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull(),
    passed: boolean("passed").notNull(),
    pass_type: varchar("pass_type", { length: 20 }).notNull(),
    pass_value: numeric("pass_value", { precision: 10, scale: 2 }).notNull(),
    grading_version: varchar("grading_version", { length: 20 }).notNull(),
    graded_at: timestamp("graded_at", { withTimezone: true }).notNull(),
    graded_by: varchar("graded_by", { length: 50 }).notNull(),
    metadata: jsonb("metadata"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_grading_results_attempt_id").on(table.attempt_id),
    index("idx_grading_results_workspace_attempt").on(table.workspace_id, table.attempt_id),
    check("valid_pass_type", sql`${table.pass_type} IN ('PERCENTAGE', 'SCORE')`),
    check("valid_graded_by", sql`${table.graded_by} IN ('ENGINE', 'SELF', 'ADMIN')`),
    check("valid_percentage_range", sql`${table.percentage} >= 0 AND ${table.percentage} <= 100`),
  ],
);
```

---

## 2. New Table: `grading_question_results`

Stores per-question grading details for audit and display.

```sql
CREATE TABLE grading_question_results (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID NOT NULL,
  attempt_id              UUID NOT NULL,
  grading_result_id       UUID NOT NULL REFERENCES grading_results(id),
  question_id             UUID NOT NULL,
  question_type           VARCHAR(20) NOT NULL,
  question_score          NUMERIC(10,2) NOT NULL,
  awarded_score           NUMERIC(10,2) NOT NULL,
  is_correct              BOOLEAN NOT NULL,
  user_response           JSONB NOT NULL,
  correct_answer_snapshot JSONB NOT NULL,
  grading_metadata        JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_grading_question_results_attempt_question
    UNIQUE (attempt_id, question_id),
  CONSTRAINT valid_question_type
    CHECK (question_type IN (
      'SINGLE', 'MULTIPLE', 'TRUE_FALSE', 'ARRANGEMENT',
      'TRADITIONAL_TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER'
    )),
  CONSTRAINT valid_awarded_score
    CHECK (awarded_score >= 0 AND awarded_score <= question_score)
);

CREATE INDEX idx_grading_question_results_grading_result_id
  ON grading_question_results (grading_result_id);

CREATE INDEX idx_grading_question_results_workspace_attempt
  ON grading_question_results (workspace_id, attempt_id);
```

### Drizzle Schema

```typescript
// apps/api/src/db/tenant/schemas/grading-question-results.schema.ts
export const gradingQuestionResults = pgTable(
  "grading_question_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspace_id: uuid("workspace_id").notNull(),
    attempt_id: uuid("attempt_id").notNull(),
    grading_result_id: uuid("grading_result_id").notNull(),
    question_id: uuid("question_id").notNull(),
    question_type: varchar("question_type", { length: 20 }).notNull(),
    question_score: numeric("question_score", { precision: 10, scale: 2 }).notNull(),
    awarded_score: numeric("awarded_score", { precision: 10, scale: 2 }).notNull(),
    is_correct: boolean("is_correct").notNull(),
    user_response: jsonb("user_response").notNull(),
    correct_answer_snapshot: jsonb("correct_answer_snapshot").notNull(),
    grading_metadata: jsonb("grading_metadata"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_grading_question_results_attempt_question").on(
      table.attempt_id,
      table.question_id,
    ),
    index("idx_grading_question_results_grading_result_id").on(table.grading_result_id),
    index("idx_grading_question_results_workspace_attempt").on(
      table.workspace_id,
      table.attempt_id,
    ),
    check(
      "valid_question_type",
      sql`${table.question_type} IN (
    'SINGLE', 'MULTIPLE', 'TRUE_FALSE', 'ARRANGEMENT',
    'TRADITIONAL_TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER'
  )`,
    ),
    check(
      "valid_awarded_score",
      sql`${table.awarded_score} >= 0 AND ${table.awarded_score} <= ${table.question_score}`,
    ),
  ],
);
```

---

## 3. New Table: `grading_overrides`

Audit trail for admin score overrides.

```sql
CREATE TABLE grading_overrides (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL,
  attempt_id        UUID NOT NULL,
  grading_result_id UUID NOT NULL REFERENCES grading_results(id),
  previous_score    NUMERIC(10,2) NOT NULL,
  new_score         NUMERIC(10,2) NOT NULL,
  previous_passed   BOOLEAN NOT NULL,
  new_passed        BOOLEAN NOT NULL,
  override_reason   TEXT NOT NULL,
  override_user_id  UUID NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_grading_overrides_attempt_id
  ON grading_overrides (attempt_id);

CREATE INDEX idx_grading_overrides_workspace
  ON grading_overrides (workspace_id);
```

### Drizzle Schema

```typescript
// apps/api/src/db/tenant/schemas/grading-overrides.schema.ts
export const gradingOverrides = pgTable(
  "grading_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspace_id: uuid("workspace_id").notNull(),
    attempt_id: uuid("attempt_id").notNull(),
    grading_result_id: uuid("grading_result_id").notNull(),
    previous_score: numeric("previous_score", { precision: 10, scale: 2 }).notNull(),
    new_score: numeric("new_score", { precision: 10, scale: 2 }).notNull(),
    previous_passed: boolean("previous_passed").notNull(),
    new_passed: boolean("new_passed").notNull(),
    override_reason: text("override_reason").notNull(),
    override_user_id: uuid("override_user_id").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_grading_overrides_attempt_id").on(table.attempt_id),
    index("idx_grading_overrides_workspace").on(table.workspace_id),
  ],
);
```

---

## 4. Attempt Table Modification

### New Column

```sql
ALTER TABLE attempts
  ADD COLUMN grading_status VARCHAR(20) NOT NULL DEFAULT 'PENDING';

ALTER TABLE attempts
  ADD CONSTRAINT valid_grading_status
  CHECK (grading_status IN ('PENDING', 'GRADING', 'GRADED', 'OVERRIDE'));
```

### Updated Check Constraint

```sql
-- Drop old constraint
ALTER TABLE attempts DROP CONSTRAINT IF EXISTS valid_status;

-- Add new constraint with GRADED
ALTER TABLE attempts ADD CONSTRAINT valid_status
  CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'FINALIZED', 'EXPIRED', 'ABORTED', 'GRADED'));
```

### Drizzle Schema Change

Add to `attempts.schema.ts`:

```typescript
grading_status: varchar('grading_status', { length: 20 }).notNull().default('PENDING'),
```

Update `valid_status` check:

```typescript
check(
  'valid_status',
  sql`${table.status} IN ('IN_PROGRESS', 'SUBMITTED', 'FINALIZED', 'EXPIRED', 'ABORTED', 'GRADED')`
),
check(
  'valid_grading_status',
  sql`${table.grading_status} IN ('PENDING', 'GRADING', 'GRADED', 'OVERRIDE')`
),
```

---

## 5. Entity Relationship

```
attempts (1) ──── (1) grading_results
    │                       │
    │                       ├──── (N) grading_question_results
    │                       │
    │                       └──── (N) grading_overrides
    │
    └──── (N) attempt_questions (existing)
```

Key relationships:

- `grading_results.attempt_id` → `attempts.id` (1:1, unique)
- `grading_question_results.grading_result_id` → `grading_results.id` (N:1)
- `grading_overrides.grading_result_id` → `grading_results.id` (N:1)
- All tables include `workspace_id` for tenant isolation (ADR-0001)
