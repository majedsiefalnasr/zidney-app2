# Backup and Recovery

Phase: DevOps & Deployment  
Scope: Master DB, Tenant DBs, Snapshots, Disaster Recovery  
Applies to: VPS (Docker-based deployment)

---

## Objectives

This document defines:

- Backup policy for master_db and tenant databases
- Snapshot policy for archived workspaces
- Restore procedures
- Disaster recovery guarantees
- Operational safeguards

Backups must preserve:

- Tenant isolation
- License integrity
- Attempt history
- Certificates
- Billing records

Data integrity is a trust requirement.

---

## Backup Scope

The following must be backed up:

### Master Database (master_db)

Contains:

- products
- licenses
- tenants_registry
- mmc_users
- platform_settings
- schema_versions

Loss of master_db breaks platform control.

### Tenant Databases (workspace\_<slug>)

Each workspace database must be backed up independently.

Contains:

- users (staff + students)
- exams
- questions
- attempts
- grading data
- certificates
- subscriptions
- translations
- academic structure

Tenant backups must be logically restorable without affecting other tenants.

---

## Backup Policy

### Frequency

- Nightly full logical backup (pg_dump)
- Weekly compressed full snapshot
- Monthly long-term archive (retained 6–12 months)

### Retention

- Daily backups: 7 days
- Weekly backups: 4 weeks
- Monthly backups: 6–12 months

Retention must be automated.

---

## Snapshot Policy (Archive Lifecycle)

Before transitioning:

SOFT_LOCKED → ARCHIVED

System MUST:

1. Ensure no active DB connections
2. Ensure no in-progress attempts
3. Take full database snapshot
4. Store metadata in master_db:
   - snapshot_id
   - snapshot_location
   - snapshot_timestamp
   - schema_version

Archived workspace must not allow writes.

Snapshots must be:

- Immutable
- Version-tagged
- Stored outside primary DB volume
- Encrypted at rest (recommended)

---

## Backup Storage Requirements

Backups must:

- Not reside only on the same VPS disk
- Be copied to off-site storage (object storage recommended)
- Be encrypted at rest
- Be access-controlled

Do not store plaintext dumps in repository or container.

---

## Restore Strategy

Restore must support:

- Full platform restore
- Single-tenant restore
- Archived workspace restore

### Full Platform Restore

1. Stop all services
2. Restore master_db
3. Restore all tenant databases
4. Validate schema versions
5. Start services
6. Run integrity checks
7. Validate authentication
8. Validate attempt engine

### Single Tenant Restore

1. Stop API (maintenance mode)
2. Drop corrupted tenant DB
3. Restore from snapshot
4. Verify schema_version
5. Validate license status
6. Re-enable workspace

Must not affect other tenants.

---

## Disaster Recovery Objectives

Recovery Time Objective (RTO):

- < 2 hours for full platform
- < 1 hour for single tenant

Recovery Point Objective (RPO):

- < 24 hours

These must be testable.

---

## Recovery Testing

Recovery must be tested:

- Quarterly (minimum)
- After major schema migration
- After infrastructure changes

Test must include:

- Attempt integrity
- Authentication
- License enforcement
- Certificate validation

Backup without restore testing is invalid.

---

## Integrity Safeguards

Before destructive operations:

- Major migration
- Version upgrade
- License deletion
- Database deletion

System must:

- Trigger pre-operation snapshot
- Log snapshot_id
- Require confirmation

Deletion without snapshot is prohibited.

---

## Logging & Audit

All backup and restore events must log:

- workspace_slug (if applicable)
- snapshot_id
- operator_id (if manual)
- timestamp
- result (success/failure)

Logs must include correlation_id.

---

## Not Allowed

- Manual database deletion without snapshot
- Snapshot without metadata record
- Backup stored only on local disk
- Restore without schema version validation
- Skipping restore testing

---

## Stability Principle

Backup is not optional.

Institutional trust depends on:

- Recoverability
- Isolation preservation
- Version integrity

Backup and recovery must be production-grade before scaling.
