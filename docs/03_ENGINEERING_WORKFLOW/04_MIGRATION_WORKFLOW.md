# Migration Workflow

Zidney uses database-per-tenant architecture.

Every tenant database has its own schema version.
Schema evolution must be deterministic, versioned, and reversible where possible.

This document defines the only allowed migration workflow.

---

## Core Principles

- Migrations are immutable.
- Historical migration files must never be edited after merge.
- Every schema change requires a schema_version bump.
- Destructive changes require snapshot capability.
- Migrations must be idempotent and deterministic.

Schema governance is defined in:

- docs/architecture/adr/adr-0008-formalize-semantic-versioning-policy.md

---

## Local Development Workflow

When introducing schema changes:

1. Update Drizzle schema definition.
2. Generate new migration file (timestamp-prefixed).
3. Apply migration to:
   - Fresh database
   - Database with realistic data
4. Verify:
   - No data corruption
   - No implicit column drops
   - Indexes created correctly
5. Update expected schema_version constant.

Migration filename format:

YYYYMMDD_description.sql

Example:

20250201_add_exam_duration_column.sql

Never rename a migration after commit.

---

## Multi-Developer Conflict Prevention

Before opening a PR:

- Pull latest main branch.
- Ensure no migration conflict exists.
- If conflict exists:
  - Regenerate migration cleanly.
  - Never modify already-merged migrations.

Rules:

- Each branch introducing schema change must include its own migration.
- Two developers must never modify the same migration file.
- Migration ordering must remain chronological.

If migration order conflict occurs:

- Rebase branch
- Regenerate migration
- Re-test locally

---

## Version Alignment Requirement

Every migration must:

- Increment schema_version
- Be compatible with product_version rules

Runtime must reject tenant DB where:

- schema_version < minimum supported
- product_version incompatible

Version enforcement is mandatory at middleware level.

---

## Production Upgrade Strategy (Per Tenant)

Upgrades are executed per workspace.

Upgrade process:

1. Validate license status = ACTIVE
2. Create full database snapshot
3. Apply migrations in order
4. Update schema_version
5. Log upgrade event
6. Release runtime compatibility

Upgrade must be atomic per tenant.

If migration fails:

- Stop execution
- Restore snapshot
- Mark tenant as UPGRADE_FAILED
- Log structured error

No partial upgrade state allowed.

---

## Rollback Strategy

Rollback depends on migration type.

Non-destructive migrations:

- Can be reversed with companion migration

Destructive migrations:

- Require full snapshot restore
- Cannot rely on reverse SQL alone

Never attempt manual schema rollback in production.

---

## Worker Upgrade Orchestration

Upgrades must be executed via worker job queue.

License enters:

UPGRADING state

During upgrade:

- Workspace access blocked
- Resolver rejects runtime requests

After successful upgrade:

- License status returns to ACTIVE

---

## Observability Requirements

Every migration event must log:

- workspace_slug
- old_schema_version
- new_schema_version
- execution_time_ms
- success | failure

Logs must be structured and correlated.

---

## Forbidden Practices

- Editing old migration files
- Running manual SQL directly in production
- Skipping schema_version update
- Deploying runtime incompatible with schema
- Applying migration without snapshot

Violation is architectural breach.

---

## Stability Principle

Schema integrity protects:

- Tenant isolation
- Attempt integrity
- Version compatibility
- Institutional trust

Migration discipline is mandatory.
