# Feature Specification: Tenant Baseline Schema

**Feature Branch**: `002B-tenant-baseline-schema`  
**Created**: 2026-02-16  
**Status**: Draft  
**Phase**: 01 – Platform Foundation  
**Stage**: STAGE_02B_TENANT_BASELINE_SCHEMA  
**Input**: Define mandatory baseline schema for every tenant database with strict normalization,
referential integrity, and audit field requirements

---

## Feature Overview

This feature defines the immutable baseline schema that every tenant database MUST start with. It
establishes:

- Mandatory global table rules (audit fields, ID constraints)
- Strict table definitions across 10 logical layers (Identity, Academic Structure, Classification,
  Exam Engine, Runtime, Commercial, Communication, Media, Ads, System)
- Referential integrity constraints with explicit ON DELETE policies
- Schema versioning mechanism
- Migration authority and enforcement
- Normalization and field standardization

**Impact Areas**:

- ALL tenant databases (database-per-tenant model)
- Attempt engine integrity (snapshots depend on schema stability)
- License schema compatibility checks
- Migration versioning system

---

## Constitutional Compliance Declaration

**Compliance Confirmation**:

- ✅ No cross-tenant access: Each table isolated to single tenant database
- ✅ No middleware bypass: All schema access via tenant resolver + license checks
- ✅ No weakening of snapshot integrity: Attempt snapshots immutable within schema version
- ✅ No direct DB instantiation: All connections via tenant resolver context
- ✅ No transaction boundary erosion: All schema operations atomic per migration
- ✅ No version enforcement weakening: schema_version table mandatory with checksum validation
- ✅ Database-per-tenant model preserved: Single PostgreSQL instance, one database per workspace

**Required ADRs Referenced**:

- ADR-0001: Database-per-Tenant Model (immutable architecture requirement)
- ADR-0002: Snapshot Attempt Model (baseline schema frozen at attempt start)
- ADR-0007: Product Version Compatibility (schema_version drives compatibility checks)

---

## Clarifications

### Session 2026-02-16

_Ambiguity audit & targeted clarification questions for Transactions, Idempotency, Concurrency,
Version Enforcement, Middleware, Security, Error Contract, Isolation Boundaries._

- Q1: Transaction Isolation Level → Answer: `READ COMMITTED` (default PostgreSQL). Allows concurrent
  writes, prevents dirty reads. Suitable for exam/attempt submissions.
- Q2: Idempotency Cache Failure Recovery → Answer: `Hybrid (Redis + DB)`. Check Redis cache first
  (24h TTL); if miss or unavailable, query database unique constraint. Survives cache failure;
  prevents double-grading.
- Q3: Middleware Execution Order & Auth → Answer: `Separate auth/tenant namespaces`.
  Workspace/tenant resolution failures → 404; user membership/auth failures → 401/403. Prevents
  workspace enumeration.
- Q4: Version Upgrade & Auto-Migration → Answer: `Separate async worker`. Product upgrades
  independently; worker async migrates with exponential backoff (max 3 retries). API returns 503
  during migration.
- Q5: Security Validation (Checksum) → Answer: `Redundant check`. API calculates SHA256 checksum
  when migration created; worker re-calculates before apply. Mismatch → abort + CRITICAL alert +
  DLQ.

---

## Isolation Impact Analysis

### Tenant Resolution Flow (Separate Auth/Tenant Namespaces)

**Before any table access**:

1. Request arrives with tenant slug (subdomain OR path parameter)
2. Tenant resolver middleware resolves workspace (returns 404 if workspace not found)
3. **Auth namespace split**: User workspace membership validated (returns 401/403 if unauthorized)
4. Database connection obtained from tenant-specific connection pool
5. License middleware validates: status NOT soft-locked or archived (returns 423/403)
6. Schema version validated against product version (returns 409/503)
7. Query executes against isolated tenant database

**Key distinction**: Workspace/tenant failures → 404 (resource not found); auth failures → 401/403
(permission denied). Prevents workspace enumeration attacks.

### Database Layer

