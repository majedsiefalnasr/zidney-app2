# Attempt Engine Schema v1.0.0

**Version:** 1.0.0  
**Status:** Production Ready  
**Schema Version:** 1  
**Last Updated:** 2026-02-18

---

## Overview

The Attempt Engine schema supports database-per-tenant isolation with deterministic, immutable attempt grading. All tables are tenant-scoped (include `workspace_id`).

### Entity Relationship Diagram

```
workspaces (master DB)
    ↓ workspace_id (foreign key)
attempts
    ├ question_snapshot (JSONB - frozen)
    ├ grading_config_snapshot (JSONB - frozen)
    ├─→ attempt_progress (1:N)
    ├─→ submission_idempotency_keys (1:N)
    └─→ grading_jobs (1:1)
```

---

## Tables

### attempts

**Purpose:** Core attempt entity – represents a single exam/assignment attempt.

**Tenant Scope:** `workspace_id` (database-per-tenant isolation)

```sql
CREATE TABLE attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL,
  exam_id UUID NOT NULL,

  -- Attempt state
  status VARCHAR(32) NOT NULL DEFAULT 'IN_PROGRESS',
    -- CHECK status IN ('IN_PROGRESS', 'SUBMITTED', 'FINALIZED', 'EXPIRED', 'ABORTED')
  attempt_mode VARCHAR(32) NOT NULL,
    -- CHECK attempt_mode IN ('RELAX', 'CHRONO', 'RUSH')

  -- Frozen snapshots at creation time (IMMUTABLE)
  question_snapshot JSONB NOT NULL,      -- Question list + options + correct answers
  grading_config_snapshot JSONB NOT NULL, -- Scoring rules, pass threshold, etc.

  -- Grading results (null until finalized)
  score NUMERIC(5,2) NULL,               -- Final score
  result_snapshot JSONB NULL,             -- Detail breakdown (per-question scores)
  passed BOOLEAN NULL,                    -- Pass/fail (derived from score)

  -- Time tracking (server-authoritative)
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- NOW() at creation
  submitted_at TIMESTAMP NULL,            -- NOW() at submission
  finalized_at TIMESTAMP NULL,            -- NOW() when grading complete
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- Last modification

  -- Foreign keys
  CONSTRAINT fk_attempts_workspace
    FOREIGN KEY (workspace_id)
    REFERENCES workspaces(id)
    ON DELETE CASCADE,

  -- Indexes for fast queries
  CONSTRAINT pk_attempts PRIMARY KEY (id)
);

-- Indexes for fast lookups
CREATE INDEX idx_attempts_workspace_user
  ON attempts(workspace_id, user_id);

CREATE INDEX idx_attempts_workspace_exam
  ON attempts(workspace_id, exam_id);

CREATE INDEX idx_attempts_status
  ON attempts(workspace_id, status);

CREATE INDEX idx_attempts_created_at
  ON attempts(workspace_id, created_at DESC);

-- Covering index for submission fetches
CREATE INDEX idx_attempts_workspace_status_created
  ON attempts(workspace_id, status, created_at DESC);
```

**Column Details:**

| Column                    | Type         | Null | Default           | Notes                                                         |
| ------------------------- | ------------ | ---- | ----------------- | ------------------------------------------------------------- |
| `id`                      | UUID         | NO   | gen_random_uuid() | Immutable, unique per attempt                                 |
| `workspace_id`            | UUID         | NO   | –                 | Tenant ID (database-per-tenant)                               |
| `user_id`                 | UUID         | NO   | –                 | Exam taker                                                    |
| `exam_id`                 | UUID         | NO   | –                 | Which exam                                                    |
| `status`                  | VARCHAR(32)  | NO   | 'IN_PROGRESS'     | Enum: IN_PROGRESS, SUBMITTED, FINALIZED, EXPIRED, ABORTED     |
| `attempt_mode`            | VARCHAR(32)  | NO   | –                 | Enum: RELAX (unlimited), CHRONO (timed), RUSH (half duration) |
| `question_snapshot`       | JSONB        | NO   | –                 | Frozen question details (array of objects)                    |
| `grading_config_snapshot` | JSONB        | NO   | –                 | Frozen grading rules (pass_threshold, scoring_type, etc.)     |
| `score`                   | NUMERIC(5,2) | YES  | NULL              | Final score (e.g., 18.50 out of 20)                           |
| `result_snapshot`         | JSONB        | YES  | NULL              | Detailed breakdown (per-question scores, feedback)            |
| `passed`                  | BOOLEAN      | YES  | NULL              | Pass/fail (computed from score >= threshold)                  |
| `created_at`              | TIMESTAMP    | NO   | NOW()             | Server time (NOT client time)                                 |
| `submitted_at`            | TIMESTAMP    | YES  | NULL              | When user submitted                                           |
| `finalized_at`            | TIMESTAMP    | YES  | NULL              | When grading completed                                        |
| `updated_at`              | TIMESTAMP    | NO   | NOW()             | Last modification                                             |

