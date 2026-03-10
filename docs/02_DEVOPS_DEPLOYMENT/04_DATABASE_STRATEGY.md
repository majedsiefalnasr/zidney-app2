# Database Strategy

Phase Alignment: Platform Foundation – Multi-Tenancy Core Scope: Database-per-tenant model, pooling,
migrations, backups, and recovery Status: Enforced

---

## Architectural Model

Zidney uses strict database-per-tenant isolation.

Single PostgreSQL instance containing:

- master_db
- workspace\_<slug_1>
- workspace\_<slug_2>
- workspace\_<slug_n>

No row-based multi-tenancy is allowed. No shared tenant tables are allowed. No cross-database joins
are allowed.

Isolation is enforced at database level.

---

## Master Database Responsibilities

master_db stores only platform-level data:

- products
- licenses
- tenants_registry
- mmc_users
- platform settings
- platform schema version

master_db must never store:

- student data
- attempts
- academic content
- certificates
- runtime analytics

---

## Tenant Database Responsibilities

Each workspace\_<slug> database stores:

- users (staff + students)
- roles and permissions
- divisions / departments / groups
- subjects / lessons
- questions (MCQ + traditional)
- exams
- attempts
- subscriptions
- translations
- certificates
- workspace settings
- schema_version table

Each tenant DB is fully self-contained.

---

## Connection Strategy

Production must use PgBouncer.

Rules:

- API connects only through PgBouncer
- No direct PostgreSQL connection in production
- One connection pool per tenant (in-memory pool map)
- Pools created lazily
- Pools never recreated per request

Connection exhaustion must be prevented via pooling.

---

## Migration Strategy

Two migration tracks:

Master migrations:

- Affect master_db only

Tenant migrations:

- Applied per workspace database

Rules:

- Each tenant stores schema_version
- Platform defines MIN_SUPPORTED_SCHEMA_VERSION
- On request, schema_version must be validated
- If outdated → block runtime (Upgrade Required)

Migrations must be:

- Idempotent
- Versioned
- Ordered
- Logged

No automatic destructive migration allowed without snapshot.

---

## Migration Execution Model

Production migrations must follow:

1. Take full snapshot
2. Apply migration
3. Verify schema_version update
4. Validate API health

If migration fails:

- Restore snapshot
- Block workspace
- Log incident

Worker service must never auto-run migrations.

---

## Backup Policy

Nightly full backup required for:

- master_db
- All tenant databases

Backups must:

- Be timestamped
- Be encrypted
- Be stored outside container filesystem
- Have retention policy defined

Recommended retention:

- Daily backups: 7 days
- Weekly backups: 4 weeks
- Monthly backups: 3 months

---

## Snapshot Policy

Snapshot required before:

- Major platform upgrade
- Breaking schema migration
- Archive transition
- Permanent deletion workflow

Snapshot metadata must include:

- workspace_slug
- schema_version
- product_version
- timestamp
- snapshot location

---

## Archive Strategy

When license transitions to ARCHIVED:

- Ensure no active attempts
- Take full database snapshot
- Prevent new writes
- Mark archived_at
- Tenant resolver returns 403

Restore requires explicit manual action.

---

## Deletion Policy

Permanent deletion allowed only when:

- License status = ARCHIVED
- Manual confirmation executed

Process:

- Drop tenant database
- Remove registry entry
- Mark license as DELETED
- Retain anonymized aggregated metrics only

Deletion is irreversible.

---

## Hard Rules

- No shared tenant schema
- No cross-tenant joins
- No schema auto-upgrade on container boot
- No skipping snapshot before destructive change
- No direct DB exposure to internet

Database layer is Zidney’s isolation boundary.

If isolation or migration safety fails, platform trust fails.
