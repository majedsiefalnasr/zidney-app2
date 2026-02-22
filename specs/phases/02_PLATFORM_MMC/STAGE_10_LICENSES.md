# STAGE 10 – Licenses Management

Phase: 2 – Platform MMC  
Status: Critical  
Scope: License creation, limits management, provisioning trigger, and lifecycle control (MMC layer)

---

## Stage Status

Status: DRAFT
Risk Level: MEDIUM
Last Updated: 2026-02-22T00:00:00Z

Scope Defined:

- License table with 18 fields including PROVISION_FAILED state support
- MMC API endpoints (create, list, details, edit, soft-lock, archive, restore, delete, retry-provisioning)
- License lifecycle with PROVISION_FAILED status for timeout/failure recovery
- Limits management framework (student_limit, staff_limit, NULL = unlimited)
- Provisioning integration with retry policy (5 retries, exponential backoff, 30 min timeout)
- MMC UI with hybrid error visibility (sanitized errors in UI, full logs in backend)
- Version integrity (schema_version, product_version immutable snapshots)

Deferred Scope:

- Actual database provisioning (Stage 05)
- Snapshot/archive implementation (Stage 11)
- Limits enforcement (Stage 04+)
- Payment processing integration (future)

Constitutional Compliance:

- All 8 ambiguities resolved and locked
- Database-per-tenant isolation enforced
- Multi-tenancy guarantees maintained
- Version compatibility model verified
- License as single source of truth established
- Middleware order compliance confirmed

Ambiguities Locked:

- Status enum extended to include PENDING_PROVISION, PROVISION_FAILED
- tenants_registry status field removed; master licenses table is authoritative
- upgrade_available as computed field (product_version comparison)
- Hybrid error visibility: MMC UI + backend logs
- Retry policy: 5 retries, 2s base exponential backoff, 30 min total timeout
- Soft-lock validation: future timestamps only (CHECK constraint)
- Auto-unlock: lazy evaluation on next request after soft_lock_until passes
- Timeout responsibility: job queue framework

Notes:
All clarifications locked and implementation-ready. Constitutional alignment: PASS (ADR-0001, ADR-0005, ADR-0008). Ready for technical planning.

---

## Objective

Implement License Management inside MMC as the commercial activation layer that binds:

Product → License → Workspace (Tenant Database)

License is:

- A commercial contract unit
- A provisioning trigger
- A lifecycle controller
- A limits authority
- A version carrier (schema + product)

This stage defines how MMC creates and manages licenses.  
Provisioning logic itself is implemented in Stage 05.

---

## Architectural Role

Relationship model:

Product → License → Workspace

Rules:

- One License references exactly one Product.
- One License provisions exactly one Workspace (one tenant DB).
- One workspace_slug is globally unique.
- One Client may own multiple Licenses.
- Product cannot be changed after license creation.

License does not contain runtime data.
License does not contain tenant credentials directly.
License never bypasses provisioning service.

---

## License Table (master_db)

Table: licenses

Required fields:

- id (UUID, PK)
- product_id (FK → products.id, immutable)
- workspace_slug (unique, immutable)
- workspace_name (display name)
- student_limit (integer | NULL)
- staff_limit (integer | NULL)
- use_zidney_payment (boolean)
- commission_per_user (numeric | NULL)
- default_language (string)
- uses_divisions (boolean)
- status (ENUM)
- soft_lock_until (timestamp | NULL)
- archived_at (timestamp | NULL)
- deleted_at (timestamp | NULL)
- schema_version (integer)
- product_version (integer)
- created_at
- updated_at

---

## License Status Model (Authoritative)

Status ENUM must be identical to Stage 04 definition.

Allowed states:

- PENDING_PROVISION
- ACTIVE
- SOFT_LOCKED
- ARCHIVED
- DELETED

Rules:

- PENDING_PROVISION: created but DB not yet provisioned
- ACTIVE: fully operational
- SOFT_LOCKED: access blocked, recoverable
- ARCHIVED: snapshot taken, DB inactive
- DELETED: terminal state

