# STAGE_02C Clarification Audit

**Stage:** STAGE_02C_MIGRATION_AND_VERSIONING_MODEL  
**Phase:** 01 – Platform Foundation  
**Audit Date:** 2026-02-16  
**Status:** ✓ COMPLETE – All 24 questions answered and encoded into specifications  
**Responses:** See [CLARIFICATION_RESPONSES.md](CLARIFICATION_RESPONSES.md)

---

## Audit Methodology

This clarification audit identifies underspecified areas in the STAGE_02C specification by
examining:

- **Transactions** – State boundaries, rollback semantics
- **Idempotency** – Replay safety, deduplication
- **Concurrency** – Lock conflicts, race conditions
- **Version Enforcement** – Compatibility logic edge cases
- **Middleware Enforcement** – Integration points, failure modes
- **Security Validation** – Permission boundaries
- **Error Contract** – All failure paths, error codes
- **Isolation Boundaries** – Tenant cross-contamination risks

**Result:** 24 explicit clarification questions requiring stakeholder answers.

---

## 1. TRANSACTIONS (6 Questions)

### Q1.1: Snapshot Atomicity with Migration Failure

**Topic:** Master transaction boundaries  
**Current spec:** "Single transaction per deployment" – all migrations + version update in one
BEGIN/COMMIT

**Ambiguity:** What is the exact transaction scope?

**Clarification Question:**

When master migrations execute:

1. Is the transaction scope: `BEGIN ... (all migrations) ... (version update) ... COMMIT`?
2. Or: Each migration is separate transaction, final version update in separate transaction?
3. If first approach and migration 003 of 005 fails: Does platform_settings get rolled back to old
   version (i.e., all-or-nothing)?
4. When exactly are migration_registry records written – inside the main transaction or in separate
   transaction?

**Options provided:**

- A) Single transaction: BEGIN (all migrations + version update + registry records) COMMIT –
  all-or-nothing
- B) Per-migration transactions: Each migration commits separately, registry updated per-file
- C) Per-migration committed, but version update in final separate transaction
- D) Other (specify)

---

### Q1.2: Tenant Migration Transaction Boundaries

**Topic:** Tenant migration transactional model  
**Current spec:** "Single transaction per workspace upgrade" with snapshot created "before
transaction"

**Ambiguity:** The exact boundary of the transaction isn't specified. Snapshot creation vs.
migration vs. version update.

**Clarification Question:**

For tenant upgrades, what is the precise transaction structure?

1. Is snapshot creation included **inside** the BEGIN/COMMIT?
2. Or is snapshot created **before** and **outside** the transaction?
3. If snapshot creation fails: Does the entire upgrade halt, or does system retry?
4. When are migration_registry records written – before, during, or after version update commit?
5. Is there a cleanup transaction if snapshot creation succeeds but migration fails?

**Options provided:**

- A) Snapshot created outside transaction; BEGIN...migrations...version update...COMMIT; if snapshot
  fails, abort before transaction starts
- B) BEGIN...snapshot creation...migrations...version update...COMMIT (all atomic)
- C) BEGIN...migrations...COMMIT; separate transaction: version update+registry; separate
  transaction: snapshot cleanup
- D) Other (specify)

---

### Q1.3: Workspace Lock Release on Transaction Failure

**Topic:** Lock lifecycle during failed migrations  
**Current spec:** "Release workspace write lock" stated after COMMIT OR ROLLBACK

**Ambiguity:** Exact timing of lock release vs. transaction boundary.

**Clarification Question:**

When a tenant migration transaction fails:

1. Is the write lock released **before** the ROLLBACK completes, **during**, or **after**?
2. If another request arrives while ROLLBACK is in progress, does it wait for lock release or get
   423 Conflict?
3. What if the ROLLBACK itself fails (database hang)? Does lock remain held indefinitely?
4. Is there a lock timeout, or is manual intervention required?

**Options provided:**

- A) Lock released only after COMMIT/ROLLBACK completes (lock held until DB confirms transaction
  closure)
- B) Lock released immediately after transaction begins (allows reads during ROLLBACK)
- C) Lock released synchronously with transaction outcome (lock release = COMMIT/ROLLBACK
  completion)
