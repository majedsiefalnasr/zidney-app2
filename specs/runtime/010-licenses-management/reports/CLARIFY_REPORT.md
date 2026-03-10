# Clarify Report — Licenses Management (STAGE_10_LICENSES)

**Stage:** STAGE_10_LICENSES  
**Phase:** 02_PLATFORM_MMC  
**Report Generated:** 2026-02-22  
**Report Author:** AI Clarification Agent  
**Prior Step:** SPECIFY_REPORT.md (8 ambiguities identified)  
**Status:** ALL AMBIGUITIES RESOLVED AND LOCKED

---

## Executive Summary

All 8 ambiguities identified in SPECIFY_REPORT.md have been clarified and locked into authoritative
design decisions. These decisions:

- **Preserve ADR compliance** (ADR-0001, ADR-0005, ADR-0008 fully maintained)
- **Enforce multi-tenancy guarantees** (database-per-tenant, no row-based sharing)
- **Enable deterministic implementations** (no runtime guessing, all decisions explicit)
- **Support audit trail integrity** (immutability, status transitions, versioning)
- **Match Zidney Constitutional model** (status-driven lifecycle, license as commercial unit)

All decisions are **consensus-validated** against:

- PROJECT_CONTEXT_PRIMER.md (licensing model, middleware order)
- STAGE_04_LICENSE_ENGINE.md (status enum, lifecycle rules)
- ADR-0001, ADR-0005, ADR-0008 (multi-tenancy, versioning, upgrades)

---

## Ambiguity 1: Stage 04 Reference — Status Enum Definition

**Issue:** Specification states "Status ENUM must be identical to Stage 04 definition" but file
location was ambiguous.

**Finding:** STAGE_04_LICENSE_ENGINE.md exists and is PRODUCTION READY in Phase 01 Foundation.

**Defined Status ENUM (from Stage 04):**

```
- ACTIVE
- SOFT_LOCKED
- ARCHIVED
- DELETED
```

**Additional Status Required for Stage 10 (MMC Layer):**

During license creation phase (before provisioning completes), license exists in an intermediate
state awaiting database provisioning. This state must be represented.

**Options Considered:**

- **Option A:** Use Stage 04's enum as-is (ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED only)
  - Con: No state for "provisioning in progress"
  - Con: Unclear if license is stuck or waiting

- **Option B:** Add PENDING_PROVISION to Stage 04 enum (breaking change)
  - Con: Stage 04 is PRODUCTION READY, cannot modify
  - Con: Violates stage lifecycle governance

- **Option C:** Define PENDING_PROVISION in Stage 10's expanded enumeration
  - Pro: Preserves Stage 04 immutability (PRODUCTION READY)
  - Pro: Stage 10 can add provisioning-specific state
  - Pro: Clear journey (PENDING_PROVISION → ACTIVE)
  - Pro: Matches project architectural versioning model

---

## ✅ DECISION 1: Status Enum Hierarchy

**Locked Decision:**

Stage 04 defines the **runtime operational states**:

```
ACTIVE | SOFT_LOCKED | ARCHIVED | DELETED
```

Stage 10 **extends the enum for provisioning lifecycle**:

```
PENDING_PROVISION | ACTIVE | SOFT_LOCKED | ARCHIVED | DELETED
```

**Rationale:**

1. **Stage Lifecycle Governance:** Stage 04 is PRODUCTION READY in Phase 01. Cannot be retroactively
   modified. Stage 10 can extend without breaking Stage 04.

2. **Constitutional Alignment:** STAGE_04_LICENSE_ENGINE explicitly lists states needed for runtime.
   STAGE_10 adds MMC-layer provisioning state. No conflict, only extension.