- **Master Database**: Contains only MMC global data (workspaces, licenses, audit log exports)
- **Tenant Databases**: 1 per workspace, contains ALL business tables defined in this spec
- **Connection Pool**: In-memory map: `{tenant_slug}: {connection_pool_instance}`
- **No Cross-Tenant Joins**: Enforced at schema level (foreign keys self-referential within
  database)
- **No Shared Global IDs**: Each tenant has independent sequence for any non-UUID IDs

### New Tables Introduced

**Global Tables (present in every tenant DB)**:

1. **Identity Layer**: users, roles, role_permissions
2. **Academic Structure**: divisions, departments, groups, hierarchy_nodes, teams, semesters,
   subjects, lessons
3. **Classification**: categories, category_values, tags, mcq_baskets
4. **Exam Engine**: mcq_questions, traditional_questions, mcq_exams, traditional_exams,
   scheduled_exams
5. **Runtime**: attempts, attempt_answers, attempt_events
6. **Commercial**: subscriptions, invoices, promocodes, subscription_events
7. **Communication**: notifications, feedback, system_feedback
8. **Media**: media_files
9. **Ads**: ads
10. **System**: translations, schema_version, audit_logs (optional)
11. **Certificates**: certificates, certificate_templates

**Total Tables**: 38–40 (determined by optional audit_logs inclusion)

---

## License & Version Enforcement

### License Validation (Mandatory on Every Workspace Request)

**Before schema access**:

```
if workspace.license.status == SOFT_LOCKED:
  → return 423 Locked
if workspace.license.status == ARCHIVED:
  → return 403 Forbidden
if workspace.license.status not in [ACTIVE, TRIAL]:
  → return 404 Not Found
```

### Schema Version Validation & Async Migration (Mandatory on First Connection)

**On connection pool initialization**:

```
actual_schema_version = SELECT version FROM schema_version LIMIT 1
expected_schema_version = product_version (from license.product_version_compatibility)

if actual_schema_version != expected_schema_version:
  if actual_schema_version > expected_schema_version:
    → return 409 Conflict (tenant schema too new for product version)
  if actual_schema_version < expected_schema_version:
    → enqueue migration task in worker queue (async)
    → return 503 Unavailable (migration in progress)
```

**Migration Worker Strategy (Separate Async)**:

- Product upgrade independent from schema migration
- Worker processes migration queue with exponential backoff (max 3 retries, ~5min timeout)
- Migration runs in transaction: LOCK schema_version → apply SQL → update schema_version → COMMIT
- On failure: rollback entire transaction, mark migration failed, send to DLQ
- API rejects workspace during migration with 503 + "Migration in progress" message

### Limits Enforced Transactionally

License soft limits (e.g., exam count, user count):

- Checked BEFORE modification
- Enforced at transaction boundary
- Rolled back if limit exceeded
- Logged with attempt_id and workspace_id

---

## Data Model Changes

### Global Table Rules (MANDATORY for ALL Tables)

Every business table MUST include:

| Field      | Type        | Constraint              | Purpose                                            |
| ---------- | ----------- | ----------------------- | -------------------------------------------------- |
| id         | UUID v7     | PRIMARY KEY, NOT NULL   | Unique record identifier                           |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Audit: creation timestamp (server-time)            |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Audit: last modification (server-time)             |
| created_by | UUID        | NULLABLE                | Audit: user who created record                     |
| updated_by | UUID        | NULLABLE                | Audit: user who last modified record               |
| is_deleted | BOOLEAN     | DEFAULT false           | Soft delete flag (no hard deletes on runtime data) |

### Indexing Requirements

Every table MUST have indexes on:

- id (implicit via PRIMARY KEY)
- All foreign keys (for referential integrity)
- Frequently queried fields (e.g., email, slug, code)
- Compound indexes for common filters

### Referential Integrity Rules

- All foreign keys MUST be EXPLICIT (no implicit assumptions)
- ON DELETE behavior MUST be defined:
  - RESTRICT (default): cannot delete if children exist
  - CASCADE (rare): delete parent deletes children (e.g., exam → questions)
  - SET NULL (when FK nullable): delete parent nullifies child FK