- D) Other (specify)

---

### Q1.4: Saga vs. Single Transaction for Multi-Database Upgrade

**Topic:** Atomic update across master_db and tenant_db  
**Current spec:** "Update tenant_db.schema_version" and "Update
master_db.tenants_registry.schema_version" listed sequentially in same transaction

**Ambiguity:** Are both databases in same transaction, or separate transactions?

**Clarification Question:**

The spec states version updates happen in "single transaction" but versions are in **two different
databases**:

- tenant_db.schema_version (source of truth)
- master_db.tenants_registry.schema_version (cache)

1. Is this a distributed transaction (two-phase commit)?
2. Or are these two separate transactions with "best effort" synchronization?
3. What if tenant_db commit succeeds but master_db commit fails?
4. Is there a DLQ job to reconcile if cache diverges from truth?

**Options provided:**

- A) Two-phase commit across both databases (atomic dual-write, either both succeed or both fail)
- B) Separate transactions: Commit tenant_db first, then master_db; if master fails, async retry via
  worker
- C) Separate transactions: Commit master_db first (for visibility), tenant_db second; if tenant
  fails, DLQ reconciliation
- D) Other (specify)

---

### Q1.5: Concurrency Between Version Check and Migration Start

**Topic:** Race condition between resolver check and migration execution  
**Current spec:** Resolver validates "tenant.schema_version ≥ minimum_supported" before request;
migration checks same before executing

**Ambiguity:** Time window between version read and migration execution.

**Clarification Question:**

Timeline:

1. [T1] Resolver reads tenant.schema_version = 1.0.0, validates 1.0.0 ≥ minimum_supported 1.0.0 ✓
2. [T1] Request proceeds to business logic
3. [T2] Meanwhile, admin triggers upgrade (different request)
4. [T3] Migration updates tenant.schema_version to 2.0.0
5. [T4] Original request still executing with old schema

Is this race condition acceptable, or must version be locked during request execution?

**Options provided:**

- A) Acceptable – version check is point-in-time; if upgrade happens during request, request uses
  old schema
- B) Not acceptable – must acquire read lock on schema_version for duration of request
- C) Not acceptable – must reload schema_version at transaction boundary of business logic
- D) Other (specify)

---

### Q1.6: Rollback on Snapshot Restoration

**Topic:** State of transaction when rolling back via snapshot  
**Current spec:** "Rollback allowed only via snapshot restoration; version metadata reset"

**Ambiguity:** What transactions are active/committed during rollback process?

**Clarification Question:**

When manually rolling back via snapshot:

1. Are there any schema_version updates written before DB restore completes?
2. Do client requests get 423/426 during the restore window?
3. How long is workspace unavailable during restore?
4. If workspace receives requests during restore, what is response?

**Options provided:**

- A) Workspace locked for duration of restore; all requests get 423 Unavailable
- B) Workspace transitions to ROLLING_BACK state; requests get 409 Conflict until restore completes
- C) Restore happens in background; version metadata updated after restore completes; requests use
  stale schema version during restore
- D) Other (specify)

---

## 2. IDEMPOTENCY (5 Questions)

### Q2.1: Migration File Replay Rules

**Topic:** What does idempotent mean for migration files?  
**Current spec:** "Individual migration file execution (can safely replay)" and "All DDL must be
idempotent: CREATE TABLE IF NOT EXISTS"

**Ambiguity:** Idempotency scope – can we replay the entire migration, or just the DDL statements
within?

**Clarification Question:**

When we say migration file is "idempotent," do we mean:

1. **Script-level:** Running the entire script twice produces same end state (e.g., CREATE TABLE IF
   NOT EXISTS)?
2. **Or statement-level:** Each SQL statement is independently idempotent (but script as a whole
   might not be)?
3. What if a migration includes: `INSERT ... ON CONFLICT DO NOTHING`?
4. What if a migration includes: `UPDATE table SET counter = counter + 1`? (This is NOT idempotent
   by default)
5. Are stored procedures considered within idempotency scope, or exempted?

**Options provided:**

