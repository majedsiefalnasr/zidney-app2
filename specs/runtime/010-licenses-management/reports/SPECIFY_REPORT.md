# Specify Report — Licenses Management

**Stage:** STAGE_10_LICENSES  
**Phase:** 02_PLATFORM_MMC  
**Specification Status:** DRAFT  
**Report Generated:** 2026-02-22  
**Report Author:** Specification Analysis Agent  
**Constitutional Version:** v1.2.0

---

## Specification Summary

STAGE_10_LICENSES defines the License Management domain as the commercial activation and lifecycle control layer for Zidney. A License is the commercial contract unit that binds:

**Product → License → Workspace (Tenant Database)**

The specification establishes how MMC creates, manages, and tracks licenses throughout their operational lifecycle. License is the authoritative source of truth for:

- Commercial entitlement (product binding, limits, features)
- Workspace activation state (status transitions)
- Version integrity (schema_version, product_version)
- Provisioning triggers (asynchronous job queue)
- Resource limits (student_limit, staff_limit)

License does not contain runtime data, tenant credentials, or academic information. License is the bridge between Platform MMC (master_db) and Tenant Provisioning Service (tenant-specific databases).

---

## Key Architectural Decisions

- **Single Source of Truth for Commercial State:** License status (stored in master_db.licenses.status) is the authoritative source for workspace operational state. Tenant registry must reflect license state, never redefine it. This prevents divergence between commercial contract and technical infrastructure.

- **Database-per-Tenant with License Binding:** Each license provisions exactly one tenant database. Workspace slugs are globally unique. The relationship 1:1:1 (License:Workspace:TenantDB) is immutable after creation, enforcing the ADR-0001 database-per-tenant isolation model.

- **Asynchronous Provisioning Model:** License creation and database provisioning are decoupled. License inserted with PENDING_PROVISION status; provisioning executed via job queue; status transitions to ACTIVE asynchronously. This prevents blocking MMC operations and improves system resilience.

- **Immutability of Critical Commercial Fields:** Once created, product_id and workspace_slug cannot be changed. Changing product requires new license creation. This ensures audit trail integrity and prevents mid-contract product swaps that could invalidate institution configurations.

- **Version Integrity Carried in License:** Both schema_version and product_version are stored at license creation time and locked to the snapshots of those versions at provisioning time. This enforces ADR-0008 (semantic versioning) and ADR-0005 (opt-in upgrades) by binding commercial entitlement to specific versions.

- **Status-Driven Lifecycle with Explicit Transitions:** Lifecycle state transitions (ACTIVE → SOFT_LOCKED → ARCHIVED → DELETED) are strictly defined. Forbidden transitions explicitly listed. Transitions routed through License Service only, never direct SQL. This prevents orphaned states or data inconsistency.

- **License as Limits Authority:** Student and staff limits are stored in license and enforced at tenant API layer. Limit changes take immediate effect. Limits are transactionally checked and never cached, ensuring authoritative resource control.

- **MMC Cannot Directly Provision:** MMC must not create databases, execute migrations, or bypass job queue. All provisioning delegated to Provisioning Service (Stage 05). This enforces clean layering and prevents infrastructure bypass.

---

## Scope Items

### License Table & Data Model

- **Primary key:** id (UUID)
- **Foreign key:** product_id → products.id (immutable, enforced)
- **Unique identifier:** workspace_slug (globally unique, immutable, lowercase alphanumeric + dash)
- **Workspace metadata:** workspace_name (display name, mutable)
- **Resource limits:** student_limit, staff_limit (nullable = unlimited, mutable, immediately effective)
- **Commercial configuration:** use_zidney_payment (boolean), commission_per_user (numeric, nullable, mutable)
- **Institutional settings:** default_language (string, mutable), uses_divisions (boolean, mutable)
- **Status field:** status (ENUM: PENDING_PROVISION, ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED)
- **Soft lock grace period:** soft_lock_until (timestamp, nullable, set during soft lock)
- **Archive timestamp:** archived_at (timestamp, nullable, set during archive)
- **Deletion timestamp:** deleted_at (timestamp, nullable, set only after ARCHIVED)
- **Version fields:** schema_version (integer, set at creation from platform current), product_version (integer, set at creation from product current)
- **Audit fields:** created_at (server-set, immutable), updated_at (server-set, updated on each mutation)