- Circular references forbidden (use junction tables)
- No orphaned records allowed

### Critical Tables Detail

#### Attempts (Runtime Integrity)

```sql
CREATE TABLE attempts (
  id UUID PRIMARY KEY,
  exam_id UUID NOT NULL REFERENCES scheduled_exams(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- SNAPSHOT: Configuration frozen at attempt start
  configuration_snapshot JSONB NOT NULL,
  question_list_snapshot JSONB NOT NULL,  -- Immutable question order
  grading_config_snapshot JSONB NOT NULL, -- Immutable grading rules

  -- Runtime State
  status ENUM ('IN_PROGRESS', 'SUBMITTED', 'GRADED', 'ARCHIVED'),
  started_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ, -- Set when worker finalizes
  duration_seconds INTEGER, -- Calculated by worker

  -- Server-Authoritative Time
  submission_deadline_at TIMESTAMPTZ NOT NULL, -- Server time, not client
  server_time_at_submission TIMESTAMPTZ, -- For drift validation

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  is_deleted BOOLEAN DEFAULT false
);

UNIQUE(exam_id, user_id, started_at); -- Prevent duplicate active attempts
```

#### Attempt_Answers (Append-Only)

```sql
CREATE TABLE attempt_answers (
  id UUID PRIMARY KEY,
  attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL, -- Denormalized for speed (not FK to respect snapshot)
  submitted_answer JSONB NOT NULL,

  submitted_at TIMESTAMPTZ NOT NULL, -- When student submitted
  submission_order INTEGER NOT NULL, -- Order within attempt

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  is_deleted BOOLEAN DEFAULT false
);

UNIQUE(attempt_id, question_id); -- One answer per question per attempt
```

#### Attempt_Events (Immutable Audit Trail)

```sql
CREATE TABLE attempt_events (
  id UUID PRIMARY KEY,
  attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  event_type ENUM ('START', 'RESUME', 'PAUSE', 'ANSWER_SUBMIT', 'TIME_WARNING',
                   'SUBMIT_REQUEST', 'FINALIZED', 'GRADED', 'ARCHIVED'),
  event_payload JSONB,
  occurred_at TIMESTAMPTZ NOT NULL, -- Server time

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  is_deleted BOOLEAN DEFAULT false

  -- NOTE: NO updated_at, NO updated_by (immutable)
);

-- Enforce append-only: no updates allowed
CREATE TRIGGER enforce_attempt_events_immutable
  BEFORE UPDATE ON attempt_events
  FOR EACH ROW
  EXECUTE FUNCTION raise_immutable_violation();
```

#### Schema_Version

```sql
CREATE TABLE schema_version (
  version VARCHAR(20) NOT NULL, -- e.g., "1.0.0"
  applied_at TIMESTAMPTZ NOT NULL,
  checksum VARCHAR(64) NOT NULL, -- SHA256 of migration file (calculated by worker on apply)

  UNIQUE(version)
);

-- Enforce single row
CREATE TRIGGER enforce_schema_version_single_row
  BEFORE INSERT ON schema_version
  FOR EACH ROW
  WHEN (SELECT COUNT(*) FROM schema_version) > 0
  EXECUTE FUNCTION raise_single_row_violation();
```

**Checksum Validation (Redundant Check for Tampering + Corruption Detection)**:

- API calculates SHA256 when migration created; stores in schema_version.checksum
- Worker re-calculates SHA256 before applying migration
- If mismatch detected → abort transaction → log CRITICAL alert → send to DLQ
- Prevents both tampering (file modified) and storage corruption (checksum drift)

### Version Bumping Rules

| Scenario                                 | Version Bump  | Backward Compatible |
| ---------------------------------------- | ------------- | ------------------- |
| Add new optional column                  | MINOR (1.X.0) | ✅ Yes              |
| Add new table                            | MINOR (1.X.0) | ✅ Yes              |
| Modify existing column (type/constraint) | MAJOR (2.0.0) | ❌ No               |
| Remove column                            | MAJOR (2.0.0) | ❌ No               |
| Remove table                             | MAJOR (2.0.0) | ❌ No               |
| Change ON DELETE policy                  | MAJOR (2.0.0) | ❌ No               |
| Add unique constraint                    | MAJOR (2.0.0) | ❌ No               |

