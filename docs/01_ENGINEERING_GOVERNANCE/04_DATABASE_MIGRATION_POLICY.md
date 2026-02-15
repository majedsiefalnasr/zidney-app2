# Database Migration Policy

Phase Alignment: Platform Foundation  
Applies To: master_db and all tenant databases

This policy defines how Zidney handles schema evolution safely in a multi-tenant architecture.

---

## Migration Tooling

- Drizzle ORM migrations are mandatory.
- No manual SQL execution in production.
- No schema modification outside migration files.
- Migrations must be committed to version control.

Two migration domains exist:

- master_db migrations
- tenant baseline migrations

They must be stored separately.

---

## Migration Immutability

- Migration files are immutable after merge.
- Never edit an old migration.
- Fixes require a new migration file.
- No force-push rewriting of migration history.

Each migration must have:

- Clear name
- Incremental version
- Deterministic SQL

---

## Versioning Model

Each database must track:

- schema_version
- applied_at timestamp

master_db and tenant DBs version independently.

Runtime must validate:

- Tenant schema_version >= minimum supported version

If not:

- Block workspace
- Require explicit upgrade

---

## Multi-Tenant Upgrade Strategy

Tenant upgrades are explicit and controlled.

Rules:

- Product update does NOT auto-run migrations.
- Workspace must opt-in upgrade.
- Upgrade runs per tenant DB.
- Upgrade must be transactional.
- On failure, migration must rollback.

No partial migration allowed.

---

## Baseline Tenant Schema

Tenant provisioning must:

- Create DB
- Apply full baseline schema
- Set initial schema_version

Baseline schema must match latest stable release.

Provisioning must never apply incremental history one-by-one.
It must apply the full compiled baseline snapshot.

---

## Migration Safety Rules

Forbidden:

- Dropping columns without deprecation window
- Renaming columns without compatibility layer
- Changing data types without migration script
- Removing constraints without replacement strategy

Required for destructive changes:

- Data migration step
- Backup confirmation
- Explicit release note

---

## Rollback Policy

Minor migrations:

- Should be reversible when feasible

Major migrations:

- Require snapshot backup before execution
- Must define rollback plan

If migration fails:

- Tenant DB must remain operational on previous version
- No partial state

---

## Locking & Concurrency

Migration runner must:

- Acquire DB-level lock
- Prevent concurrent migrations
- Prevent runtime writes during migration

No migration may run while active attempt submissions are executing.

---

## Developer Workflow

Before merge:

- Migration tested locally (fresh DB)
- Migration tested against realistic existing data
- Migration passes CI

CI must:

- Run migrations on empty DB
- Run migrations on previous schema snapshot

No PR may merge with failing migration tests.

---

## Production Execution Model

Production migrations must:

- Run in controlled window
- Be logged
- Emit structured logs
- Include correlation ID

For tenant upgrades:

- Upgrade status stored in master_db
- Workspace blocked during upgrade
- On success → version updated
- On failure → revert and unlock

---

## Non-Negotiable Rules

Not allowed:

- Runtime schema mutation
- Dynamic table creation outside provisioning
- Manual hotfix SQL in production
- Skipping version validation

Migration discipline protects:

- Tenant isolation
- Data integrity
- Institutional trust

If schema becomes inconsistent, platform stability is compromised.
