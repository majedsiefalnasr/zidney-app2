# STAGE 04 – License Engine

Phase: 1 – Platform Foundation
Status: Critical
Scope: License lifecycle, limits, and state transitions

---

## Objective

Implement the License Engine that:

- Connects Product → Workspace
- Controls lifecycle states
- Enforces student & staff limits
- Controls soft-lock & archive behavior
- Governs tenant operational status

The License Engine is the commercial authority of Zidney.

---

## Core Concepts

Definitions:

Product:

- Commercial configuration
- Defines enabled modules
- Defines base configuration

License:

- Instance of a Product assigned to a workspace
- Has limits and lifecycle state

Workspace:

- Tenant database
- Operational environment for institution

Relationship:

Product → License → Workspace

One License = One Workspace  
One License = One Product  
One Product = Many Licenses

---

## License Table (master_db)

Must include:

- id
- product_id
- workspace_slug (unique)
- student_limit (number | NULL for unlimited)
- staff_limit (number | NULL for unlimited)
- status (ACTIVE | SOFT_LOCKED | ARCHIVED | DELETED)
- soft_lock_until (timestamp | NULL)
- archived_at (timestamp | NULL)
- deleted_at (timestamp | NULL)
- expected_schema_version
- expected_product_version
- created_at
- updated_at

workspace_slug must be immutable after creation.

---

## Lifecycle States

ACTIVE

- Fully operational
- Login allowed
- Attempt allowed
- Content editable

SOFT_LOCKED (License-level)

- Blocks new authentication sessions (Backoffice + Frontoffice)
- Existing authenticated sessions remain valid until token expiration
- Prevents new attempt starts
- Allows in-progress attempts to finish and submit
- Workspace considered commercially inactive

ARCHIVED

- Workspace unavailable
- Snapshot taken
- UI shows: "Archived – Contact Zidney"
- Can restore manually

DELETED

- Database dropped
- License marked deleted
- Only after manual confirmation

---

## State Transitions

ACTIVE → SOFT_LOCKED
Trigger:

- Payment failure
- Manual admin action

SOFT_LOCKED → ACTIVE
Trigger:

- Renewal within 90 days

SOFT_LOCKED → ARCHIVED
Trigger:

- soft_lock_until expired

ARCHIVED → ACTIVE
Trigger:

- Manual restore
- Snapshot restore

ARCHIVED → DELETED
Trigger:

- Manual confirmation only

DELETED is terminal.

---

## Limit Enforcement

License defines:

- student_limit
- staff_limit

Rules:

If student_limit is number:

- Prevent creating new student when limit reached

If staff_limit is number:

- Prevent creating new staff when limit reached

If limit is NULL:

- Unlimited

Limit applies to:

Total registered users, not concurrent users.

Definition:

Active student = user where:

- status = ENABLED
- not soft-deleted

Limit checks must count only active users.

---

## Enforcement Points

Student creation:

- Check limit before insert

Staff creation:

- Check limit before insert

Workspace login:

- Check license status before authentication

Attempt start:

- Check license status before allowing

All enforcement must happen in API layer.

---

## Versioning

Each license stores:

- expected_schema_version
- expected_product_version

Tenant databases store:

- current_schema_version

On every workspace-bound request:

- Compare tenant.current_schema_version with license.expected_schema_version
- If mismatch → Reject request (426 Upgrade Required)

Product version enforcement:

- If license.expected_product_version incompatible with runtime → Reject request (426)

License stores the expected contract.
Tenant stores the actual applied version.

License must never store runtime-derived schema values.

---

## Archive Strategy

When moving to ARCHIVED:

- Full DB snapshot required
- Snapshot reference stored
- Database optionally moved to archive namespace

During ARCHIVED:

- No DB writes allowed
- Tenant resolver returns 403

---

## Runtime License Middleware

License validation MUST execute in middleware on every workspace-bound request.

Middleware must:

1. Resolve tenant via tenants_registry
2. Load license from master_db
3. Validate:
   - status != DELETED
   - status != ARCHIVED
   - If SOFT_LOCKED → reject (423)
   - tenant.current_schema_version matches expected_schema_version
   - product version compatible with expected_product_version

4. Attach to request context:
   - license_id
   - student_limit
   - staff_limit
   - status
   - expected_schema_version
   - expected_product_version

No route handler may access tenant DB before license validation.

License validation is required for:

- Backoffice APIs
- Frontoffice APIs
- Attempt engine
- Content APIs

---

## Schema & Product Version Enforcement

On every request:

If tenant.schema_version < minimum_supported_version
→ Reject request (426 Upgrade Required)

If license.product_version is outdated and incompatible
→ Reject request (426)

This prevents:

- Old tenant schema using new runtime code
- Breaking runtime assumptions

Upgrade must be explicit and controlled.

---

## Limit Enforcement Hard Guarantee

Limit checks MUST be transactional.

Student creation must:

1. Count active students inside transaction
2. Compare with student_limit
3. Insert only if within limit
4. Commit

No race condition allowed.

Same for staff_limit.

Limit check must NOT rely on cached count.

---

## Archive Snapshot Integrity

Before transitioning to ARCHIVED:

System MUST:

- Ensure no active connections to tenant DB
- Ensure no in-progress attempts
- Take full snapshot
- Store snapshot metadata:
  - snapshot_id
  - snapshot_location
  - snapshot_timestamp

ARCHIVED workspace must:

- Reject all DB writes
- Allow snapshot restore only via MMC

---

## Soft Lock Enforcement Window

If status = SOFT_LOCKED:

- soft_lock_until must be validated on every request
- If current_time > soft_lock_until
  → Transition to ARCHIVED automatically

Soft lock enforcement must not rely on cron only.
Middleware must enforce expiration boundary.

---

## Permanent Deletion Rules

Transition to DELETED requires:

1. Manual confirmation from MMC
2. Snapshot verification
3. Snapshot retention confirmation
4. Explicit destructive action confirmation

Deletion must:

- Drop tenant database
- Remove from tenants_registry
- Set license.deleted_at timestamp

Deletion is irreversible.

No automated deletion allowed.

---

## In-Progress Attempt Behavior

If license transitions to SOFT_LOCKED:

- New login sessions blocked
- Existing sessions remain valid until token expiration
- New attempt starts blocked immediately
- In-progress attempts allowed to submit
- No new content creation allowed

If license transitions to ARCHIVED:

- All requests immediately blocked
- No attempt submission allowed
- No authentication allowed

---

## Validation Criteria

Stage complete when:

- License can be created
- Workspace_slug validated as unique
- ACTIVE workspace functional
- SOFT_LOCKED blocks login
- ARCHIVED blocks access
- Renewal restores access
- student_limit enforced
- staff_limit enforced
- State transitions validated
- Version fields stored correctly

---

## Not Allowed

- License without workspace_slug
- Changing workspace_slug after creation
- Automatic destructive deletion
- Ignoring soft-lock window
- Shared limits across workspaces

---

## Stability Principle

License Engine controls revenue and operational status.

If lifecycle is inconsistent,
institutional trust is broken.

No provisioning logic may proceed without stable license lifecycle.

---

Next stage:
STAGE_05_TENANT_PROVISIONING_SERVICE