- A) Script-level idempotency: Entire script replayable with same outcome (strict requirement)
- B) Statement-level idempotency: Each DDL statement safe, DML statements exempt from idempotency
  requirement
- C) Declaration-based: Operator marks migration as idempotent or not; system allows replay if
  marked
- D) Other (specify)

---

### Q2.2: Duplicate Detection for Idempotency

**Topic:** How is duplicate migration execution prevented?  
**Current spec:** "Check migration_registry before execution; If record exists with SUCCESS: Skip
file, log warning; If record exists with FAILED: Re-run"

**Ambiguity:** What triggers a "duplicate execution" attempt, and how is it detected?

**Clarification Question:**

Scenario: Admin clicks "Upgrade Workspace" button twice in 1 second.

1. Is duplicate detection synchronous (before queuing to worker), or asynchronous (worker
   deduplicates)?
2. What stops second click from creating second upgrade job?
3. If both requests reach worker: What prevents parallel execution?
4. If first request is in-flight and second request comes in, does second request:
   - A) Wait for first to complete, then check status?
   - B) Get immediate error "Upgrade already in progress"?
   - C) Get queued and attached to same job?

**Options provided:**

- A) Synchronous: Resolver or API validates (workspace_id, target_version) unique before accepting
  request
- B) Asynchronous: Worker queue enforces: max 1 upgrade job per workspace at a time
- C) Lock-based: Acquire lock before checking registry; if lock fails, retry or queue
- D) Other (specify)

---

### Q2.3: Replay After Partial Failure

**Topic:** What happens when migration fails mid-execution?  
**Current spec:** "If migration fails: Transaction rolls back; Workspace remains on old
schema_version"

**Ambiguity:** What is "partial failure" and how do we resume?

**Clarification Question:**

Scenario: Migration 003 has multiple SQL statements:

```sql
-- Migration: 1.2.0
CREATE TABLE new_table (...)  -- succeeds
ALTER TABLE existing ADD COLUMN x  -- succeeds
CREATE INDEX ON new_table(...)  -- FAILS (timeout)
UPDATE existing SET... -- never executed
```

When we replay this migration:

1. Does the entire script re-execute (including the CREATE TABLE that already succeeded)?
2. Or does system track per-statement progress and resume from statement 4?
3. Is the "idempotency" enforcement what allows safe re-execution of CREATE TABLE?
4. What if re-execution hits same timeout? Retry limit?

**Options provided:**

- A) Entire script re-runs; idempotency ensures no error on re-execution of already-done statements
- B) Per-statement tracking: Resume from failed statement; previous statements skipped
- C) Script-level retry with exponential backoff; after 3 failures, manual intervention
- D) Other (specify)

---

### Q2.4: Idempotency of Version Metadata Updates

**Topic:** Can version update itself be replayed?  
**Current spec:** "Version metadata updates (idempotent SET operations)"

**Ambiguity:** What exactly are these "idempotent SET operations"?

**Clarification Question:**

After successful migration, we execute:

```sql
UPDATE tenant_db.schema_version SET version = '1.2.0';
UPDATE master_db.tenants_registry SET schema_version = '1.2.0';
```

1. Is the idempotency property: "Running these updates twice produces same end state"? (Answer: Yes,
   obviously – SET is idempotent)
2. Or is the question: "If we replay the entire upgrade job twice, does migration_registry prevent
   running migrations twice"?
3. Is there also a UNIQUE constraint preventing duplicate (workspace_id, "1.2.0") entries in
   migration_registry?
4. Can we replay the version update without replaying the migrations?

**Options provided:**

- A) Version updates are trivially idempotent (SET); primary idempotency is
  migration_registry.UNIQUE constraint
- B) Version updates + migration_registry unique constraint together provide idempotency
- C) Version updates are intentionally non-idempotent in certain cases (e.g., product_version
  transitions)
- D) Other (specify)

---

### Q2.5: Snapshot Idempotency

**Topic:** Can snapshot operations be safely replayed?  
**Current spec:** "Snapshot creation (re-run-safe, keyed by migration_id)"

**Ambiguity:** What happens if we create two snapshots for the same migration?

**Clarification Question:**

