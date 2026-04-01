# Feature Specification: Scheduled Exam Engine

**Feature Branch**: `spec/038-scheduled-exam-engine`
**Stage**: `STAGE_38_SCHEDULED_ENGINE`
**Phase**: `03_BACKOFFICE_CORE / 04_EXAM_ENGINE_CORE`
**Created**: 2026-04-01
**Status**: DRAFT
**Stage File**: `specs/phases/03_BACKOFFICE_CORE/04_EXAM_ENGINE_CORE/STAGE_38_SCHEDULED_ENGINE.md`

---

## Overview

The **Scheduled Exam Engine** wraps an existing, ENABLED base exam (MCQ or Traditional/Topics)
inside a time-boxed, immutable delivery event. Once scheduled and enabled, the exam window is
fixed and server-enforced. Students may only begin within the permitted window; their sessions
are forcibly submitted when time expires or connection is lost beyond the grace period.

**What is being built:**

- A `scheduled_exams` table per-tenant: binds a base exam to a UTC start/end window with
  attempt-control and reminder settings.
- Additions to the `attempts` table: tracks scheduling linkage, auto-submission state,
  heartbeat, and forced-submission metadata.
- Full CRUD API for scheduled exams, protected by tenant resolver → license middleware.
- Workflow transition API: drive scheduled exams through `APPROVED → ENABLED`.
- Attempt start enforcement: server-side time gate, single-attempt guard, exam-window binding.
- Heartbeat API: client pings to maintain session alive; server records `last_heartbeat_at`.
- Auto-submit worker: background process that monitors active scheduled attempts and force-
  submits when the attempt or exam window expires or connection grace lapses.
- Reconnection logic: if `current_time - last_heartbeat_at > 30s`, attempt is force-submitted.
- Immutability enforcement: key scheduling fields become read-only after ENABLED; structural
  fields are further frozen once any attempt exists.

**What the Scheduled Exam Engine is:**

- A delivery wrapper around an existing base exam — NOT a new exam type.
- A time-authority layer: all time decisions are server-UTC; client timestamps are never trusted.
- A tenant-isolated scheduling event with strict referential integrity to `mcq_exams` or
  `traditional_exams`.

**What the Scheduled Exam Engine is NOT:**

- NOT a standalone exam configuration (it wraps an existing base exam).
- NOT applicable to Assessments or Exercises.
- NOT a grading engine — grading logic belongs to the attempt engine.
- NOT a client-controlled event — clients have no authority over timing or submission.

**Affected system areas:**

| Area                        | Affected? | Notes                                                                 |
| --------------------------- | --------- | --------------------------------------------------------------------- |
| Tenant Isolation            | Yes       | All tables reside in tenant DB only                                   |
| License Enforcement         | Yes       | License middleware mandatory for all workspace scheduled-exam routes  |
| Status Workflow             | Yes       | Lifecycle managed: APPROVED → ENABLED                                 |
| Attempt Engine              | Yes       | Attempts gain scheduling metadata and time-binding                    |
| Worker / Background Job     | Yes       | Auto-submit worker monitors and forces submission                     |
| Redis                       | Yes       | Heartbeat tracking and distributed lock for auto-submit deduplication |
| Observability               | Yes       | Structured logging with correlation fields on all scheduled events    |
| MCQ Exam (Stage 36)         | Yes       | `mcq_exams` used as base exam source                                  |
| Traditional Exam (Stage 35) | Yes       | `traditional_exams` used as base exam source                          |

---

## User Stories

### User Story 1 – Create and Schedule an Exam (Priority: P1)

A backoffice operator creates a scheduled exam record that wraps an existing ENABLED base exam
(MCQ or Traditional) and configures the delivery time window, late tolerance, and single-attempt
policy. The exam starts in APPROVED status awaiting final enablement.

**Why this priority**: Core feature — without this, no scheduling events can exist.

**Independent Test**: Can be tested by creating a scheduled exam via API and verifying the
record in the database with correct field values, referential constraints, and APPROVED status.

**Acceptance Scenarios**:

1. **Given** a base MCQ exam in ENABLED status, **When** an operator POSTs a valid scheduled
   exam payload with start/end datetimes and tolerance fields, **Then** a `scheduled_exams`
   record is created in APPROVED status with all provided fields persisted and immutable-field
   defaults in place.
2. **Given** a base exam in COMPLETED or UNDER_REVIEW status, **When** an operator attempts to
   create a scheduled exam for it, **Then** the API returns 422 with error code
   `SCHEDULED_EXAM.BASE_EXAM_NOT_ENABLED`.
3. **Given** a `code` value already used by another scheduled exam in the same workspace,
   **When** an operator submits the same code, **Then** the API returns 409 with error code
   `SCHEDULED_EXAM.CODE_CONFLICT`.
4. **Given** `end_datetime` earlier than or equal to `start_datetime`, **When** the operator
   submits the payload, **Then** the API returns 422 with error code
   `SCHEDULED_EXAM.INVALID_TIME_WINDOW`.

---

### User Story 2 – Enable a Scheduled Exam (Priority: P1)

A backoffice operator transitions a scheduled exam from APPROVED to ENABLED, locking immutable
fields and opening the exam for student access within the configured time window.

**Why this priority**: Until ENABLED, students cannot attempt the exam; this transition is the
critical gate before delivery.

**Independent Test**: Can be tested by POSTing a workflow transition and verifying that the
`workflow_status` changes to ENABLED and that subsequent PATCH attempts on immutable fields are
rejected.

**Acceptance Scenarios**:

1. **Given** a scheduled exam in APPROVED status with its base exam still ENABLED and unmodified,
   **When** an operator triggers the ENABLED transition, **Then** `workflow_status` is set to
   ENABLED and the response confirms the transition.
2. **Given** the base exam has been modified after the scheduled exam was created, **When** an
   operator attempts ENABLED transition, **Then** the API returns 422 with error code
   `SCHEDULED_EXAM.BASE_EXAM_MODIFIED`.
3. **Given** a scheduled exam already in ENABLED status, **When** an operator attempts to PATCH
   `start_datetime`, **Then** the API returns 409 with error code
   `SCHEDULED_EXAM.FIELD_IMMUTABLE`.

---

### User Story 3 – Student Starts a Scheduled Exam Attempt (Priority: P1)

A student attempts to begin a scheduled exam. The server validates the current time against the
exam window (accounting for late tolerance), enforces the single-attempt rule, creates the
attempt record with scheduling metadata, and returns the attempt session.

