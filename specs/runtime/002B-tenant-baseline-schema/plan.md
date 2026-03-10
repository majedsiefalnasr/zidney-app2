# Implementation Plan: Tenant Baseline Schema

**Feature Branch**: `002B-tenant-baseline-schema`  
**Created**: 2026-02-16  
**Status**: Draft  
**Phase**: 01 – Platform Foundation  
**Stage**: STAGE_02B_TENANT_BASELINE_SCHEMA  
**Template**: `specs/templates/plan-template.md`

---

## Stage Alignment

- **Phase**: 01 – Platform Foundation
- **Stage**: STAGE_02B_TENANT_BASELINE_SCHEMA (Tenant Baseline Schema)
- **Related Spec File**: [spec.md](./spec.md)
- **Related ADRs**:
  - ADR-0001: Database-per-Tenant Model
  - ADR-0002: Snapshot Attempt Model
  - ADR-0007: Product Version Compatibility
  - ADR-0008: Semantic Versioning Policy

**Scope**: Define immutable baseline schema for all tenant databases, enforce schema versioning,
manage migrations via worker.

**Blocked By**: None (foundation stage)

**Blocks**: STAGE_02C_MIGRATION_AND_VERSIONING_MODEL (depends on baseline schema stability)

---

## Architectural Scope Confirmation

**Constitutional Alignment Check** ✅

- ✅ No cross-tenant data access: Each table isolated to single tenant database
- ✅ No middleware bypass: All schema operations validated through tenant resolver + license
  middleware
- ✅ No direct DB instantiation: All connections obtained from tenant resolver context
- ✅ No grading logic: Grading is Worker responsibility (deferred to STAGE_06)
- ✅ No weakening snapshot integrity: Attempt snapshots immutable within schema version
- ✅ No weakening version enforcement: Schema_version mandatory with checksum validation
- ✅ No layer boundary violation: API creates schema (via worker), Worker applies migrations,
  Frontend consumes zero schema logic
- ✅ Database-per-tenant preserved: 1 database per workspace, single PostgreSQL instance
- ✅ All writes transactional: Schema initialization, migrations, attempt submissions all use
  transactions
- ✅ Server-authoritative time: All timestamps from PostgreSQL now()

**No ADR exceptions required.**

---

## Implementation Layers

### Layer 1: API Layer (Provisioning Endpoint)

**Route**: `POST /mmm/workspaces/:workspace_id/schema/initialize`

**Responsibility**: Accept provisioning request, enqueue schema initialization in worker queue

**Flow**:

```
1. Accept POST request with idempotency_key
2. Tenant resolver middleware → resolve workspace_id
3. License middleware → validate ACTIVE/TRIAL status
4. Validate idempotency key (Redis or DB check)
5. If duplicate → return 409 Conflict (already initialized)
6. If new → enqueue task in worker queue (async)
7. Return 202 Accepted + task_id
```

**Middleware Stack**:

- Tenant resolver (mandatory) → tenant_id extracted
- License middleware (mandatory) → status validated
- Request ID propagation (structured logging)
- Rate limiting (5 requests/minute per workspace)

**No Database Writes**: API only enqueues; worker performs schema creation

**Validation Package**: `@zidney/validation` for idempotency_key format

---

### Layer 2: Worker Layer (Migration & Schema Initialization)

**Queue Name**: `schema-initialization` (separate queue for schema operations)

**Task Types**:

1. **INIT_TENANT_SCHEMA**: Create all 38–40 baseline tables on new tenant
2. **APPLY_MIGRATION**: Execute versioned migration on existing tenant

#### Task: INIT_TENANT_SCHEMA

**Worker Responsibility**:

```
BEGIN TRANSACTION (READ COMMITTED isolation)
  ├─ Get tenant database connection from pool (resolver context)
  ├─ Create all 38–40 tables with:
  │   ├─ UUID primary keys (id)
  │   ├─ Audit fields (created_at, updated_at, created_by, updated_by, is_deleted)
  │   ├─ Indexes on FK columns and frequently queried fields
  │   ├─ Foreign key constraints (RESTRICT/CASCADE/SET NULL explicit)
  │   ├─ Immutability triggers (attempt_events, audit_logs if enabled)
  │   └─ Single-row trigger (schema_version)
  ├─ Calculate SHA256 checksum of schema initialization script
  ├─ INSERT INTO schema_version (version='1.0.0', applied_at=now(), checksum=CALCULATED)
  └─ COMMIT

On success:
  ├─ Log CRITICAL level: "Tenant schema initialized: workspace={workspace_id}, version=1.0.0"
  └─ Remove task from queue

On failure:
  ├─ ROLLBACK entire transaction
  ├─ Log ERROR: "Schema initialization failed: workspace={workspace_id}, reason={error}"
  ├─ Retry with exponential backoff (2s, 4s, 8s) max 3 retries
  ├─ After 3 failed retries → send to DLQ with schema_init_failed flag
  └─ Do NOT mark workspace as initialized (remains eligible for retry)
```

