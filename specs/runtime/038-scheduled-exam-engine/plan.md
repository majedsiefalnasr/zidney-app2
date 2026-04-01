# Implementation Plan — Stage 38: Scheduled Exam Engine

**Stage**: `STAGE_38_SCHEDULED_ENGINE`
**Branch**: `spec/038-scheduled-exam-engine`
**Phase**: `03_BACKOFFICE_CORE / 04_EXAM_ENGINE_CORE`
**Risk Level**: HIGH
**Generated**: 2026-04-01
**Spec**: `specs/runtime/038-scheduled-exam-engine/spec.md`
**Research**: `specs/runtime/038-scheduled-exam-engine/research.md`
**Data Model**: `specs/runtime/038-scheduled-exam-engine/data-model.md`
**Schema after plan**: 1.22.0 → 1.23.0

---

## Stage Alignment

- **Phase**: `03_BACKOFFICE_CORE / 04_EXAM_ENGINE_CORE`
- **Stage**: `STAGE_38_SCHEDULED_ENGINE`
- **Spec File**: `specs/runtime/038-scheduled-exam-engine/spec.md`
- **Related ADRs**: ADR-0001 (DB-per-tenant), ADR-0002 (snapshot integrity), ADR-0006 (server-authoritative time)

---

## Architectural Scope Confirmation

- ✅ **No cross-tenant data access** (ADR-0001): All queries pass tenant `DbClient`; no global singleton.
- ✅ **No middleware bypass**: Tenant resolver → license middleware → auth runs at parent router level.
- ✅ **No direct DB instantiation**: Tenant pool resolved exclusively by `apps/api/src/middleware/tenant.ts`.
- ✅ **No grading logic outside Worker**: Stage 38 does not implement grading; only schedules delivery and forces submission. Grading remains worker-only (Stage 36/35 contract).
- ✅ **No weakening of snapshot integrity** (ADR-0002): Attempt snapshot frozen at start time per existing contract.
- ✅ **No weakening of version enforcement** (ADR-0007/0008): Migrations forward-only; schema version bumped per migration.
- ✅ **No client-authoritative time** (ADR-0006): ALL time decisions use `new Date()` server-side or `NOW()` in SQL; no client timestamps trusted.
- ✅ **No layer boundary violation**: `packages/domain-core` has no HTTP/Drizzle imports; app routes import from packages only.

---

## Trust Chain Verification

**Isolation → License → Authentication → Attempt → Runtime → Frontoffice**

- [x] **Isolation**: All `scheduled_exams` and `attempts` additions reside in tenant DB only. No master DB writes.
- [x] **License**: `apps/api/src/middleware/license.ts` runs on all `/api/v1/:workspace/` routes before handlers.
- [x] **Authentication**: JWT validation + RBAC guards (`requireAnyPermission`) enforced per route.
- [x] **Attempt**: Snapshot frozen at attempt start per Stage 36/35 contract; `attempt_end_time` bound at creation.
- [x] **Runtime**: Server UTC time only (`new Date()` or SQL `NOW()`); heartbeat ignores client timestamps.
- [x] **Frontoffice**: No frontend work in this stage; API-only delivery.

---

## Import Boundary Compliance

| Direction                                  | Status                  |
| ------------------------------------------ | ----------------------- |
| `apps/api` → `packages/domain-core`        | ✅                      |
| `apps/api` → `packages/validation`         | ✅                      |
| `apps/api` → `packages/logger`             | ✅                      |
| `apps/api` → `packages/job-queue`          | ✅                      |
| `apps/worker` → `packages/domain-core`     | ✅                      |
| `apps/worker` → `packages/job-queue`       | ✅                      |
| `packages/domain-core` → `packages/logger` | ✅                      |
| `packages/domain-core` → `packages/types`  | ✅                      |
| Any `apps/*` → other `apps/*`              | ❌ Forbidden — not done |
| Any `packages/*` → `apps/*`                | ❌ Forbidden — not done |

---

## Phase 0: Setup & Schema (2 tasks)

### Task P0-1: Migration 016 — Create `scheduled_exams`

**File**: `apps/api/src/db/tenant/migrations/20260402_016_create_scheduled_exams.ts`

Two-phase migration (CONCURRENT unique index on `code`):

**Phase 1 (inside BEGIN/COMMIT)**:

- `CREATE TABLE IF NOT EXISTS scheduled_exams (...)` — full DDL per data-model.md
- All CHECK constraints (exam_type, workflow_status, tolerance, end_after_start)
- B-tree indexes: `base_exam_id`, `start_datetime`, `end_datetime`, `workflow_status`, `deleted_at`
- `UPDATE schema_versions SET version = '1.22.0'`