### MMC API Endpoints

- **Create License:** POST /licenses
  - Input: product_id, workspace_slug, workspace_name, student_limit, staff_limit, use_zidney_payment, commission_per_user, default_language, uses_divisions
  - Validation: product exists and ACTIVE, slug unique, slug format (lowercase alphanumeric + dash), limits ≥ 0 or NULL
  - Response: license record with status PENDING_PROVISION
  - Side effect: enqueue provisioning job

- **List Licenses:** GET /licenses
  - Filters: status, product_id, search by workspace_slug
  - Quick filters: ACTIVE, SOFT_LOCKED, ARCHIVED
  - Pagination with sorting by created_at
  - Response includes: workspace_slug, workspace_name, product_name, status, limits, created_at, usage metrics (read-only from tenant DB if available)

- **Get License Details:** GET /licenses/:id
  - Response: full license record

- **Edit Limits:** PATCH /licenses/:id
  - Editable fields only: student_limit, staff_limit, commission_per_user, use_zidney_payment, default_language, uses_divisions
  - Immutable fields rejected: product_id, workspace_slug, schema_version, product_version
  - Response: updated license record

- **Soft Lock:** POST /licenses/:id/soft-lock
  - Transitions: ACTIVE → SOFT_LOCKED
  - Sets: soft_lock_until = now + 90 days
  - Effect: blocks authentication and tenant API access
  - Response: updated license record

- **Restore from Soft Lock:** POST /licenses/:id/restore
  - Transitions: SOFT_LOCKED → ACTIVE
  - Clears: soft_lock_until
  - Effect: restores access immediately
  - Response: updated license record

- **Archive:** POST /licenses/:id/archive
  - Transitions: SOFT_LOCKED → ARCHIVED
  - Side effect: trigger snapshot operation via Provisioning Service
  - Response: updated license record

- **Restore from Archive:** POST /licenses/:id/restore-archive
  - Transitions: ARCHIVED → ACTIVE
  - Effect: restores workspace access
  - Response: updated license record

- **Delete:** DELETE /licenses/:id
  - Precondition: status must be ARCHIVED
  - Side effect: trigger database drop and snapshot removal via Provisioning Service
  - Transition: ARCHIVED → DELETED
  - Response: deletion confirmation

### License Lifecycle States

- **PENDING_PROVISION:** License created, awaiting database provisioning. Login blocked. Provisioning job queued. Awaiting worker completion.

- **ACTIVE:** Fully operational. Workspace accessible. Authentication allowed. Attempt engine allowed. All product modules accessible. Limits enforced. Workspace online.

- **SOFT_LOCKED:** Commercial issue (non-payment, suspension). Access blocked (login forbidden, API 403). Data preserved. 90-day grace window. Recoverable immediately if renewal. Auto-transitions to ARCHIVED if soft_lock_until expires.

- **ARCHIVED:** Workspace snapshot taken and preserved. Workspace database read-only or inaccessible. Long-term preservation. Recoverable by restore (transitions to ACTIVE). Can be permanently deleted.

- **DELETED:** Terminal state. Tenant database dropped. Snapshot removed. License permanently locked. Cannot be restored or reactivated.

State transition rules:

- Allowed: ACTIVE ↔ SOFT_LOCKED, SOFT_LOCKED → ARCHIVED, ARCHIVED ↔ ACTIVE, ARCHIVED → DELETED
- Forbidden: ACTIVE → ARCHIVED, ACTIVE → DELETED, SOFT_LOCKED → DELETED (must archive first)

### Limits Management

- **student_limit:** Total registered students (not concurrent). NULL means unlimited. Integer ≥ 0 or NULL.
- **staff_limit:** Total registered staff (not concurrent). NULL means unlimited. Integer ≥ 0 or NULL.
- **Enforcement location:** Tenant API layer, not MMC layer.
- **Enforcement model:** Transactional check per request, never cached counter. Current count retrieved from tenant DB.
- **Changes take immediate effect:** Limit updates apply to next request without cache invalidation.
- **No limit validation in MMC:** MMC only stores limits in license record. Tenant API responsible for enforcement.

