# STAGE 05 – Tenant Provisioning Service

Phase: 1 – Platform Foundation  
Status: Critical  
Scope: Automatic tenant database lifecycle (create, initialize, archive, restore, delete)

---

## Objective

Implement the internal Tenant Provisioning Service responsible for:

- Creating tenant databases
- Running baseline tenant migrations
- Seeding required structural data
- Registering tenant in tenants_registry
- Handling archive snapshots
- Handling restoration
- Handling permanent deletion

Provisioning must be:

- Deterministic
- Idempotent
- Transaction-safe
- Lock-protected
- Auditable
- Internal-only

This service is not publicly exposed.

---

## Provisioning Execution Model (Finalized)

Provisioning runs asynchronously via internal job queue.

License lifecycle becomes:

CREATED → PROVISIONING → ACTIVE  
PROVISIONING → FAILED (on error)

Provisioning is triggered when:

License transitions to PROVISIONING.

License creation stores metadata only.  
Provisioning creates the physical workspace database.

No synchronous DB creation during API request is allowed.

---

## Provisioning Lock Mechanism (Mandatory)

Before provisioning starts, system must acquire a distributed lock.

Lock key:
provisioning:<workspace_slug>

Lock duration:
Short-lived (e.g., 60 seconds, auto-renewable)

If lock exists:
→ Abort provisioning attempt.

Prevents:

- Double database creation
- Parallel migrations
- Duplicate registry writes

Lock must be released only after successful completion or safe failure.

---

## Provisioning Flow

1. Acquire provisioning lock
2. Validate workspace_slug uniqueness
3. Create database: workspace\_<slug>
4. Run baseline tenant migrations
5. Seed baseline structural data
6. Insert row into tenants_registry
7. Update license.expected_schema_version
8. Update license status to ACTIVE
9. Release provisioning lock

If any step fails:

- Drop created database (if exists)
- Remove partial registry entry
- Mark license as FAILED
- Log failure with correlation_id
- Release lock

No partial state is allowed.

Provisioning must be atomic at system level.

---

## Database Creation Rules

Database name:

workspace\_<slug>

Slug rules:

- lowercase
- alphanumeric + dash
- globally unique
- immutable

Database must:

- Use same PostgreSQL instance
- Be compatible with connection pooling
- Be tracked in tenants_registry

Manual DB creation outside provisioning service is prohibited.

---

## Baseline Tenant Schema

Initial migration must create structural tables only:

- users
- roles
- role_permissions
- divisions
- departments
- groups
- subscriptions
- attempts
- exams
- mcq_questions
- traditional_questions
- translations
- certificates
- settings
- schema_version

No business data seeded.

Schema version must be written to:

tenant.schema_version.current_schema_version

---

## Seeding Requirements

Baseline seed must include:

- Default admin role
- Default student role
- Default permission set
- Default language
- Default non-removable division
- Base workspace settings

No demo users.  
No demo content.

---

## Idempotency & Recovery Rules

Provisioning must tolerate:

- Duplicate triggers
- Partial crashes
- Worker restarts
- Network interruptions

If database exists but registry missing:

→ Drop database and restart provisioning.

If registry exists but DB missing:

→ Mark FAILED and log critical inconsistency.

If DB exists and partially migrated:

→ Drop and restart (no resume in Phase 1).

Provisioning must result in either:

- Fully completed system  
  OR
- Fully reverted system

Never partial.

---

## Archive Process

Triggered when:

License transitions from SOFT_LOCKED → ARCHIVED.

Process:

1. Validate no in-progress attempts
2. Ensure no open transactions
3. Take consistent full database snapshot
4. Store snapshot metadata:
   - snapshot_id
   - snapshot_location
   - snapshot_timestamp
5. Update license.archived_at
6. Update license status to ARCHIVED
7. Block tenant resolver access

Snapshot must be:

- Recoverable
- Version-tagged
- Integrity-verified
- Encrypted if stored externally

Archive must represent clean system state.

---

## Restoration Process

Triggered when:

ARCHIVED → ACTIVE.

Process:

1. Restore database from snapshot
2. Validate schema compatibility
3. Re-register in tenants_registry
4. Update license status to ACTIVE
5. Resume operations

No data loss allowed.

---

## Permanent Deletion

Allowed only when:

- License status = ARCHIVED
- Manual confirmation executed
- Snapshot verified

Process:

1. Drop tenant database
2. Remove from tenants_registry
3. Set license.deleted_at
4. Set license status = DELETED
5. Log deletion event
6. Retain anonymized aggregated metrics only

Deletion is irreversible.

No automatic deletion permitted.

---

## tenants_registry Integrity Rules

tenants_registry stores infrastructure metadata only.

It must always match:

- Actual DB existence
- Associated license_id
- Expected schema version

License lifecycle state is NOT duplicated here.

Periodic integrity job must detect:

- Orphan databases
- Orphan registry rows
- Schema mismatches

---

## Security Requirements

Provisioning service must:

- Not expose public HTTP endpoints
- Encrypt DB credentials at rest
- Log all provisioning events
- Restrict execution to internal service account
- Use least-privilege DB credentials

Provisioning logic must live in worker process.

---

## Validation Criteria

Stage complete when:

- PROVISIONING state triggers DB creation
- Database initialized correctly
- Registry entry created
- Baseline schema exists
- Lock prevents duplicate provisioning
- Failed provisioning rolls back cleanly
- Archive snapshot works
- Restore works
- Permanent deletion drops DB
- Idempotency validated
- Integrity job detects inconsistencies

---

## Not Allowed

- Manual DB creation outside provisioning service
- Registry entry without DB
- DB without registry entry
- Provisioning without lock
- Deletion without ARCHIVED state
- Partial provisioning state

---

## Stability Principle

Provisioning is Zidney’s physical isolation layer.

If provisioning creates orphan databases,  
registry inconsistencies,  
partial migrations,  
or unsafe archives,

The platform becomes operationally unstable.

Provisioning must be stable before:

STAGE_06_ATTEMPT_ENGINE_FOUNDATION