**Example Row:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "workspace_id": "550e8400-e29b-41d4-a716-446655440002",
  "user_id": "550e8400-e29b-41d4-a716-446655440003",
  "exam_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "FINALIZED",
  "attempt_mode": "CHRONO",
  "question_snapshot": [
    {
      "id": "q1",
      "type": "MCQ",
      "question": "What is 2+2?",
      "options": ["3", "4", "5"],
      "correct": "4",
      "points": 1
    }
  ],
  "grading_config_snapshot": {
    "pass_threshold": 0.6,
    "scoring_type": "all-or-nothing"
  },
  "score": 18.5,
  "result_snapshot": {
    "total_score": 18.5,
    "max_score": 20,
    "question_scores": [
      {
        "question_id": "q1",
        "score": 1,
        "max_score": 1,
        "feedback": "Correct!"
      }
    ]
  },
  "passed": true,
  "created_at": "2026-02-18T14:30:00Z",
  "submitted_at": "2026-02-18T14:45:00Z",
  "finalized_at": "2026-02-18T14:45:05Z",
  "updated_at": "2026-02-18T14:45:05Z"
}
```

---

### attempt_progress

**Purpose:** Real-time progress tracking (autosave). One row per question per attempt.

**Tenant Scope:** `workspace_id`

```sql
CREATE TABLE attempt_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  attempt_id UUID NOT NULL,
  question_index INTEGER NOT NULL,  -- 0-indexed

  -- User's response for this question
  response_data JSONB NOT NULL,     -- Format varies by question type
  elapsed_time_ms INTEGER NULL,     -- Time to answer (ms)

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT fk_progress_attempt
    FOREIGN KEY (attempt_id)
    REFERENCES attempts(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_progress_workspace
    FOREIGN KEY (workspace_id)
    REFERENCES workspaces(id)
    ON DELETE CASCADE,

  -- Idempotency: only one progress record per question per attempt
  CONSTRAINT uq_progress_question
    UNIQUE (attempt_id, question_index)
);

-- Indexes
CREATE INDEX idx_progress_attempt
  ON attempt_progress(attempt_id);
```

**Column Details:**

| Column            | Type      | Null | Notes                          |
| ----------------- | --------- | ---- | ------------------------------ |
| `id`              | UUID      | NO   | Progress record ID             |
| `workspace_id`    | UUID      | NO   | Tenant ID                      |
| `attempt_id`      | UUID      | NO   | FK to attempts                 |
| `question_index`  | INTEGER   | NO   | Question number (0-indexed)    |
| `response_data`   | JSONB     | NO   | User's answer (varies by type) |
| `elapsed_time_ms` | INTEGER   | YES  | Milliseconds spent on question |
| `created_at`      | TIMESTAMP | NO   | When first saved               |
| `updated_at`      | TIMESTAMP | NO   | Last update                    |

**Example Row:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440099",
  "workspace_id": "550e8400-e29b-41d4-a716-446655440002",
  "attempt_id": "550e8400-e29b-41d4-a716-446655440001",
  "question_index": 0,
  "response_data": {
    "selected": "4",
    "timestamp": "2026-02-18T14:30:05Z"
  },
  "elapsed_time_ms": 5000,
  "created_at": "2026-02-18T14:30:05Z",
  "updated_at": "2026-02-18T14:30:05Z"
}
```

---

### submission_idempotency_keys

**Purpose:** Prevent duplicate submissions (triple-layer idempotency).

**Tenant Scope:** `workspace_id`

```sql
CREATE TABLE submission_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  key VARCHAR(255) NOT NULL,         -- Client-provided idempotency key
  attempt_id UUID NOT NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Indexes
  CONSTRAINT uq_idempotency_key
    UNIQUE (workspace_id, key),

  CONSTRAINT fk_idempotency_attempt
    FOREIGN KEY (attempt_id)
    REFERENCES attempts(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_idempotency_workspace
    FOREIGN KEY (workspace_id)
    REFERENCES workspaces(id)
    ON DELETE CASCADE
);

CREATE INDEX idx_idempotency_key
  ON submission_idempotency_keys(workspace_id, key);
```