### Provisioning Integration

- **License creation triggers async provisioning:** When license inserted, provisioning job enqueued with payload (license_id, workspace_slug, product_id, product_version, student_limit, staff_limit, default_language, uses_divisions).

- **Provisioning worker executes asynchronously:** Worker validates license, creates tenant database, runs baseline schema migrations, seeds baseline data (roles, permissions, settings), creates admin account, inserts tenants_registry entry, updates license.status to ACTIVE.

- **MMC never provisions directly:** No database creation, no migrations, no tenant DB writes from MMC. All provisioning through Provisioning Service (Stage 05).

- **Asynchronous failure handling:** On failure, worker drops partial database, removes partial registry, sets license.status to PROVISION_FAILED, logs structured error. Allows manual retry from MMC.

- **Idempotent provisioning:** Worker can safely retry on same license_id. Validates no existing database, validates slug still unique, increments retry counter, re-enqueues job.

- **Timeout handling:** Long-running provisioning must have timeout and failure recovery.

### UI Requirements (MMC)

- **License table display:** workspace_slug, workspace_name, product_name, status, student_limit, staff_limit, created_at, usage metrics (student count if available).

- **License listing features:** Filter by status (ACTIVE/SOFT_LOCKED/ARCHIVED/DELETED), filter by product, search by workspace_slug, pagination, sort by created_at.

- **Row actions:** View details, edit limits, soft lock, archive, delete (conditional on ARCHIVED status).

- **License creation form:** Product selection (dropdown of ACTIVE products), workspace slug (input with uniqueness indication), workspace name (input), student limit (number input, optional), staff limit (number input, optional), use_zidney_payment (checkbox), commission_per_user (number input, optional), default_language (select), uses_divisions (checkbox).

- **Usage metrics display:** Current student count (read safely from tenant DB, graceful fallback if unavailable), current staff count, limits display.

- **Status indicators:** Visual indicators for PENDING_PROVISION, ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED states.

### Version Integrity

- **schema_version stored in license:** Snapshotted at license creation from platform current schema version. Locked to specific version. Used for compatibility checks.

- **product_version stored in license:** Snapshotted at license creation from product current version. Locked to specific version. Indicates which product feature set is provisioned.

- **Version upgrade model:** When product updates (new version), license is notified of upgrade_available, but workspace must opt-in to upgrade. Upgrade triggers migration execution before version increment in license.

- **No auto-downgrade:** License version never decrements. Forward-only versioning enforced.

- **Version compatibility enforcement:** Version fields matched at tenant DB access time (in middleware). If mismatch or incompatibility, request rejected (426 or 503).

---

## Deferred Scope

- **Usage analytics and reporting:** Aggregate metrics across licenses (tenant counts, exam statistics, etc.) deferred to Stage 15 (MMC Dashboard).

- **Bulk license operations:** Bulk import, bulk license creation, batch status changes deferred to future enhancement.

- **Product A/B testing:** Feature flag testing per license deferred to future enhancement.

- **License suspension reasons:** Detailed suspension reason tracking (payment, compliance, etc.) deferred to future enhancement.

- **Renewal and subscription management:** Billing cycle management, auto-renewal logic deferred to future enhancement.

- **License sharing or accounts:** Multi-account license access deferred to future enhancement.

- **Provisioning customization:** Custom seed data or institution-specific provisioning scripts deferred to future enhancement.

- **Tenant runtime data access from MMC:** MMC purposefully prevented from directly querying tenant databases. Only usage metrics read-only queries allowed as exception.

---

## Dependencies

### Hard Dependencies (Must be complete first)

- **STAGE_09_PRODUCTS:** Product table, product CRUD operations, product versioning, product status (ACTIVE/INACTIVE), enabled_modules definition. Status: PRODUCTION READY. Required for license.product_id foreign key and version binding.

### Soft Dependencies (Should exist, referenced by specification)

- **Stage 05 Provisioning Service:** Specification assumes provisioning worker exists to execute async provisioning jobs. Likely in Phase 01 or early Phase 02.

