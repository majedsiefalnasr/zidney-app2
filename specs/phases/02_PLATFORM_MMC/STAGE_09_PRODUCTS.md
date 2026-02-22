# STAGE 09 – Products Management

Phase: 2 – Platform MMC  
Status: Critical  
Scope: Product entity, configuration model, module control, and versioning

---

## Stage Status

Status: PENDING  
Risk Level: UNKNOWN  
Initiated: 2026-02-22T00:00:00Z

Scope Open:

- Specification pending

Constitutional Compliance:

- Pending constitutional audit

Notes:
Stage initialized. Specification in progress.

---

## Objective

Implement Product Management inside MMC.

Product represents:

- A commercial offering
- A module bundle definition
- A versioned configuration baseline
- A licensing template

Products are the source of licenses.

---

## Product Role in Zidney

Product defines:

- Enabled modules
- Base configuration flags
- Default system capabilities
- Future feature flags

Relationship:

Product → License → Workspace

One product can have many licenses.  
One license references exactly one product.

Products must never reference tenant databases.

---

## Product Table (master_db)

### Core Fields

- id (uuid)
- name (JSON for multi-language support)
- slug (unique, immutable)
- description (nullable)
- enabled_modules (JSON array)
- status (ACTIVE | INACTIVE)
- created_at
- updated_at

### Versioning Fields

- current_version (integer)

Version history must be stored in separate table:

product_versions:

- id
- product_id
- version_number
- change_summary
- created_at

Slug rules:

- lowercase
- alphanumeric + dash
- globally unique
- immutable after creation

---

## Enabled Modules Contract

Allowed modules (enum-controlled, not free-text):

- MCQ
- TRADITIONAL_EXAMS
- EXERCISES
- LIBRARY
- LIVES
- FORUM

Rules:

- At least one module required
- Modules must be validated against allowed enum
- Removing a module only affects future licenses
- Existing licenses remain unchanged

Disabled module in product:

- Must not be provisioned in new workspaces
- Must not be accessible in Backoffice
- Must not be accessible in Frontoffice

Module enforcement must occur at:

- License creation time
- Runtime authorization middleware

---

## Product Versioning Model

Products evolve over time.

Rules:

- Each structural change increments version
- Version increment must be atomic
- Version must never decrease
- Version history immutable

License stores product_version at creation.

When product updates:

- Existing licenses remain pinned to old version
- Update availability flag stored
- Workspace must explicitly opt-in upgrade

No automatic upgrade allowed.

Upgrade logic handled in License Engine stage.

---

## Product Status Model

ACTIVE:

- Can create new licenses
- Visible in license creation flow

INACTIVE:

- Cannot create new licenses
- Existing licenses remain valid

Deletion rules:

- Hard delete prohibited if any license exists
- Soft delete allowed only if no licenses exist

---

## Product Creation Flow

1. Validate slug uniqueness
2. Validate module list
3. Set current_version = 1
4. Insert product record
5. Insert version record (version 1)
6. Log audit event

No provisioning occurs at product creation.

---

## Product Update Flow

1. Validate changes
2. Create new version record
3. Increment current_version
4. Do not modify existing licenses
5. Mark update_available for affected licenses (optional flag)
6. Log audit event

Product updates must never:

- Modify existing tenant schema
- Force runtime upgrade
- Break backward compatibility

---

## Audit Requirements

Every product change must log:

- product_id
- previous_version
- new_version
- changed_fields
- performed_by
- timestamp

Audit logs must be immutable.

---

## Product Listing (MMC UI Requirements)

Must support:

- Search by name or slug
- Status filter (ACTIVE / INACTIVE)
- Pagination
- Sorting by created_at
- View licenses count
- View current_version

Actions per row:

- View
- Edit
- Disable

Bulk actions allowed for:

- Disable only

---

## Validation Criteria

Stage complete when:

- Product CRUD operational
- Slug uniqueness enforced at DB level
- Module enum validation enforced
- Version increments correctly
- Version history immutable
- Existing licenses unaffected by updates
- INACTIVE product cannot create new license
- Audit logs generated

---

## Not Allowed

- Editing slug after creation
- Removing module retroactively for existing licenses
- Hard deleting product with licenses
- Automatic license upgrades
- Direct tenant DB access from product logic

---

## Stability Principle

Products define what institutions purchase.

If product configuration mutates retroactively,
commercial trust collapses.

Product version isolation must be stable before:

STAGE_10_LICENSES
