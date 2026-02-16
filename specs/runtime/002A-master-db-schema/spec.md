# Feature Specification: Master Database Schema Implementation

**Feature Branch**: `002A-master-db-schema`  
**Created**: 2026-02-16  
**Status**: Draft  
**Input**: User description: "Implement master database schema as defined in STAGE_02A_MASTER_DATABASE_SCHEMA"

## Feature Overview

What is being built: Implementation of the master database schema for Zidney's control plane, including all required tables for product management, licensing, tenant registry, MMC users, and platform versioning.

Phase: 01 – Platform Foundation  
Stage: STAGE_02A_MASTER_DATABASE_SCHEMA  
Reference: [STAGE_02A_MASTER_DATABASE_SCHEMA.md](STAGE_02A_MASTER_DATABASE_SCHEMA.md)

Affects:

- Isolation: Defines master database structure
- License enforcement: Provides foundation for license validation
- Attempt engine: No direct impact
- Worker: No direct impact
- Runtime: No direct impact
- Frontoffice: No direct impact

## Constitutional Compliance Declaration

- No cross-tenant access: Master DB only, no tenant data
- No middleware bypass: N/A (schema only)
- No grading outside worker: N/A
- No direct DB instantiation: Schema definition only
- No weakening of snapshot integrity: N/A
- No weakening of transaction boundaries: DDL operations atomic
- No weakening of version enforcement: Enables version enforcement

No exceptions required.

## Isolation Impact Analysis

- Database accessed: master
- Tenant resolution: N/A (master database)
- Connection pool: Master connection pool
- Resolver middleware: Not applicable
- New tables introduced: products, licenses, tenants_registry, mmc_users, platform_schema_version

No shared tenant data.

## License & Version Enforcement

This feature establishes the schema foundation for license and version enforcement. Specific enforcement logic will be implemented in subsequent features.

- License middleware required: For future operations on this schema
- License states allowed: ACTIVE, SOFT_LOCKED, ARCHIVED (as defined in schema)
- Limit enforcement required: Schema supports student_limit, staff_limit
- Schema_version checked: Schema includes schema_version fields
- Product_version checked: Schema includes product_version fields

## Data Model Changes

New tables:

- products
- licenses
- tenants_registry
- mmc_users
- platform_schema_version

Modified tables: None

Migration impact: Initial master database migration required
Version bump required: Yes (initial schema_version)
Backward compatibility strategy: N/A (initial schema)

Aligns with STAGE_02C_MIGRATION_AND_VERSIONING_MODEL.

## Transaction Boundaries

Schema creation (DDL) operations are atomic by database design.
No runtime transactions defined in this feature.

## Authoritative Time Usage

All timestamp fields (created_at, updated_at, starts_at, expires_at, etc.) will use server-authoritative time.
No client time involved.

## Idempotency Strategy

N/A - Schema creation is not an endpoint operation.

## Observability Requirements

For future operations:

- Structured log fields: timestamp, level, service, workspace_slug, workspace_id, user_id, correlation_id
- request_id included: Yes
- workspace_slug included: Yes (for tenant operations)
- attempt_id included: N/A
- Error contract compliance: Yes
- Metrics emitted: Schema version checks

## Rate Limiting & Abuse Protection

N/A - Schema creation is not a runtime endpoint.

## Layer Separation Confirmation

- Frontend contains no business logic: N/A
- API contains no grading logic: N/A
- Worker contains no HTTP logic: N/A
- MMC does not access tenant DB: Schema prevents this
- No direct DB creation outside provisioning: Schema supports controlled provisioning

## Failure Modes & Recovery

- Schema creation failure: Manual intervention required, rollback migration
- Version mismatch: Handled by future enforcement logic
- License block: Handled by future enforcement logic
- Worker failure: N/A
- Timeout: N/A
- DLQ behavior: N/A

## Test Strategy

- Unit tests required: For any domain logic (minimal)
- Integration tests required: Migration execution test
- Transaction rollback test: DDL rollback test
- Idempotency test: N/A
- Version compatibility test: Schema compatibility validation
- Isolation test: Master DB isolation verification

## User Scenarios & Testing

### Scenario 1: Tenant Provisioning

**Given** a new license is purchased  
**When** the provisioning process runs  
**Then** entries are created in licenses and tenants_registry tables  
**And** the tenant database connection details are stored securely

### Scenario 2: License Validation

**Given** a workspace request arrives  
**When** license middleware checks the license  
**Then** it queries the licenses table for status and limits  
**And** blocks access if SOFT_LOCKED or ARCHIVED