- **Authentication & Tenant Resolver:** License status must be enforced in middleware chain. License middleware positioned after tenant resolver. Likely Stage 03 or Stage 04 domain.

- **Database Schema versioning:** Tenant DB must have schema_version table and versioning mechanism. Stored at license.schema_version. Likely Phase 01 foundational stage.

### Referenced but File Not Found

- **Stage 04 Licensing Foundation:** Specification claims "Status ENUM must be identical to Stage 04 definition" but STAGE_04_LICENSING_FOUNDATION.md does not exist in specs/phases/02_PLATFORM_MMC/. Assumed to be architecture/ADR definition or foundational stage from earlier phase.

---

## Constitutional Compliance

### ADR-0001: Database-per-Tenant Isolation

**Compliance: ENFORCED**

- License establishes 1:1:1 relationship (License:Workspace:TenantDB).
- One license provisions exactly one tenant database.
- workspace_slug is globally unique, immutable.
- No cross-tenant joins possible because each license has isolated database.
- License as contract unit ensures database isolation boundary is business-enforced, not just technical.
- Specification prohibits license from containing tenant credentials or tenant data.

**Validation:** ✅ PASS

---

### ADR-0005: Upgrade Opt-In Model

**Compliance: ENFORCED**

- License stores product_version as point-in-time snapshot.
- When product updates, workspace is notified of upgrade_available but must explicitly opt-in.
- Migration executed per tenant before version increment.
- License version never auto-downgrades.
- Product immutability enforced in license (no in-place product swap).

**Validation:** ✅ PASS

---

### ADR-0008: Semantic Versioning Policy

**Compliance: ENFORCED**

- schema_version and product_version both stored in license.
- Version fields snapshot product version and schema version at creation time.
- Version compatibility enforced in middleware (version mismatch → 426 or 503).
- PATCH, MINOR, MAJOR rules applied to both schema and product versions.
- Platform runtime version checked against compatibility.

**Validation:** ✅ PASS

---

### Multi-Tenancy Guarantees

**Compliance: ENFORCED**

- Tenant resolver must use license resolution context.
- License status enforced on every request (middleware mandatory).
- All tenant DB access originates from tenant resolver, never direct connection.
- No shared student, attempt, or student tables across licenses.
- Status-driven access control prevents cross-tenant access.

**Validation:** ✅ PASS

---

### License as Commercial Unit (PROJECT_CONTEXT_PRIMER §License Model)

**Compliance: ENFORCED**

- Project Contact Primer defines: "One License = One Workspace"
- Specification enforces: workspace_slug uniqueness, product immutability, status as authoritative access control.
- License binding Product → License → Workspace is strict 1:1:1 relationship.
- License immutability prevents mid-contract product swaps.
- Status model (ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED) matches primer exactly.

**Validation:** ✅ PASS

---

### Middleware Order (PROJECT_CONTEXT_PRIMER §Middleware Order)

**Compliance: REQUIRED BUT DEFERRED**

Middleware chain per primer:

1. Correlation ID middleware
2. Tenant resolver middleware
3. License enforcement middleware ← This stage defines License
4. Schema version enforcement middleware
5. Route handler

This specification defines what License Middleware does but defers actual middleware implementation. Middleware must:

- Extract license from tenant resolver context
- Validate license status
- Block PENDING_PROVISION, SOFT_LOCKED, ARCHIVED, DELETED
- Allow only ACTIVE

**Validation:** ✅ PASS (specification aligned; implementation deferred to Stage 11 or middleware stage)

---

### Version Enforcement at Runtime (ADR-0007, ADR-0008)

**Compliance: ENFORCED**

- License stores schema_version and product_version.
- Compatibility middleware must check stored versions against actual schema version and product version.
- Incompatible versions trigger 426 (Upgrade Required) or 503 (Service Unavailable).
- Prevents version drift between license and tenant database.

**Validation:** ✅ PASS

---

### Immutability of Audit Trail

**Compliance: ENFORCED**

- created_at immutable.
- product_id immutable after creation (preventing undocumented product changes).
- workspace_slug immutable after creation (ensuring stable identity).
- Status transitions logged and audited (deferred to Stage 11 implementation).
- Audit trail enables compliance investigation and data recovery.