---

## Transaction Boundaries

**Isolation Level**: All tenant database transactions use `READ COMMITTED` isolation. Allows
concurrent writes (high throughput), prevents dirty reads, acceptable phantom read possibility for
snapshot/audit queries.

### Schema Initialization (Provisioning Endpoint)

```
BEGIN TRANSACTION (isolation: READ COMMITTED)
  ├─ Create all 38–40 tables
  ├─ Create all indexes
  ├─ Create all triggers (immutability checks)
  ├─ Calculate SHA256 checksum of schema initialization script
  ├─ INSERT INTO schema_version (version='1.0.0', applied_at=now(), checksum=CALCULATED)
  └─ COMMIT

On failure:
  → ROLLBACK entire transaction
  → Tenant database left empty
  → Retry allowed (idempotent via idempotency key)
```

### Migration Execution (Worker, not API – Async with Redundant Checksum Validation)

```
BEGIN TRANSACTION (isolation: READ COMMITTED)
  ├─ LOCK schema_version (wait for exclusive lock)
  ├─ READ migration file from disk
  ├─ Calculate SHA256 checksum of migration file
  ├─ Compare checksum:
  │   if mismatch vs API-stored checksum:
  │     → ABORT transaction
  │     → Log CRITICAL alert (potential tampering or storage corruption)
  │     → Send to DLQ with tampering_detected flag
  └─ On checksum match:
     ├─ Apply migration SQL
     ├─ Validate schema integrity
     ├─ UPDATE schema_version SET version=NEW_VERSION, applied_at=now(), checksum=RECALCULATED
     └─ COMMIT

On failure:
  → ROLLBACK entire transaction
  → schema_version unchanged
  → Tenant database reverted to pre-migration state
  → Logged as critical error + DLQ
  → Retry queue: exponential backoff (2s, 4s, 8s), max 3 retries, ~5min timeout total
```

### Attempt Submission (API Endpoint – Hybrid Idempotency)

```
BEGIN TRANSACTION (isolation: READ COMMITTED, FOR UPDATE to prevent race)
  ├─ SELECT FOR UPDATE attempts WHERE id=X (lock row)
  ├─ Validate status = IN_PROGRESS
  ├─ Validate deadline not exceeded (server time)
  ├─ Check idempotency key:
  │   ├─ Try Redis cache lookup (fast path, 24h TTL)
  │   ├─ If hit: ROLLBACK, return cached response (idempotent replay)
  │   └─ If miss:
  │       ├─ Check database unique constraint (exam_id, user_id, started_at)
  │       └─ If exists: return that attempt's response (fallback safe path)
  ├─ INSERT all attempt_answers (all at once or rollback)
  ├─ UPDATE attempts SET status='SUBMITTED', submitted_at=now()
  ├─ Store response in Redis with idempotency_key (24h TTL)
  └─ COMMIT

All writes must happen together or not at all. Hybrid approach ensures idempotency even if Redis unavailable or TTL expired.
```

### Idempotency Strategy (Hybrid Redis + Database Fallback)

**Mandatory for**:

- Tenant provisioning
- Attempt submission
- License transitions
- Schema migrations (via idempotent migration format)

**Implementation (Hybrid)**:

- Idempotency key (UUID) supplied by client or generated server-side
- **Primary (fast path)**: Redis cache lookup with 24h TTL
- **Fallback (safe path)**: If Redis miss or unavailable, query database:
  - For attempt submission: check unique constraint (exam_id, user_id, started_at)
  - For provisioning: check if workspace already has schema_version table
- **Recovery**: If both hits, return same response (idempotent); no double-execution
- **Cache failure resilience**: System remains safe even if Redis down (falls back to DB check)

---

## Authoritative Time Usage