**Phase 2 (outside transaction)**:

- `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_scheduled_exams_code_unique ON scheduled_exams (LOWER(code)) WHERE deleted_at IS NULL`

**Acceptance**: Migration runs cleanly on fresh tenant DB; re-run is idempotent (`IF NOT EXISTS`).

---

### Task P0-2: Migration 017 — Add columns to `attempts`

**File**: `apps/api/src/db/tenant/migrations/20260402_017_add_scheduled_fields_to_attempts.ts`

Single-phase migration (no CONCURRENT indexes needed):

**Phase 1 (inside BEGIN/COMMIT)**:

```sql
ALTER TABLE attempts
  ADD COLUMN IF NOT EXISTS is_scheduled              BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS scheduled_exam_id         UUID        NULL,
  ADD COLUMN IF NOT EXISTS scheduled_end_time        TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS auto_submitted            BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS forced_submission_reason  VARCHAR(50) NULL
    CONSTRAINT attempts_forced_submission_reason_check
    CHECK (forced_submission_reason IN ('ATTEMPT_TIME_EXCEEDED','SCHEDULED_END_REACHED','CONNECTION_TIMEOUT')),
  ADD COLUMN IF NOT EXISTS last_heartbeat_at         TIMESTAMPTZ NULL;
```

- Partial indexes: `scheduled_exam_id WHERE NOT NULL`, `(scheduled_exam_id, is_scheduled, auto_submitted) WHERE is_scheduled=TRUE AND auto_submitted=FALSE`, `last_heartbeat_at WHERE is_scheduled=TRUE AND auto_submitted=FALSE`
- `UPDATE schema_versions SET version = '1.23.0'`

**Acceptance**: All 6 new columns on `attempts`; 3 new partial indexes; schema version 1.23.0.

---

### Task P0-3: Drizzle Schema Updates

**New file**: `apps/api/src/db/tenant/schemas/scheduled-exams.schema.ts`

- Full `scheduledExams` pgTable definition per data-model.md
- Export `ScheduledExam` and `NewScheduledExam` types

**Existing file update**: `apps/api/src/db/tenant/schemas/attempts.schema.ts`

- Add 6 new columns with matching Drizzle column definitions (withTimezone timestamps, boolean defaults)

**Update**: `apps/api/src/db/tenant/schemas/index.ts`

- Export `scheduledExams`, `ScheduledExam`, `NewScheduledExam` from new schema file

---

## Phase 1: Domain Core (8 tasks)

**Package**: `packages/domain-core/src/scheduled-exam/`

### Task P1-1: `scheduled-exam.types.ts`

Define all TypeScript types for the module:

```ts
export type ScheduledExamStatus = "APPROVED" | "ENABLED";
export type ScheduledExamType = "MCQ" | "TRADITIONAL";
export type ForcedSubmissionReason =
  | "ATTEMPT_TIME_EXCEEDED"
  | "SCHEDULED_END_REACHED"
  | "CONNECTION_TIMEOUT";

export interface ScheduledExamRow {
  id: string;
  base_exam_id: string;
  exam_type: ScheduledExamType;
  name: string;
  code: string;
  start_datetime: Date;
  end_datetime: Date;
  late_tolerance_minutes: number;
  allow_single_attempt: boolean;
  reminder_before_start: boolean;
  reminder_before_end: boolean;
  workflow_status: ScheduledExamStatus;
  base_exam_modified: boolean;
  base_exam_snapshot_hash: string | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
}
export interface CreateScheduledExamInput {
  base_exam_id: string;
  exam_type: ScheduledExamType;
  name: string;
  code: string;
  start_datetime: Date;
  end_datetime: Date;
  late_tolerance_minutes: number;
  allow_single_attempt: boolean;
  reminder_before_start: boolean;
  reminder_before_end: boolean;
}
export interface UpdateScheduledExamInput {
  name?: string;
  code?: string;
  start_datetime?: Date;
  end_datetime?: Date;
  late_tolerance_minutes?: number;
  allow_single_attempt?: boolean;
  reminder_before_start?: boolean;
  reminder_before_end?: boolean;
}
export interface ListScheduledExamsInput {
  page: number;
  limit: number;
  workflow_status?: ScheduledExamStatus;
  exam_type?: ScheduledExamType;
  search?: string;
  start_from?: Date;
  start_to?: Date;
}
export interface DbClient {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
}
export interface AuditContext {
  workspace_id: string;
  user_id: string;
  correlation_id: string;
  workspace_slug: string;
}
```

