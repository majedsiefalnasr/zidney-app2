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

- License table: 21 fields with 6 status states (PENDING_PROVISION, ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED, PROVISION_FAILED)
- API Layer: 10 endpoints (create, list, get, edit, soft-lock, unlock, archive, restore, delete, retry-provisioning)
- Middleware Layer: License access gate with status validation and soft-lock lazy expiration
- Worker Layer: Provisioning job with idempotency, 5 retries, exponential backoff, 30m timeout
- Version Integrity: Immutable schema_version and product_version snapshots
- UI Layer: 7 views (list, detail, create, edit, soft-lock modal, archive modal, restore confirmation)
- Migration: 3 forward-only migrations for schema creation, provisioning fields, status enum

Deferred Scope:

- Actual database provisioning logic (Stage 05 - DBInitializer)
- Snapshot/archive implementation (Stage 11)
- Limits enforcement in runtime (Stage 04+)
- Payment processing integration (future)

Constitutional Compliance:

- Technical plan designed and validated
- Database-per-tenant architecture preserved
- License as single source of truth established
- Multi-tenancy isolation guaranteed
- Version immutability enforced
- All ADRs aligned (0001, 0005, 0006, 0007, 0008)
- Middleware order: Correlation ID → License Check → Tenant Routing
- Error handling RFC 7807 compliant
- Structured logging with correlation_id ready

Decision Implementations Locked:

- Status enum includes PROVISION_FAILED for timeout recovery
- tenants_registry: status field removed (master_db authoritative)
- upgrade_available: computed field in License GET response
- Provisioning errors: hybrid visibility (sanitized UI + full backend logs)
- Retry policy: 5 retries, 2s base exponential, 30m timeout implemented
- Soft-lock validation: CHECK constraint for future timestamps
- Soft-lock expiration: lazy evaluation on next request (SOFT_LOCKED → ARCHIVED)
- Timeout responsibility: job queue framework (not STAGE_10)

Notes:
Technical plan complete and implementation-ready. All layers specified, all endpoints designed, all migrations drafted. Constitutional mandates validated. Ready for Task generation step.

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

---

## Stage Status

Status: DRAFT
Risk Level: MEDIUM
Last Updated: 2026-02-22T12:30:00Z

Tasks Defined:

- Total: 117 atomic tasks
- Database: 7 tasks (schema, migrations, versioning)
- API: 6 endpoints + 3 middleware + 5 job tasks
- UI: 11 components (7 views, filters, forms, modals)
- Testing: 17 test suites (unit, integration, E2E, security)
- Infrastructure: 21 tasks (setup, validation, logging, optimization)

Constitutional Compliance:

- Task set compliant with all ADRs
- Database-per-tenant isolation enforced
- Transactional boundaries defined (18 write tasks)
- Idempotency mechanisms specified (8 tasks)
- Middleware dependencies explicit
- All error codes mapped (RFC 7807)

Notes:
Atomic task set generated. Drift analysis gate pending.