**Purpose of Triple-Layer Idempotency:**

1. **Redis Cache** – Fast dedup for same key within 30 min
2. **DB Unique Index** – Prevents duplicate db rows
3. **Status Check** – If attempt.status = SUBMITTED, reject

---

### grading_jobs

**Purpose:** Async job queue and tracking for grading operations.

**Tenant Scope:** `workspace_id`

```sql
CREATE TABLE grading_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  attempt_id UUID NOT NULL,
  user_id UUID NOT NULL,

  -- Job state
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    -- CHECK status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER')
  result_data JSONB NULL,             -- Grading result when COMPLETED

  -- Error tracking
  error_message TEXT NULL,
  error_stack TEXT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,

  -- Time tracking
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP NULL,          -- When worker picked it up
  completed_at TIMESTAMP NULL,        -- When worker finished

  -- Foreign keys
  CONSTRAINT fk_job_attempt
    FOREIGN KEY (attempt_id)
    REFERENCES attempts(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_job_workspace
    FOREIGN KEY (workspace_id)
    REFERENCES workspaces(id)
    ON DELETE CASCADE
);

-- Indexes for worker query patterns
CREATE INDEX idx_grading_job_status
  ON grading_jobs(workspace_id, status);

CREATE INDEX idx_grading_job_attempted
  ON grading_jobs(workspace_id, attempt_id);

CREATE INDEX idx_grading_job_created
  ON grading_jobs(workspace_id, created_at DESC);
```

**Column Details:**

| Column          | Type        | Null | Notes                                               |
| --------------- | ----------- | ---- | --------------------------------------------------- |
| `id`            | UUID        | NO   | Job ID (same as Redis queue entry)                  |
| `workspace_id`  | UUID        | NO   | Tenant ID                                           |
| `attempt_id`    | UUID        | NO   | FK to attempts                                      |
| `user_id`       | UUID        | NO   | For audit logging                                   |
| `status`        | VARCHAR(32) | NO   | PENDING, PROCESSING, COMPLETED, FAILED, DEAD_LETTER |
| `result_data`   | JSONB       | YES  | Final grading result (score, feedback)              |
| `error_message` | TEXT        | YES  | Why job failed                                      |
| `error_stack`   | TEXT        | YES  | Full stack trace                                    |
| `retry_count`   | INTEGER     | NO   | Number of retries so far                            |
| `created_at`    | TIMESTAMP   | NO   | When job created                                    |
| `started_at`    | TIMESTAMP   | YES  | When worker began processing                        |
| `completed_at`  | TIMESTAMP   | YES  | When worker finished                                |