---

### Task P1-2: `scheduled-exam.errors.ts`

```ts
const SCHEDULED_EXAM_ERROR_CODES = {
  NOT_FOUND: "SCHEDULED_EXAM.NOT_FOUND",
  CODE_CONFLICT: "SCHEDULED_EXAM.CODE_CONFLICT",
  INVALID_TIME_WINDOW: "SCHEDULED_EXAM.INVALID_TIME_WINDOW",
  BASE_EXAM_NOT_ENABLED: "SCHEDULED_EXAM.BASE_EXAM_NOT_ENABLED",
  BASE_EXAM_ARCHIVED: "SCHEDULED_EXAM.BASE_EXAM_ARCHIVED",
  BASE_EXAM_MODIFIED: "SCHEDULED_EXAM.BASE_EXAM_MODIFIED",
  FIELD_IMMUTABLE: "SCHEDULED_EXAM.FIELD_IMMUTABLE",
  HAS_ATTEMPTS: "SCHEDULED_EXAM.HAS_ATTEMPTS",
  CANNOT_DELETE_ENABLED: "SCHEDULED_EXAM.CANNOT_DELETE_ENABLED",
  NOT_STARTED: "SCHEDULED_EXAM.NOT_STARTED",
  CLOSED: "SCHEDULED_EXAM.CLOSED",
  ALREADY_ATTEMPTED: "SCHEDULED_EXAM.ALREADY_ATTEMPTED",
  INVALID_EXAM_TYPE: "SCHEDULED_EXAM.INVALID_EXAM_TYPE",
  INVALID_BASE_EXAM_REF: "SCHEDULED_EXAM.INVALID_BASE_EXAM_REF",
} as const;

export class ScheduledExamError extends Error {
  constructor(public readonly code: keyof typeof SCHEDULED_EXAM_ERROR_CODES) {
    super(SCHEDULED_EXAM_ERROR_CODES[code]);
    this.name = "ScheduledExamError";
  }
}
```

---

### Task P1-3: `scheduled-exam-hash.ts`

Implements the snapshot hash functions (Clarification Q1).

**Exports**:

- `MCQ_HASH_FIELDS: readonly string[]` — `['id', 'workflow_status', 'title', 'duration_minutes', 'total_marks', 'passing_marks', 'question_selection_mode', 'questions_count', 'updated_at']`
- `TRADITIONAL_HASH_FIELDS: readonly string[]` — `['id', 'workflow_status', 'title', 'duration_minutes', 'total_marks', 'passing_marks', 'topics', 'updated_at']`
- `computeBaseExamHash(examFields: Record<string, unknown>, fieldList: readonly string[]): string`

**Algorithm**: SHA-256 of `JSON.stringify` with sorted keys; `Date` instances converted to `.toISOString()`.

**Usage sites**: FR-006 (ENABLED transition), FR-007 (re-approve snapshot refresh), FR-012 (modification detection). All three MUST import from this file — no inline field lists.

**Tests**: Unit tests with known inputs verify hash stability and field-list enforcement.

---

### Task P1-4: `scheduled-exam-time.ts`

Pure time gate functions (no I/O, pure functions, easily testable):

```ts
export function isWindowOpen(
  now: Date,
  startDatetime: Date,
  endDatetime: Date,
  lateToleranceMinutes: number,
): boolean;
export function isBeforeWindow(
  now: Date,
  startDatetime: Date,
  lateToleranceMinutes: number,
): boolean;
export function isAfterWindow(now: Date, endDatetime: Date): boolean;
export function computeAttemptEndTime(
  attemptStartTime: Date,
  examDurationMinutes: number | null,
  scheduledEndDatetime: Date,
): Date;
export function isAttemptExpired(now: Date, attemptEndTime: Date): boolean;
export function isConnectionTimedOut(
  now: Date,
  lastHeartbeatAt: Date,
  graceSeconds?: number,
): boolean;
export function computeRemainingSeconds(now: Date, attemptEndTime: Date): number;
```

**Invariants**:

- `computeAttemptEndTime` returns `MIN(startTime + duration, scheduledEndDatetime)`.
- When `examDurationMinutes` is null, returns `scheduledEndDatetime`.
- `isConnectionTimedOut` default grace = 30 seconds.
- All functions accept `Date` objects only — no string parsing inside pure functions.

---

### Task P1-5: `scheduled-exam-workflow.ts`

Workflow transition rules (pure functions, no DB calls):