**Idempotency**:

- Check if schema_version table exists (if yes, already initialized, idempotent replay)
- Unique constraint on version → prevents duplicate version rows
- Database-level idempotency (no Redis dependency)

**Transaction Isolation**: `READ COMMITTED` (allows concurrent writes from other tenants)

**Concurrency Guard**: `LOCK schema_version` during migration (serializes migrations per tenant)

**Timeout**: 30 seconds (schema init typically completes in < 5s)

---

#### Task: APPLY_MIGRATION

**Worker Responsibility**:

```
BEGIN TRANSACTION (READ COMMITTED isolation)
  ├─ Get tenant database connection (resolver context)
  ├─ LOCK schema_version (wait for exclusive lock)
  ├─ READ expected schema_version from task payload
  ├─ SELECT current version from schema_version table
  ├─ Validate version > current (no downgrade)
  │
  ├─ Read migration file from disk (apps/api/src/db/tenant/migrations/{version}/*.sql)
  ├─ Calculate SHA256 checksum of migration file
  ├─ Read stored checksum from task payload (calculated by API at migration creation)
  │
  ├─ Validate checksums match:
  │   if MISMATCH:
  │     ├─ ABORT transaction
  │     ├─ Log CRITICAL: "Migration checksum mismatch: workspace={workspace_id}, version={version}"
  │     ├─ Send to DLQ with tampering_detected=true
  │     └─ DO NOT RETRY (security incident)
  │
  ├─ Apply migration SQL (single transaction)
  ├─ Validate schema integrity (all new columns/tables exist)
  ├─ UPDATE schema_version SET version=NEW_VERSION, applied_at=now(), checksum=RECALCULATED
  └─ COMMIT

On success:
  ├─ Log CRITICAL: "Migration applied: workspace={workspace_id}, version={old}→{new}"
  └─ Remove task from queue

On failure (non-checksum):
  ├─ ROLLBACK entire transaction
  ├─ Log ERROR: "Migration failed: workspace={workspace_id}, version={version}, reason={error}"
  ├─ Retry with exponential backoff (2s, 4s, 8s) max 3 retries (~13s total)
  ├─ After 3 retries → send to DLQ with migration_failed flag
  └─ Tenant blocked from requests (API returns 503 "Migration pending")
```

**Idempotency**: Unique constraint on schema_version(version) prevents re-applying same version

**Concurrency Guard**: `LOCK schema_version` serializes migrations per tenant (max 1 migration at a
time)

**Timeout**: 30 seconds (most migrations << 1s)

---

### Layer 3: Middleware Layer

#### Tenant Resolver Middleware

**Execution Order**: First (before all other middleware)

**Responsibility**:

1. Extract tenant slug from subdomain or path parameter
2. Validate slug format (alphanumeric + hyphens)
3. Query MMC master DB: `SELECT workspace_id FROM workspaces WHERE slug=?`
4. If not found → return 404 ("Workspace not found")
5. If found → inject tenant_id into request context
6. Check user workspace membership (separate auth namespace):
   - Query: `SELECT role FROM workspace_users WHERE workspace_id=? AND user_id=?`
   - If not member → return 401/403 ("Unauthorized")
   - If member → proceed
7. Initialize connection pool for tenant (lazy or eager):
   - Check in-memory map: `tenant_pools[workspace_id]`
   - If missing → create connection pool and cache
   - If cached → reuse pool

**Error Codes**:

- 404: Workspace not found (tenant slug resolution failed)
- 401: User not authenticated (JWT invalid)
- 403: User not authorized (not member of workspace)

---

#### License Middleware

**Execution Order**: Second (after tenant resolver)

**Responsibility**:

1. Query master DB:
   `SELECT status, product_version_compatibility FROM licenses WHERE workspace_id=?`