**Why this priority**: The student-facing entry point — every other scheduling rule feeds into
this moment.

**Independent Test**: Can be tested by invoking the attempt-start endpoint at different server
times (before window, in window, after window) and with the single-attempt guard both enabled
and disabled.

**Acceptance Scenarios**:

1. **Given** a scheduled exam in ENABLED status and current server time within the permitted
   start window, **When** a student POSTs to start the attempt, **Then** an attempt record is
   created with `is_scheduled=true`, `scheduled_exam_id`, `scheduled_end_time`, and
   `attempt_end_time = min(start_time + exam_duration, scheduled_end_datetime)`.
2. **Given** current server time is before `(start_datetime - late_tolerance_minutes)`, **When**
   a student attempts to start, **Then** the API returns 403 with error code
   `SCHEDULED_EXAM.NOT_STARTED`.
3. **Given** current server time is after `end_datetime`, **When** a student attempts to start,
   **Then** the API returns 403 with error code `SCHEDULED_EXAM.CLOSED`.
4. **Given** `allow_single_attempt=true` and the student already has an attempt for this
   scheduled exam, **When** the student POSTs to start, **Then** the API returns 403 with error
   code `SCHEDULED_EXAM.ALREADY_ATTEMPTED`.
5. **Given** `allow_single_attempt=true`, the single-attempt check must be evaluated inside a
   transaction with a row-level lock to prevent race conditions.

---

### User Story 4 – Heartbeat During Scheduled Attempt (Priority: P2)

A student's client periodically pings the heartbeat endpoint during an active scheduled attempt.
The server updates `last_heartbeat_at` to the current server UTC time. This enables the
reconnection grace window enforcement by the worker.

**Why this priority**: Required to distinguish active sessions from disconnected ones before
force-submitting.

**Independent Test**: Can be tested by calling the heartbeat endpoint and verifying
`last_heartbeat_at` is updated to a server timestamp; client-supplied timestamps must be ignored.

**Acceptance Scenarios**:

1. **Given** an active scheduled attempt, **When** the client POSTs to the heartbeat endpoint,
   **Then** `last_heartbeat_at` is updated to the current server UTC time (not client time).
2. **Given** an attempt that has already been submitted, **When** a heartbeat ping arrives,
   **Then** the API returns 409 with error code `ATTEMPT.ALREADY_SUBMITTED`.
3. **Given** the current server time exceeds `attempt_end_time`, **When** a heartbeat ping
   arrives, **Then** the API returns 410 with error code `ATTEMPT.TIME_EXPIRED` and triggers
   the force-submit path.

---

### User Story 5 – Auto-Submit Worker Enforces Time Limits (Priority: P1)

The background worker continuously monitors active scheduled attempts and force-submits any
attempt where the attempt duration, the scheduled exam end time, or the reconnection grace window
has been exceeded. The worker logs the forced submission reason at WARN level.

**Why this priority**: Without the worker, timing enforcement is incomplete and students could
stay active beyond the allowed window.

**Independent Test**: Can be tested by creating an attempt with a past `attempt_end_time` and
verifying that the worker transitions it to SUBMITTED with `auto_submitted=true` and
`forced_submission_reason=ATTEMPT_TIME_EXCEEDED`, and does not process it a second time.

**Acceptance Scenarios**:

1. **Given** an active attempt where `current_time > attempt_end_time`, **When** the worker
   runs, **Then** the attempt is submitted with `auto_submitted=true` and
   `forced_submission_reason=ATTEMPT_TIME_EXCEEDED`.
2. **Given** an active attempt where `current_time > scheduled_exam.end_datetime`, **When** the
   worker runs, **Then** the attempt is submitted with `auto_submitted=true` and
   `forced_submission_reason=SCHEDULED_END_REACHED`.
3. **Given** an active attempt where `current_time - last_heartbeat_at > 30 seconds`, **When**
   the worker runs, **Then** the attempt is submitted with `auto_submitted=true` and
   `forced_submission_reason=CONNECTION_TIMEOUT`.
4. **Given** an attempt that has already been submitted, **When** the worker tries to process
   it again, **Then** the worker exits idempotently without creating duplicate submission records
   or errors.
5. **Given** multiple concurrent worker instances, **When** the same attempt qualifies for
   force-submit, **Then** only one worker succeeds (distributed lock prevents duplicates).

---

### User Story 6 – Reconnection After Connection Loss (Priority: P2)

A student whose connection drops has a 30-second grace window to reconnect and resume their
scheduled attempt. If the grace window expires before reconnection, the worker force-submits
the attempt on the next worker cycle.

**Why this priority**: Protects students from network hiccups; prevents indefinite session holds.

**Independent Test**: Can be tested by stopping heartbeat pings for >30 seconds and verifying
the worker force-submits the attempt with `forced_submission_reason=CONNECTION_TIMEOUT`.

**Acceptance Scenarios**:

1. **Given** an active attempt where `last_heartbeat_at` was 25 seconds ago, **When** the
   worker runs, **Then** the attempt is NOT force-submitted.
2. **Given** an active attempt where `last_heartbeat_at` was 35 seconds ago, **When** the
   worker runs, **Then** the attempt IS force-submitted with `forced_submission_reason=CONNECTION_TIMEOUT`.
3. **Given** an attempt force-submitted for CONNECTION_TIMEOUT, **When** the student reconnects
   and attempts to resume, **Then** the API returns 410 with error code `ATTEMPT.ALREADY_SUBMITTED`.

---

### User Story 7 – View and Manage Scheduled Exams (Priority: P3)

A backoffice operator lists, filters, and views scheduled exam records. They can update mutable
metadata fields before the exam is ENABLED and before any attempts exist.

**Why this priority**: Administrative CRUD needed for day-to-day management, but lower priority
than the core scheduling and enforcement logic.

**Independent Test**: Can be tested by exercising list, get, and update endpoints independently
of the attempt flow.

**Acceptance Scenarios**:

1. **Given** multiple scheduled exams in the workspace, **When** an operator GETs the list with
   filters (status, exam_type, date range), **Then** only matching records are returned with
   correct pagination.
2. **Given** a scheduled exam in APPROVED status with no attempts, **When** an operator PATCHes
   mutable fields (name, code, remind flags), **Then** the fields are updated successfully.
3. **Given** a scheduled exam in ENABLED status, **When** an operator attempts to PATCH
   `start_datetime`, **Then** the API returns 409 with error code
   `SCHEDULED_EXAM.FIELD_IMMUTABLE`.
