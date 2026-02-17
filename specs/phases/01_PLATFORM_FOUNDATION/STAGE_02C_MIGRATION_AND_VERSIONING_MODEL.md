# STAGE 02C – Migration & Versioning Model

Phase: 1 – Platform Foundation  
Status: Critical  
Scope: Master & Tenant schema evolution governance

---

## Stage Status

Status: BACKEND CLOSED  
UI Status: Deferred  
Closure Date: 2025-02-16

### Closure Scope

The following components are complete and production-ready:

- Master DB migration & version tables
- Tenant schema version tracking
- Semantic version enforcement (ADR-0008)
- Product compatibility validation (ADR-0007)
- Upgrade orchestration service
- Worker-based migration executor
- Locking strategy with timeout enforcement
- Retry strategy (max 3 exponential backoff)
- DLQ escalation for checksum mismatch
- Structured logging & metrics hooks
- Unit + integration test scaffolding

### Deferred Scope

Frontend upgrade interface components:

- UpgradeStatus
- UpgradeForm
- UpgradeHistory
- UpgradePage

UI implementation is deferred to:

Phase 2 — PLATFORM MMC  
Stage 16 — Shared UI System

Stage 02C is considered **backend-complete and constitutionally compliant**.

---

## Objective

Define a strict, deterministic migration and versioning model that guarantees:

- No schema drift
- No cross-tenant inconsistency
- Controlled upgrade paths
- Safe forward-only evolution
- Explicit compatibility enforcement
- Snapshot-backed upgrade safety
- Full alignment with ADR-0008 (Semantic Versioning Policy)

Schema integrity is non-negotiable.

This stage operationalizes ADR-0008.

---

## Governing ADR

This stage is governed by:

ADR-0008 — Formalize Semantic Versioning Policy

All version increments, compatibility checks, and upgrade orchestration must comply with ADR-0008.

If conflict exists between this document and ADR-0008, ADR-0008 prevails.

---

## Core Principles

1. Forward-only migrations.
2. No destructive migration without explicit manual approval.
3. No automatic rollback in production (only snapshot-based recovery).
4. No runtime schema modification.
5. No per-tenant schema divergence.
6. All schema state must be version-tracked.
7. Platform runtime must never assume implicit schema compatibility.
8. No schema change without version increment.

---

## Version Model

There are THREE version dimensions.

### Platform Schema Version (Global)

Stored in:

master_db.platform_settings

Fields:

- current_schema_version
- minimum_supported_schema_version

Defines:

- Latest available schema
- Lowest schema version allowed to run with current runtime

If tenant.schema_version < minimum_supported_schema_version  
→ Runtime must reject (426 Upgrade Required)

---

### Tenant Schema Version (Per Workspace)

Stored in:

tenant_db.schema_version (single-row table)

Fields:

- version
- applied_at

Mirrored in:

master_db.tenants_registry.schema_version

Mirroring exists for:

- Fast compatibility checks
- Resolver-level blocking
- Upgrade observability
- Administrative visibility

The source of truth remains tenant_db.schema_version.

---

### Product Version (Commercial Layer)

Stored in:

master_db.licenses.product_version

Governed by ADR-0008.

Controls:

- Enabled modules
- Feature surface
- Behavioral configuration

Product version and schema version are independent but validated together at runtime.

---

## Semantic Version Alignment

Schema version must follow SemVer:

MAJOR.MINOR.PATCH

Rules:

PATCH:

- Non-breaking fixes
- No structural change

MINOR:

- Additive schema change
- Backward-compatible
- New tables, nullable columns, indexes

MAJOR:

- Breaking schema change
- Column removal
- Type change
- Constraint redesign
- Requires explicit upgrade and snapshot

No schema change may occur without version bump.

---

## Migration Folder Structure

backend/
migrations/
master/
001_init.sql
002_license_engine.sql
tenant/
001_baseline.sql
002_attempt_engine.sql
003_exam_engine.sql

Rules:

- Sequential numeric naming
- Immutable once merged
- Never edited after production deployment
- New change → new migration file only
- Each migration must declare:
  - target_schema_version
  - required_min_product_version
  - breaking (true | false)

No silent schema change allowed.

---

## Master Migration Flow

Master DB migrations:

- Applied on deployment
- Executed before application startup
- Blocking if failed

Master DB must always match current_schema_version.

If mismatch:

- Runtime must refuse to boot.

---

## Tenant Migration Flow

Tenant upgrades are opt-in per workspace.

Upgrade flow:

1. Platform release increases current_schema_version
2. Tenant migration files exist
3. Workspace admin triggers upgrade
4. System:
   - Validates license ACTIVE
   - Validates compatibility preconditions
   - Takes full DB snapshot
   - Locks workspace
   - Executes migrations in transaction
   - Updates tenant.schema_version
   - Updates tenants_registry.schema_version
   - Updates license.product_version (if required)
   - Unlocks workspace

If migration fails:

- Transaction rolls back
- Workspace remains on old schema_version
- Snapshot retained
- CRITICAL log emitted
- Manual intervention required

Partial state is forbidden.

---

## Compatibility Enforcement

On every workspace-bound request:

Resolver must validate:

- tenant.schema_version ≥ minimum_supported_schema_version
- license.product_version compatible with runtime (ADR-0008)

If incompatible:
→ Reject request (426 Upgrade Required)

Runtime execution must never proceed under incompatible conditions.

---

## Upgrade Safety Requirements

Before running any tenant migration:

- Full database snapshot required
- Snapshot ID persisted
- Migration checksum validated
- Execution inside single transaction
- Workspace write lock enforced
- No concurrent attempt execution allowed
- No concurrent background job allowed

Upgrade must be atomic.

---

## Destructive Migration Policy

Destructive changes:

- DROP COLUMN
- DROP TABLE
- Column type narrowing
- Constraint removal

Require:

- Explicit MAJOR version increment
- Snapshot mandatory
- Manual approval required
- Release documentation

No silent destructive migration allowed.

---

## Idempotency & Consistency Rules

Migration runner must:

- Track applied migrations
- Validate checksum
- Prevent duplicate execution
- Detect missing migration gaps
- Refuse to continue if gap detected

If migration 003 missing:
→ Execution must stop.

No migration skipping allowed.

---

## Rollback Model

Rollback allowed only via:

- Snapshot restoration
- Version metadata reset

Rollback must:

- Restore previous schema_version
- Restore previous product_version
- Restore DB snapshot
- Log CRITICAL rollback event

No partial rollback permitted.

---

## Upgrade Logging

Every tenant upgrade must log:

- workspace_slug
- previous_schema_version
- target_schema_version
- previous_product_version
- target_product_version
- snapshot_id
- migration_files_applied
- execution_time
- status (SUCCESS | FAILED)
- operator_id

Logs must be immutable and structured.

---

## What Is Strictly Forbidden

- Editing past migration files
- Manual schema change in production
- Per-tenant schema customization
- Runtime auto-migration
- Silent upgrade
- Skipping migration numbers
- Cross-tenant schema differences
- Schema change without SemVer increment

---

## Validation Criteria

Stage complete when:

- Master migration runner implemented
- Tenant migration runner implemented
- Snapshot-before-upgrade enforced
- Version mismatch blocks runtime
- Product compatibility enforced
- Duplicate migration execution prevented
- Failed migration fully rolls back
- Upgrade log persisted
- Resolver enforces minimum schema version
- Enforcement aligned with ADR-0008

---

## Stability Principle

Schema versioning is the backbone of institutional trust.

If tenants run inconsistent schema,  
Zidney becomes unpredictable.

Migration discipline must be absolute.