### Server-Authoritative Time (Mandatory)

ALL timestamps use `now()` (PostgreSQL server time):

- `created_at`: Always `DEFAULT now()`
- `updated_at`: Always `DEFAULT now()` on each update
- `attempt_started_at`: Set by API to `now()`
- `attempt_submitted_at`: Set by API/Worker to `now()`
- `submission_deadline_at`: Calculated server-side (e.g., created_at + duration_minutes)
- Drift validation: Compare client submitted time vs. server time, log discrepancies

### Client Time Must Not Be Trusted

- Client clock skew detected: Log warning, use server time
- Client sends future timestamps: Discard, use server time
- Client sends past timestamps: Discard, use server time
- Reconnection: Time recalculated from server (no extrapolation from client)

---

## Observability Requirements

### Structured Logging (All Schema Operations)

Every database operation MUST log:

```json
{
  "timestamp": "2026-02-16T10:30:45.123Z",
  "level": "info",
  "service": "api",
  "correlation_id": "req-uuid-12345",
  "workspace_slug": "workspace-abc",
  "workspace_id": "uuid",
  "user_id": "uuid",
  "operation": "attempt_submission",
  "table": "attempts",
  "rows_affected": 1,
  "duration_ms": 45,
  "status": "success"
}
```

### Critical Path Metrics

- Schema initialization duration (ms)
- Migration execution duration (ms)
- Attempt submission transaction duration (ms)
- Lock wait time on schema_version (ms)
- Query count per transaction

---

## Failure Modes & Recovery

| Failure Mode                        | Detection                 | Recovery                                   | Impact                                 |
| ----------------------------------- | ------------------------- | ------------------------------------------ | -------------------------------------- |
| **Tenant DB Connection Failed**     | Pool exhausted, timeout   | Retry with exponential backoff (max 3x)    | 503 Unavailable → user waits           |
| **schema_version Mismatch**         | Version read != expected  | Trigger migration worker OR reject request | 409 Conflict (tenant migration needed) |
| **Soft Delete Flag Corrupted**      | Missing is_deleted column | Migration to add column with DEFAULT false | ❌ Cannot proceed                      |
| **Referential Integrity Violation** | FK constraint error       | Rollback transaction, log violation        | Transaction rejected                   |
| **Duplicate Attempt Submission**    | Idempotency key exists    | Return cached response                     | Idempotent (no double-grading)         |
| **Concurrent Updates (Race)**       | Serialization failure     | Retry transaction                          | Retry loop (max 3x)                    |
| **Migration Fails Mid-Way**         | Transaction rollback      | Revert schema_version, retry migration     | Pre-migration state preserved          |
| **Checksum Mismatch on Migration**  | Checksum != calculated    | Abort migration, investigate tampering     | Security alert logged                  |

---

## User Scenarios & Testing

### User Story 1 – Tenant Provisioning (Priority: P1)

**Actor**: MMC Admin / Provisioning Worker

**Scenario**: New workspace provisioned → entire baseline schema created in isolated database

**Why P1**: Without baseline schema, no tenant can function. Critical path for SaaS onboarding.

**Independent Test**: Provision single workspace, verify all 38–40 tables exist with correct
structure

**Acceptance Scenarios**:

1. **Given** workspace provisioning initiated, **When** provisioning service executes schema
   initialization, **Then** all tables created with correct column types, indexes, and constraints
2. **Given** schema creation in progress, **When** transaction fails (e.g., FS disk full), **Then**
   entire transaction rolled back and database left empty
3. **Given** repeated provisioning request (idempotent), **When** called twice with same idempotency
   key, **Then** returns same response without creating duplicate tables

---

### User Story 2 – Audit Trail Immutability (Priority: P1)

**Actor**: Admin / Auditor

**Scenario**: Attempt events logged and must be provably immutable

**Why P1**: Compliance, grading integrity, fraud detection depend on immutable audit trail

**Independent Test**: Submit attempt answers → verify attempt_events appended → verify no events can
be modified

**Acceptance Scenarios**:

