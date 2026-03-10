# Tenant Baseline Schema - Documentation

**Version**: 1.0.0  
**Stage**: STAGE_02B_TENANT_BASELINE_SCHEMA  
**Last Updated**: 2026-02-16

## Table of Contents

1. [Schema Overview](#schema-overview)
2. [Table Reference](#table-reference)
3. [Foreign Key Policies](#foreign-key-policies)
4. [Immutable Tables](#immutable-tables)
5. [Triggers & Constraints](#triggers--constraints)
6. [Snapshots & Versioning](#snapshots--versioning)

---

## Schema Overview

### Architecture

The tenant baseline schema consists of **26 production tables** organized into 6 logical layers:

```
┌─ SYSTEM LAYER ─┐
│  schema_version
└────────────────┘
        ↓
┌─ IDENTITY LAYER ─────────────┐
│ users, roles, role_permissions,
│ role_assignments
└──────────────────────────────┘
        ↓
┌─ ACADEMIC STRUCTURE LAYER ────────────┐
│ divisions, departments, groups,
│ semesters, subjects
└───────────────────────────────────────┘
        ↓
┌─ CLASSIFICATION LAYER ────────────┐
│ categories, category_values,
│ tags, mcq_baskets
└───────────────────────────────────┘
        ↓
┌─ EXAM ENGINE LAYER ─────────────────────────┐
│ mcq_questions, traditional_questions,
│ mcq_exams, traditional_exams, scheduled_exams
└─────────────────────────────────────────────┘
        ↓
┌─ RUNTIME LAYER ──────────────────┐
│ attempts, attempt_events
└──────────────────────────────────┘
        ↓
┌─ COMMERCIAL & COMMUNICATION LAYER ─────────────────────┐
│ subscriptions, notifications, feedback,
│ media_files, certificates
└──────────────────────────────────────────────────────────┘
```

### Immutability Enforcement

Three layers of immutability:

1. **Database Layer**: PostgreSQL BEFORE UPDATE triggers prevent mutations
2. **Application Layer**: API/Worker only allow specific operations
3. **Audit Layer**: attempt_events maintains append-only audit trail

---

## Table Reference

### System Layer

#### `schema_version`

- **Purpose**: Track current schema version with integrity checksum
- **Constraints**: UNIQUE(version), EXCLUSION (single row), IMMUTABLE
- **Triggers**: prevent_schema_version_update (blocks UPDATE)
- **Columns**:
  - `version` VARCHAR(20) PRIMARY KEY (e.g., "1.0.0")
  - `applied_at` TIMESTAMPTZ (when applied)
  - `checksum` VARCHAR(64) (SHA256 for tampering detection)

---

### Identity Layer

#### `users`

- **Columns**: id, email, name, profile_picture_url, is_active, created_at, updated_at, created_by,
  updated_by, is_deleted
- **Indexes**: (email), (is_active)
- **Constraints**: UNIQUE(email), valid_email CHECK
- **FK Dependencies**: role_assignments, subscriptions, notifications, etc.

#### `roles`

- **Columns**: id, code, name, description, created_at, updated_at, is_deleted
- **Constraints**: UNIQUE(code), valid_role_code CHECK
- **Children**: role_permissions (CASCADE), role_assignments (CASCADE)

#### `role_permissions`

- **Columns**: id, role_id, permission_code, created_at, is_deleted
- **FK**: role_id → roles(id) ON DELETE CASCADE
- **Constraints**: UNIQUE(role_id, permission_code)

#### `role_assignments`

- **Columns**: id, user_id, role_id, assigned_at, assigned_by, removed_at, is_active
- **FK**: user_id → users(id) ON DELETE CASCADE, role_id → roles(id) ON DELETE CASCADE
- **Constraints**: UNIQUE(user_id, role_id)

---

### Academic Structure Layer

#### `divisions`

- **Purpose**: Faculty-level divisions (can be hierarchical)
- **Columns**: id, name, code, parent_division_id, is_active, audit fields
- **FK**: parent_division_id → divisions(id) ON DELETE SET NULL
- **Children**: departments (RESTRICT), hierarchy_nodes (CASCADE)

#### `departments`

- **FK**: division_id → divisions(id) ON DELETE RESTRICT
- **Children**: groups (RESTRICT), teams (RESTRICT)

#### `groups`

- **FK**: department_id → departments(id) ON DELETE RESTRICT
- **Note**: Represents student cohorts

#### `semesters`

- **Purpose**: Academic periods (e.g., Spring 2026, Fall 2026)
- **Columns**: id, name, code, start_date, end_date, is_active, audit fields
- **Children**: subjects (SET NULL)

#### `subjects`

- **Purpose**: Courses/classes
- **FK**: semester_id → semesters(id) ON DELETE SET NULL
- **Children**: mcq_baskets (SET NULL)

---

### Classification Layer

#### `categories`

- **Purpose**: Hierarchical categorization (supports tree structure)
- **FK**: parent_category_id → categories(id) ON DELETE SET NULL
- **Children**: category_values (CASCADE)

#### `category_values`

- **Purpose**: Enumerated values within a category
- **FK**: category_id → categories(id) ON DELETE CASCADE
- **Constraints**: UNIQUE(category_id, value)

#### `tags`

- **Purpose**: Flexible tagging for questions, content
- **Columns**: id, name, color_hex, is_active, audit fields
- **Constraints**: UNIQUE(name)

#### `mcq_baskets`

- **Purpose**: Question pools for MCQ exams
- **FK**: subject_id → subjects(id) ON DELETE SET NULL
- **Children**: mcq_questions (RESTRICT)

---

### Exam Engine Layer

#### `mcq_questions`

- **Columns**: id, basket_id, question_text, options_json, correct_option, difficulty, tags_json,
  audit fields
- **FK**: basket_id → mcq_baskets(id) ON DELETE RESTRICT
- **Type**: JSONB storage for flexible options structure

#### `traditional_questions`

- **Similar to mcq_questions but for essay/written questions**

#### `mcq_exams`

- **Columns**: id, name, duration_minutes, question_count, passing_score, shuffle_questions, audit
  fields
- **Children**: scheduled_exams, attempts

#### `traditional_exams`

- **Similar structure for traditional exams**

#### `scheduled_exams`

- **Purpose**: Scheduled instances of exams
- **Usage**: Polymorphic reference (exam_type + exam_id) to mcq_exams or traditional_exams
- **Columns**: id, exam_type (ENUM: MCQ/TRADITIONAL), exam_id (UUID), scheduled_at, timezone, audit
  fields

---

### Runtime Layer

#### `attempts` ⚠️ SNAPSHOT TABLE

- **Immutability**: Snapshots captured at start, **never updated during attempt**
- **Columns**:
  - `id`, `exam_type`, `exam_id`, `user_id`
  - `configuration_snapshot` JSONB (exam settings frozen at start)
  - `question_list_snapshot` JSONB (question order frozen)
  - `grading_config_snapshot` JSONB (grading rules frozen)
  - `status` ENUM (IN_PROGRESS, SUBMITTED, FINALIZED, GRADED, ARCHIVED)
  - `started_at`, `submitted_at`, `submission_deadline_at`, `server_time_at_submission`
- **FK**: user_id → users(id) ON DELETE RESTRICT
- **Constraints**: UNIQUE(exam_id, user_id, started_at)
- **Children**: attempt_events (CASCADE), attempt_answers (CASCADE)

#### `attempt_events` 🔒 IMMUTABLE

- **Immutability**: Append-only audit trail, NO UPDATES allowed
- **Columns**:
  - `id`, `attempt_id`, `event_type` ENUM, `event_payload` JSONB
  - `occurred_at` TIMESTAMPTZ (server time)
  - `created_at` TIMESTAMPTZ, `created_by` UUID
  - **No updated_at/updated_by** (immutable marker)
- **FK**: attempt_id → attempts(id) ON DELETE CASCADE
- **Trigger**: prevent_attempt_events_update (blocks UPDATE)
- **Event Types**: START, RESUME, PAUSE, ANSWER_SUBMIT, TIME_WARNING, SUBMIT_REQUEST, FINALIZED,
  GRADED, ARCHIVED

---

### Commercial & Communication Layer

#### `subscriptions`

- **FK**: user_id → users(id) ON DELETE CASCADE
- **Columns**: plan_type, status (ENUM: ACTIVE/PAUSED/CANCELLED), started_at, expired_at
- **Children**: subscription_events (CASCADE)

#### `notifications`

- **FK**: user_id → users(id) ON DELETE CASCADE
- **Columns**: message, is_read
- **Indexes**: (user_id), (is_read)

#### `feedback`

- **FK**: user_id → users(id) ON DELETE SET NULL
- **Columns**: feedback_text, rating (1-5)

#### `media_files`

- **Purpose**: Store file metadata (URLs point to S3/CDN)
- **Columns**: file_name, file_size, mime_type, url

#### `certificates`

- **FK**: user_id → users(id) ON DELETE RESTRICT
- **Columns**: template_id, certificate_data JSONB, issued_at

---

## Foreign Key Policies

### Summary Matrix

| Referencing Table | Referenced Table | ON DELETE Rule | Rationale                       |
| ----------------- | ---------------- | -------------- | ------------------------------- |
| role_permissions  | roles            | CASCADE        | Delete perms when role deleted  |
| role_assignments  | users/roles      | CASCADE        | Clean up when user/role deleted |
| departments       | divisions        | RESTRICT       | Prevent orphaned departments    |
| groups            | departments      | RESTRICT       | Prevent orphaned groups         |
| mcq_questions     | baskets          | RESTRICT       | Prevent orphaned questions      |
| attempts          | users            | RESTRICT       | Prevent orphaned attempts       |
| attempt_events    | attempts         | CASCADE        | Clean up events with attempt    |
| subscriptions     | users            | CASCADE        | Clean up subs when user deleted |
| notifications     | users            | CASCADE        | Clean up notifications          |

### Policy Examples

#### CASCADE (Auto-delete children)

```sql
ON DELETE CASCADE
-- Example: DELETE user → auto-delete all subscriptions, notifications
```

#### RESTRICT (Prevent deletion)

```sql
ON DELETE RESTRICT
-- Example: Cannot DELETE exam if active attempts exist
```

#### SET NULL (Allow deletion, NULL foreign key)

```sql
ON DELETE SET NULL
-- Example: DELETE semester → subjects.semester_id becomes NULL
```

---

## Immutable Tables

### Append-Only Pattern

**Tables**: `attempt_events`

**Characteristics**:

- No `updated_at` or `updated_by` (signals immutability)
- No `is_deleted` (no soft deletes)
- PostgreSQL BEFORE UPDATE trigger prevents all modifications
- Only INSERT is allowed

**Access Pattern**:

```sql
-- ALLOWED: INSERT
INSERT INTO attempt_events (attempt_id, event_type, occurred_at, created_by)
VALUES ('...', 'START', NOW(), '...');

-- BLOCKED: UPDATE (trigger raises exception)
UPDATE attempt_events SET event_type = 'PAUSE' WHERE id = '...';
-- ERROR: Immutable table: attempt_events does not allow updates

-- ALLOWED: SELECT (read-only)
SELECT * FROM attempt_events WHERE attempt_id = '...' ORDER BY occurred_at;

-- CASCADE DELETE (if parent deleted)
DELETE FROM attempts WHERE id = '...';  -- auto-deletes attempt_events
```

---

## Triggers & Constraints

### Schema Integrity Triggers

#### `prevent_schema_version_update`

- **Table**: schema_version
- **Event**: BEFORE UPDATE
- **Action**: Raises exception (one-time write)
- **Purpose**: Ensures schema_version is immutable after initial INSERT

#### `prevent_attempt_events_update`

- **Table**: attempt_events
- **Event**: BEFORE UPDATE
- **Action**: Raises exception (append-only enforcement)
- **Purpose**: Audit trail cannot be modified

#### `update_timestamp`

- **Tables**: All transactional tables
- **Event**: BEFORE UPDATE
- **Action**: Sets updated_at = NOW()
- **Purpose**: Automatic timestamp tracking

---

## Snapshots & Versioning

### Attempt Snapshots

**Captured at Attempt Start**:

```json
{
  "configuration_snapshot": {
    "duration_minutes": 120,
    "total_questions": 50,
    "passing_score": 70,
    "shuffle_questions": true,
    "allow_review": false
  },
  "question_list_snapshot": [
    { "id": "q1", "order": 1 },
    { "id": "q2", "order": 2 },
    { "id": "q3", "order": 3 }
  ],
  "grading_config_snapshot": {
    "algorithm": "simple_percent",
    "points_per_question": 2,
    "negative_marking": false
  }
}
```

**Immutability Guarantee**: No UPDATE allowed during or after attempt. If exam is modified, new
attempts get new snapshot.

### Schema Versioning

**Format**: Semantic versioning (major.minor.patch)

- **Example**: 1.0.0, 1.1.0, 2.0.0

**Checksum Validation**:

- SHA256 hash of migration SQL file
- Stored with version to detect tampering
- On migration: verify checksum matches before executing

---

## Performance Considerations

### Indexes

All tables include indexes on:

- Primary keys (automatic)
- Foreign keys
- Frequently filtered columns
- WHERE clauses (partial indexes on `is_deleted = false`)

### Query Patterns

**Soft Delete Filtering**:

```sql
SELECT * FROM users WHERE NOT is_deleted
-- Use partial index: idx_users_active_deleted
```

**Attempt History**:

```sql
SELECT * FROM attempt_events WHERE attempt_id = $1 ORDER BY occurred_at
-- Uses: idx_attempt_events_attempt_id
```

---

## Audit Trail

**Fields on All Transactional Tables**:

- `created_at` UUID (system timestamp)
- `created_by` UUID (user ID)
- `updated_at` TIMESTAMPTZ (last modification)
- `updated_by` UUID (last modifier)
- `is_deleted` BOOLEAN (soft delete flag)

**Immutable Tables Exception**:

- `attempt_events` has NO `updated_at`/`updated_by`/`is_deleted`
- Only `created_at` and `created_by` (append-only)

---

## Constitutional Compliance

✅ **ADR-0001**: Database-per-Tenant

- Each workspace has isolated database
- No cross-tenant joins possible in schema

✅ **ADR-0002**: Snapshot Attempt Model

- Snapshots capture exam config/questions/grading at start
- Immutable during attempt lifecycle

✅ **ADR-0006**: Server-Authoritative Time

- All timestamps use PostgreSQL `NOW()`
- No client time trusted

✅ **ADR-0008**: Semantic Versioning

- Migration versions follow major.minor.patch
- Checksum validation prevents tampering

---

## Support & Operations

For operational procedures, see [OPERATIONS.md](./OPERATIONS.md) For migration procedures, see
[MIGRATIONS.md](./MIGRATIONS.md) For backup/recovery, see [BACKUP_RECOVERY.md](./BACKUP_RECOVERY.md)
For monitoring, see [MONITORING.md](./MONITORING.md)