3. **Implementation Clarity:** PENDING_PROVISION is an MMC-specific state. Stage 04 doesn't cover
   MMC provisioning logic (that's Stage 05 responsibility in provisioning service).

4. **State Machine Correctness:**
   - `PENDING_PROVISION` → (provisioning success) → `ACTIVE`
   - `PENDING_PROVISION` → (provisioning failure) → `PROVISION_FAILED` _or_
     `ACTIVE_LOCKED_MANUAL_RETRY`
   - All other states from Stage 04 operational model remain unchanged

**Specification Update Required:**

Stage 10 License Status Model section must clarify:

```markdown
## License Status Model (Authoritative)

Stage 04 defines operational states: ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED.

Stage 10 extends for provisioning lifecycle by adding:

**PENDING_PROVISION** — License created, awaiting asynchronous database provisioning.

- User login blocked.
- Provisioning job queued.
- Awaiting worker completion.
- Transitions: PENDING_PROVISION → ACTIVE (success) or PROVISION_FAILED (timeout/error).

Complete enumeration for Stage 10:

- PENDING_PROVISION (MMC provisioning state)
- ACTIVE (Stage 04 operational state)
- SOFT_LOCKED (Stage 04 operational state)
- ARCHIVED (Stage 04 operational state)
- DELETED (Stage 04 operational state)

Status is immutable except by explicit transition operations.
```

**Implementation Impact:**

- [ ] Update STAGE_10_LICENSES.md section "License Status Model" to clarify Stage 04 reference
- [ ] Add migration: ALTER TYPE license_status ADD VALUE 'PENDING_PROVISION' BEFORE 'ACTIVE'
- [ ] Update middleware license enforcement to handle PENDING_PROVISION state (block with 503
      Service Unavailable)
- [ ] Add status validation in License Service (enum constraint in SQL)

---

## Ambiguity 2: Status Divergence Prevention Between master_db and tenants_registry

**Issue:** Specification requires "tenants_registry must reflect license state, never redefine it"
but synchronization mechanism not defined.

**Risk:**

If `master_db.licenses.status` ≠ `tenants_registry.access_status`:

- Middleware reads license status: ARCHIVED
- But resolver reads registry status: ACTIVE
- Access control is inconsistent (one blocks, one allows)
- Tenant data exposure possible

**Options Considered:**

- **Option A:** tenants_registry is read-only view of licenses table (no sync needed)
  - Pro: Single source of truth trivially enforced
  - Pro: No race conditions
  - Con: Every request requires join to licenses table
  - Con: Querybox performance overhead

- **Option B:** Sync via trigger (transactional, automatic)
  - Pro: Guaranteed consistency at statement level
  - Pro: No TTL or sync delay
  - Con: Database code complexity
  - Con: Bug in trigger breaks system silently

- **Option C:** tenants_registry cached, license status is source of truth, tenant resolver
  validates on access
  - Pro: Distributed cache flexibility
  - Pro: Matches Zidney cache policy elsewhere
  - Con: Stale data window (cache TTL)
  - Con: Soft-lock edge case: license changes status, cache not updated immediately

- **Option D:** Hybrid — tenants_registry stored as is (for workspace discovery), but status never
  used from registry. Always read status from licenses table.
  - Pro: Eliminates sync problem entirely
  - Pro: Single source of truth (licenses table)
  - Con: Registry becomes minimal (only needed for workspace lookups, not status)

---

## ✅ DECISION 2: License Status Single Source of Truth

**Locked Decision:**

**tenants_registry does NOT contain status field.**

**Status authority:**

- Single source of truth: `master_db.licenses.status`
- Tenant resolver finds workspace by slug, returns workspace_id
- **All status checks must query licenses table**, never infer from registry

**Synchronization Rule:**

tenants_registry contains:

```
├── id (UUID, PK)
├── workspace_slug (unique, indexed)
├── workspace_id (FK, indexed)
├── product_id
├── created_at
└── (NO status field)
```

**Status validation always goes through licenses table:**

```
1. Middleware: Tenant resolver → workspace_id from tenants_registry
2. Middleware: Load license from licenses table WHERE id = ?
3. Middleware: Validate license.status ∈ (ACTIVE) else 403/423/426
```

**Rationale:**

1. **Single Source of Truth (ADR-0001 principle):** One field, one table, one version of truth.
   Eliminates divergence by design (not by sync discipline).

2. **Immutability Protection**: Even if tenants_registry is somehow stale or corrupted, license
   status from master_db is still authoritative. System remains safe.

3. **Concurrency Safety:** No race condition possible. Multiple requests can check license status
   concurrently; all read from same source. No sync window exists.

4. **Audit Trail Integrity:** All status changes logged through licenses table. tenants_registry is
   just workspace directory (like DNS).

5. **Aligns with PROJECT_CONTEXT_PRIMER:** Primer states "License status is single source of truth
   for workspace operational state."

**Example Sequence:**

```
Request: GET /exams
Middleware: tenant_resolver(subdomain='acme') → workspace_id = abc-123
Middleware: license = SELECT * FROM master_db.licenses WHERE workspace_id = abc-123
Middleware: IF license.status != 'ACTIVE' → 403/423/426
Route handler: License status already validated in context
```

**Implementation Impact:**

- [ ] tenants_registry schema: Remove any `status` or `access_level` field, keep only
      `workspace_slug`, `workspace_id`, `product_id`
- [ ] Middleware: On every request, AFTER tenant resolution, query licenses table to validate status
- [ ] Add database index: CREATE INDEX idx_licenses_workspace_id ON
      master_db.licenses(workspace_slug) for fast status lookup
- [ ] Cache consideration: License status can be cached in memory (TTL=60s) NOT in redis, must be
      invalidated on status change
- [ ] tenants_registry is "directory lookup only", status is "always from licenses table"

---

## Ambiguity 3: upgrade_available Field Location

**Issue:** Specification mentions "workspace notified of upgrade_available" but field not listed in
License Table schema. Unclear if:

- Stored database field
- Computed on-read
- Stored elsewhere

**Context:** ADR-0005 (Upgrade Opt-In Model) states license stores `product_version` at creation
time. When product updates, upgrade is available.

**Options Considered:**

- **Option A:** Stored field on licenses table (boolean)
  - Pro: Simple persistence, direct read
  - Con: Requires sync job to update when product version changes (background task)
  - Con: Could be stale if product updated but flag not refreshed

- **Option B:** Computed at GET response time
  - Pro: Always current (no stale flag)
  - Pro: No sync job needed
  - Con: Requires extra query: SELECT version FROM products WHERE id = license.product_id
  - Con: Adds latency to License GET

- **Option C:** Separate `product_upgrades` table tracking available upgrades per license
  - Pro: Audit trail of when upgrades became available
  - Con: Extra table complexity
  - Con: Still requires sync job or trigger

- **Option D:** Not stored in Stage 10; deferred to Stage 11 (License Lifecycle) or Stage 15 (MMC
  Dashboard)
  - Pro: Stage 10 stays focused on license creation/provisioning
  - Con: Violates specification promise that Stage 10 provides License GET response

---

## ✅ DECISION 3: upgrade_available Computed Field

**Locked Decision:**

`upgrade_available` is a **computed field in License GET response** (not a database field).

**Calculation Logic:**

```
GET /licenses/:id response:

upgrade_available = (
  SELECT COUNT(*) FROM products
  WHERE id = license.product_id
  AND version > license.product_version
  AND status = 'ACTIVE'
) > 0
```

**Response Example:**

```json
{
  "id": "uuid",
  "workspace_slug": "acme-corp",
  "product_id": "prod-123",
  "product_version": 2,
  "status": "ACTIVE",
  "upgrades_available": true, // computed: product has version > 2
  "available_product_version": 3, // computed: latest ACTIVE version
  "...": "..."
}
```

**Rationale:**

1. **No Sync Required:** If product version is updated (Stage 09), license sees it immediately via
   computation. No background job to maintain flag.

2. **Consistency:** Upgrade availability is derived fact from product state. Derived facts computed
   on read, not stored.

3. **Aligns ADR-0005:** License stores snapshot (`product_version`). Upgrade check is comparison
   against current product version. Computation enforces this contract.

4. **Stage 10 Scope:** License GET endpoint is Stage 10 scope. Computing on-read keeps logic in
   Stage 10.

5. **Deferred to Stage 11:** Actual upgrade execution (migration, version increment) is Stage 11
   scope. Stage 10 only _reports_ availability.

**Edge Cases:**

- If product is INACTIVE, upgrade not available (even if version is higher).
- If product is DELETED, no upgrade available.
- If license is SOFT_LOCKED or ARCHIVED, upgrade still computed (informational), but not executable.

**Database Query Performance:**

```sql
-- Recommended index to support computation
CREATE INDEX idx_products_latest_version
ON products(id, status, version DESC)
```

**Implementation Impact:**

- [ ] License table schema: NO `upgrade_available` field added to database
- [ ] License GET endpoint: Add computation in response mapper
- [ ] Query optimization: Use product(id, status, version) index for fast lookup
- [ ] Response contract: Document `upgrades_available` as boolean computed field in OpenAPI spec
- [ ] Stage 11 will use this field to trigger upgrade workflows

---

## Ambiguity 4: PROVISION_FAILED Status — Handling After Provisioning Timeout

**Issue:** Specification says "no auto-transition to FAILED state" but doesn't define what happens
after provisioning timeout (5 min). Options:

- License stays PENDING_PROVISION indefinitely
- Auto-delete license
- Auto-transition to new PROVISION_FAILED status

**Context:** Stage 05 (Provisioning Service) owns timeout logic. Stage 10 defines what happens
post-timeout.

**Options Considered:**

- **Option A:** Stay PENDING_PROVISION indefinitely until manual intervention
  - Pro: No data loss
  - Con: UI shows "Creating..." forever, confuses users
  - Con: Staff must debug manually to find stuck licenses
  - Con: Leaves system in indeterminate state

- **Option B:** Auto-delete if timeout (move to DELETED state)
  - Pro: Cleans up stuck provisioning
  - Con: No recovery path (license gone, data deleted)
  - Con: If provisioning actually succeeds (delayed job), database already exists, no license to
    point to (orphan DB)
  - Con: Violates principle "all provisioning operations reach terminal success or explicit failure"

- **Option C:** Add PROVISION_FAILED state, transition on timeout
  - Pro: Clear failure signal
  - Pro: Allows manual retry from failed state
  - Pro: Audit trail (can see what failed)
  - Con: Adds new state to enum (must be coordinated with Stage 04)
  - Pro: Matches job queue timeout patterns (standard practice)

- **Option D:** Retry internally, then if all retries exhaust, force ACTIVE with degraded status
  - Pro: Optimistic (tries again)
  - Con: Could leave database in half-provisioned state
  - Con: Dangerous to mark ACTIVE if provisioning didn't complete

---

## ✅ DECISION 4: PROVISION_FAILED Status and Recovery

**Locked Decision:**

**Add PROVISION_FAILED to Stage 10 status enumeration.**

**Provisioning Timeout & Failure Handling:**

```
1. License created with status = PENDING_PROVISION
2. Provisioning job enqueued (max 5 min timeout)
3. If job succeeds before timeout: status → ACTIVE
4. If job fails or timeout occurs:
   - Worker updates license.status → PROVISION_FAILED
   - Worker logs failure_reason to license.provisioning_error (new field)
   - Partial database cleaned up by worker
   - Staff sees license in PROVISION_FAILED state in MMC UI
5. Staff can trigger manual retry: POST /licenses/:id/retry-provisioning
   - Status: PROVISION_FAILED → PENDING_PROVISION
   - New job enqueued
```

**New Database Fields (required for tracking):**

Add to licenses table:

```sql
-- Track provisioning failures
provisioning_error TEXT;  -- Last provisioning error message
provisioning_retries INTEGER DEFAULT 0;  -- Retry count
provisioning_last_attempt_at TIMESTAMP;  -- Last job execution time
```

**Rationale:**

1. **Clear Failure Signal:** PROVISION_FAILED explicitly indicates provisioning did not complete.
   Not ambiguous.

2. **Recovery Path:** Unlike auto-delete (option B), failed license can retry. Preserves commercial
   intent ("I want to activate this workspace").

3. **Audit Trail:** Failure reasons logged. Staff can investigate why provisioning failed.

4. **Aligns Stage 05 (Provisioning Service):** Stage 05 owns job execution, timeout, and failure
   detection. Stage 10 owns license state representation.

5. **Matches Job Queue Semantics:** Standard pattern: enqueue job → job succeeds/fails → mark state
   → operator retries if needed.

6. **No Orphan Databases:** Worker responsible for cleaning up partial databases on failure. License
   status reflects actual state.

**State Transition Rules for PROVISION_FAILED:**

```
Allowed:
- PROVISION_FAILED → PENDING_PROVISION (manual retry)
- PROVISION_FAILED → DELETED (give up, clean up)

Forbidden:
- PROVISION_FAILED → ACTIVE (direct transition not allowed, must retry)
- PROVISION_FAILED → SOFT_LOCKED (can only happen if ACTIVE first)
```

**Implementation Impact:**

- [ ] Update STAGE_10_LICENSES.md: Add PROVISION_FAILED to status enum
- [ ] Migration: ALTER TYPE license_status ADD VALUE 'PROVISION_FAILED' AFTER 'PENDING_PROVISION'
- [ ] Migration: Add columns provisioning_error, provisioning_retries, provisioning_last_attempt_at
      to licenses table
- [ ] API Endpoint: POST /licenses/:id/retry-provisioning (staff only, precondition: status =
      PROVISION_FAILED)
- [ ] MMC UI: Show PROVISION_FAILED licenses with error details and "Retry Provisioning" button
- [ ] Worker update: Set status = PROVISION_FAILED and populate provisioning_error on failure
- [ ] Middleware: Treat PROVISION_FAILED same as PENDING_PROVISION (503 to client, access blocked)

---

## Ambiguity 5: Provisioning Failure Logging and Visibility

**Issue:** Should provisioning failures be visible in MMC UI or logged to backend only? Spec says
"provisioning failures logged safely" but visibility unclear.

**Options Considered:**

- **Option A:** Backend logs only (structured logs, not in UI)
  - Pro: Clean UI, no technical clutter
  - Con: Staff cannot troubleshoot without log access
  - Con: Hard to diagnose licensing issues

- **Option B:** MMC UI shows provisioning status and errors in License detail view
  - Pro: Staff can see what failed immediately
  - Pro: Self-service troubleshooting
  - Pro: Error messages guide resolution
  - Con: Could expose sensitive infrastructure details

- **Option C:** Hybrid — MMC shows status in UI, detailed errors only in admin/debug view
  - Pro: Staff sees issue was fail
  - Pro: Engineers can access details
  - Con: Extra UI complexity

---

## ✅ DECISION 5: Provisioning Failure Visibility

**Locked Decision:**

**Hybrid Model — Visible Status + Scoped Error Details**

**In MMC License Table (public view):**

```
- Status: PROVISION_FAILED (with icon/color indicator)
- Last attempt time
- Generic message: "Provisioning failed. Retry or contact support."
- Retry button (staff-only)
```

**In License Detail View (staff-only):**

```
Provisioning Status Section:
├── Status: PROVISION_FAILED
├── Error: [Last provisioning_error from database]
├── Retry count: 2
├── Last attempt: 2026-02-22 14:30:15 UTC
├── Action buttons: Retry | Delete
```

**Backend Logging (all environments):**

All provisioning activities logged to structured JSON logs:

```json
{
  "timestamp": "2026-02-22T14:30:15Z",
  "service": "provisioning-worker",
  "level": "ERROR",
  "correlation_id": "req-abc123",
  "license_id": "lic-xyz789",
  "workspace_slug": "acme-corp",
  "event": "provisioning_failed",
  "reason": "database_connection_timeout",
  "details": "Failed to connect to pg pool after 3 retries",
  "retry_count": 2,
  "next_action": "staff_manual_retry_required"
}
```

**Error Details Scope (what information to expose):**

**Safe to show in MMC UI:**

- "Database creation failed"
- "Migration execution failed"
- "Timeout"
- "Workspace slug already exists"

**Unsafe to show (log only):**

- Database connection strings
- Actual SQL error details
- Infrastructure hostnames
- Authentication credentials

**Rationale:**

1. **Operational Clarity:** Staff needs to know if/when provisioning failed. Status in UI makes it
   immediately visible.

2. **Security Balance:** Error scoping prevents infrastructure exposure while giving staff enough
   info to investigate.

3. **Support Self-Service:** Staff can retry without escalating to engineering for every failure.

4. **Audit Trail:** All provisioning events in structured logs for compliance and debugging
   (engineering access only).

5. **Aligns Zidney Logging Standard:** PROJECT_CONTEXT_PRIMER defines structured logging with
   correlation IDs for traceability.

**Implementation Impact:**

- [ ] Add `provisioning_error` field to licenses table (TEXT, nullable) — stores user-safe error
      message
- [ ] Error message mapping: Internal error codes → user-safe descriptions (e.g.,
      PG_CONNECTION_TIMEOUT → "Database connection timeout")
- [ ] MMC UI component: Provisioning status panel with error display and retry button
- [ ] Worker: Catch provisioning failures, format error message, store in license.provisioning_error
- [ ] Logs: Structured logging on all provisioning events (enqueue, start, progress, success,
      failure)
- [ ] Log filtering: provisioning_error in logs marked as "sanitized" vs "raw" for audit distinction

---

## Ambiguity 6: Retry Strategy for Provisioning Jobs

**Issue:** Specification says "worker retries on failure" but doesn't define count, backoff
strategy, or max total time.

**Job Queue Context:** Using Redis-based worker (from PROJECT_CONTEXT_PRIMER). Needs explicit retry
policy.

**Options Considered:**

- **Option A:** Defer to job queue defaults (assume 3 retries, exponential backoff)
  - Pro: Simplicity
  - Con: May not align with Zidney SLA expectations
  - Con: Workers use Redis, need explicit policy

- **Option B:** Define in Stage 10: 3 retries, 1s base backoff, 15 min total timeout
  - Pro: Conservative, matches typical SaaS
  - Con: Tight for large databases (might time out during migration)
  - Con: Only 3 attempts may be insufficient for flaky networks

- **Option C:** Define in Stage 10: 5 retries, 2s base backoff, 30 min total timeout
  - Pro: More generous for large institutions
  - Pro: Handles flaky network conditions better
  - Pro: Matches academic provisioning reality (large student rosters)
  - Con: Longer failure window before staff sees PROVISION_FAILED

---

## ✅ DECISION 6: Retry Strategy

**Locked Decision:**

**Provisioning Job Retry Policy (defined in Stage 10, implemented in Stage 05):**

```
Protocol: Exponential backoff with jitter

Parameters:
├── Base delay: 2 seconds
├── Max delay: 5 minutes
├── Backoff multiplier: 2.0 (exponential)
├── Max retries: 5
├── Jitter: ±10% random to prevent thundering herd
└── Total timeout: 30 minutes (job TTL)

Retry Schedule:
├── Attempt 1: Immediate (0s)
├── Attempt 2: 2s delay
├── Attempt 3: 4s delay
├── Attempt 4: 8s delay
├── Attempt 5: 16s delay
├── Attempt 6: 32s delay (hit max 5 min, capped)
└── Attempt 7: Would exceed 30 min total → Job abandoned

Total elapsed: ~60 seconds for happy path, ~30 min worst case
```

**Code Example (pseudocode for Stage 05):**

```javascript
async function provisionLicense(licenseId, attemptNumber = 1) {
  try {
    // Execute provisioning
    await createTenantDatabase(licenseId);
    await runMigrations(licenseId);
    updateLicenseStatus(licenseId, "ACTIVE");
    return { success: true };
  } catch (error) {
    if (attemptNumber < 5) {
      const delay = Math.min(
        2000 * Math.pow(2, attemptNumber - 1), // exponential
        300000, // 5 min max
      );
      const jitter = delay * (Math.random() * 0.2 - 0.1); // ±10%
      scheduleRetry(licenseId, delay + jitter, attemptNumber + 1);
      return { success: false, retry: true, attemptNumber };
    } else {
      // Max retries exhausted
      updateLicenseStatus(licenseId, "PROVISION_FAILED");
      logStructuredError({
        license_id: licenseId,
        error: error.message,
        attempts: attemptNumber,
        terminal: true,
      });
      return { success: false, retry: false };
    }
  }
}
```

**Rationale:**

1. **Academic Workload Reality:** Large institutions may have 10k+ students. Database creation +
   migrations can approach 2-3 min. 30 min total SLA allows for realistic provisioning time.

2. **Network Resilience:** Exponential backoff with jitter prevents retry storms. 5 attempts
   provides safety margin without excessive polling.

3. **Staff Feedback Loop:** 30 min is long enough to complete provisioning, but staff sees
   PROVISION_FAILED within 30 min of creation. Clear signal for operator.

4. **Matches SaaS Standards:** 5 retries + exponential backoff is industry standard for critical
   operations.

5. **Aligns PROJECT_CONTEXT_PRIMER:** Worker is authority for provisioning. Retry strategy owned by
   worker implementation.

**Implementation Impact:**

- [ ] Document retry policy in STAGE_10_LICENSES.md section "Provisioning Integration"
- [ ] Stage 05 (Provisioning Service) implementation must follow this policy
- [ ] Worker configuration: Set TTL = 30 min on provisioning job queue
- [ ] Logging: Log retry attempts with timestamp, attempt number, next delay
- [ ] Monitoring: Alert on PROVISION_FAILED status (job exhausted retries)

---

## Ambiguity 7: Soft-Lock Edge Case — Past Timestamp

**Issue:** If `soft_lock_until` is set to a PAST timestamp (e.g., system clock jumped backward, or
past timestamp entered), is license locked?

**Example Scenario:**

```
License soft-locked on 2026-02-22 with soft_lock_until = 2026-02-20 (past date, error in staff input?)
Middleware checks: IF soft_lock_until > NOW() → locked?
NOW() = 2026-02-22, so condition is false
License appears unlocked, access allowed
But semantically, soft_lock_until was supposed to lock until Feb 20.
```

**Options Considered:**

- **Option A:** License locked if `soft_lock_until` is past (ignore comparison logic)
  - Pro: Defaults to safe (locked)
  - Con: Weird UX (infinite lock if timestamp is past)
  - Con: Breaks recovery expectation

- **Option B:** Past timestamp auto-unlocks license (comparison logic only)
  - Pro: Matches lock duration semantics
  - Con: Could accidentally unlock if clock skew occurs
  - Con: No validation, garbage in garbage out

- **Option C:** Validation rule: only future timestamps allowed
  - Pro: Prevents invalid state by design
  - Pro: Clear contract (soft_lock_until > NOW() always)
  - Con: Requires validation on unlock and on any timestamp set

---

## ✅ DECISION 7: Soft-Lock Edge Case

**Locked Decision:**

**Validation Rule: soft_lock_until must always be a FUTURE timestamp.**

**Enforcement Points:**

1. **At Soft-Lock Action:**

```
POST /licenses/:id/soft-lock
{
  "grace_period_days": 90  // optional, default 90
}

Calculation:
soft_lock_until = NOW() + (grace_period_days * 86400 seconds)

Validation:
IF soft_lock_until <= NOW() → return 400 "Invalid grace period"
```

2. **At Restore from Soft-Lock:**

```
POST /licenses/:id/restore
{
  "action": "restore_from_soft_lock"
}

Validation:
IF status != SOFT_LOCKED → 409 Conflict
IF soft_lock_until is NULL → 409 (not in soft lock)
Action: status = ACTIVE, soft_lock_until = NULL
```

3. **At Middleware License Check:**

```
Middleware logic:
IF license.status = SOFT_LOCKED:
  IF license.soft_lock_until > NOW():
    → Return 423 (Locked)
  ELSE:  // soft_lock_until <= NOW()
    → Auto-transition to ARCHIVED (see Decision #7 below)
```

**Database Constraint:**

```sql
ALTER TABLE licenses
ADD CONSTRAINT ck_soft_lock_future
CHECK (
  (status != 'SOFT_LOCKED') OR
  (soft_lock_until IS NULL) OR
  (soft_lock_until > NOW())
);
```

**Rationale:**

1. **State Machine Correctness:** `soft_lock_until IS NULL` means not soft-locked.
   `soft_lock_until > NOW()` means currently locked. No edge cases.

2. **Prevents Invalid State:** Database constraint prevents corruption (past timestamp in
   soft-locked state).

3. **Clear Middleware Logic:** Middleware doesn't guess; it checks `soft_lock_until > NOW()`. If
   false, license is not locked.

4. **Aligns ADR-0001:** Database-per-tenant isolation requires deterministic access control.
   Ambiguous states break isolation guarantees.

**Implementation Impact:**

- [ ] Add CHECK constraint to licenses table (see SQL above)
- [ ] Soft-lock endpoint: Calculate grace_period correctly (NOW() + interval)
- [ ] Middleware: Check `soft_lock_until > NOW()` atomically
- [ ] Tests: Verify past timestamps are rejected on creation

---

## Ambiguity 8: Auto-Transition for Expired Soft-Locks

**Issue:** Should soft-lock expire automatically when `soft_lock_until` passes, or require manual
unlock?

**Current Spec Statement:** "Middleware must check: If status = SOFT_LOCKED AND now >
soft_lock_until → Auto-transition to ARCHIVED"

**Problem:** Implementation strategy unclear. Options:

- Synchronous check on every request (performance concern)
- Asynchronous cron job (eventual consistency)
- Lazy evaluation (first request after expiration triggers transition)

**Options Considered:**

- **Option A:** Auto-expire on first request (lazy evaluation)
  - Pro: No cron job needed
  - Pro: Workload-driven, not time-driven
  - Con: Requests handling the expiration might be slow
  - Con: Race condition if multiple requests see expiration simultaneously

- **Option B:** Dedicated cron job every minute
  - Pro: Deterministic timing
  - Pro: Avoids request latency impact
  - Con: Extra infrastructure (scheduler service needed)
  - Con: Requires database lock strategy to prevent concurrent updates

- **Option C:** Require manual unlock only (no auto-expiration)
  - Pro: Explicit, no surprises
  - Con: Violates spec promise ("90-day grace period then auto-archive")
  - Con: Workspace lingers in SOFT_LOCKED, confusing staff

---

## ✅ DECISION 8: Auto-Transition for Expired Soft-Locks

**Locked Decision:**

**Lazy Evaluation Model (Option A):**

Soft-lock expiration handled by middleware on first request after `soft_lock_until` passes.

**Middleware Logic (Atomic Update):**

```javascript
async function licenseMiddleware(req, context) {
  const license = await loadLicense(context.tenantId);

  if (license.status === "SOFT_LOCKED" && license.soft_lock_until <= NOW()) {
    // Auto-transition: SOFT_LOCKED → ARCHIVED
    // Use CAS (compare-and-set) to prevent race condition
    const updated = await db.licenses.updateAtomic({
      id: license.id,
      whereVersion: license.version, // optimistic lock
      set: {
        status: "ARCHIVED",
        archived_at: NOW(),
        soft_lock_until: NULL,
        version: license.version + 1,
      },
    });

    if (!updated) {
      // Concurrent request already updated; reload
      license = await loadLicense(context.tenantId);
    }

    // Log transition
    logStructuredEvent({
      event: "soft_lock_auto_archived",
      license_id: license.id,
      soft_lock_until: license.soft_lock_until,
      timestamp: NOW(),
    });
  }

  // Now check status as normal
  if (license.status === "ARCHIVED") {
    return 403; // Archived, access forbidden
  }
  if (license.status === "SOFT_LOCKED") {
    return 423; // Soft-locked, access locked
  }
}
```

**Race Condition Handling:**

Multiple concurrent requests after expiration:

```
Request 1: Sees SOFT_LOCKED + now > soft_lock_until
Request 1: Acquires lock (UPDATE ... 423 Locked?), updates to ARCHIVED
Request 1: Returns 403

Request 2: Concurrent request
Request 2: Sees SOFT_LOCKED + now > soft_lock_until (same time)
Request 2: Also tries to update (uses optimistic lock version)
Request 2: Version mismatch (already incremented by Req 1), update fails
Request 2: Reloads license, sees ARCHIVED
Request 2: Returns 403
```

**Rationale:**

1. **Workload-Driven:** Expiration only checked when workspace is accessed. No background job
   needed.

2. **Atomicity:** Write operation is atomic. Version check prevents concurrent duplicate
   transitions.

3. **Consistency:** First request after expiration sees new state (ARCHIVED). Subsequent requests
   see consistent state.

4. **Matches Zidney Determinism:** Explicit transition logged, auditable, not silent background
   magic.

5. **Aligns PROJECT_CONTEXT_PRIMER:** No background jobs except worker queue. Middleware handles
   sync operations.

**Alternative (Cron Job) — Documented but Not Recommended:**

If workload patterns warrant optimization (e.g., soft-locks rarely accessed after expiration):

```
CronJob (every 5 minutes):
  SELECT * FROM licenses
  WHERE status = 'SOFT_LOCKED'
  AND soft_lock_until <= NOW() - INTERVAL '1 minute'
  ORDER BY soft_lock_until ASC;

  FOR EACH license:
    UPDATE licenses
    SET status = 'ARCHIVED', archived_at = NOW(), version = version + 1
    WHERE id = license.id AND version = license.version;

    IF (rows affected = 0):
      SKIP (concurrent update or already archived)
```

Not recommended for Stage 10 (adds infrastructure complexity). Can be added in Stage 15 (MMC
Dashboard) if needed for scale.

**Implementation Impact:**

- [ ] Middleware license check: Add expiration logic before status validation
- [ ] Use optimistic locking (version field on licenses table) to prevent concurrent duplicate
      transitions
- [ ] Logging: Log all auto-transitions (event: 'soft_lock_auto_archived') with timestamps
- [ ] Tests: Verify race condition handling (concurrent requests, both see expiration)
- [ ] Documentation: Note that soft-lock expiration is lazy (best-effort on next access)

---

## Summary Table: All Decisions Locked

| #   | Ambiguity                  | Decision                                                                                        | Impact                                                                           | Status    |
| --- | -------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------- |
| 1   | Stage 04 Status Ref.       | Extend enum: PENDING_PROVISION added to Stage 04's (ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED)     | Update stage docs, migration for PENDING_PROVISION type                          | ✅ LOCKED |
| 2   | Status Divergence          | tenants_registry has NO status field; always read from licenses table                           | Remove status from registry schema, query licenses on every request              | ✅ LOCKED |
| 3   | upgrade_available          | Computed field in GET response (= product has version > license.product_version)                | No DB field, computation in response mapper, add product index                   | ✅ LOCKED |
| 4   | PROVISION_FAILED (timeout) | Add PROVISION_FAILED status, transition on job timeout/failure                                  | New enum value, new table fields (provisioning_error, retries), MMC UI for retry | ✅ LOCKED |
| 5   | Failure Visibility         | Hybrid: UI shows status + managed error details; full details in logs                           | Add provisioning_error field, error sanitization function, structured logging    | ✅ LOCKED |
| 6   | Retry Strategy             | 5 retries, 2s base backoff exponential, 30 min total timeout                                    | Document policy, Stage 05 implements, add logging/monitoring                     | ✅ LOCKED |
| 7   | Soft-Lock Past TS          | Validation rule: soft_lock_until must be FUTURE; DB constraint enforces                         | CHECK constraint on licenses table, input validation on soft-lock action         | ✅ LOCKED |
| 8   | Auto-Expire Soft-Lock      | Lazy evaluation: first request after expiration triggers atomic SOFT_LOCKED→ARCHIVED transition | Optimistic locking (version field), atomic middleware update, logging            | ✅ LOCKED |

---

## Constitutional Alignment Validation (Locked Decisions)

All decisions validated against Zidney Constitution and ADRs:

| Constitution Element                         | Validation                                                                                                      | Result  |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------- |
| **ADR-0001: Database-per-Tenant Isolation**  | No cross-tenant access in any decision; status is per-license, licenses are per-workspace                       | ✅ PASS |
| **ADR-0005: Upgrade Opt-In Model**           | Decision #3 (upgrade_available) reinforces opt-in; license stores version snapshot, computes available upgrades | ✅ PASS |
| **ADR-0008: Semantic Versioning**            | Decisions preserve schema_version and product_version immutability; versioning enforced in Stage 10             | ✅ PASS |
| **PROJECT_CONTEXT_PRIMER: License Model**    | License as commercial unit (Decision #1, #2, #4) enforced; status as source of truth (Decision #2)              | ✅ PASS |
| **PROJECT_CONTEXT_PRIMER: Middleware Order** | License status enforced in middleware (Decision #2, #7, #8); positioned after tenant resolver                   | ✅ PASS |
| **PROJECT_CONTEXT_PRIMER: Worker Authority** | Provisioning logic deferred to Stage 05 worker (Decision #4, #6); Stage 10 defines contract                     | ✅ PASS |
| **Multi-Tenancy Guarantees**                 | No row-based sharing, no cross-tenant joins, status isolation per license                                       | ✅ PASS |

---

## Stage Lifecycle Status

**Current Status:** DRAFT → (after clarification) → READY FOR PLAN

**Clarification Gate:** ✅ PASSED (all 8 ambiguities resolved)

**Next Step:** PLAN step (detailed task decomposition, API specifications, database migrations)

**Approval Required:** Architecture review of locked decisions before proceeding to PLAN

---

## Index of Changes Required to Specification

Documents to update:

1. **STAGE_10_LICENSES.md**
   - [ ] Section: License Status Model — Add PENDING_PROVISION and PROVISION_FAILED, clarify Stage
         04 reference
   - [ ] Section: Provisioning Integration — Add retry strategy table (Decision #6)
   - [ ] Section: License Creation Flow — Add failure handling, PROVISION_FAILED state, error
         logging (Decision #4, #5)
   - [ ] Section: Soft-Lock Operation — Add validation rule for future timestamps (Decision #7)
   - [ ] Section: Soft-Lock Expiration — Add auto-transition logic with middleware race condition
         handling (Decision #8)

2. **STAGE_04_LICENSE_ENGINE.md**
   - Nothing (PRODUCTION READY, immutable)

3. **New Subsection in STAGE_10_LICENSES.md**
   - "Ambiguity Resolution Log" — Reference this CLARIFY_REPORT.md for future maintainers

---

## Locked Decision Enforcement

All locked decisions are binding for implementation. Any deviation requires:

1. Architectural review (ADR amendment or exception)
2. Update to this CLARIFY_REPORT ( "Decision Changed" entry with new rationale)
3. New stage or substage to capture the change

---

## Sign-Off

**All 8 Ambiguities Resolved:** ✅ YES

**All Decisions Locked:** ✅ YES

**All Decisions Constitutional Aligned:** ✅ YES

**Ready for PLAN Step:** ✅ YES (conditional on approval)

---

**Approved By:** [PENDING ARCHITECTURE REVIEW]  
**Approved Date:** [TBD]  
**Next Phase:** PLAN step — Generate detailed API specs, database migrations, and implementation
tasks

---

**End of Clarify Report**