```ts
export function canTransitionToEnabled(
  exam: ScheduledExamRow,
  baseExamStatus: string,
  baseExamArchived: boolean,
): { allowed: boolean; reason?: string };
// Returns: { allowed: false, reason: 'BASE_EXAM_NOT_ENABLED' | 'BASE_EXAM_ARCHIVED' | 'BASE_EXAM_MODIFIED' } or { allowed: true }

export function getImmutableFields(exam: ScheduledExamRow, hasAttempts: boolean): string[];
// Returns fields that must be rejected in a PATCH based on current status + attempt count

export function isFieldMutable(
  fieldName: string,
  exam: ScheduledExamRow,
  hasAttempts: boolean,
): boolean;
```

---

### Task P1-6: `scheduled-exam.repository.ts`

Pure SQL functions. No transactions. All accept `DbClient` as first param:

```ts
export async function findById(db: DbClient, id: string): Promise<ScheduledExamRow | null>;
export async function findByCode(db: DbClient, code: string): Promise<ScheduledExamRow | null>;
export async function findAll(
  db: DbClient,
  input: ListScheduledExamsInput,
): Promise<ScheduledExamRow[]>;
export async function countAll(db: DbClient, input: ListScheduledExamsInput): Promise<number>;
export async function countAttempts(db: DbClient, scheduledExamId: string): Promise<number>;
export async function insert(
  db: DbClient,
  data: CreateScheduledExamInput,
  audit: AuditContext,
): Promise<ScheduledExamRow>;
export async function update(
  db: DbClient,
  id: string,
  data: Partial<UpdateScheduledExamInput>,
  audit: AuditContext,
): Promise<ScheduledExamRow>;
export async function softDelete(db: DbClient, id: string, audit: AuditContext): Promise<void>;
export async function updateWorkflowStatus(
  db: DbClient,
  id: string,
  status: ScheduledExamStatus,
  snapshotHash: string | null,
): Promise<ScheduledExamRow>;
export async function setBaseExamModified(
  db: DbClient,
  id: string,
  modified: boolean,
): Promise<void>;
export async function findApprovedByBaseExamId(
  db: DbClient,
  baseExamId: string,
): Promise<ScheduledExamRow[]>;
export async function findEnabledByBaseExamId(
  db: DbClient,
  baseExamId: string,
): Promise<ScheduledExamRow[]>;
```

---

### Task P1-7: `scheduled-exam.service.ts`

Orchestrates business rules, manages transactions:

```ts
export async function createScheduledExam(
  db: DbClient,
  input: CreateScheduledExamInput,
  audit: AuditContext,
): Promise<ScheduledExamRow>;
// TX: validate base exam enabled + not archived + unique code → INSERT

export async function updateScheduledExam(
  db: DbClient,
  id: string,
  input: UpdateScheduledExamInput,
  audit: AuditContext,
): Promise<ScheduledExamRow>;
// TX: check immutability (workflow_status + attempt count) → UPDATE

export async function deleteScheduledExam(
  db: DbClient,
  id: string,
  audit: AuditContext,
): Promise<void>;
// TX: check no attempts + not ENABLED → soft delete

export async function enableScheduledExam(
  db: DbClient,
  id: string,
  audit: AuditContext,
): Promise<ScheduledExamRow>;
// TX: validate base exam + base_exam_modified=false → compute snapshot hash → UPDATE workflow_status

export async function reApproveScheduledExam(
  db: DbClient,
  id: string,
  audit: AuditContext,
): Promise<ScheduledExamRow>;
// TX: require APPROVED + base_exam_modified=true → refresh snapshot → set base_exam_modified=false

export async function startScheduledAttempt(
  db: DbClient,
  scheduledExamId: string,
  userId: string,
  audit: AuditContext,
): Promise<AttemptStartResult>;
// TX: [1] validate ENABLED [2] time gate [3] if allow_single_attempt: advisory lock + count check [4] INSERT attempt

export async function recordHeartbeat(
  db: DbClient,
  attemptId: string,
  userId: string,
  audit: AuditContext,
): Promise<HeartbeatResult>;
// No TX needed: validate ownership + not submitted + not expired → UPDATE last_heartbeat_at=NOW()
// If expired: enqueue auto-submit BullMQ job (jobId: auto_submit:{attemptId})

export async function submitAttempt(
  db: DbClient,
  attemptId: string,
  userId: string,
  audit: AuditContext,
): Promise<SubmitResult>;
// TX: FOR UPDATE re-check → if already submitted return existing → determine if late → UPDATE status=SUBMITTED

export async function notifyBaseExamModified(
  db: DbClient,
  baseExamId: string,
  audit: AuditContext,
): Promise<void>;
// No TX: find APPROVED scheduled exams by base_exam_id → setBaseExamModified(true)
// Find ENABLED scheduled exams → log WARN (no status change)
```

