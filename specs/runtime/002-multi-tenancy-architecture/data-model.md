# Data Model: Implement multi-tenancy architecture for Zidney platform

**Date**: 2026-02-15 **Feature**:
[specs/runtime/002-multi-tenancy-architecture/spec.md](specs/runtime/002-multi-tenancy-architecture/spec.md)

## Entities

### tenants_registry (Master DB)

**Purpose**: Infrastructure metadata for tenant databases, no commercial data.

**Fields**:

- `id` (UUID, primary key)
- `workspace_slug` (string, unique, lowercase alphanumeric + dash)
- `db_name` (string, format: workspace\_<slug>)
- `db_host` (string)
- `db_port` (integer)
- `db_user` (string)
- `db_password` (string, encrypted)
- `schema_version` (string, semantic version)
- `product_version` (string, semantic version)
- `created_at` (timestamp, server time)
- `updated_at` (timestamp, server time)

**Relationships**:

- Unique on workspace_slug
- Referenced by licenses.workspace_slug (foreign key)

**Validation Rules**:

- workspace_slug: 3-50 chars, starts with letter, no consecutive dashes
- db_name: auto-generated from slug
- schema_version: valid semver
- product_version: valid semver

**State Transitions**: None (static registry)

**Lifecycle**: Created during provisioning, immutable except updates for migrations.

### licenses (Master DB, Existing)

**Referenced Fields**:

- `workspace_slug` (foreign key to tenants_registry)
- `status` (enum: ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED)
- `product_version` (string, semver)

**Usage**: Enforced in middleware for access control and version compatibility.

## Data Volume Assumptions

- <100 tenants initially
- Registry grows slowly (one per workspace)
- No high-frequency updates

## Security Considerations

- db_password encrypted at rest
- No sensitive data in registry
- Access controlled via middleware