4. **Given** a scheduled exam with existing attempts, **When** an operator attempts deletion,
   **Then** the API returns 409 with error code `SCHEDULED_EXAM.HAS_ATTEMPTS`.

---

### User Story 8 – Workflow Invalidation on Base Exam Change (Priority: P2)

If a base exam is modified after a scheduled exam references it, the scheduled exam's ENABLED
transition is blocked and the record is marked as requiring re-approval.

**Why this priority**: Prevents stale configuration from being delivered to students.

**Independent Test**: Can be tested by modifying a base exam after a scheduled exam in APPROVED
status references it, then attempting to enable the scheduled exam.

**Acceptance Scenarios**:

1. **Given** a scheduled exam in APPROVED status, **When** the referenced base exam is updated,
   **Then** the scheduled exam's `base_exam_modified` flag is set to true.
2. **Given** `base_exam_modified=true`, **When** an operator attempts ENABLED transition, **Then**
   the API returns 422 with error code `SCHEDULED_EXAM.BASE_EXAM_MODIFIED`.
3. **Given** `base_exam_modified=true`, **When** an operator explicitly re-approves the
   scheduled exam (re-review), **Then** `base_exam_modified` is reset to false and transition
   to ENABLED becomes available.

---

### Edge Cases

- What happens if `start_datetime` and `end_datetime` are equal? → `INVALID_TIME_WINDOW` (end must be after start).
- What happens if a student submits manually while the worker is running? → Idempotent submission; one record wins, other exits cleanly.
- What happens if `exam_duration` is longer than the scheduled window? → `attempt_end_time = scheduled_exam.end_datetime`.
- What happens if two students start simultaneously with `allow_single_attempt=true`? → Transactional lock; second student receives `ALREADY_ATTEMPTED`.
- What happens if the worker crashes mid-submission? → Transactional write; incomplete submissions are rolled back and picked up on next cycle.
- What happens if `base_exam_id` is archived after scheduling? → ENABLED transition blocked; error code `SCHEDULED_EXAM.BASE_EXAM_ARCHIVED`.

---

## Functional Requirements

### FR-001: Create Scheduled Exam

**Endpoint:** `POST /api/v1/workspace/:slug/scheduled-exams`

Create a new scheduled exam record binding a base exam to a time window.

**Required fields:**

- `base_exam_id` (uuid) — FK to `mcq_exams.id` OR `traditional_exams.id`
- `exam_type` (enum: `MCQ` | `TRADITIONAL`) — discriminates the FK target table
- `name` (string, max 255) — display name for the scheduled event
- `code` (string, max 100) — unique per workspace (case-insensitive)
- `start_datetime` (ISO 8601 UTC) — window open time
- `end_datetime` (ISO 8601 UTC) — window close time

**Optional fields:**

- `late_tolerance_minutes` (integer ≥ 0, default 5) — minutes before official start to grant access
- `allow_single_attempt` (boolean, default false)
- `reminder_before_start` (boolean, default false)
- `reminder_before_end` (boolean, default false)

**Validation rules:**

- `end_datetime` MUST be strictly after `start_datetime`
- `base_exam_id` must reference a non-archived record in the correct table for `exam_type`
- Referenced base exam `workflow_status` MUST be `ENABLED`
- `code` must be unique per workspace (case-insensitive), excluding soft-deleted records
- `late_tolerance_minutes` MUST be ≥ 0

**Initial status:** `APPROVED`

**Response:** Created scheduled exam object with `id`, timestamps, and `workflow_status=APPROVED`.

---

### FR-002: List Scheduled Exams

**Endpoint:** `GET /api/v1/workspace/:slug/scheduled-exams`

List scheduled exam records with pagination and optional filters.

**Query parameters:**

- `page` (integer, default 1)
- `limit` (integer, default 20, max 100)
- `workflow_status` (optional: `APPROVED` | `ENABLED`)
- `exam_type` (optional: `MCQ` | `TRADITIONAL`)
- `search` (optional — case-insensitive match on name or code)
- `start_from` (optional ISO 8601 UTC — filter by `start_datetime >= value`)
- `start_to` (optional ISO 8601 UTC — filter by `start_datetime <= value`)

**Response:** `{ items: ScheduledExam[], total: number, page: number, limit: number }`

Excludes soft-deleted records (`deleted_at IS NULL`).

---

### FR-003: Get Scheduled Exam by ID

**Endpoint:** `GET /api/v1/workspace/:slug/scheduled-exams/:id`

Retrieve a single scheduled exam with attempt count summary.

**Response:** Full scheduled exam object including:

- `attempts_count` (integer) — total attempt count for this scheduled exam
- `base_exam_modified` (boolean) — whether base exam changed after scheduling

Returns 404 if not found or soft-deleted.

---

### FR-004: Update Scheduled Exam

**Endpoint:** `PATCH /api/v1/workspace/:slug/scheduled-exams/:id`

Update mutable fields. Immutability rules are enforced.

**Always mutable (before and after ENABLED, as long as no attempts exist):**

- `name`, `reminder_before_start`, `reminder_before_end`

**Mutable only before ENABLED:**

- `code`, `start_datetime`, `end_datetime`, `late_tolerance_minutes`, `allow_single_attempt`

**Immutable once ENABLED:**

- `base_exam_id`, `exam_type`, `start_datetime`, `end_datetime`, `late_tolerance_minutes`

**Immutable once any attempt exists:**

- All structural fields; only `name`, `reminder_before_start`, `reminder_before_end` remain mutable

**Validation:** Same rules as FR-001 for updated fields.

---

### FR-005: Delete Scheduled Exam

**Endpoint:** `DELETE /api/v1/workspace/:slug/scheduled-exams/:id`

Soft-delete a scheduled exam (`deleted_at = NOW()`).

**Guard rules:**

- MUST be rejected if any attempt exists for this scheduled exam (`SCHEDULED_EXAM.HAS_ATTEMPTS`)
- MUST be rejected if `workflow_status = ENABLED` (`SCHEDULED_EXAM.CANNOT_DELETE_ENABLED`)

---

### FR-006: Workflow Transition – Enable Scheduled Exam

**Endpoint:** `POST /api/v1/workspace/:slug/scheduled-exams/:id/workflow`

Drive the scheduled exam through the workflow lifecycle.

**Supported transitions:**

| From     | To      | Validation                                                              |
| -------- | ------- | ----------------------------------------------------------------------- |
| APPROVED | ENABLED | Base exam MUST be ENABLED, not archived, and `base_exam_modified=false` |