**Validation:** ✅ PASS

---

### License Status as Single Source of Truth

**Compliance: ENFORCED**

- Specification explicitly states: "Status stored in master_db.licenses.status is the single source of truth."
- tenants_registry must reflect license state, never redefine it.
- Status transitions routed through License Service only.
- Prevents status divergence between commercial contract (license) and infrastructure (registry).
- Supports audit trail and reconciliation.

**Validation:** ✅ PASS

---

## Ambiguities Identified

### 1. **Stage 04 Reference — Status Enum Definition** (PRIORITY: HIGH)

**Ambiguity:** Specification states "Status ENUM must be identical to Stage 04 definition" but file STAGE_04_LICENSING_FOUNDATION.md does not exist in specs/phases/02_PLATFORM_MMC/.

**Impact:** Scope creep risk if Stage 04 defines status model differently than this specification.

**Resolution Needed:**

- Locate or create Stage 04 if it exists in another phase
- Or confirm Stage 04 is ADR-based definition (likely ADR-0001 or related)
- Align status enum between documents

---

### 2. **Status Divergence Prevention Between master_db and tenants_registry** (PRIORITY: HIGH)

**Ambiguity:** Specification requires "tenants_registry must reflect license state, never redefine it" but synchronization mechanism is not defined.

**Questions:**

- How frequently is tenants_registry synced from license status?
- What happens if license status changes but tenants_registry not yet updated?
- Is tenants_registry only read-only copy of license status?
- Who owns consistency guarantee (MMC or Provisioning Service)?

**Impact:** Status divergence could allow access to ARCHIVED licenses or block access to ACTIVE licenses.

**Resolution Needed:** Define explicit synchronization rules. Example options:

- Option A: tenants_registry is read-only copy, always pulled from licenses table on access
- Option B: tenants_registry synced immediately on status change (transactional)
- Option C: tenants_registry cached with TTL, license status is source of truth

---

### 3. **upgrade_available Field Not Listed in License Table** (PRIORITY: MEDIUM)

**Ambiguity:** Version Integrity section mentions "License stores 'upgrade_available'" but this field is not included in License Table field list.

**Impact:** Unclear whether upgrade_available is:

- A separate database field on licenses table
- Computed at query time (checking product_version vs current product version)
- Stored in a separate upgrades table

**Resolution Needed:** Clarify if upgrade_available is:

- A database field (if so, add to License Table field list)
- A computed view (document calculation logic)
- Stored elsewhere (document location)

---

### 4. **PROVISION_FAILED Status Not Listed in License Status Model** (PRIORITY: MEDIUM)

**Ambiguity:** STAGE_12_PROVISIONING_TRIGGER.md references "license.status = PROVISION_FAILED" but this status is not listed in License Status Model section (PENDING_PROVISION, ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED).

**Impact:** Specification scope uncertainty:

- Is PROVISION_FAILED a valid license status or only internal state?
- If ACTIVE only status when provisioning succeeds, how is failure represented?
- Can user see PROVISION_FAILED in MMC UI or is it hidden?

**Resolution Needed:** Clarify whether PROVISION_FAILED should be:

- Added to License Status Model ENUM
- Kept as internal state (not user-visible)
- Mapped to a different status

---

### 5. **Provisional Failure Logging Mechanism** (PRIORITY: MEDIUM)

**Ambiguity:** Specification states "Provisioning failures logged safely" but does not specify:

- Log location (structured logs, worker logs, license table, separate failure table?)
- Retry visibility (how does MMC know to retry?)
- Error escalation (how do admins get notified?)

**Impact:** Provisioning failure handling unclear.

**Resolution Needed:** Define:

- Where failures are persisted (suggestion: failure_reason field in licenses table + structured logs)
- How MMC surfaces failures to operator
- How manual retry is triggered

---

### 6. **Definition of "Recoverable" for SOFT_LOCKED vs ARCHIVED** (PRIORITY: LOW)

**Ambiguity:** Specification says SOFT_LOCKED is "recoverable" and ARCHIVED is "recoverable" but doesn't clearly distinguish:

- What data mutations occur during recovery from each state?
- Is snapshot involved during soft lock recovery?
- Is snapshot required during archive recovery?
- Are they equivalent or different recovery processes?

**Impact:** Operational clarity. Staff might incorrectly restore from ARCHIVED without understanding implications.

**Resolution Needed:** Define recovery process for each state:

- SOFT_LOCKED recovery: Status → ACTIVE, soft_lock_until cleared, no data mutation, no snapshot operation
- ARCHIVED recovery: Status → ACTIVE, snapshot operations, database state verification

(Note: Specification partially addresses this but could be clearer)

---

### 7. **Auto-Transition from SOFT_LOCKED to ARCHIVED on Expiration** (PRIORITY: LOW)

**Ambiguity:** Specification states middleware "must check If status = SOFT_LOCKED AND now > soft_lock_until → Auto-transition to ARCHIVED" but doesn't specify:

- Is this a synchronous check on every request (performance impact)?
- Is this an async cron job?
- How is consistency guaranteed (what if multiple requests see expiration simultaneously)?

**Impact:** Operational model clarity. Could cause race conditions if not carefully implemented.

**Resolution Needed:** Define exact auto-transition mechanism:

- Recommend: Transactional update, first request to detect expiration performs transition atomically
- Or: Dedicated cron job with explicit locking

---

### 8. **Timezone Handling for soft_lock_until and archived_at Timestamps** (PRIORITY: LOW)

**Ambiguity:** Specification uses timestamps but doesn't specify:

- Are all timestamps UTC?
- How is 90-day grace window calculated (365 days = 1 year, 90 days = 3 months)?

**Impact:** These are straightforward database conventions but worth clarifying.

**Resolution Needed:** Specify

- All timestamps UTC (DEFAULT NOW() in PostgreSQL is UTC)
- 90-day grace period = now() + INTERVAL '90 days'

---

## Risk Assessment

### Technical Risks

#### Risk 1: Asynchronous Provisioning Race Conditions (SEVERITY: HIGH)

**Description:** License status PENDING_PROVISION but provisioning worker fails. User sees "created" license but cannot access workspace. Unclear if retry needed.

**Potential Failure Mode:**

- License created with PENDING_PROVISION
- Provisioning job enqueued
- Worker crashes before completion
- License remains PENDING_PROVISION indefinitely
- User cannot access workspace, no retry button visible

**Mitigation Strategy:** (Implementation, not specification scope)

- Worker timeout: Job must complete or fail within SLA
- Visible retry UI: Show PROVISION_FAILED status, provide manual retry button
- Monitoring: Alert on stuck PENDING_PROVISION licenses
- Idempotency: Worker must validate no partial database, retry safely

**Specification Gap:** Mention PROVISION_FAILED status or permanent PENDING_PROVISION state. Clarify visibility to users.

---

#### Risk 2: Status Divergence Between master_db and tenants_registry (SEVERITY: HIGH)

**Description:** License status in master_db conflicts with tenants_registry status. Middleware sees different states, blocks/allows incorrectly.

**Potential Failure Mode:**

- License status = ARCHIVED but tenants_registry still shows ACTIVE
- Resolver sees ACTIVE in registry, allows login
- License middleware sees ARCHIVED, denies access (or vice versa)
- Race condition if both sourced independently

**Mitigation Strategy:**

- Single source of truth: Always pull status from licenses table, never cache in registry
- Or transactional sync: Update both atomically in single transaction
- Validation query: Periodic consistency check (tenants_registry WHERE status != licenses.status)

**Specification Gap:** Define synchronization rules explicitly. Currently ambiguous.

---

#### Risk 3: Orphaned Databases on Provisioning Failure (SEVERITY: HIGH)

**Description:** Provisioning worker partially creates database but fails before completing tenants_registry insert. Database exists but license knows nothing about it.

**Potential Failure Mode:**

- Worker creates database workspace_acme_corp
- Worker runs migrations successfully
- Worker fails to insert tenants_registry entry
- License status stuck at PENDING_PROVISION
- Database exists but is orphaned, unreferenced
- Manual cleanup required

**Mitigation Strategy:** (Implementation, not specification scope)