Status must never be inferred.
Status must never be duplicated in tenants_registry.

tenants_registry must reflect license state, not redefine it.

---

## License Creation Flow (Asynchronous Provisioning Model)

Provisioning model: Asynchronous job queue

Flow:

1. Validate product exists and is ACTIVE.
2. Validate workspace_slug uniqueness.
3. Validate slug format (lowercase, alphanumeric + dash).
4. Validate student_limit ≥ 0 or NULL.
5. Validate staff_limit ≥ 0 or NULL.
6. Insert license with:
   - status = PENDING_PROVISION
   - schema_version = current platform version
   - product_version = current product version
7. Dispatch provisioning job.
8. Provisioning worker:
   - Creates tenant DB
   - Runs baseline migrations
   - Seeds baseline roles/settings
   - Inserts into tenants_registry
9. On success:
   - Update status → ACTIVE
10. On failure:

- Update status → DELETED or keep PENDING with error flag
- Log structured error

Login must be blocked while status = PENDING_PROVISION.

Provisioning must be idempotent.

---

## Limits Model

student_limit:

- Total registered students.
- Not concurrent users.
- NULL = unlimited.

staff_limit:

- Total registered staff.
- NULL = unlimited.

Limit enforcement occurs inside tenant API layer.
Limit check must be transactional.
Limit check must not rely on cached counters.

Changing limits is allowed and must take effect immediately.

---

## Editable vs Immutable Fields

Editable:

- student_limit
- staff_limit
- commission_per_user
- use_zidney_payment
- default_language
- uses_divisions

Not Editable:

- workspace_slug
- product_id
- schema_version (migration-controlled)
- product_version (upgrade-controlled)
- created_at

Changing product requires new license creation.
No in-place product swap allowed.

---

## License Lifecycle Operations (MMC Layer)

MMC may trigger:

- Soft lock
- Restore from soft lock
- Archive
- Restore from archive
- Permanent delete (only if archived)

MMC must not:

- Directly manipulate tenant DB
- Drop database manually
- Skip archive before delete

All destructive operations must route through Provisioning Service.

---

## License Listing Requirements (MMC UI)

License table must support:

- Filter by status
- Filter by product
- Search by workspace_slug
- Quick filters (ACTIVE, SOFT_LOCKED, ARCHIVED)
- Pagination
- Sorting by created_at

Row actions:

- View details
- Edit limits
- Soft lock
- Archive
- Delete (only if ARCHIVED)

Displayed fields:

- workspace_slug
- workspace_name
- product_name
- status
- student_limit
- staff_limit
- created_at

Usage metrics (student count) must be retrieved safely from tenant DB via read-only query and must not break if tenant unavailable.

---

## Version Integrity

schema_version and product_version stored in license must:

- Match tenant DB schema_version
- Match product version at provisioning time

Upgrade model:

- When product updates:
  - License stores “upgrade_available”
  - Workspace must explicitly opt-in upgrade
  - Migration executed before version increment

License version must never auto-downgrade.

---

## Hard Constraints

Not allowed:

- License without product
- Duplicate workspace_slug
- Manual DB creation outside provisioning
- Changing product_id
- Skipping PENDING_PROVISION state
- Direct DB manipulation from MMC
- Hard deletion without ARCHIVED state

---

## Validation Criteria

Stage is complete when:

- License creation triggers async provisioning
- PENDING_PROVISION blocks login
- ACTIVE license fully operational
- Limits editable and enforced downstream
- Product change blocked
- Lifecycle transitions restricted properly
- Status stored in single authoritative source
- Provisioning failures logged safely
- Deletion requires archive first

---

## Stability Principle

License management connects commercial control to technical infrastructure.

If License state diverges from tenant state,
Zidney loses operational integrity.

This stage must be stable before:

STAGE 11 – License Lifecycle Operations