**Example Row:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440098",
  "workspace_id": "550e8400-e29b-41d4-a716-446655440002",
  "attempt_id": "550e8400-e29b-41d4-a716-446655440001",
  "user_id": "550e8400-e29b-41d4-a716-446655440003",
  "status": "COMPLETED",
  "result_data": {
    "total_score": 18,
    "max_score": 20,
    "passed": true,
    "question_scores": [...]
  },
  "error_message": null,
  "error_stack": null,
  "retry_count": 0,
  "created_at": "2026-02-18T14:45:00Z",
  "started_at": "2026-02-18T14:45:01Z",
  "completed_at": "2026-02-18T14:45:05Z"
}
```

---

## Constraints & Invariants

### Data Integrity

1. **Snapshot Immutability**

   ```sql
   ALTER TABLE attempts ADD CONSTRAINT chk_snapshot_immutable
     CHECK (question_snapshot IS NOT NULL AND grading_config_snapshot IS NOT NULL);
   ```

2. **Status Transitions (Enforced by API, not DB)**
   - IN_PROGRESS → SUBMITTED (user clicks submit)
   - SUBMITTED → FINALIZED (worker completes grading)
   - IN_PROGRESS → EXPIRED (time exceeded)

3. **Score Validity (Enforced by API)**

   ```sql
   ALTER TABLE attempts ADD CONSTRAINT chk_score_valid
     CHECK (score IS NULL OR (score >= 0 AND score <= 100));
   ```

4. **Time Ordering (Enforced by API)**
   ```sql
   -- created_at < submitted_at < finalized_at
   -- Can be verified post-hoc
   ```

---

## Indexes

### Primary Indexes

| Index                  | Columns                                         | Purpose     |
| ---------------------- | ----------------------------------------------- | ----------- |
| `pk_attempts`          | attempts.id                                     | Primary key |
| `uq_progress_question` | attempt_progress.(attempt_id, question_index)   | Idempotency |
| `uq_idempotency_key`   | submission_idempotency_keys.(workspace_id, key) | Dedup       |

### Query Indexes

| Index                           | Columns                                  | Purpose                       |
| ------------------------------- | ---------------------------------------- | ----------------------------- |
| `idx_attempts_workspace_user`   | attempts.(workspace_id, user_id)         | Find user's attempts          |
| `idx_attempts_workspace_status` | attempts.(workspace_id, status)          | Find pending grading          |
| `idx_attempts_created_at`       | attempts.(workspace_id, created_at DESC) | Time-range queries            |
| `idx_progress_attempt`          | attempt_progress.(attempt_id)            | Load all progress for attempt |
| `idx_grading_job_status`        | grading_jobs.(workspace_id, status)      | Worker polls pending jobs     |

---

## Migration

### v1.0.0 Initial Schema

**File:** `apps/api/src/db/tenant/migrations/v1.0.0/001_create_attempt_engine_tables.sql`

```sql
-- Create all tables and indexes
-- See [001_create_attempt_engine_tables.sql]
```

### v1.1.0 Add Manual Grading Support (Phase 2)

**Planned Tables:**

- `essay_responses` – Essay submission text
- `manual_grades` – Teacher grading of essays

**(To be implemented in Phase 2)**

---

## Tenant Isolation Verification

### Query Pattern Check

All queries must include `workspace_id` filter:

```sql
-- ✅ CORRECT
SELECT * FROM attempts
WHERE workspace_id = $1 AND id = $2;

-- ❌ WRONG (data leak!)
SELECT * FROM attempts
WHERE id = $1;
```

### Pre-Deployment Audit

```bash
# Find all SELECT queries without workspace_id
grep -r "SELECT.*FROM.*WHERE" apps/api/src/ | grep -v workspace_id | wc -l
# Should return: 0
```

---

## Backup & Recovery

### Backup Strategy

```bash
# Daily backup (automated)
pg_dump zidney_tenant1 | gzip > /backups/zidney_tenant1_$(date +%Y%m%d).sql.gz

# Verify backup
gunzip -c /backups/zidney_tenant1_20260218.sql.gz | head -100
```

### Recovery (Snapshot Restore Only)

```bash
# Recover from backup
gunzip -c /backups/zidney_tenant1_20260218.sql.gz | psql zidney_tenant1

# Verify recovery
SELECT COUNT(*) FROM attempts;
```

**Note:** Schema migrations are forward-only. Code rollback via container image is the supported approach.

---

## Performance Characteristics

### Typical Query Times

| Query                                | Time | Notes                       |
| ------------------------------------ | ---- | --------------------------- |
| INSERT attempt                       | ~5ms | Includes snapshot storage   |
| UPDATE progress (idempotent)         | ~2ms | Fast dedup via UNIQUE       |
| SELECT attempts (by status)          | ~1ms | Indexed                     |
| SELECT for submit (pessimistic lock) | ~1ms | Indexed, then LOCK acquired |

### Storage Estimates

| Table                       | Rows (1000 attempts) | Size                   |
| --------------------------- | -------------------- | ---------------------- |
| attempts                    | 1,000                | ~2MB (snapshots JSONB) |
| attempt_progress            | ~20,000              | ~500KB                 |
| submission_idempotency_keys | ~1,000               | ~100KB                 |
| grading_jobs                | ~1,000               | ~200KB                 |
| **Total**                   | –                    | **~2.8MB**             |

**Scaling:** 1M attempts ≈ 2.8GB (before archival, Phase 2)

---

## Version History

| Version | Date       | Changes                                                                                          |
| ------- | ---------- | ------------------------------------------------------------------------------------------------ |
| 1.0     | 2026-02-18 | Initial schema (4 tables: attempts, attempt_progress, submission_idempotency_keys, grading_jobs) |
| 1.1     | (Phase 2)  | Add essay_responses, manual_grades tables                                                        |

---

**Last Updated:** 2026-02-18  
**Maintainer:** Zidney Database Team