---

### Task P1-8: `index.ts` (barrel export)

```ts
export * from "./scheduled-exam.types";
export * from "./scheduled-exam.errors";
export * from "./scheduled-exam-hash";
export * from "./scheduled-exam-time";
export * from "./scheduled-exam-workflow";
export * from "./scheduled-exam.repository";
export * from "./scheduled-exam.service";
```

---

## Phase 2: API Routes (12 tasks)

**Directory**: `apps/api/src/routes/backoffice/scheduled-exams/`
**Student routes**: Co-located in same router (attempt + heartbeat + submit distinguished by role guard)

### Task P2-1: `helpers.ts`

Standard helpers following `mcq-exams/helpers.ts` pattern:

```ts
export function getDb(c: Context): DbClient; // extracts tenant pool client from c.var
export function buildAuditCtx(c: Context): AuditContext; // workspace_id, user_id, correlation_id, workspace_slug
export function successResponse<T>(data: T): { success: true; data: T; error: null };
export function scheduledExamErrorResponse(c: Context, err: unknown): Response;
// Maps ScheduledExamError codes to HTTP status codes per error-code table in data-model.md
```

### Task P2-2: `index.ts` — Router Factory

```ts
export function createScheduledExamsRouter(): Hono<BackofficeEnv>;
```

Route registration order (static before parameterised):

1. `GET  /scheduled-exams` → readGuard → listHandler
2. `POST /scheduled-exams` → writeGuard → createHandler
3. `GET  /scheduled-exams/:id` → readGuard → getHandler
4. `PATCH /scheduled-exams/:id` → writeGuard → updateHandler
5. `DELETE /scheduled-exams/:id` → writeGuard → deleteHandler
6. `POST /scheduled-exams/:id/workflow` → writeGuard → workflowTransitionHandler
7. `POST /scheduled-exams/:id/re-approve` → writeGuard → reApproveHandler
8. `POST /scheduled-exams/:id/attempts` → studentGuard → startAttemptHandler
9. `POST /attempts/:attemptId/heartbeat` → studentGuard → heartbeatHandler
10. `POST /attempts/:attemptId/submit` → studentGuard → submitHandler

**Guards**:

- `readGuard = requireAnyPermission(['exam_manage', 'content_manage', 'content_read'])`
- `writeGuard = requireAnyPermission(['exam_manage', 'content_manage'])`
- `studentGuard = requireRole('STUDENT')` — denies operators (Clarification Q5)

### Task P2-3: `create-scheduled-exam.ts`

POST handler. Validates body against `createScheduledExamSchema` from `@zidney/validation`. Calls `createScheduledExam()`. Returns 201.

### Task P2-4: `list-scheduled-exams.ts`

GET handler. Validates query params. Calls `listExams()` + `countExams()`. Returns 200 with pagination envelope.

### Task P2-5: `get-scheduled-exam.ts`

GET by ID handler. Calls `findById()` + `countAttempts()`. Returns 200 with `attempts_count` included.

### Task P2-6: `update-scheduled-exam.ts`

PATCH handler. Validates body. Calls `updateScheduledExam()`. Immutability errors map to 409.

### Task P2-7: `delete-scheduled-exam.ts`

DELETE handler. Calls `deleteScheduledExam()`. Guards: no attempts + not ENABLED.

### Task P2-8: `workflow-transition.ts`

POST `/workflow` handler. Body: `{ action: 'ENABLE' }`. Calls `enableScheduledExam()`. Returns 200.

### Task P2-9: `re-approve.ts`

POST `/re-approve` handler. No body required. Calls `reApproveScheduledExam()`. Returns 200.

### Task P2-10: `start-attempt.ts`

POST `/scheduled-exams/:id/attempts` handler (student). Calls `startScheduledAttempt()`. Returns 201 with `remaining_seconds`.

### Task P2-11: `heartbeat.ts`

POST `/attempts/:attemptId/heartbeat` handler (student). Calls `recordHeartbeat()`. Returns 200 with `{ remaining_seconds }`.

### Task P2-12: `submit-attempt.ts`

POST `/attempts/:attemptId/submit` handler (student). Calls `submitAttempt()`. Returns 200 always (including late submissions per Clarification Q4).

---

### Validation Schemas: `packages/validation/src/backoffice/scheduled-exams.schemas.ts`