1. If we attempt to create a snapshot but storage is full, snapshot fails. When we retry the
   upgrade:
   - A) New snapshot is created (old failed snapshot attempt ignored)?
   - B) System detects failed snapshot in upgrade_snapshots table and retries?
   - C) System refuses upgrade until operator manually deletes failed snapshot?
2. Are snapshot records immutable once created, or can they be updated?
3. If two concurrent upgrade attempts both try to create snapshots, what prevents two snapshot
   records in upgrade_snapshots?
4. Is there a backup/dedup strategy to prevent duplicate snapshots if upgrades are retried?

**Options provided:**

- A) Each upgrade attempt creates new snapshot record; old unconsumed snapshots deleted
  automatically
- B) Snapshots deduplicated by (workspace_id, previous_schema_version); retry reuses existing
  snapshot
- C) Snapshots keyed by (workspace_id, target_schema_version, migration_file_hash); prevents
  duplicates
- D) Other (specify)

---

## 3. CONCURRENCY (5 Questions)

### Q3.1: Write Lock Granularity

**Topic:** What exactly does "workspace write lock" protect?  
**Current spec:** "Acquire workspace write lock; Locks during upgrade to prevent concurrent writes"

**Ambiguity:** Does lock apply to all writes, or only schema-related writes?

**Clarification Question:**

When workspace is locked during migration:

1. Are **user data writes** (student attempts, exam submissions) blocked, or only schema operations?
2. If user data writes are blocked, what error do they receive? (429 Too Many Requests? 423
   Conflict?)
3. What is the scope: Migration only, or entire upgrade operation (including snapshot)?
4. Can **reads** happen during the lock, or is it a full read-write lock?
5. Can background jobs (scoring, notifications) execute during lock, or are they suspended?

**Options provided:**

- A) Write lock applies to all database operations (reads + writes blocked)
- B) Write lock applies to writes only; reads allowed; background jobs suspended
- C) Write lock applies to schema operations only; user data writes continue
- D) Other (specify)

---

### Q3.2: Lock Acquisition Failure

**Topic:** What happens if lock cannot be acquired?  
**Current spec:** No specification for lock acquisition failure mode

**Ambiguity:** Timeout and retry behavior not defined.

**Clarification Question:**

If workspace is upgrading and admin clicks upgrade again:

1. Does system:
   - A) Immediately reject: "Upgrade in progress, try later"?
   - B) Queue the request and wait for lock (blocking)?
   - C) Wait with timeout (e.g., 60 seconds), then fail?
   - D) Other?

2. What HTTP status code if lock timeout? (504 Gateway Timeout? 409 Conflict? 429 Too Many
   Requests?)
3. Is there a max queue size? (If 100 requests waiting, does 101st get rejected?)
4. What is admin's experience if they wait? Do they get status/ETA?

**Options provided:**

- A) Immediate rejection: 409 Conflict "Upgrade in progress"
- B) Queued with timeout: Wait up to 60s; if timeout, return 504
- C) Queued indefinitely: First-in-first-out (FIFO) queue
- D) Other (specify)

---

### Q3.3: Concurrent Snapshots for Same Workspace

**Topic:** Can multiple snapshots be created simultaneously?  
**Current spec:** "Full database snapshot required; Snapshot ID persisted"

**Ambiguity:** No concurrency control specified for snapshot creation.

**Clarification Question:**

If two upgrade requests both create snapshots concurrently:

1. Does the write lock prevent concurrent snapshot creation, or is snapshot creation outside the
   lock?
2. Can snapshot operations happen in parallel across different workspaces?
3. Is there a rate limit on snapshot creation (e.g., max snapshots per hour)?
4. Does snapshot storage have a queue/serial constraint?
5. If snapshots are created in parallel and storage fills up mid-way: Can we handle partial failure
   gracefully?

**Options provided:**

- A) Snapshot creation is inside the write lock (serialized per workspace, no parallel snapshots)
- B) Snapshot creation is outside the write lock (parallel snapshots possible; must handle race
  conditions)
- C) Snapshots are created async after migration succeeds (never parallel with migrations)
- D) Other (specify)

---