1. **Given** attempt in progress, **When** student submits answer, **Then** event inserted into
   attempt_events with server time and event_type
2. **Given** event in attempt_events, **When** attempted to UPDATE (e.g., change event_type),
   **Then** trigger fires and UPDATE rejected
3. **Given** multiple events in sequence, **When** fetched, **Then** submission_order reflects
   chronological order and is queryable

---

### User Story 3 – Attempt Snapshot Immutability (Priority: P1)

**Actor**: Exam System

**Scenario**: Configuration frozen at attempt start → prevents live exam changes

**Why P1**: Prevents fraud (exam admins changing answers mid-exam), ensures fair grading

**Independent Test**: Create attempt → capture configuration snapshot → modify live exam config →
verify attempt uses snapshot

**Acceptance Scenarios**:

1. **Given** exam created with 5 questions, **When** attempt started, **Then**
   question_list_snapshot captures all 5 questions in original order
2. **Given** attempt in progress, **When** admin deletes 1 question from live exam, **Then** attempt
   still sees original 5 questions from snapshot
3. **Given** attempt submitted, **When** grading worker processes, **Then** uses
   configuration_snapshot and grading_config_snapshot (never live exam config)

---

### User Story 4 – Referential Integrity (Priority: P2)

**Actor**: System Maintainer

**Scenario**: Cannot create orphaned records or delete parents with children

**Why P2**: Data consistency, prevents silent corruption

**Independent Test**: Attempt to delete user with active attempts → verify rejection

**Acceptance Scenarios**:

1. **Given** user with active attempts, **When** DELETE executed on users table, **Then** FK
   constraint rejects (ON DELETE RESTRICT)
2. **Given** exam with questions, **When** DELETE executed on exams table, **Then** constraint
   allows (ON DELETE CASCADE) if question orphaning acceptable
3. **Given** foreign key created, **When** insert with non-existent parent ID, **Then** constraint
   rejects

---

### User Story 5 – Schema Versioning (Priority: P2)

**Actor**: Product / Platform Engineer

**Scenario**: Tenant schema version validated → ensures product ↔ schema compatibility

**Why P2**: Prevents version mismatch bugs, enables graceful migration

**Independent Test**: Generate mismatch between product version and schema version → verify
rejection

**Acceptance Scenarios**:

1. **Given** product version 1.2.0, **When** tenant schema version 1.0.0, **Then** automatic
   migration triggered OR request rejected with 503
2. **Given** tenant schema version 2.0.0, **When** product version 1.2.0, **Then** request rejected
   with 409 (schema too new)
3. **Given** schema version table, **When** queried, **Then** exactly 1 row returned with version,
   applied_at, checksum

---

### Edge Cases

- **Large Data Set**: 1 million rows in mcq_questions → verify indexes prevent table scans
- **Long-Running Migration**: Migration takes > 5 minutes → verify connection doesn't timeout
- **Concurrent Attempts**: 100 concurrent users submitting answers simultaneously → verify no race
  conditions
- **Clock Skew**: Client 5 minutes behind server → verify server time overrides client
- **Failed Soft Delete**: is_deleted flag corruption → queries must still work (use COALESCE)

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST create all 38–40 baseline tables on tenant provisioning with identical
  schema (version 1.0.0)
- **FR-002**: Each table MUST include mandatory audit fields: id (UUID), created_at, updated_at,
  created_by, updated_by, is_deleted
- **FR-003**: System MUST enforce no composite primary keys; all tables use single UUID primary key
- **FR-004**: System MUST create indexes on all foreign keys and frequently accessed columns
  automatically during provisioning
- **FR-005**: System MUST enforce referential integrity via foreign key constraints with explicit ON
  DELETE policies (RESTRICT, CASCADE, or SET NULL)
- **FR-006**: Soft delete MUST be the only delete mechanism for runtime data; hard deletes forbidden
  via schema trigger
- **FR-007**: System MUST maintain exactly one schema_version row per tenant database tracking
  semantic version, applied_at timestamp, and migration checksum
- **FR-008**: Attempt_events table MUST be append-only; no UPDATEs or DELETEs allowed via
  immutability trigger