```ts
export const createScheduledExamSchema = z.object({...})
export const updateScheduledExamSchema = z.object({...}).partial()
export const listScheduledExamsQuerySchema = z.object({...})
export const workflowTransitionSchema = z.object({ action: z.enum(['ENABLE']) })
```

---

## Phase 3: Worker Jobs (3 tasks)

### Task P3-1: `apps/worker/src/jobs/auto-submit-scheduled-attempt.ts`

Per-attempt auto-submit job handler:

```ts
export interface AutoSubmitScheduledAttemptJob {
  tenantSlug: string;
  attemptId: string;
  scheduledExamId: string;
  workspaceId: string;
  correlationId: string;
}

export async function handleAutoSubmitScheduledAttempt(
  job: AutoSubmitScheduledAttemptJob,
  logger: JobLogger,
): Promise<void>;
```

**Algorithm** (following worker contract in spec):

1. Acquire Redis lock: `auto_submit_lock:{attemptId}` with TTL 60s using `packages/redis-utils`.
2. If lock fails: log DEBUG, return (skip).
3. Get tenant DB pool via tenant slug.
4. BEGIN transaction.
5. `SELECT id, auto_submitted, status FROM attempts WHERE id = ? FOR UPDATE`.
6. If `auto_submitted=true` or status terminal: ROLLBACK, release lock, return.
7. Determine `forced_submission_reason` (priority: `attempt_end_time` → `scheduled_end_datetime` → `last_heartbeat_at`).
8. `UPDATE attempts SET auto_submitted=true, forced_submission_reason=?, status='SUBMITTED', submitted_at=NOW(), updated_at=NOW()`.
9. COMMIT.
10. Release lock.
11. Log WARN with full context: `workspace_slug`, `scheduled_exam_id`, `attempt_id`, `forced_submission_reason`, `request_id`.

**Error handling**: Per-attempt exceptions caught and logged ERROR; worker continues.

---

### Task P3-2: `apps/worker/src/jobs/scheduled-exam-dispatcher.ts`

Tenant dispatcher job — runs on a schedule (every 30s), dispatches per-tenant auto-submit jobs:

```ts
export interface ScheduledExamDispatcherJob {
  correlationId: string;
}

export async function handleScheduledExamDispatcher(
  job: ScheduledExamDispatcherJob,
  logger: JobLogger,
): Promise<void>;
```

**Algorithm** (Clarification Q2):

1. Query master DB for active tenant slugs that have `scheduled_exams` with open windows.
2. For each tenant: query that tenant's DB for active scheduled attempts meeting force-submit conditions.
3. For each candidate attempt: enqueue `auto-submit-scheduled-attempt` job with `jobId: auto_submit:{attemptId}` (BullMQ dedup prevents duplicates).
4. Log INFO: `tenant_count`, `enqueued_count`, `correlationId`.

---

### Task P3-3: `apps/worker/src/` — Register jobs in worker queue

- Register `auto-submit-scheduled-attempt` processor in worker queue setup.
- Register `scheduled-exam-dispatcher` as repeatable job (every 30s).
- Both jobs added to existing BullMQ queue infrastructure in `apps/worker/src/queue.ts` / `processor.ts`.

---

## Phase 4: Job Queue Package (1 task)

### Task P4-1: `packages/job-queue/src/job-schema.ts` — New job types

Add to existing file:

```ts
export interface AutoSubmitScheduledAttemptJob extends BaseJob {
  type: "auto_submit_scheduled_attempt";
  attempt_id: string;
  scheduled_exam_id: string;
}

export interface ScheduledExamDispatcherJob extends BaseJob {
  type: "scheduled_exam_dispatcher";
}
```

---

## Phase 5: Tests (6 test suites)

### Task P5-1: Unit — Domain hash functions

**File**: `packages/domain-core/src/scheduled-exam/__tests__/scheduled-exam-hash.test.ts`

- Known input → known SHA-256 output (snapshot stability).
- MCQ field list and TRADITIONAL field list are the canonical sets.
- `updated_at` change → different hash.
- Missing field in input → deterministic behavior (undefined serialized as null).

### Task P5-2: Unit — Time gate functions

**File**: `packages/domain-core/src/scheduled-exam/__tests__/scheduled-exam-time.test.ts`

- `isBeforeWindow`: before window, inside window, at boundary — verify correct boolean.
- `isAfterWindow`: after window — verify correct boolean.
- `computeAttemptEndTime`: with duration (chooses min), without duration (chooses scheduled end), duration extends past window (clamps to scheduled end).
- `isConnectionTimedOut`: 25s → false, 35s → true.
- `computeRemainingSeconds`: positive, zero, negative (returns 0).