### Q3.4: Master Migrations and Tenant Access

**Topic:** Can tenant requests proceed while master migrations are running?  
**Current spec:** "Master DB migrations applied on deployment; Executed before application startup"

**Ambiguity:** Is there an uptime window where platform is locked during master migrations?

**Clarification Question:**

During platform deployment:

1. Master migrations run **before** app startup. So:
   - A) App is fully down until master migrations complete?
   - B) App can start while master migrations run (if master DB operations don't block app boot)?

2. If master migration updates `minimum_supported_schema_version` to a new value:
   - When do tenant requests see the new value?
   - Is there a cache invalidation delay?
   - Can old and new apps coexist briefly during rolling deployment?

3. If master migration fails:
   - App refuses to boot (per spec)
   - But what if app already partially started? (Race condition between migration and startup)

**Options provided:**

- A) Master migrations block app startup entirely; no requests processed until master complete
- B) Master migrations run in parallel with app startup; app uses old platform_settings until
  migrations complete
- C) Master migrations are pre-flight check; app refuses to boot if any migration fails
- D) Other (specify)

---

### Q3.5: Concurrent Version Reads from Cache vs. Truth

**Topic:** Cache coherency between master_db and tenant_db versions  
**Current spec:** "Source of truth remains tenant_db.schema_version; Cache in
master_db.tenants_registry"

**Ambiguity:** What happens if cache diverges from truth during concurrent operations?

**Clarification Question:**

Scenario:

1. Request 1 acquires lock, begins migration, updates tenant_db.schema_version = 2.0.0
2. Request 2 (different process) reads master_db.tenants_registry.schema_version = 1.0.0 (still old)
3. Request 2 makes decision based on cache

4. Is cache divergence acceptable (eventual consistency)?
5. Or must cache be updated atomically with truth?
6. If cache divergence happens:
   - A) Resolver detects and refreshes from truth?
   - B) Resolver uses cache knowing it's stale?
   - C) Resolver uses TTL-based cache invalidation?
7. What TTL? (1 second? 5 minutes? Forever until invalidation signal?)

**Options provided:**

- A) Eventual consistency acceptable; cache may lag by seconds/minutes
- B) Atomic dual-write: Both tables updated in same transaction
- C) Cache-aside pattern: Resolver reads truth on every request, doesn't use cache
- D) Other (specify)

---

## 4. VERSION ENFORCEMENT (3 Questions)

### Q4.1: Version Comparison Logic for Non-SemVer Versions

**Topic:** How is version comparison done?  
**Current spec:** "Schema version must follow SemVer: MAJOR.MINOR.PATCH"

**Ambiguity:** What if version string is malformed?

**Clarification Question:**

1. If tenant_db.schema_version contains "1.2" (missing PATCH):
   - A) Is this treated as 1.2.0 (implicit zero)?
   - B) Comparison fails with error?
   - C) Schema validation at write time prevents this?

2. If platform_settings.minimum_supported_schema_version = "2.0.0-rc1" (prerelease):
   - A) How does "1.5.0" compare to "2.0.0-rc1"?
   - B) Is prerelease version supported or forbidden?
   - C) Are prerelease versions allowed only in development?

3. What if minimum_supported jumps from 1.0.0 to 3.0.0 (skip 2.0.0)?
   - A) All workspaces on 1.x suddenly blocked (forced upgrade)?
   - B) Is this a valid deployment scenario or error?
   - C) Are there guardrails to prevent large version jumps?

**Options provided:**

- A) SemVer strictly enforced; malformed versions rejected at write time
- B) Lenient parsing: Convert "1.2" to "1.2.0"; strip prerelease tags; normalize
- C) Version comparison uses numeric tuple (MAJOR, MINOR, PATCH) parsed from strings
- D) Other (specify)

---

### Q4.2: Minimum Supported Version Enforcement During Upgrade

**Topic:** Can workspace upgrade to a version below current minimum?  
**Current spec:** "Validate: tenant.schema_version ≥ minimum_supported_schema_version"

**Ambiguity:** When is this check performed during upgrade?

**Clarification Question:**

