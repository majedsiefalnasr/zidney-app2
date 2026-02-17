# STAGE 02A – Master Database Schema

Phase: 1 – Platform Foundation  
Depends on: STAGE_02_MULTI_TENANCY_ARCHITECTURE

---

## Stage Status

Status: PRODUCTION READY  
Risk Level: LOW  
Closure Date: 2026-02-16

Scope Closed:

- Master DB schema finalized
- Migration system implemented
- tenants_registry table enforced
- RBAC + integrity constraints validated
- 40/40 tasks completed
- Drift audit: 0 violations

Deferred Scope:

- None

Constitutional Compliance:

- Master DB strictly separated from tenant data
- No runtime data stored in master_db

Notes:
Master schema considered stable. Breaking changes require new stage.

---

## Objective

Define the authoritative schema for `master_db`.

Master DB is the control plane of Zidney.
It must remain small, secure, and stable.

It never stores tenant runtime data.

---

## Master DB Tables

### products

Represents sellable product types.

Fields:

- id (uuid, pk)
- name
- slug (unique)
- description
- version (semantic version string)
- enabled_modules (jsonb)
- created_at
- updated_at

Rules:

- Product versioning is semantic (e.g., 1.0.0)
- Product changes affect new licenses by default

---

### licenses

Represents a purchased product instance.

Fields:

- id (uuid, pk)
- product_id (fk → products)
- workspace_slug (unique)
- student_limit (integer | null for unlimited)
- staff_limit (integer | null for unlimited)
- status (ACTIVE | SOFT_LOCKED | ARCHIVED)
- starts_at
- expires_at
- product_version
- schema_version
- soft_lock_until (timestamp | null)
- archived_at (timestamp | null)
- deleted_at (timestamp | null)
- created_at
- updated_at

Rules:

- License controls workspace lifecycle
- Limit enforcement is runtime-based

---

### tenants_registry

Critical control table.

Fields:

- id (uuid, pk)
- license_id (fk → licenses)
- workspace_slug (unique)
- db_name
- db_host
- db_port
- db_user
- db_password_encrypted
- schema_version
- product_version
- created_at
- updated_at

Rules:

- This table stores infrastructure metadata only
- License lifecycle state MUST be read from `licenses` table
- Resolver must join registry with licenses for enforcement

---

### mmc_users

Platform internal users.

Fields:

- id
- email
- password_hash
- role
- is_active
- created_at

---

### platform_schema_version

Single row table.

Fields:

- id (1)
- current_version
- minimum_supported_version
- updated_at

Purpose:

- Controls tenant compatibility
- Blocks incompatible runtimes

---

## Forbidden in Master DB

- students
- attempts
- exams
- certificates
- subscriptions
- content
- translations

Master DB must remain small and secure.

---

## Architectural Authority Rules

- `licenses` table is the single source of truth for lifecycle state
- `tenants_registry` must never duplicate license status
- No business logic allowed inside master_db
- All lifecycle transitions must update `licenses` first
- `tenants_registry` exists purely for connection resolution

This stage is frozen once approved.