### Task P5-3: Unit — Workflow rules

**File**: `packages/domain-core/src/scheduled-exam/__tests__/scheduled-exam-workflow.test.ts`

- `canTransitionToEnabled`: base exam not ENABLED → blocked; base archived → blocked; `base_exam_modified=true` → blocked; all clear → allowed.
- `getImmutableFields`: APPROVED + no attempts → only core fields immutable; ENABLED → structural frozen; has attempts → structural + code + allow_single_attempt frozen.

### Task P5-4: Integration — API endpoints

**File**: `apps/api/src/routes/backoffice/scheduled-exams/__tests__/scheduled-exams.integration.test.ts`

Tests (30+ scenarios covering spec acceptance criteria):

- Create: valid payload → 201; base exam not ENABLED → 422 `BASE_EXAM_NOT_ENABLED`; duplicate code → 409 `CODE_CONFLICT`; invalid time window → 422.
- Update: APPROVED + no attempts → 200; ENABLED + immutable field → 409 `FIELD_IMMUTABLE`; any attempt exists + structural field → 409 `HAS_ATTEMPTS`.
- Delete: with attempts → 409; ENABLED → 409; no attempts + APPROVED → 200.
- Workflow: APPROVED + base modified → 422; valid → 200.
- Re-approve: `base_exam_modified=false` → 422; valid → 200.
- Start attempt: before window → 403 `NOT_STARTED`; after window → 403 `CLOSED`; in window → 201 with `remaining_seconds`.
- Single attempt: `allow_single_attempt=true` + existing attempt → 403 `ALREADY_ATTEMPTED`.
- Heartbeat: active attempt → 200 with `remaining_seconds`; expired → 410.
- Submit: valid → 200; already submitted → 409; late submission → 200 with `auto_submitted=true`.
- **Tenant isolation**: all requests scoped to tenant pool; cross-tenant attempt access → 404.

### Task P5-5: Worker tests

**File**: `apps/worker/src/jobs/__tests__/auto-submit-scheduled-attempt.test.ts`

- Expired attempt → submitted with correct `forced_submission_reason`.
- Already submitted attempt → skipped (idempotency).
- Lock acquisition failure → skip without error.
- Concurrent workers → only one submission committed (advisory lock).
- ROLLBACK on failure → attempt not submitted; next cycle picks it up.

### Task P5-6: Migration tests

**File**: `apps/api/src/db/tenant/migrations/__tests__/`

- Migration 016 up: `scheduled_exams` table created; unique code index enforced.
- Migration 017 up: 6 new columns on `attempts`; partial indexes created.
- Re-run idempotency: running `up()` twice does not error.

---

## Phase 6: Validation (3 tasks)

### Task P6-1: TypeScript typecheck

```bash
rtk tsc --noEmit -p tsconfig.json
```

All new files pass without type errors. `DbClient` type consistent across domain-core and API handlers.

### Task P6-2: Lint

```bash
rtk lint
```

No biome errors or warnings on new files.

### Task P6-3: Migration validate

```bash
bun run ai:guard && bun run arch:audit
```

- `ai-guard.ts`: no import boundary violations.
- `infra-audit.ts`: migration numbers sequential (014 → 015 → 016 → 017).
- All new modules registered in architecture map.

---

## ADR Requirements

No new ADRs required. This plan operates within:

- **ADR-0001**: DB-per-tenant (all writes to tenant pool via middleware-resolved client).
- **ADR-0002**: Snapshot integrity (attempt snapshot frozen at start per existing contract).
- **ADR-0006**: Server-authoritative time (all time decisions via `new Date()` server-side).

The `pg_try_advisory_xact_lock` pattern (Clarification Q3) is an established PostgreSQL serialization pattern, not an architectural deviation.

The logical (non-postgres-level) FK from `scheduled_exams.base_exam_id` to polymorphic `mcq_exams` / `traditional_exams` is an application-layer referential integrity pattern consistent with the existing codebase — no ADR required.

---

## Task Summary

| Phase              | Tasks  | Key Deliverables                                                                          |
| ------------------ | ------ | ----------------------------------------------------------------------------------------- |
| P0: Setup & Schema | 3      | 2 migration files, 1 new Drizzle schema, 1 updated schema                                 |
| P1: Domain Core    | 8      | Full `scheduled-exam/` module (types, errors, hash, time, workflow, repo, service, index) |
| P2: API Routes     | 12     | 10 route handlers, 1 router, 1 helpers file, validation schemas                           |
| P3: Worker         | 3      | 2 job handlers, 1 queue registration                                                      |
| P4: Job Queue      | 1      | 2 new job type definitions                                                                |
| P5: Tests          | 6      | ~60 test scenarios across unit, integration, worker, migration                            |
| P6: Validation     | 3      | typecheck, lint, arch:audit                                                               |
| **Total**          | **36** | —                                                                                         |

