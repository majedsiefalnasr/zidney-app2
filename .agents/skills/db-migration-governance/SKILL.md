---
name: db-migration-governance
description: Database migration governance for Zidney's database-per-tenant architecture — naming, safety, tenant fan-out, and rollback rules
metadata:
  category: database
  scope: backend
  capabilities:
    - migration file naming enforcement
    - tenant fan-out safety validation
    - expand-deploy-migrate-contract compliance
    - lock risk analysis
    - rollback discipline
---

# DB Migration Governance Skill

Zidney uses a **database-per-tenant** model with PostgreSQL. Every schema change must be applied to ALL tenant databases. This makes migrations the **highest-risk operation** in the platform.

This skill consolidates migration rules from `apps/api/AGENTS.md`, `docker/AGENTS.md`, and the root `AGENTS.md` into a single authoritative source.

---

## Migration File Locations

```
apps/api/src/db/master/migrations/   ← Master (platform) DB migrations
apps/api/src/db/tenant/migrations/   ← Tenant DB migrations (applied per-tenant)
```

AI must never write migration SQL outside these directories.

---

## Migration File Rules

1. **One migration per feature** — never combine unrelated schema changes
2. **Forward-only** — never modify an existing migration file
3. **Naming format:** `NNNN_<descriptive_name>.ts` (zero-padded sequential number)
4. **Each migration must increment `schema_version`**
5. **Production rollback = snapshot restore** — there are no down migrations

---

## Expand-Deploy-Migrate-Contract Pattern

For any column or table change, follow this 3-phase pattern:

### Phase 1 — Expand
- Add new columns/tables as NULLABLE or with defaults
- No data loss, no breaking changes
- Deploy code that can handle both old and new schema

### Phase 2 — Migrate
- Backfill data into new columns
- Run via Worker job (not inline migration)
- Must be idempotent

### Phase 3 — Contract
- Remove old columns/tables
- Only after Phase 2 is verified complete
- Separate migration file from Phase 1

---

## Tenant Fan-Out Safety

When applying tenant migrations:

- Migrations run against ALL tenant databases in the pool
- A failure on ONE tenant must not prevent other tenants from continuing
- Each tenant migration must be wrapped in a transaction
- Migration status must be tracked per-tenant (success/failure/pending)
- Failed tenant migrations must be retried with exponential backoff

---

## Lock Risk Analysis

Before writing any migration, AI must evaluate:

| Operation | Lock Level | Risk |
|-----------|-----------|------|
| ADD COLUMN (nullable) | ACCESS EXCLUSIVE (brief) | Low |
| ADD COLUMN (with default) | ACCESS EXCLUSIVE | Medium — PG 11+ handles this fast |
| DROP COLUMN | ACCESS EXCLUSIVE (brief) | Low |
| ADD INDEX | SHARE (blocks writes) | HIGH — use CONCURRENTLY |
| ADD INDEX CONCURRENTLY | SHARE UPDATE EXCLUSIVE | Low |
| ALTER COLUMN TYPE | ACCESS EXCLUSIVE | HIGH — rewrites table |
| ADD NOT NULL constraint | ACCESS EXCLUSIVE | HIGH — full table scan |

For HIGH-risk operations:
- Use `CREATE INDEX CONCURRENTLY` instead of `CREATE INDEX`
- Break ALTER COLUMN TYPE into expand-migrate-contract phases
- Add NOT NULL via CHECK constraint first, then convert

---

## Forbidden Migration Patterns

- **No `DROP TABLE` without explicit approval** — archived data must be preserved
- **No `TRUNCATE`** in migration files
- **No `DELETE` without WHERE** in migration files
- **No schema changes outside migration files** — no ad-hoc SQL via MCP
- **No modifying closed/hardened stage migrations**
- **No cross-tenant data operations** in a single migration

---

## Drizzle ORM Integration

Migrations are generated via Drizzle Kit but may be hand-edited for safety:

```bash
bun drizzle-kit generate    # Generate migration from schema changes
bun drizzle-kit push        # Apply to development database (NEVER production)
```

AI must review generated migrations before committing — Drizzle may generate unsafe operations.

---

## Pre-Commit Validation

Before committing any migration:

1. Verify migration is in the correct directory (master vs tenant)
2. Verify sequential numbering
3. Verify `schema_version` increment
4. Verify no modification of existing migration files
5. Run `bun scripts/infra-audit.ts` to validate architecture compliance

---

## Verdict Protocol

```
VERDICT: PASS   — migration follows all rules
VERDICT: BLOCKED — migration violates safety rules (specify which)
```