Scenario: Platform released; minimum_supported is 2.0.0. Workspace is on 1.5.0. Admin tries to
upgrade to 1.8.0.

1. Should migration runner:
   - A) Reject upgrade because target (1.8.0) < minimum_supported (2.0.0)?
   - B) Allow upgrade to 1.8.0 even though it's below minimum?
   - C) Force upgrade to minimum_supported (2.0.0) instead of requested (1.8.0)?

2. Or does "minimum_supported" only block runtime requests, not upgrades?
3. Can workspace choose to "skip" upgrade steps and jump directly to minimum_supported?

**Options provided:**

- A) Upgrade target must be ≥ minimum_supported; otherwise reject upgrade request
- B) Upgrade allowed to any version; minimum_supported only enforced at runtime
- C) Upgrade allowed; but if target < minimum_supported, force-advance to minimum_supported
- D) Other (specify)

---

### Q4.3: Product Version Compatibility with Schema Version

**Topic:** Relationship between product version and schema version  
**Current spec:** "Product version and schema version are independent but validated together at
runtime"

**Ambiguity:** How are they "validated together"?

**Clarification Question:**

Migration file header says:

```
Required Minimum Product Version: 1.5.0
```

Scenario: Workspace attempts upgrade, but their license.product_version = 1.0.0 (< 1.5.0).

1. Should migration:
   - A) Proceed anyway (ignore product version requirement)?
   - B) Blocked by validation before execution?
   - C) Allowed but post-migration validation fails?

2. Who enforces this check? (Resolver? Migration runner? License middleware?)
3. Who updates product_version after migration? (Platform operator? Auto-update based on migration?)
4. Can product_version be updated without schema version change?
5. Can schema_version increment without product_version change?

**Options provided:**

- A) Independent: Schema upgrades regardless of product version; checked separately
- B) Coupled: Product version auto-bumped when schema increments if required
- C) Pre-flight: Migration runner validates product_version before executing migration
- D) Other (specify)

---

## 5. MIDDLEWARE ENFORCEMENT (2 Questions)

### Q5.1: License Middleware Timing

**Topic:** When is license validation executed?  
**Current spec:** "Validates license ACTIVE; Validates compatibility preconditions; Takes full DB
snapshot; Locks workspace"

**Ambiguity:** Is license check part of middleware chain, or migration runner?

**Clarification Question:**

For upgrade requests to `/api/mmc/workspace/{id}/upgrade`:

1. Is license validated:
   - A) In HTTP middleware (before route handler)?
   - B) In route handler before queuing worker job?
   - C) In worker before executing migration?

2. If license is validated in middleware and returns 423, is workspace still locked?
3. If license is VALID at time of upload request but becomes SOFT_LOCKED before worker processes it:
   - A) Worker should detect and skip migration?
   - B) Worker should execute anyway?
   - C) Worker should fail and rollback snapshot?

4. Is there a license "grace period"? (License expires tomorrow; can still upgrade today?)

**Options provided:**

- A) License validated in HTTP middleware; if fail, reject before worker queued
- B) License validated in worker; if fail, no snapshot created, migration skipped
- C) License validated twice: Middleware + Worker (belt and suspenders)
- D) Other (specify)

---

### Q5.2: Resolver Middleware Cache Invalidation

**Topic:** When does resolver reload version compatibility data?  
**Current spec:** "Resolver validat­es on every workspace-bound request"

**Ambiguity:** If master_db.platform_settings is updated, when do all resolvers see it?

**Clarification Question:**

Scenario: Platform operator updates `minimum_supported_schema_version` from 1.0.0 to 2.0.0.

1. Does every running instance of resolver:
   - A) See it immediately (no caching)?
   - B) See it after TTL expiration (e.g., 5-minute cache)?
   - C) See it after service restart?

2. If cached and TTL is 5 minutes:
   - Requests in [0, 5min]: Use old minimum (1.0.0)
   - Requests in [5min, ∞]: Use new minimum (2.0.0)
   - Is this eventual consistency acceptable?

3. Is there an invalidation signal (pubsub) to flush cache immediately?
4. What if resolver crashes while holding cached data? Is cache persisted or lost?

**Options provided:**