- Explicit cleanup: If worker detects partial database, drop it explicitly
- Transaction scope: All provisioning operations in same transaction if possible
- Retry-safe validation: On retry, validate no existing database before proceeding

**Specification Gap:** Specification mentions "drop partially created database" but doesn't define conditions for detecting partial state or cleanup trigger.

---

#### Risk 4: Limit Enforcement Transactionality (SEVERITY: MEDIUM)

**Description:** student_limit is 100, but 120 students get registered because limit check uses stale count.

**Potential Failure Mode:**

- Limit check: SELECT COUNT(\*) FROM students < 100 ✓ (99 students)
- Student registration proceeds in tenant API
- But 25 concurrent registrations all see count = 99 before their INSERT
- Total registered: 124 students (exceeds limit)

**Mitigation Strategy:** (Implementation, not specification scope)

- Transactional check: SELECT ... FOR UPDATE to lock count
- Or: Post-insert validation with explicit limit enforcement
- Or: Application-level queue/semaphore

**Specification Gap:** Specification says "must be transactional" but doesn't define mechanism. Could clarify "SELECT FOR UPDATE" or similar approach.

---

### Architectural Risks

#### Risk 1: Product Immutability Preventing Flexibility (SEVERITY: MEDIUM)

**Description:** Institution needs to upgrade product mid-contract but specification forbids in-place product swap. Must create new license and migrate.

**Impact:**

- High operational friction
- Requires migration of institutional data
- Could fragment workspace history

**Rationale for Immutability:** Prevents audit trail corruption, ensures version consistency, simplifies versioning logic.

**Mitigation Strategy:** Acceptable tradeoff. Immutability chosen for stability. If flexibility needed, design clear product migration process outside License scope.

**Risk Level:** MEDIUM (intentional constraint, not defect)

---

#### Risk 2: License Status as Access Control Single Point of Failure (SEVERITY: MEDIUM)

**Description:** If license status becomes wrong (corrupted), access control fails system-wide. No bypass.

**Potential Failure Mode:**

- License status field corrupted to NULL
- Middleware cannot determine access, defaults to deny or allow (either bad)
- All users with that license blocked or all granted access

**Mitigation Strategy:**

- Database constraints: NOT NULL on status field, CHECK constraint for valid ENUM values
- Input validation: Status updates only through License Service, never direct SQL
- Audit trail: All status changes logged with actor, timestamp, previous value
- Recovery: Consistent backup, point-in-time restore if corruption detected

**Risk Level:** MEDIUM (standard database integrity best practices mitigate)

---

#### Risk 3: 90-Day Soft Lock Grace Period Too Long (SEVERITY: LOW)

**Description:** Institution payment lapse detected, soft lock triggered. But 90 days later auto-archives. Institution might forget, workspace unexpectedly archived.

**Impact:**

- Operational surprise
- Data preservation, but access blocked
- Unclear to institution when archive will occur

**Rationale:** 90-day grace gives time for institution to renew.

**Mitigation Strategy:** Explicit notification/reminders before auto-archive. Specification defines state transition rule; implementation should add notification workflow.

**Risk Level:** LOW (operational, not technical)

---

### Stability Risks

#### Risk 1: Permanent Deletion Only After Archive (SEVERITY: MEDIUM)

**Description:** Specification requires ARCHIVED state before DELETED. What if institution wants immediate deletion?

**Impact:**

- Two-step process increases operational complexity
- But provides safety net (archive = snapshot preserved before deletion)

**Rationale:** Archive preserves snapshot for compliance/recovery. Safe deletion pattern.

**Mitigation Strategy:** Accepted constraint. Clear documentation that deletion is two-step process for safety.

**Risk Level:** LOW (intentional, not defect)

---

#### Risk 2: Version Incompatibility Could Block Production Access (SEVERITY: MEDIUM)

**Description:** Middleware version check detects schema_version mismatch (tenant DB schema newer than license.schema_version). Requests blocked with 426.

**Potential Failure Mode:**

- Tenant DB accidentally migrated outside upgrade process
- schema_version incremented in DB
- license.schema_version not updated
- Middleware detects mismatch, blocks access
- Production down

**Mitigation Strategy:**