**On successful ENABLED transition:**

- `workflow_status` is set to `ENABLED`
- `base_exam_snapshot_hash` is recorded (hash of key base exam fields at transition time)

**Blocked if:**

- Base exam is not ENABLED → `SCHEDULED_EXAM.BASE_EXAM_NOT_ENABLED`
- Base exam is archived → `SCHEDULED_EXAM.BASE_EXAM_ARCHIVED`
- Base exam was modified after scheduling → `SCHEDULED_EXAM.BASE_EXAM_MODIFIED`

---

### FR-007: Re-Approve After Base Exam Change

**Endpoint:** `POST /api/v1/workspace/:slug/scheduled-exams/:id/re-approve`

Resets `base_exam_modified=false` and updates the internal base exam reference snapshot, allowing
an operator to acknowledge the change and proceed to ENABLED after review.

**Precondition:** `workflow_status = APPROVED` and `base_exam_modified = true`.

**Effect:** `base_exam_modified` is set to false; base exam snapshot is refreshed.

---

### FR-008: Start Scheduled Attempt

**Endpoint:** `POST /api/v1/workspace/:slug/scheduled-exams/:id/attempts`

A student starts an attempt for the scheduled exam. This is the time-gated entry point.

**Validation (server-side only, using server UTC clock):**

1. Scheduled exam MUST be in `ENABLED` status → otherwise 422
2. `current_time >= (start_datetime - late_tolerance_minutes)` → otherwise 403 `NOT_STARTED`
3. `current_time <= end_datetime` → otherwise 403 `CLOSED`
4. If `allow_single_attempt=true`: count existing attempts for `(user_id, scheduled_exam_id)`
   inside a transaction; if count > 0 → 403 `ALREADY_ATTEMPTED`

**Created attempt fields (additions):**

- `is_scheduled = true`
- `scheduled_exam_id` = this scheduled exam's ID
- `scheduled_end_time` = `scheduled_exam.end_datetime`
- `attempt_end_time = MIN(start_time + exam_duration, scheduled_exam.end_datetime)`
- `auto_submitted = false`
- `forced_submission_reason = null`
- `last_heartbeat_at = NOW()` (server time)

**Snapshot:** The full base exam config is snapshotted into the attempt at creation time (same
contract as non-scheduled attempts; Stage 36/35 snapshot rules apply).

**Response:** Attempt session object including `attempt_end_time`, `scheduled_end_time`,
`remaining_seconds` (computed server-side).

---

### FR-009: Heartbeat (Keep-Alive)

**Endpoint:** `POST /api/v1/workspace/:slug/attempts/:attempt_id/heartbeat`

Called periodically by the client (recommended interval: 10 seconds) to signal the session
is still active.

**Server behavior:**

- Validate attempt belongs to the authenticated user and to this workspace
- Validate attempt is not yet submitted
- Validate `current_time <= attempt_end_time` → if exceeded, reject and trigger force-submit
- Update `last_heartbeat_at = NOW()` using server UTC clock (ignore any client-provided time)

**Response:** `{ success: true, data: { remaining_seconds: number } }`

---

### FR-010: Submit Attempt (Standard Path)

**Endpoint:** `POST /api/v1/workspace/:slug/attempts/:attempt_id/submit`

Standard student-initiated submission. Must be idempotent.

**Validation:**

- Attempt must belong to authenticated user
- Attempt must not already be submitted (`auto_submitted` or already in terminal state) → 409 `ATTEMPT.ALREADY_SUBMITTED`
- Submission time must be ≤ `attempt_end_time` (enforced server-side); if exceeded, record as
  `auto_submitted=true`, `forced_submission_reason=ATTEMPT_TIME_EXCEEDED`

**Idempotency:** If the same attempt is submitted twice within a short window, the second call
returns the existing submission result without errors.

---

### FR-011: Auto-Submit Worker (Force Submit Path)

The auto-submit worker runs on a configurable cycle (recommended: every 30 seconds) and
processes active scheduled attempts that meet any of the force-submit conditions.