---

## Execution Order (dependency chain)

```
P0-1 (migration 016) ─┐
P0-2 (migration 017) ─┤─► P0-3 (Drizzle schemas)
                       │
P0-3 ─────────────────┼─► P1-1..P1-8 (domain-core)
P4-1 (job types) ─────┘
                       │
P1-7 (service) ────────┼─► P2-* (API routes)
P1-7 ──────────────────┼─► P3-1, P3-2 (worker jobs)
P2, P3 ────────────────┼─► P5-4 (integration tests)
P1-3..P1-5 ────────────┼─► P5-1, P5-2, P5-3 (unit tests)
P3-1 ──────────────────┼─► P5-5 (worker tests)
P0-1, P0-2 ────────────┼─► P5-6 (migration tests)
All above ─────────────┴─► P6-1, P6-2, P6-3 (validation)
```

---

## Database Impact

For each affected database:

Master DB

- Tables touched
- Migration required? (Yes/No)
- Version bump?

Tenant DB

- Tables touched
- Migration required? (Yes/No)
- schema_version change?
- product_version compatibility impact?

Must reference STAGE_02C_MIGRATION_AND_VERSIONING_MODEL.

---

## Transaction Design

For every mutating operation in this stage:

- Transaction required? (Yes/No)
- Atomic operations defined?
- Rollback behavior defined?
- Isolation level (SERIALIZABLE/REPEATABLE READ/READ COMMITTED)?
- Concurrency protection mechanism (FOR UPDATE/unique constraint/external lock)?

Must ensure no race conditions per clarifications from this stage.

---

## Idempotency Plan

If endpoint mutates state:

- Idempotency key header used?
- Unique constraint used?
- Replay-safe?
- Duplicate submission safe?
- Worker deduplication strategy?

Mandatory for all operations where:

- Attempt submission
- License transitions
- Provisioning
- Payments
- Grading

---

## Version Enforcement Strategy

Must define:

- Where schema_version validated
- Where product_version validated
- What happens on mismatch (426)
- Backward compatibility strategy

No silent assumptions allowed.

---

## Authoritative Time Handling

If feature involves time:

- Server clock used?
- Expiration validation?
- Soft lock enforcement?
- Deadline enforcement?
- Reconnection grace logic?

Client time must never be used for authority.

---

## Error Contract

All API responses must follow:

```json
{
  "success": boolean,
  "data": object | null,
  "error": { "code": string, "message": string } | null
}
```

---

## Observability & Logging

Plan must define:

- Structured log format
- request_id propagation
- workspace_slug propagation
- attempt_id propagation (if runtime)
- Error contract adherence
- Metrics emitted (if critical performance path)

No console logs allowed in production code.

---

## Rate Limiting

If applicable to this stage, plan must specify:

- Endpoint classification
- Rate limit thresholds
- Abuse mitigation
- Worker queue protection

---

## Failure Modes

Explicitly define (as applicable to this stage):

- DB unavailable
- Version mismatch
- License blocked
- Worker failure
- Duplicate request
- Timeout
- Queue backlog
- Partial transaction failure

Must define recovery path for each mode.

---

## Security Review

Confirm:

- RBAC enforcement server-side
- No role checks in frontend
- No secrets exposed
- JWT workspace scope enforced
- No sensitive data in logs

---

## Test Strategy

Plan must include:

- Unit tests
- Integration tests
- Isolation tests
- Transaction rollback test
- Idempotency test
- Version mismatch test
- Concurrency test (if runtime feature)

No implementation without defined tests.

---

## Rollback Strategy

Define:

- How feature can be safely rolled back
- Migration rollback plan
- Feature flag (if needed)
- Data integrity preservation

---

## Architecture Guard Validation

Plan must pass governance validation before proceeding:

```bash
bun run ai:guard && bun run arch:audit && bun run lint && bun run typecheck && bun run test
```

Individual checks:

```bash
bun scripts/infra-audit.ts    # Infrastructure audit
bun scripts/ai-guard.ts        # AI governance guard
```

---

## Non-Goals

Explicitly list what is not included.

Prevents scope creep.

---

## Final Compliance Statement

The plan must end with:

"Implementation plan compliant with Zidney Architecture Governance (AGENTS.md + ADRs) — No violations detected."

If violation exists: Plan must stop and describe conflict.