2. Validate status:
   - `SOFT_LOCKED` → return 423 ("Locked")
   - `ARCHIVED` → return 403 ("Forbidden")
   - `ACTIVE` or `TRIAL` → proceed
3. Store license in request context (for schema version validation)

**Error Codes**:

- 423: License soft-locked (features restricted)
- 403: License archived (workspace suspended)

---

#### Schema Version Validation Middleware

**Execution Order**: Third (after license)

**Responsibility**:

1. Get tenant database connection from pool
2. Query tenant DB: `SELECT version FROM schema_version LIMIT 1`
3. Get expected version from license.product_version_compatibility
4. Compare versions:
   - If `actual > expected`: Product outdated → return 409 ("Conflict: tenant schema too new for
     product")
   - If `actual < expected`: Schema outdated → check if migration in-flight
     - If migration queued → return 503 ("Migration in progress")
     - If no migration → enqueue migration task, return 503
     - Do NOT proceed until migration complete

**Error Codes**:

- 409: Version mismatch (tenant ahead of product)
- 503: Migration in progress (retry after delay)

---

### Layer 4: Frontend Layer

**Responsibility**: Zero (schema initialization is MMC/Admin-only)

**No Direct DB Access**: Frontend never queries schema_version or manages migrations

---

## Database Impact

### Master Database (MMC)

**Tables Touched**:

- `workspaces` — SELECT (tenant resolution)
- `licenses` — SELECT (license validation)
- `workspace_users` — SELECT (membership check)

**Migration Required**: No (master schema already exists)

**Version Bump**: No

---

### Tenant Database (Per Workspace)

**Tables Created** (baseline schema):

| Layer          | Tables                                                                               | Count |
| -------------- | ------------------------------------------------------------------------------------ | ----- |
| Identity       | users, roles, role_permissions                                                       | 3     |
| Academic       | divisions, departments, groups, hierarchy_nodes, teams, semesters, subjects, lessons | 8     |
| Classification | categories, category_values, tags, mcq_baskets                                       | 4     |
| Exam Engine    | mcq_questions, traditional_questions, mcq_exams, traditional_exams, scheduled_exams  | 5     |
| Runtime        | attempts, attempt_answers, attempt_events                                            | 3     |
| Commercial     | subscriptions, invoices, promocodes, subscription_events                             | 4     |
| Communication  | notifications, feedback, system_feedback                                             | 3     |
| Media          | media_files                                                                          | 1     |
| Ads            | ads                                                                                  | 1     |
| Certificates   | certificates, certificate_templates                                                  | 2     |
| System         | translations, schema_version, audit_logs (optional)                                  | 2–3   |

**Total**: 36–38 tables (audit_logs optional)

**Migration Required**: Yes (V1.0.0 baseline schema)

**schema_version Change**: Yes (set to 1.0.0 on initialization)

**product_version Compatibility**: Initial baseline = 1.0.0 (future migrations bump schema_version
per ADR-0008)

---

## Transaction Design

### Transaction 1: Schema Initialization

**Operation**: Create all baseline tables (38–40)

**Database**: Tenant DB

**Isolation Level**: `READ COMMITTED`

**Atomic Operations**:

1. Create all tables (all-or-nothing)
2. Create all indexes (all-or-nothing)
3. Create all triggers (all-or-nothing)
4. Calculate checksum
5. INSERT schema_version row

**Rollback Behavior**: Entire transaction rolls back on ANY failure (table creation, index creation,
trigger creation, or schema_version insert)

**Concurrency Protection**: First initialization per tenant (no concurrent schema creation)

**Timeout**: 30 seconds

---

### Transaction 2: Migration Execution

**Operation**: Apply versioned migration (e.g., v1.0.0 → v1.1.0)

**Database**: Tenant DB

**Isolation Level**: `READ COMMITTED`

**Atomic Operations**:

1. LOCK schema_version (exclusive)
2. Validate version ordering
3. Read + verify migration file checksum
4. Apply migration SQL
5. Validate schema integrity
6. UPDATE schema_version

**Rollback Behavior**: Entire transaction rolls back on ANY failure (including checksum mismatch)

**Concurrency Protection**: `LOCK schema_version` serializes migrations per tenant (max 1 migration
at time)

**Timeout**: 30 seconds

---

### Transaction 3: Attempt Submission (Bonus: affected by baseline schema)

**Operation**: Submit attempt answers + mark status SUBMITTED

**Database**: Tenant DB

**Isolation Level**: `READ COMMITTED`

**Atomic Operations**:

1. SELECT FOR UPDATE attempts WHERE id=X (row-level lock)
2. Validate status = IN_PROGRESS
3. Check idempotency key (Redis or DB)
4. INSERT all attempt_answers (all or nothing)
5. UPDATE attempts SET status='SUBMITTED', submitted_at=now()

**Rollback Behavior**: Entire transaction rolls back if any insert/update fails

**Concurrency Protection**: Row-level lock on attempts row (prevents concurrent submissions)

**Timeout**: 15 seconds

---

## Idempotency Plan

### Endpoint: POST /mmm/workspaces/:workspace_id/schema/initialize

**Idempotency Key**: UUID supplied by client (or generated server-side)

**Storage**:

1. **Primary**: Redis cache key format: `schema-init:{workspace_id}:{idempotency_key}` with 24h TTL
2. **Fallback**: Query tenant DB for schema_version table existence (if schema_version exists,
   already initialized)

**Replay-Safe**: Yes

- If Redis hit → return cached response (202 Accepted)
- If Redis miss + DB hit (schema_version exists) → return success response (202 Accepted)
- If Redis miss + DB miss → proceed with initialization

**Duplicate Submission Safe**: Yes (hybrid Redis+DB prevents double-execution)

**Implementation**:

```python
# API handler
idempotency_key = request.headers.get('Idempotency-Key') or generate_uuid()

# Check Redis first (fast path)
cached_response = redis.get(f"schema-init:{workspace_id}:{idempotency_key}")
if cached_response:
    return 202, cached_response

# Check database (fallback, safe path)
try:
    schema_version = tenant_db.query(
        "SELECT version FROM schema_version LIMIT 1",
        workspace_id=workspace_id
    )
    if schema_version:
        # Already initialized, return success
        redis.setex(f"schema-init:{workspace_id}:{idempotency_key}", 86400, cached_response)
        return 202, cached_response
except:
    pass  # Not initialized, proceed

# New request: enqueue schema init
task_id = enqueue_worker_task('INIT_TENANT_SCHEMA', workspace_id=workspace_id)

response = {'task_id': task_id, 'status': 'initialization_queued'}
redis.setex(f"schema-init:{workspace_id}:{idempotency_key}", 86400, response)
return 202, response
```

---

## Version Enforcement Strategy

### Where schema_version is Validated

**Location 1**: Schema Version Validation Middleware (on every request)

- Query tenant DB: `SELECT version FROM schema_version`
- Compare against license.product_version_compatibility
- Reject if mismatch

**Location 2**: Migration Execution (worker)

- Validate new_version > current_version (no downgrade)
- Validate checksum match (tampering detection)

### Where product_version is Validated

**Location**: License Middleware (on every request)

- Query master DB: `SELECT product_version_compatibility FROM licenses`
- Store in request context for schema version comparison

### Mismatch Handling

| Scenario                        | Detection         | Action                            | HTTP Code               |
| ------------------------------- | ----------------- | --------------------------------- | ----------------------- |
| Tenant schema > Product version | Schema middleware | Reject request, do NOT migrate    | 409 Conflict            |
| Tenant schema < Product version | Schema middleware | Enqueue migration, block requests | 503 Service Unavailable |
| Migration checksum mismatch     | Worker            | Abort transaction, DLQ            | N/A (worker)            |

### Backward Compatibility Strategy

- **MINOR version bump** (v1.0.0 → v1.1.0): Backward compatible
  - Add optional columns (default values)
  - Add new tables (optional features)
  - No breaking changes
  - Existing queries still valid

- **MAJOR version bump** (v1.1.0 → v2.0.0): Not backward compatible
  - Modify/remove columns
  - Alter constraints
  - Requires mandatory migration before upgrade

---

## Authoritative Time Handling

### Server Clock Used

**All timestamps must use PostgreSQL `now()`**:

- `created_at`: DEFAULT now()
- `updated_at`: DEFAULT now() on UPDATE
- `started_at` (attempts): SET BY API to now()
- `submitted_at` (attempts): SET BY WORKER to now()
- `submission_deadline_at` (attempts): CALCULATED server-side (e.g., now() + duration_minutes)

### Expiration Validation

**Attempt deadline enforcement** (handled by Worker, not Baseline Schema):

- Check: `server_time > submission_deadline_at` → attempt expired
- Worker sets `status='ARCHIVED'` if deadline exceeded

### Soft Lock Enforcement

**License soft-lock** (handled by License Middleware):

- Every request checks `license.status != SOFT_LOCKED`
- Block with 423 Locked

### Deadline Enforcement (Attempt-specific, not baseline schema)

Deferred to STAGE_06_ATTEMPT_ENGINE_FOUNDATION

### Reconnection Grace Logic

**Database reconnection**:

- If connection drops during transaction → reconnect and retry (up to 3x with exponential backoff)
- Do NOT extrapolate client timestamps
- Recalculate all deadlines from server time after reconnection

### Client Time Never Used for Authority

- Client sends `submitted_at` timestamp → IGNORED
- Use PostgreSQL `now()` instead
- Log warning if client time > 5 minutes ahead/behind server

---

## Observability & Logging

### Structured Log Format

**All logs MUST include**:

```json
{
  "timestamp": "2026-02-16T10:30:45.123Z", // ISO8601 UTC
  "level": "info|warn|error|critical",
  "service": "api|worker", // Originating service
  "correlation_id": "req-uuid-12345", // Request trace ID
  "workspace_slug": "workspace-abc", // Tenant identifier
  "workspace_id": "uuid",
  "user_id": "uuid", // If authenticated
  "operation": "schema_initialization", // What operation
  "table": "attempts", // If applicable
  "rows_affected": 1, // If applicable
  "duration_ms": 45,
  "status": "success|failure",
  "error_code": "SCHEMA_VERSION_MISMATCH", // Standardized code
  "message": "Human-readable description"
}
```

### Request ID Propagation

- Generate request_id UUID on API ingress
- Inject into all logs for request
- Pass to worker tasks (correlation_id becomes worker task ID)

### Workspace Propagation

- Extract workspace_slug from tenant resolver
- Add to ALL logs (API + worker)
- Format: `workspace_slug` (primary), `workspace_id` (secondary)

### Attempt ID Propagation (Future)

- When attempt created, generate attempt_id UUID
- Include in attempt submission logs
- Deferred to STAGE_06

### Error Contract Adherence

**All API error responses**:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "SCHEMA_VERSION_MISMATCH",
    "message": "Tenant schema version 1.0.0 incompatible with product version 1.2.0. Run migration with: POST /admin/migrate"
  }
}
```

**Standard error codes**:

- `SCHEMA_INIT_FAILED` — Schema initialization failed (500)
- `SCHEMA_VERSION_MISMATCH` — Version incompatibility (409)
- `MIGRATION_IN_PROGRESS` — Pending migration (503)
- `LICENSE_SOFT_LOCKED` — Workspace locked (423)
- `WORKSPACE_NOT_FOUND` — Invalid tenant slug (404)
- `UNAUTHORIZED` — User not authenticated (401)
- `FORBIDDEN` — User not authorized (403)
- `DUPLICATE_REQUEST` — Idempotency key replay (409)

### Metrics Emitted

- `schema_initialization_duration_ms` — Time to create baseline schema
- `migration_duration_ms` — Time to apply migration
- `schema_version_validation_duration_ms` — Middleware check latency
- `idempotency_cache_hits` — Redis cache hit rate
- `idempotency_db_fallback` — Times DB fallback used (Redis unavailable)
- `migration_retry_count` — Retry attempts before success/failure

---

## Rate Limiting

### Endpoint: POST /mmm/workspaces/:workspace_id/schema/initialize

**Classification**: Admin operation (MMC-only)

**Rate Limit**: 5 requests per minute per workspace (provisioning is rare)

**Abuse Mitigation**:

- If > 5 requests/minute → return 429 Too Many Requests
- Log rate limit hit as WARN level
- Same idempotency key within rate limit → allow (idempotent replay)

### Worker Queue Protection

**Queue**: `schema-initialization`

**Max Concurrency**: 1 per tenant (sequential migrations)

**Max Queue Depth**: Unlimited (migrations eventually process)

**Backlog Alert**: If > 100 pending tasks → alert DevOps (potential migration bottleneck)

---

## Failure Modes & Recovery

### Failure Mode 1: Tenant DB Connection Unavailable

**Detection**: Connection pool timeout (> 5 seconds)

**Recovery**:

- API: Return 503 Service Unavailable
- Worker: Retry with exponential backoff (max 3 retries)
- User: Retry request after 30 seconds

**Impact**: User requests blocked temporarily; no data loss

---

### Failure Mode 2: Schema Version Mismatch (Tenant Ahead)

**Detection**: schema_version > product_version

**Recovery**:

- API: Return 409 Conflict ("Tenant schema too new for product")
- Operator: Manually downgrade tenant (restore snapshot) OR upgrade product
- User: Requests blocked until resolved

**Impact**: Deployment issue; manual intervention required

---

### Failure Mode 3: Schema Version Mismatch (Tenant Behind)

**Detection**: schema_version < product_version

**Recovery**:

- API: Return 503 Unavailable ("Migration in progress")
- Worker: Auto-enqueue migration task
- API: Block workspace requests until migration complete
- User: Retry after migration complete (~30 seconds)

**Impact**: Temporary unavailability; automatic recovery

---

### Failure Mode 4: Migration Checksum Mismatch

**Detection**: Calculated checksum ≠ stored checksum

**Recovery**:

- Worker: Abort transaction, log CRITICAL alert
- Alert: Send to DevOps (security incident)
- User: Requests blocked (503) until manual investigation
- Operator: Investigate tampering; restore migration file or mark safe

**Impact**: Security incident; manual intervention required

---

### Failure Mode 5: Schema Initialization Fails (Partial)

**Detection**: Transaction rollback during table creation

**Recovery**:

- Worker: ROLLBACK entire transaction
- Tenant database: Reverted to pre-init state (no partial schema)
- Worker: Retry with exponential backoff (max 3 retries)
- After 3 retries: Send to DLQ, mark workspace init_failed
- User: Provisioning blocked until manual retry

**Impact**: Data loss: none (transaction atomic); provisioning delayed

---

### Failure Mode 6: Duplicate Attempt Submission

**Detection**: Idempotency key exists in Redis or DB unique constraint triggers

**Recovery**:

- API: Return cached response (idempotent replay)
- Worker: No duplicate grading (submission already processed)
- User: Receives same response (no side effects)

**Impact**: None (idempotent); user transparent

---

### Failure Mode 7: Worker Queue Backlog

**Detection**: > 100 pending migration tasks

**Recovery**:

- Alert: Notify DevOps (potential process overload)
- API: Requests blocked with 503 ("Migration in progress")
- Operator: Scale worker processes or investigate stalls
- User: Retry after delay

**Impact**: Requests slower; eventually process

---

### Failure Mode 8: Partial Transaction Failure

**Detection**: INSERT schema_version fails after tables created

**Recovery**:

- Database: Automatic ROLLBACK (transaction boundary)
- Tenant schema: Reverted to pre-transaction state (tables/indexes dropped)
- Worker: Retry (exponential backoff)
- User: Provisioning re-attempted

**Impact**: Transaction atomicity ensures no partial state

---

## Security Review

✅ **RBAC Enforcement**:

- Checked server-side: tenant resolver validates user workspace membership
- 403 Forbidden returned if not member

✅ **No Frontend Role Checks**:

- Frontend never validates roles (MMC handles all schema operations)
- Schema operations are admin-only (no user-facing endpoints)

✅ **No Secrets Exposed**:

- No migration file content in logs
- No connection strings in error messages
- No database passwords in structured logs

✅ **JWT Workspace Scope Enforced**:

- JWT extracted by auth middleware (deferred to STAGE_03)
- Workspace_id in JWT validated against request workspace

✅ **No Sensitive Data in Logs**:

- Avoid logging PII (user names, emails)
- Avoid logging passwords or tokens
- Log only workspace_id, user_id (UUIDs)

---

## Test Strategy

### Unit Tests Required

**File**: `apps/api/tests/unit/schema-baseline.test.ts`

- [ ] Schema initialization script: verify all 38–40 tables created
- [ ] Soft delete trigger: verify hard DELETE rejected on runtime tables
- [ ] Immutability trigger: verify UPDATE rejected on attempt_events
- [ ] Schema_version single-row trigger: verify duplicate INSERT rejected
- [ ] Unique constraints: verify subscriptions (active per user), attempts (exam+user+started_at)
- [ ] Checksum calculation: verify SHA256 matches expected value
- [ ] Idempotency key validation: verify UUID format

### Integration Tests Required

**File**: `apps/api/tests/integration/tenant-provisioning.test.ts`

- [ ] End-to-end provisioning: POST /mmm/workspaces/{id}/schema/initialize → verify all tables exist
- [ ] Transaction rollback: simulate disk full during schema creation → verify rollback, no partial
      schema
- [ ] Foreign key cascade/restrict: delete parent → verify child behavior matches ON DELETE policy
- [ ] Schema version validation: product vs tenant version mismatch → verify rejection (409/503)
- [ ] License soft-lock: attempt request with SOFT_LOCKED license → verify 423 response
- [ ] Idempotency: repeated provisioning with same key → verify cached response, no re-creation
- [ ] Migration execution: apply versioned migration → verify schema_version updated

### Snapshot Tests Required

**File**: `apps/api/tests/snapshot/schema-baseline.snapshot.ts`

- [ ] Schema_version table structure: verify exact columns (version, applied_at, checksum)
- [ ] Audit fields on all tables: sample random tables → verify id, created_at, updated_at,
      created_by, updated_by, is_deleted present
- [ ] Index definitions: verify indexes exist on all FK columns

### Isolation Tests Required

**File**: `apps/api/tests/integration/isolation.test.ts`

- [ ] Cross-tenant query prevention: tenant A → attempt to query tenant B data → verify rejection at
      pool level
- [ ] Connection pool isolation: verify separate pools per workspace
- [ ] Tenant resolver: workspace slug resolution correct

### Concurrency Tests Required

**File**: `apps/api/tests/integration/concurrency.test.ts`

- [ ] 100 concurrent attempt submissions: verify no lost updates
- [ ] Concurrent migrations on same tenant: verify serialization (only 1 at time)
- [ ] Concurrent provisioning requests: verify idempotency prevents race

### Database Migration Tests Required

**File**: `apps/api/tests/integration/migrations.test.ts`

- [ ] Checksum validation: calculate checksum → store → retrieve → verify match
- [ ] Migration rollback: apply migration → simulate error → verify rollback restores pre-migration
      schema
- [ ] Version ordering: attempt downgrade → verify rejection

---

## Rollback Strategy

### Safe Rollback Mechanism

If STAGE_02B must be rolled back (rare):

1. **No data loss**: Attempt snapshots immutable (frozen at baseline schema)
2. **Connection pool**: Drain existing connections before schema teardown
3. **Migration state**: schema_version table survives (used for version check)
4. **Timestamp**: All events timestamped (audit trail recoverable)

### Migration Rollback Plan

**For schema migrations** (v1.0.0 → v1.1.0):

- Automatic: Rollback transaction on any failure (database-level atomicity)
- Manual: Restore database snapshot from pre-migration backup
- Time window: 24 hours (standard backup retention)

### Feature Flag (if needed)

- Flag: `SCHEMA_BASELINE_ENABLED` (default: true)
- If disabled: API returns 503 ("Schema initialization suspended")
- Allows graceful shutdown during incidents

### Data Integrity Preservation

- All data persisted transactionally (ACID guarantees)
- Soft deletes preserved (is_deleted flag recoverable)
- Audit trail immutable (attempt_events append-only)

---

## Non-Goals

- ❌ Tenant-specific schema customization at DB level (configuration tables only)
- ❌ Hard delete of runtime data (soft delete only)
- ❌ Automatic schema rollback (manual restore only)
- ❌ Row-based multi-tenancy (database-per-tenant only)
- ❌ GraphQL schema generation (manual schema first)
- ❌ Horizontal sharding (single PostgreSQL instance per deployment)
- ❌ Cross-tenant materialized views
- ❌ Compression/archiving of schema (immutable baseline)

---

## Final Compliance Statement

**Zidney Constitution v1.2.0 Compliance Status**: ✅ **COMPLIANT**

**No violations detected.** This implementation plan adheres to:

- ✅ Database-per-tenant model (ADR-0001)
- ✅ Snapshot attempt integrity (ADR-0002)
- ✅ Server-authoritative time (ADR-0006)
- ✅ Version compatibility enforcement (ADR-0007)
- ✅ Semantic versioning (ADR-0008)
- ✅ Multi-tenancy isolation: no row-based, no shared tables, no cross-tenant access
- ✅ License enforcement middleware (mandatory)
- ✅ Transaction boundaries (all-or-nothing semantics)
- ✅ Idempotency strategy (hybrid Redis+DB fallback)
- ✅ Audit fields on all tables
- ✅ Structured logging with correlation_id
- ✅ No direct DB instantiation outside resolver
- ✅ No schema drift (versioning enforced)
- ✅ Worker-only migrations (API enqueues, worker executes)

**Implementation ready for Phase 2 task generation.**