- **FR-009**: Attempts table MUST snapshot exam configuration, question list, and grading rules at
  start (immutable JSONB fields)
- **FR-010**: All timestamps MUST be server-authoritative (PostgreSQL now()); client time never used
  for audit or deadline validation
- **FR-011**: Attempt submission MUST be transactional: all attempt_answers inserted + status
  updated atomically or rolled back entirely
- **FR-012**: Duplicate attempt submissions MUST be detected via idempotency key and return cached
  response without re-grading
- **FR-013**: System MUST validate schema_version compatibility with product_version before allowing
  workspace operations
- **FR-014**: Subscriptions table MUST enforce unique active subscription per user via unique
  constraint
- **FR-015**: Invoices table MUST use numeric type (not float) for financial calculations; states
  MUST be explicit ENUM (PENDING, PAID, FAILED, REFUNDED)
- **FR-016**: All database connections MUST originate from tenant resolver context; no direct DB
  instantiation allowed
- **FR-017**: License validation MUST reject workspace requests if license status is SOFT_LOCKED
  (423) or ARCHIVED (403)
- **FR-018**: Schema initialization MUST be idempotent: repeated provisioning with same idempotency
  key returns same response
- **FR-019**: Migration execution MUST lock schema_version, apply changes transactionally, and
  rollback entire transaction on any failure
- **FR-020**: Audit_logs table (if included) MUST be append-only and never included in soft-delete
  queries

### Key Entities

- **Attempts**: Container for exam submissions, snapshots configuration at start
- **Attempt_Answers**: Individual question responses within an attempt (append-only)
- **Attempt_Events**: Immutable audit trail of attempt lifecycle events
- **Schema_Version**: Single-row table tracking database schema version and migration checksum
- **Subscriptions**: User-workspace subscription records with unique active constraint
- **Users**: Identity records with audit fields
- **Exam Tables**: MCQ/Traditional exam definitions with question references
- **Categories/Tags**: Classification system for hierarchical organization
- **Notifications**: Communication records for user alerts
- **Certificates**: Credential records issued upon completion

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: New tenant provisioning completes in < 5 seconds (all 38–40 tables created with
  indexes)
- **SC-002**: Referential integrity constraints prevent 100% of orphaned record attempts (any
  insert/delete violating FK rejected)
- **SC-003**: Soft delete recovery queries return consistent results (is_deleted filtering works on
  100% of queries)
- **SC-004**: Attempt submission transaction completes atomically: no partial states observable
  (all-or-nothing semantics)
- **SC-005**: Schema version validation prevents 100% of product↔schema version mismatches
  (incompatible requests rejected before execution)
- **SC-006**: Attempt_events immutability enforced 100%: no updates/deletes allowed on event records
- **SC-007**: Server time enforcement reduces clock-skew bugs to 0 (all timestamps from PostgreSQL
  now())
- **SC-008**: Idempotent provisioning and submission prevent 100% of duplicate-execution bugs
- **SC-009**: Migration rollback restores pre-migration state within 100% accuracy (no partial
  migrations)
- **SC-010**: Database-per-tenant isolation verified: cross-tenant queries rejected at connection
  pool level
- **SC-011**: License enforcement blocks soft-locked/archived workspaces with < 100ms latency
  penalty
- **SC-012**: Audit trail completeness: 100% of user actions traceable via created_by, updated_by,
  attempt_events

---

## Assumptions

- PostgreSQL version 14+ available for all tenant databases
- JSON/JSONB type supported (snapshot storage)
- UUID extension enabled
- Connection pooling (PgBouncer or equivalent) manages tenant connections
- All timestamps use UTC timezone (TIMESTAMPTZ enforced at schema level)
- Index creation is synchronous (blocking during provisioning)
- No need for TimescaleDB or other extensions initially

---

## Explicit Non-Goals

- **NO**: Tenant-specific schema customization at DB level (all customization via configuration
  tables)
