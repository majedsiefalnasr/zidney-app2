# STAGE 02B – Tenant Baseline Schema

Phase: 1 – Platform Foundation

---

## 🎯 Objective

Define mandatory baseline schema for every tenant database.

Each workspace database MUST:

- Start from identical schema version (v1.0.0)
- Follow strict normalization rules
- Enforce referential integrity
- Include audit fields on all business tables
- Disallow schema drift

No tenant-specific schema customization is allowed at DB level.
Customization must occur via configuration tables only.

---

## Core Tables

## Global Table Rules (Applies to ALL Tables)

Every business table MUST include:

- id (UUID v7 recommended)
- created_at (timestamp with timezone)
- updated_at (timestamp with timezone)
- created_by (nullable UUID)
- updated_by (nullable UUID)
- is_deleted (boolean default false)

Rules:

- No auto-increment integers as primary keys
- No composite primary keys
- All foreign keys must be explicit
- ON DELETE behavior must be defined (RESTRICT or CASCADE intentionally)
- Soft delete via is_deleted only (never hard delete runtime data)

Indexes must exist on:

- id (PK)
- foreign keys
- frequently queried fields

### Identity Layer

- users
- roles
- role_permissions

### Academic Structure

- divisions
- departments
- groups
- hierarchy_nodes
- teams
- semesters
- subjects
- lessons

### Classification

- categories
- category_values
- tags
- mcq_baskets

### Exam Engine

- mcq_questions
- traditional_questions
- mcq_exams
- traditional_exams
- scheduled_exams

### Runtime

- attempts
- attempt_answers
- attempt_events

Additional Constraints:

- attempts must snapshot configuration at start
- attempt_answers must reference attempt_id
- attempt_events must be append-only (no updates allowed)

### Commercial

- subscriptions
- invoices
- promocodes
- subscription_events

Rules:

- subscriptions must enforce unique active subscription per user
- invoice state must be explicit (PENDING | PAID | FAILED | REFUNDED)
- No financial calculations stored as floating point (use numeric)

### Communication

- notifications
- feedback
- system_feedback

### Media

- media_files

### Ads

- ads

### Certificates

- certificates
- certificate_templates

### System

- translations
- schema_version
- audit_logs (optional but recommended)

Rules:

- schema_version must contain exactly one row
- schema_version.version must follow semantic versioning
- schema_version checksum must match migration checksum
- audit_logs must be append-only

---

## Schema Version Table

schema_version table structure:

- version (semantic version string, NOT NULL)
- applied_at (timestamp with timezone, NOT NULL)
- checksum (string, NOT NULL)

Rules:

- Exactly one row allowed
- Updated only via migration process
- Never manually edited

---

## Rules

- No cross-database references
- No shared global IDs across tenants
- No cross-tenant foreign keys
- No implicit schema changes without migration

---

## Migration Authority

Tenant schema may only be modified through:

- Platform migration scripts
- Version-controlled migration files
- Deterministic execution order

Manual DB edits are strictly prohibited.

Migration order must:

1. Lock schema_version
2. Apply migration
3. Update schema_version
4. Commit transaction

If migration fails:
→ Rollback entire transaction

No partial migrations allowed.

---

## Stability Principle

Tenant baseline schema defines runtime integrity.

If baseline schema drifts,
attempt engine, grading, subscription enforcement, and audit systems become unreliable.

This stage must be frozen before implementing:

STAGE_02C_MIGRATION_AND_VERSIONING_MODEL