### Scenario 3: MMC User Authentication

**Given** an MMC user attempts login  
**When** credentials are validated  
**Then** the mmc_users table is queried for email and password_hash  
**And** role-based access is granted

### Scenario 4: Platform Version Check

**Given** a runtime starts  
**When** version compatibility is checked  
**Then** platform_schema_version table is queried  
**And** incompatible runtimes are blocked

## Functional Requirements

1. Create `products` table with fields: id (uuid, pk), name, slug (unique), description, version (semantic), enabled_modules (jsonb), created_at, updated_at
2. Create `licenses` table with fields: id (uuid, pk), product_id (fk), workspace_slug (unique), student_limit, staff_limit, status, starts_at, expires_at, product_version, schema_version, soft_lock_until, archived_at, deleted_at, created_at, updated_at
3. Create `tenants_registry` table with fields: id (uuid, pk), license_id (fk), workspace_slug (unique), db_name, db_host, db_port, db_user, db_password_encrypted, schema_version, product_version, created_at, updated_at
4. Create `mmc_users` table with fields: id, email, password_hash, role, is_active, created_at
5. Create `platform_schema_version` table with single row: id (1), current_version, minimum_supported_version, updated_at
6. Implement initial migration script for master database
7. Ensure all foreign key constraints are properly defined
8. Ensure unique constraints on workspace_slug fields
9. Use server-authoritative timestamps for all timestamp fields

## Success Criteria

- Master database schema exactly matches STAGE_02A_MASTER_DATABASE_SCHEMA specification
- Migration script executes successfully on clean database
- All table constraints (PK, FK, unique) are enforced
- Schema supports database-per-tenant architecture
- No forbidden tables (students, attempts, etc.) are present
- Schema remains small and secure as control plane

## Key Entities

- Product: Sellable product type with versioning
- License: Purchased product instance with lifecycle state
- Tenant Registry: Infrastructure metadata for tenant databases
- MMC User: Platform internal user
- Platform Schema Version: Version compatibility control

## Assumptions

- PostgreSQL database engine used
- UUID extension available
- Semantic versioning strings handled as text
- JSONB type available for enabled_modules
- Password encryption handled at application layer
- Initial schema_version starts at 1.0.0

## Explicit Non-Goals

- Implement business logic for license validation
- Implement API endpoints for CRUD operations
- Implement MMC user authentication logic
- Implement tenant provisioning logic
- Implement version compatibility checks
- Define tenant database schemas
- Implement runtime middleware

## Final Constitutional Compliance Statement

Compliant with Zidney Constitution v1.2.0 — No violations detected.
IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
you should still have a viable MVP (Minimum Viable Product) that delivers value.

Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
Think of each story as a standalone slice of functionality that can be:

- Developed independently
- Tested independently
- Deployed independently
- Demonstrated to users independently
  -->

### User Story 1 - [Brief Title] (Priority: P1)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently - e.g., "Can be fully tested by [specific action] and delivers [specific value]"]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 2 - [Brief Title] (Priority: P2)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 3 - [Brief Title] (Priority: P3)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right edge cases.
-->

- What happens when [boundary condition]?
- How does system handle [error scenario]?

## Requirements _(mandatory)_

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST [specific capability, e.g., "allow users to create accounts"]
- **FR-002**: System MUST [specific capability, e.g., "validate email addresses"]
- **FR-003**: Users MUST be able to [key interaction, e.g., "reset their password"]
- **FR-004**: System MUST [data requirement, e.g., "persist user preferences"]
- **FR-005**: System MUST [behavior, e.g., "log all security events"]

_Example of marking unclear requirements:_

- **FR-006**: System MUST authenticate users via [NEEDS CLARIFICATION: auth method not specified - email/password, SSO, OAuth?]
- **FR-007**: System MUST retain user data for [NEEDS CLARIFICATION: retention period not specified]

### Key Entities _(include if feature involves data)_

- **[Entity 1]**: [What it represents, key attributes without implementation]
- **[Entity 2]**: [What it represents, relationships to other entities]

## Success Criteria _(mandatory)_

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: [Measurable metric, e.g., "Users can complete account creation in under 2 minutes"]
- **SC-002**: [Measurable metric, e.g., "System handles 1000 concurrent users without degradation"]
- **SC-003**: [User satisfaction metric, e.g., "90% of users successfully complete primary task on first attempt"]
- **SC-004**: [Business metric, e.g., "Reduce support tickets related to [X] by 50%"]