- A) No cache; fetch from master_db on every request (latency risk)
- B) In-memory cache with TTL (5 minutes default; configurable)
- C) In-memory cache with invalidation signal (pubsub for instant updates)
- D) Other (specify)

---

## 6. SECURITY VALIDATION (1 Question)

### Q6.1: Migration File Content Validation

**Topic:** What validates migration file content before execution?  
**Current spec:** "Forbidden operations: DROP COLUMN, ALTER TABLE DROP COLUMN, ...Idempotency
requirement: All DDL must be idempotent"

**Ambiguity:** Who enforces these rules and when?

**Clarification Question:**

Migration file submitted contains:

```sql
-- Migration: 2.0.0
DROP COLUMN users.deprecated_field;
```

1. Is this caught:
   - A) At migration commit time (pre-deployment review)?
   - B) At runtime before execution (SQL parser)?
   - C) Not caught (runtime error if executed)?
   - D) Other?

2. Who has authority to override rules? (Platform operator? Architecture review?)
3. Are there whitelisted exceptions? (Some operators can DROP COLUMN, others can't?)
4. Is checksum validated against file content, or only hash of parsed SQL?
5. Can checksums be tampered with, or are they signed/verified?

**Options provided:**

- A) Pre-deployment review: Human reviews SQL before merge (enforcement via process)
- B) Parser validation: Automated SQL parser rejects DROP COLUMN before execution
- C) Signed migrations: Checksum verified cryptographically; prevents tampering
- D) Other (specify)

---

## 7. ERROR CONTRACT (3 Questions)

### Q7.1: Undefined Error Codes

**Topic:** What error codes are returned for different failures?  
**Current spec:** Includes SCHEMA_VERSION_MISMATCH for 426; but many failure modes not mapped to
error codes

**Ambiguity:** What error code for migration syntax error? Snapshot creation failure? Lock timeout?

**Clarification Question:**

Define error codes for:

1. Migration file syntax error
2. Snapshot creation failure (disk full)
3. License invalid at upgrade time
4. Workspace locked (upgrade in progress)
5. Checksum mismatch (file tampered)
6. Missing migration file (gap in sequence)
7. Database connection failure
8. Timeout during migration execution
9. Post-migration validation failure
10. Rollback failure (snapshot restore failed)

**For each, provide:**

- HTTP status code (4xx client error? 5xx server error?)
- Error code (e.g., MIGRATION_SYNTAX_ERROR)
- Message template

---

### Q7.2: Error Response Structure for Async Operations

**Topic:** Error format for worker-executed migrations  
**Current spec:** "Worker executes migration asynchronously" but error response structure not
specified

**Ambiguity:** How do async errors get reported to client?

**Clarification Question:**

Admin triggers upgrade `/api/mmc/workspace/{id}/upgrade` (returns immediately):

```json
{
  "success": true,
  "data": { "job_id": "123" }
}
```

Later, migration fails in worker. How does admin get error?

1. Polling `/api/mmc/job/{123}` returns:
   - A) Includes error in response?
   - B) Just status, error logged separately?

2. Is there a webhook/callback to notify on completion?
3. Is there a notification sent (email, dashboard alert)?
4. What is error structure in polling response? Same format as sync errors?

**Options provided:**

- A) Polling endpoint returns full error details including error code + message
- B) Polling returns status only; errors queried separately via `/api/errors/{job_id}`
- C) Webhook callback sent to registered endpoint with full error
- D) Other (specify)

---

### Q7.3: Partial Success / Partial Failure Reporting

**Topic:** Reporting for multi-step operations  
**Current spec:** "All migrations in single transaction; Failure blocks platform boot; Full rollback
on any migration failure"

**Ambiguity:** How is partial success communicated?

**Clarification Question:**

Scenario: Platform deployment runs 5 master migrations. Migration 3 of 5 fails.

Error report should include:

1. Which migrations succeeded? (1, 2 listed?)
2. Which failed? (3 listed with error)
3. Which were not attempted? (4, 5 listed?)
4. Is there a detailed breakdown or just summary?

For tenant upgrades: If migration 4 of 4 fails mid-execution:

1. Should error list include intermediate state (e.g., "Created 3 new tables before failing on index
   creation")?
2. Or just "Migration failed, rolled back to previous state"?
3. Is there a detailed SQL error message included, or redacted for security?

**Options provided:**

- A) Detailed breakdown: List success, failures, skipped; include SQL error messages
- B) Summary only: "X of Y migrations applied; last error: [message]"
- C) Minimal: "Upgrade failed; contact support" (errors only in logs)
- D) Other (specify)

---

## 8. ISOLATION BOUNDARIES (2 Questions)

### Q8.1: Cross-Tenant Data in Migration Registry

**Topic:** Can workspace A read migration history of workspace B?  
**Current spec:** "migration_registry tracks all applied migrations" stored in master_db across all
workspaces

**Ambiguity:** No access control specified.

**Clarification Question:**

1. Who can query `master_db.migration_registry` for a given workspace?
   - A) Only that workspace admin?
   - B) Platform operator only?
   - C) All authenticated users in platform?

2. Should API endpoint `/api/mmc/workspace/{id}/migration-history` be:
   - A) Blocked for unauth'd workspaces?
   - B) Show only current workspace?
   - C) Cross-tenant readable (for administrative visibility)?

3. Can MMC (platform control layer) expose migration_registry in UI?
   - A) Yes, for debugging?
   - B) No, cross-tenant data leak?
   - C) Yes, but redacted (schemas only, no operator IDs)?

**Options provided:**

- A) Tenant-scoped access: Each workspace sees only own migration history
- B) Operator-only access: Only platform operators see full migration_registry
- C) Public access: All authenticated users can view migration history (for auditability)
- D) Other (specify)

---

### Q8.2: Snapshot Restoration Cross-Tenant Risk

**Topic:** Can operator restore snapshot of workspace A into workspace B?  
**Current spec:** "Snapshot keyed by workspace_id; Rollback must restore previous schema_version"

**Ambiguity:** Are there safeguards preventing cross-tenant restore?

**Clarification Question:**

Operator has API with snapshot metadata:

```json
{
  "snapshot_id": "snap-123",
  "workspace_id": "workspace-A",
  "snapshot_location": "s3://backups/snap-123.sql.gz"
}
```

1. Can operator call restore operation on workspace B with snapshot from workspace A?
2. What prevents this?
   - A) API validates workspace_id matches (before restore)?
   - B) Restore runs blind (workspace_id not checked)?
   - C) Schema validation fails post-restore?

3. If restored into wrong workspace:
   - A) Data corruption in workspace B?
   - B) Transaction detects mismatch and aborts?
   - C) Schema IDs embedded in snapshot prevent wrong restore?

4. Should this be:
   - A) Impossible (API prevents cross-workspace restore)?
   - B) Possible but risky (requires operator to be careful)?
   - C) Other?

**Options provided:**

- A) Strict: API validates workspace_id; rejects cross-workspace restore
- B) Permissive: Restore proceeds; operator responsible for validation
- C) Constraints-based: Schema content validates workspace_id; wrong restore detected
- D) Other (specify)

---

## Summary Matrix

| Area                       | # Questions | Coverage       |
| -------------------------- | ----------- | -------------- |
| **Transactions**           | 6           | Q1.1 – Q1.6    |
| **Idempotency**            | 5           | Q2.1 – Q2.5    |
| **Concurrency**            | 5           | Q3.1 – Q3.5    |
| **Version Enforcement**    | 3           | Q4.1 – Q4.3    |
| **Middleware Enforcement** | 2           | Q5.1 – Q5.2    |
| **Security Validation**    | 1           | Q6.1           |
| **Error Contract**         | 3           | Q7.1 – Q7.3    |
| **Isolation Boundaries**   | 2           | Q8.1 – Q8.2    |
| **TOTAL**                  | **24**      | Complete audit |

---

## Next Steps

1. **Stakeholders review** these 24 clarification questions
2. **Provide answers** using provided options or specify alternatives
3. **Update specification** with clarified decisions
4. **Re-audit** if needed after updates
5. **Proceed to planning** once all ambiguities resolved

---

END CLARIFICATION AUDIT