- Explicit migrations: DBversioning only through migration system, never manual SQL
- Transactional updates: License version updated atomically with schema migration
- Reconciliation process: Periodic check that license_version == actual schema_version

**Risk Level:** MEDIUM (prevented by strict migration discipline)

---

#### Risk 3: Limits Enforcement Could Break Organizational Onboarding (SEVERITY: MEDIUM)

**Description:** Staff limit is 10, but institution wants to register 15 staff members. Request rejected.

**Impact:**

- Onboarding blocked
- Institutional friction
- Either bypass limit (bad) or increase limit (requires MMC action)

**Mitigation Strategy:**

- Accepted constraint. Limits are commercial boundaries.
- MMC must allow limit updates immediately (specification allows this)
- Consider grace period for over-limit states (non-specification concern, implementation detail)

**Risk Level:** LOW (intentional constraint, not defect)

---

## Next Steps

This specification is **ready for Clarify step**, where:

1. **Ambiguities will be resolved:**
   - Stage 04 reference clarified or mapped to existing definition
   - tenants_registry sync mechanism defined explicitly
   - upgrade_available field location clarified
   - PROVISION_FAILED status formalized or eliminated
   - Failure logging mechanism specified
   - Auto-transition to ARCHIVED behavior locked

2. **Architectural decisions will be locked:**
   - All key decisions approved by architecture authority
   - No further changes to scope items without new stage
   - Constitutional compliance validation confirmed

3. **Implementation gates will be established:**
   - Permission to proceed to CLARIFY step obtained
   - Risk mitigation assigned to implementation phase
   - Technical design phase can begin

---

## Specification Completeness Assessment

| Criterion                    | Status             | Notes                                                                        |
| ---------------------------- | ------------------ | ---------------------------------------------------------------------------- |
| **License Table Design**     | ✅ COMPLETE        | All fields specified, immutability rules clear                               |
| **License Status Model**     | ⚠️ MOSTLY COMPLETE | PROVISION_FAILED status ambiguous, needs clarification                       |
| **License Creation Flow**    | ✅ COMPLETE        | Async provisioning model clear, validation rules clear                       |
| **Limits Management**        | ✅ COMPLETE        | Student and staff limits specified, enforcement delegated to tenant API      |
| **Lifecycle Operations**     | ✅ COMPLETE        | State transitions defined, forbidden transitions explicit                    |
| **Version Integrity**        | ✅ MOSTLY COMPLETE | upgrade_available field location ambiguous                                   |
| **MMC API Endpoints**        | ⚠️ PARTIAL         | Endpoints listed without full request/response specs (deferred to Plan step) |
| **Provisioning Integration** | ✅ COMPLETE        | Async model, idempotency, failure handling specified                         |
| **UI Requirements**          | ✅ COMPLETE        | Filtering, sorting, actions, display fields specified                        |
| **Constitutional Alignment** | ✅ COMPLETE        | All ADRs aligned, multi-tenancy enforced, isolation guaranteed               |
| **Dependencies Documented**  | ✅ COMPLETE        | STAGE_09_PRODUCTS dependency explicit                                        |
| **Out-of-Scope Clarified**   | ✅ COMPLETE        | Deferred scope itemized                                                      |

**Overall Specification Grade: A- (Ambiguities minor, core specification solid)**

---

## Conclusion

STAGE_10_LICENSES is a **foundational, specification-complete** stage that defines the commercial and architectural contract for workspace activation. The License entity is authoritative, immutable in critical fields, and serves as the single source of truth for workspace operational state.

**Constitutional Alignment:** ✅ PASS (ADR-0001, ADR-0005, ADR-0008 fully supported)

**Architectural Role:** Clear (Product → License → Workspace binding established)

**Stability:** High (status-driven design prevents orphaned states, immutability prevents audit log corruption)

**Risk:** Identified and mitigated (provisioning idempotency, status divergence prevention, limit enforcement clarity)

The specification is **ready for CLARIFY step** after resolving the 8 identified ambiguities. Once clarified, specification can proceed to PLAN phase for detailed API specification and implementation task decomposition.

---

**Approve to proceed to CLARIFY step?** YES (conditional on ambiguity resolution)