See [Worker Contract](#worker-contract) section for full specification.

---

### FR-012: Base Exam Modification Detection

When a base exam (`mcq_exams` or `traditional_exams`) is updated, the system must detect
whether any APPROVED or ENABLED scheduled exams reference it.

**Behavior:**

- For APPROVED scheduled exams: set `base_exam_modified = true`; these exams cannot be ENABLED
  until an operator performs re-approval (FR-007).
- For ENABLED scheduled exams: log a WARNING; structural invalidation does not retroactively
  disable an in-progress scheduled event. No change to `workflow_status`. A platform alert
  is raised for operator review.

---

### FR-013: Immutability Enforcement

After `workflow_status = ENABLED`, PATCH requests on the following fields MUST be rejected
with `SCHEDULED_EXAM.FIELD_IMMUTABLE`:

- `base_exam_id`, `exam_type`, `start_datetime`, `end_datetime`, `late_tolerance_minutes`

After any attempt exists for the scheduled exam, PATCH requests on ALL structural fields
(including `code`, `allow_single_attempt`) MUST be rejected with `SCHEDULED_EXAM.HAS_ATTEMPTS`.

---

## Non-Functional Requirements

### NFR-001: Server-Side Time Authority

All time comparisons MUST use the database server's `NOW()` function or an equivalent server-
side clock. Client-provided timestamps in request payloads MUST NOT be used for time-gate
decisions. This rule applies to: attempt start, submission, heartbeat, auto-submit worker, and
reconnection evaluation.

### NFR-002: Idempotency

All submission operations (student-initiated and worker-initiated) MUST be idempotent. Retrying
a submission on an already-submitted attempt MUST produce a successful no-op response (or
acknowledge the existing state) rather than an error or duplicate record.

### NFR-003: Transactional Integrity

The following operations MUST execute within a database transaction:

- Attempt creation with single-attempt enforcement (row-level lock on `(user_id, scheduled_exam_id)`)
- Worker force-submit (lock attempt row before write to prevent concurrent submission)
- Scheduled exam enablement (transition + snapshot recording)
- Re-approval (flag reset + snapshot refresh)

### NFR-004: Tenant Isolation

All database queries MUST be scoped to the tenant's dedicated PostgreSQL pool. No cross-tenant
queries, no global singleton DB connection, no shared tables.

### NFR-005: License Enforcement

License validation middleware MUST run on every route under `/api/v1/workspace/:slug/`.
Requests on expired or suspended licenses MUST be rejected before reaching business logic.

### NFR-006: Performance

- Attempt start endpoint: p95 latency < 500ms under normal load
- Heartbeat endpoint: p95 latency < 100ms
- Worker cycle: complete a full scan of active scheduled attempts within 10 seconds on datasets
  up to 10,000 concurrent active attempts

### NFR-007: Security

- Attempt ownership MUST be validated on every attempt-scoped endpoint (heartbeat, submit) —
  a student cannot heartbeat or submit another student's attempt
- Workspace slug MUST be verified against the tenant pool; slug injection from request body
  is forbidden
- `scheduled_exam_id` linkage MUST be verified to belong to the correct tenant DB

### NFR-008: Forward-Only Migrations

All schema changes MUST be expressed as forward-only migration files in
`apps/api/src/db/tenant/migrations/`. Existing migration files MUST NOT be modified.

---

## API Endpoints

| #   | Method | Path                                                     | Auth     | Description                       |
| --- | ------ | -------------------------------------------------------- | -------- | --------------------------------- |
| 1   | POST   | `/api/v1/workspace/:slug/scheduled-exams`                | Operator | Create scheduled exam             |
| 2   | GET    | `/api/v1/workspace/:slug/scheduled-exams`                | Operator | List scheduled exams              |
| 3   | GET    | `/api/v1/workspace/:slug/scheduled-exams/:id`            | Operator | Get scheduled exam detail         |
| 4   | PATCH  | `/api/v1/workspace/:slug/scheduled-exams/:id`            | Operator | Update mutable fields             |
| 5   | DELETE | `/api/v1/workspace/:slug/scheduled-exams/:id`            | Operator | Soft-delete scheduled exam        |
| 6   | POST   | `/api/v1/workspace/:slug/scheduled-exams/:id/workflow`   | Operator | Workflow transition               |
| 7   | POST   | `/api/v1/workspace/:slug/scheduled-exams/:id/re-approve` | Operator | Re-approve after base exam change |
| 8   | POST   | `/api/v1/workspace/:slug/scheduled-exams/:id/attempts`   | Student  | Start scheduled attempt           |
| 9   | POST   | `/api/v1/workspace/:slug/attempts/:attempt_id/heartbeat` | Student  | Session keep-alive heartbeat      |
| 10  | POST   | `/api/v1/workspace/:slug/attempts/:attempt_id/submit`    | Student  | Submit attempt (standard path)    |

### API Response Contract

All responses follow the Zidney error contract:

```ts
// Success
{ success: true, data: T, error: null }

// Error
{ success: false, data: null, error: { code: string, message: string } }
```

### Key Request/Response Shapes

#### POST `/scheduled-exams` — Request Body

```json
{
  "base_exam_id": "uuid",
  "exam_type": "MCQ | TRADITIONAL",
  "name": "string (max 255)",
  "code": "string (max 100)",
  "start_datetime": "ISO 8601 UTC",
  "end_datetime": "ISO 8601 UTC",
  "late_tolerance_minutes": 5,
  "allow_single_attempt": false,
  "reminder_before_start": false,
  "reminder_before_end": false
}
```

#### POST `/scheduled-exams` — Response Data

```json
{
  "id": "uuid",
  "base_exam_id": "uuid",
  "exam_type": "MCQ",
  "name": "string",
  "code": "string",
  "start_datetime": "ISO 8601 UTC",
  "end_datetime": "ISO 8601 UTC",
  "late_tolerance_minutes": 5,
  "allow_single_attempt": false,
  "reminder_before_start": false,
  "reminder_before_end": false,
  "workflow_status": "APPROVED",
  "base_exam_modified": false,
  "created_at": "ISO 8601 UTC",
  "updated_at": "ISO 8601 UTC"
}
```

#### POST `/scheduled-exams/:id/attempts` — Response Data

```json
{
  "attempt_id": "uuid",
  "scheduled_exam_id": "uuid",
  "is_scheduled": true,
  "attempt_end_time": "ISO 8601 UTC",
  "scheduled_end_time": "ISO 8601 UTC",
  "remaining_seconds": 3600,
  "auto_submitted": false,
  "created_at": "ISO 8601 UTC"
}
```

#### POST `/attempts/:id/heartbeat` — Response Data

```json
{
  "remaining_seconds": 3540
}
```

---

## Database Schema

### Table: `scheduled_exams` (tenant DB)

```sql
CREATE TABLE scheduled_exams (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  base_exam_id          UUID          NOT NULL,
  exam_type             VARCHAR(20)   NOT NULL CHECK (exam_type IN ('MCQ', 'TRADITIONAL')),
  name                  VARCHAR(255)  NOT NULL,
  code                  VARCHAR(100)  NOT NULL,
  start_datetime        TIMESTAMPTZ   NOT NULL,
  end_datetime          TIMESTAMPTZ   NOT NULL,
  late_tolerance_minutes INTEGER       NOT NULL DEFAULT 5 CHECK (late_tolerance_minutes >= 0),
  allow_single_attempt  BOOLEAN       NOT NULL DEFAULT FALSE,
  reminder_before_start BOOLEAN       NOT NULL DEFAULT FALSE,
  reminder_before_end   BOOLEAN       NOT NULL DEFAULT FALSE,
  workflow_status       VARCHAR(20)   NOT NULL DEFAULT 'APPROVED'
                          CHECK (workflow_status IN ('APPROVED', 'ENABLED')),
  base_exam_modified    BOOLEAN       NOT NULL DEFAULT FALSE,
  base_exam_snapshot_hash TEXT        NULL,
  deleted_at            TIMESTAMPTZ   NULL,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT scheduled_exams_end_after_start
    CHECK (end_datetime > start_datetime)
);
```

**Indexes:**

```sql
CREATE INDEX idx_scheduled_exams_base_exam_id    ON scheduled_exams (base_exam_id);
CREATE INDEX idx_scheduled_exams_start_datetime  ON scheduled_exams (start_datetime);
CREATE INDEX idx_scheduled_exams_end_datetime    ON scheduled_exams (end_datetime);
CREATE INDEX idx_scheduled_exams_workflow_status ON scheduled_exams (workflow_status);
CREATE UNIQUE INDEX idx_scheduled_exams_code_workspace
  ON scheduled_exams (LOWER(code))
  WHERE deleted_at IS NULL;
```

**Notes:**

- `base_exam_id` is a logical FK to `mcq_exams.id` OR `traditional_exams.id`, discriminated
  by `exam_type`. A polymorphic FK is not enforced at DB level; integrity is enforced at the
  application layer with explicit validation.
- `base_exam_snapshot_hash` stores a hash of key base exam fields captured at ENABLED
  transition time, used to detect post-scheduling modification.

---

### Additions to `attempts` Table (tenant DB)

```sql
ALTER TABLE attempts ADD COLUMN is_scheduled           BOOLEAN       NOT NULL DEFAULT FALSE;
ALTER TABLE attempts ADD COLUMN scheduled_exam_id      UUID          NULL;
ALTER TABLE attempts ADD COLUMN scheduled_end_time     TIMESTAMPTZ   NULL;
ALTER TABLE attempts ADD COLUMN auto_submitted         BOOLEAN       NOT NULL DEFAULT FALSE;
ALTER TABLE attempts ADD COLUMN forced_submission_reason VARCHAR(50) NULL
  CHECK (forced_submission_reason IN (
    'ATTEMPT_TIME_EXCEEDED',
    'SCHEDULED_END_REACHED',
    'CONNECTION_TIMEOUT'
  ));
ALTER TABLE attempts ADD COLUMN last_heartbeat_at      TIMESTAMPTZ   NULL;
```

**Additional indexes:**

```sql
CREATE INDEX idx_attempts_scheduled_exam_id
  ON attempts (scheduled_exam_id)
  WHERE scheduled_exam_id IS NOT NULL;

CREATE INDEX idx_attempts_is_scheduled_active
  ON attempts (scheduled_exam_id, is_scheduled, auto_submitted)
  WHERE is_scheduled = TRUE AND auto_submitted = FALSE;

CREATE INDEX idx_attempts_last_heartbeat_at
  ON attempts (last_heartbeat_at)
  WHERE is_scheduled = TRUE AND auto_submitted = FALSE;
```

---

### Migration Strategy

- All schema changes are expressed as **forward-only** migration files under
  `apps/api/src/db/tenant/migrations/`.
- The `scheduled_exams` table is a new migration file (e.g., `NNNN_create_scheduled_exams.ts`).
- The `attempts` table additions are a separate migration file
  (e.g., `NNNN_add_scheduled_fields_to_attempts.ts`).
- Existing migration files MUST NOT be modified.
- Migrations are run during tenant provisioning and via the standard migration runner.

---

## Business Rules

### BR-001: Exam Type Restriction

Scheduling is only permitted for:

- `exam_type = MCQ` → `base_exam_id` references `mcq_exams`
- `exam_type = TRADITIONAL` → `base_exam_id` references `traditional_exams`

Assessments and Exercises MUST NOT be schedulable.

---

### BR-002: Base Exam Must Be ENABLED

A scheduled exam may only be created when `base_exam.workflow_status = ENABLED`. The `ENABLED`
transition on the scheduled exam further re-validates this at the moment of transition.

---

### BR-003: Immutability After ENABLED

Once `workflow_status = ENABLED`, the following fields MUST NOT change:

- `base_exam_id`
- `exam_type`
- `start_datetime`
- `end_datetime`
- `late_tolerance_minutes`

Any PATCH targeting these fields while `workflow_status = ENABLED` MUST be rejected.

---

### BR-004: Immutability When Attempts Exist

If any attempt exists for the scheduled exam (`COUNT(*) > 0` in `attempts` where
`scheduled_exam_id = this.id`), ALL structural field modifications MUST be rejected, including
`code` and `allow_single_attempt`. Only `name`, `reminder_before_start`, and
`reminder_before_end` remain mutable.

---

### BR-005: Server-Side Time Authority

ALL time comparisons use the server's UTC clock. The decision points are:

| Decision                    | Server Formula                                                              |
| --------------------------- | --------------------------------------------------------------------------- |
| Can student start?          | `NOW() >= (start_datetime - interval '?' minute) AND NOW() <= end_datetime` |
| Is attempt expired?         | `NOW() > attempt_end_time`                                                  |
| Is session disconnected?    | `NOW() - last_heartbeat_at > interval '30 seconds'`                         |
| Is scheduled window closed? | `NOW() > scheduled_exam.end_datetime`                                       |

No payload field from the client may substitute for any of these.

---

### BR-006: Start Window Formula

```
allowed_start_from = start_datetime - INTERVAL '${late_tolerance_minutes} minutes'
```

A student may start only if:

```
allowed_start_from <= NOW() <= end_datetime
```

Before `allowed_start_from` → 403 `SCHEDULED_EXAM.NOT_STARTED`
After `end_datetime` → 403 `SCHEDULED_EXAM.CLOSED`

Late tolerance applies ONLY to the start gate, not to submission time.

---

### BR-007: Attempt End Time Binding

On attempt creation for a scheduled exam:

```
attempt_end_time = MIN(start_time + exam_duration_interval, scheduled_exam.end_datetime)
```

If the base exam has no `duration_minutes` (unlimited duration exam), then:

```
attempt_end_time = scheduled_exam.end_datetime
```

No attempt may remain active beyond `scheduled_exam.end_datetime`.

---

### BR-008: Single Attempt Enforcement

If `allow_single_attempt = true`, before creating a new attempt the system MUST:

1. Begin a transaction
2. SELECT COUNT(\*) FROM attempts WHERE user_id = ? AND scheduled_exam_id = ? WITH LOCK
3. If count > 0 → rollback and return 403 `SCHEDULED_EXAM.ALREADY_ATTEMPTED`
4. Else → proceed to create attempt within the same transaction

The row-level lock prevents concurrent duplicate attempt creation.

---

### BR-009: Reconnection Grace Window

The 30-second grace window is evaluated by the worker:

```
IF (NOW() - last_heartbeat_at) > INTERVAL '30 seconds' THEN
  force_submit(reason = 'CONNECTION_TIMEOUT')
END IF
```

There is no API-level reconnection endpoint; the student reconnects by calling the heartbeat
endpoint — if the attempt is still active, the session continues. If already submitted, they
receive `ATTEMPT.ALREADY_SUBMITTED`.

---

### BR-010: Workflow Invalidation on Base Exam Change

When a base exam is updated after a scheduled exam references it:

| Scheduled Exam Status | Action                                                                         |
| --------------------- | ------------------------------------------------------------------------------ |
| APPROVED              | Set `base_exam_modified = true`; ENABLED transition blocked until re-approved  |
| ENABLED               | Log WARN; no status change; operator alert raised; no retroactive invalidation |

---

### BR-011: Workflow Transition Rules

| Transition | From     | To      | Pre-conditions                                                |
| ---------- | -------- | ------- | ------------------------------------------------------------- |
| Enable     | APPROVED | ENABLED | Base exam ENABLED, not archived, `base_exam_modified = false` |

There is no DISABLED or CANCELLED status for scheduled exams. A scheduled exam can be soft-
deleted only if no attempts exist.

---

### BR-012: Deletion Guard

A scheduled exam MUST NOT be deleted (soft or hard) if:

- Any attempt exists for `scheduled_exam_id`
- `workflow_status = ENABLED` (unless all attempts are terminal and operator confirms)

---

## Error Codes

All errors follow the Zidney error contract:

```json
{
  "success": false,
  "data": null,
  "error": { "code": "DOMAIN.REASON", "message": "Human-readable string" }
}
```

### Scheduled Exam Errors

| Code                                   | HTTP | Description                                              |
| -------------------------------------- | ---- | -------------------------------------------------------- |
| `SCHEDULED_EXAM.NOT_FOUND`             | 404  | Scheduled exam not found or soft-deleted                 |
| `SCHEDULED_EXAM.CODE_CONFLICT`         | 409  | Code already exists in this workspace                    |
| `SCHEDULED_EXAM.INVALID_TIME_WINDOW`   | 422  | `end_datetime` not after `start_datetime`                |
| `SCHEDULED_EXAM.BASE_EXAM_NOT_ENABLED` | 422  | Referenced base exam is not in ENABLED status            |
| `SCHEDULED_EXAM.BASE_EXAM_ARCHIVED`    | 422  | Referenced base exam is archived                         |
| `SCHEDULED_EXAM.BASE_EXAM_MODIFIED`    | 422  | Base exam changed after scheduling; re-approval required |
| `SCHEDULED_EXAM.FIELD_IMMUTABLE`       | 409  | Attempt to modify immutable field after ENABLED          |
| `SCHEDULED_EXAM.HAS_ATTEMPTS`          | 409  | Cannot delete or structurally modify; attempts exist     |
| `SCHEDULED_EXAM.CANNOT_DELETE_ENABLED` | 409  | Cannot delete an ENABLED scheduled exam                  |
| `SCHEDULED_EXAM.NOT_STARTED`           | 403  | Current time is before the permitted start window        |
| `SCHEDULED_EXAM.CLOSED`                | 403  | Current time is after `end_datetime`                     |
| `SCHEDULED_EXAM.ALREADY_ATTEMPTED`     | 403  | Student already has an attempt (single-attempt mode)     |
| `SCHEDULED_EXAM.INVALID_EXAM_TYPE`     | 422  | `exam_type` not MCQ or TRADITIONAL                       |
| `SCHEDULED_EXAM.INVALID_BASE_EXAM_REF` | 422  | `base_exam_id` does not exist for given `exam_type`      |

### Attempt Errors (Scheduled Context)

| Code                        | HTTP | Description                                       |
| --------------------------- | ---- | ------------------------------------------------- |
| `ATTEMPT.ALREADY_SUBMITTED` | 409  | Attempt already in terminal (submitted) state     |
| `ATTEMPT.TIME_EXPIRED`      | 410  | Attempt `attempt_end_time` exceeded               |
| `ATTEMPT.NOT_FOUND`         | 404  | Attempt not found for this user/workspace         |
| `ATTEMPT.UNAUTHORIZED`      | 403  | Attempt does not belong to the authenticated user |

### General Errors

| Code                         | HTTP | Description                               |
| ---------------------------- | ---- | ----------------------------------------- |
| `LICENSE.SUSPENDED`          | 403  | Workspace license is suspended or expired |
| `AUTH.UNAUTHENTICATED`       | 401  | Request is not authenticated              |
| `AUTH.FORBIDDEN`             | 403  | Authenticated user lacks required role    |
| `VALIDATION.INVALID_PAYLOAD` | 422  | Request body fails schema validation      |

---

## Worker Contract

### Worker: `scheduled-exam-auto-submit`

**Purpose:** Background process that enforces all time-based submission conditions for
scheduled attempts, preventing "zombie" active sessions past their allowed window.

**Trigger:** Runs on a configurable interval (default: every 30 seconds). MUST also be
triggered reactively if a heartbeat endpoint detects `current_time > attempt_end_time`.

**Query for candidates:**

```sql
SELECT a.*
FROM attempts a
WHERE a.is_scheduled = TRUE
  AND a.auto_submitted = FALSE
  AND (
    a.status NOT IN ('SUBMITTED', 'CANCELLED', 'ABANDONED')
  )
  AND (
       NOW() > a.attempt_end_time                                    -- Condition 1: attempt time exceeded
    OR NOW() > (
         SELECT se.end_datetime
         FROM scheduled_exams se
         WHERE se.id = a.scheduled_exam_id
       )                                                              -- Condition 2: scheduled end reached
    OR (NOW() - a.last_heartbeat_at) > INTERVAL '30 seconds'        -- Condition 3: connection timeout
  );
```

**For each candidate attempt:**

1. **Acquire distributed lock** using Redis key: `auto_submit_lock:{attempt_id}` with TTL 60s.
   - If lock cannot be acquired: skip (another worker instance is processing it).

2. **Begin transaction** on the tenant DB pool.

3. **Re-validate** within transaction (optimistic re-check to prevent TOCTOU):

   ```sql
   SELECT id, auto_submitted, status FROM attempts WHERE id = ? FOR UPDATE;
   ```

   - If `auto_submitted = TRUE` or `status` is terminal: rollback, release lock, skip.

4. **Determine `forced_submission_reason`** (evaluated in priority order):
   - `attempt_end_time` exceeded → `ATTEMPT_TIME_EXCEEDED`
   - `scheduled_exam.end_datetime` exceeded → `SCHEDULED_END_REACHED`
   - `last_heartbeat_at` lapsed > 30s → `CONNECTION_TIMEOUT`

5. **Write submission:**

   ```sql
   UPDATE attempts
   SET auto_submitted = TRUE,
       forced_submission_reason = ?,
       status = 'SUBMITTED',
       submitted_at = NOW(),
       updated_at = NOW()
   WHERE id = ?;
   ```

6. **Commit transaction.**

7. **Release lock.**

8. **Emit structured log** at WARN level with fields:
   - `workspace_slug`, `scheduled_exam_id`, `attempt_id`, `forced_submission_reason`,
     `request_id` (worker-generated correlation ID)

**Idempotency contract:**

- A committed attempt (auto_submitted = TRUE, status = SUBMITTED) MUST NOT be processed again.
- The re-validation step inside the transaction is the idempotency gate.
- If the worker crashes after commit but before releasing the lock, the lock expires (TTL) and
  the next cycle will re-validate and safely skip.

**Worker MUST NOT:**

- Trust or read any frontend state
- Modify `start_datetime`, `end_datetime`, or `scheduled_exam.workflow_status`
- Delete attempt records
- Submit attempts belonging to non-scheduled exams via this worker path

**Failure behavior:**

- Per-attempt exceptions are caught and logged; the worker continues processing other candidates
- Failed batches are logged at ERROR level with full context
- Dead-letter logging: each permanently failed attempt force-submit must produce an alert

---

## Observability Requirements

### Required Log Fields

Every log entry originating from a scheduled exam runtime event MUST include:

| Field               | Type          | Description                                                              |
| ------------------- | ------------- | ------------------------------------------------------------------------ |
| `workspace_slug`    | string        | Tenant workspace identifier                                              |
| `scheduled_exam_id` | uuid / null   | ID of the scheduled exam (null if not applicable)                        |
| `attempt_id`        | uuid / null   | ID of the attempt (null if not applicable)                               |
| `request_id`        | string        | Correlation ID for the request or worker cycle                           |
| `submission_reason` | string / null | `forced_submission_reason` value when applicable                         |
| `event_type`        | string        | Semantic event name (e.g., `attempt.started`, `attempt.force_submitted`) |

### Log Levels

| Condition                                      | Level |
| ---------------------------------------------- | ----- |
| Attempt started successfully                   | INFO  |
| Heartbeat received                             | DEBUG |
| Heartbeat rejected (time exceeded)             | WARN  |
| Auto-submit executed (any reason)              | WARN  |
| Base exam modified after scheduling            | WARN  |
| Duplicate submission attempt (idempotency hit) | INFO  |
| Worker exception (per-attempt error)           | ERROR |
| Worker failed to acquire lock                  | DEBUG |
| License rejected                               | WARN  |

### Monitoring Alerts (Recommended)

- Alert if worker has not run successfully for > 2 minutes
- Alert if any active scheduled attempt has `last_heartbeat_at` > 5 minutes stale
- Alert if `forced_submission_reason = SCHEDULED_END_REACHED` occurs with >0 active attempts
  more than 60 seconds after `end_datetime` (late cleanup indicator)

---

## Success Criteria

### Validation Criteria — Stage Complete When:

- [ ] `POST /scheduled-exams` creates a record with APPROVED status referencing a valid ENABLED base exam
- [ ] Attempt start correctly enforces `NOT_STARTED` and `CLOSED` gates using server UTC
- [ ] Late tolerance window (default 5 minutes) is applied correctly to start gate only
- [ ] `allow_single_attempt=true` prevents duplicate attempts transactionally
- [ ] `attempt_end_time = MIN(start + duration, scheduled_end_datetime)` is computed correctly
- [ ] Heartbeat endpoint updates `last_heartbeat_at` with server time only
- [ ] Worker force-submits attempts where `attempt_end_time` exceeded
- [ ] Worker force-submits attempts where `scheduled_exam.end_datetime` exceeded
- [ ] Worker force-submits disconnected attempts (heartbeat lapsed > 30s)
- [ ] Auto-submit is idempotent; running worker twice on same attempt = same result
- [ ] Distributed lock prevents concurrent double-submission
- [ ] Immutable fields cannot be updated post-ENABLED
- [ ] Structural fields cannot be updated when attempts exist
- [ ] Scheduled exam cannot be deleted when attempts exist
- [ ] Base exam modification sets `base_exam_modified=true` for APPROVED scheduled exams
- [ ] ENABLED transition blocked when `base_exam_modified=true`
- [ ] Re-approval resets `base_exam_modified` and refreshes snapshot
- [ ] All API responses follow `{ success, data, error }` contract
- [ ] All logs include `workspace_slug`, `scheduled_exam_id`, `attempt_id`, `request_id`
- [ ] Forced submissions logged at WARN level
- [ ] All migrations are forward-only; no existing migration files modified
- [ ] All queries scoped to tenant DB pool (no cross-tenant joins)
- [ ] License middleware runs before all scheduled exam routes

### Measurable Outcomes

- **SC-001**: Students attempting to start outside the permitted window receive a deterministic
  error (NOT_STARTED or CLOSED) within 300ms.
- **SC-002**: Auto-submit worker processes all expired active attempts within two worker cycles
  (≤ 60 seconds) on datasets up to 10,000 concurrent attempts.
- **SC-003**: Zero duplicate submission records exist for any attempt after worker processing.
- **SC-004**: No attempt remains active more than 60 seconds past its `attempt_end_time`.
- **SC-005**: 100% of forced submissions have `forced_submission_reason` recorded and logged
  at WARN level.

---

## Assumptions

1. The existing base exam snapshot contract (Stage 36/35) handles the snapshotting of question
   sets and grading config into attempts. This stage extends that contract with scheduling
   metadata but does not replace it.
2. The shared workflow engine (`executeTransition()`) is responsible for workflow state machine
   transitions; this stage defines the pre-conditions, not the engine implementation.
3. Redis is available; heartbeat tracking for disconnection detection uses server-side
   `last_heartbeat_at` column (database-backed) rather than Redis directly, to ensure
   persistence across worker restarts. Redis is used for distributed locking only.
4. The base exam `duration_minutes` field exists on both `mcq_exams` and
   `traditional_exams` tables (nullable for unlimited exams).
5. Worker scheduling infrastructure (BullMQ or equivalent) is pre-existing; this spec defines
   the job logic contract, not the queue setup.
6. Reminder delivery (reminder_before_start, reminder_before_end) is flagged in the schema but
   the delivery mechanism (email/push) is out of scope for this stage.

---

## Dependencies

| Dependency             | Stage                 | Notes                                                       |
| ---------------------- | --------------------- | ----------------------------------------------------------- |
| MCQ Exam Config        | Stage 36              | `mcq_exams` table; ENABLED workflow status                  |
| Traditional Exam Model | Stage 35              | `traditional_exams` table; ENABLED workflow status          |
| Attempt Engine         | Stage 37 (or earlier) | `attempts` table base structure; snapshot contract          |
| Workflow Engine        | Core                  | `executeTransition()` shared; provides lifecycle management |
| Worker Infrastructure  | Core Worker           | BullMQ/job-queue package                                    |
| Redis                  | Infrastructure        | Distributed lock for auto-submit deduplication              |
| License Middleware     | Core API              | Must exist before this stage ships                          |