- **NO**: Hard delete mechanism for runtime data (soft delete only)
- **NO**: Automatic schema rollback across versions (rollback = restore snapshot)
- **NO**: Multi-tenant row-based isolation (database-per-tenant is exclusive model)
- **NO**: GraphQL or ORM type generation from schema (manual schema first)
- **NO**: Sharding strategy (single PostgreSQL instance per deployment)
- **NO**: Cross-tenant views or materialized views

---

## Test Strategy

### Unit Tests Required

- ✅ Schema initialization script: verify table creation
- ✅ Soft delete trigger: verify hard delete prevention
- ✅ Immutability trigger for attempt_events: verify UPDATE rejected
- ✅ schema_version single-row trigger: verify duplicate INSERT rejected
- ✅ Unique constraint validation: subscriptions (active), attempts (exam+user+time)

### Integration Tests Required

- ✅ End-to-end tenant provisioning: create workspace → verify all tables exist
- ✅ Foreign key cascade/restrict: delete parent → verify child behavior matches policy
- ✅ Attempt submission transaction: concurrent submissions → verify atomicity
- ✅ Schema version compatibility: product version mismatch → verify rejection
- ✅ License validation: soft-locked workspace → verify 423 response
- ✅ Idempotency: repeated provisioning → verify identical response
- ✅ Snapshot immutability: modify live exam → verify attempt uses snapshot

### Snapshot Tests Required

- ✅ schema_version table structure: verify exact columns and constraints
- ✅ Audit fields: verify all business tables have id, created_at, updated_at, created_by,
  updated_by, is_deleted
- ✅ Index definitions: verify indexes on all FK columns

### Isolation Tests Required

- ✅ Cross-tenant query prevention: tenant A cannot query tenant B data
- ✅ Connection pool isolation: verify separate pools per workspace
- ✅ Tenant resolver middleware: verify tenant ID resolved correctly

### Concurrency Tests Required

- ✅ 100 concurrent attempt submissions: verify no lost updates
- ✅ Concurrent attempts on same user: verify status consistency
- ✅ Race condition on schema_version lock: verify serialization

---

## Observability & Monitoring

### Metrics to Emit

- Provisioning duration (ms)
- Migration duration (ms)
- Query execution duration (ms)
- Lock wait time on schema_version (ms)
- Failed transaction count
- Soft delete query performance

### Logs to Capture

- Tenant provisioning start/end
- Migration execution start/completion
- FK constraint violations (action + table + user)
- schema_version mismatch detected
- License validation blocks
- Clock skew warnings

---

## Final Constitutional Compliance Statement

**Zidney Constitution v1.2.0 Compliance Status**: ✅ **COMPLIANT**

No violations detected. This specification adheres to:

- ✅ Database-per-tenant model (ADR-0001)
- ✅ Snapshot attempt integrity (ADR-0002)
- ✅ Server-authoritative time (ADR-0006)
- ✅ Version compatibility enforcement (ADR-0007)
- ✅ Multi-tenancy isolation rules (hard rule: no row-based, no shared tables, no cross-tenant
  access)
- ✅ License enforcement middleware (mandatory)
- ✅ Transaction boundaries (all-or-nothing semantics)
- ✅ Idempotency strategy (provisioning, submission)
- ✅ Audit fields on all tables
- ✅ Structured logging requirements
- ✅ No direct DB instantiation (tenant resolver mandatory)
- ✅ No schema drift (versioning enforced)
- **FR-007**: System MUST retain user data for [NEEDS CLARIFICATION: retention period not specified]

### Key Entities _(include if feature involves data)_

- **[Entity 1]**: [What it represents, key attributes without implementation]
- **[Entity 2]**: [What it represents, relationships to other entities]

## Success Criteria _(mandatory)_

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: [Measurable metric, e.g., "Users can complete account creation in under 2 minutes"]
- **SC-002**: [Measurable metric, e.g., "System handles 1000 concurrent users without degradation"]
- **SC-003**: [User satisfaction metric, e.g., "90% of users successfully complete primary task on
  first attempt"]
- **SC-004**: [Business metric, e.g., "Reduce support tickets related to [X] by 50%"]
