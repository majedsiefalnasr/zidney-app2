# Script Knowledge Base

> Authoritative documentation for all operational scripts in the Zidney monorepo.

## Purpose

This directory documents every operational script available via `bun run <script>` from the repository root.
Each script document covers: purpose, when to run, dependencies, example usage, and known failure modes.

## How to Add New Script Documentation

1. Add a JSDoc metadata header to your script file (`scripts/<domain>/<script>.ts`) containing:
   - `@script <domain>:<action>` — the `package.json` key
   - `@domain <domain>` — the functional domain
   - `@description <description>` — what the script does
   - `@mode manual|ci` — when the script runs
   - `@dependencies <comma-separated>` — runtime dependencies

2. Run `bun run dev:generate:script-docs` to regenerate all documentation pages.

3. Verify the generated `docs/scripts/<script-name>.md` file and update if needed.

## Script Registry

See [SCRIPT_REGISTRY.md](SCRIPT_REGISTRY.md) for a complete list of all runtime-referenced scripts
with their registration status.

## Domain Groups

### DB Domain (`db:*`)

Scripts for database operations:

- [db:pool-status](db-pool-status.md) — Check PostgreSQL connection pool health
- [db:validate-licenses](db-validate-licenses.md) — Validate license distribution in master_db
- [db:migrate](db-migrate.md) — Run database migrations
- [db:console](db-console.md) — Launch interactive psql session

### Validate Domain (`validate:*`)

Scripts for validation gates:

- [validate:ai-context-fresh](validate-ai-context-fresh.md) — Check AI context artifact freshness
- [validate:ai-context-schemas](validate-ai-context-schemas.md) — Validate AI context JSON schemas
- [validate-runtime-scripts](validate-runtime-scripts.md) — CI guard for unregistered spec script references

### Maintenance Domain (`maintenance:*`)

Scripts for repository maintenance:

- [maintenance:cache-clean](maintenance-cache-clean.md) — Clean build caches and dist directories

### Seed Domain (`seed:*`)

Scripts for test data management:

- [seed-dashboard-test-data](seed-dashboard-test-data.md) — Seed MMC dashboard test data

### Generate Domain (`generate:*`)

Scripts for automated generation:

- [generate-script-docs](generate-script-docs.md) — Generate documentation from script metadata headers

## Naming Convention

All new operational scripts must follow the `<domain>:<action>` naming convention.
The generator validates this rule and exits 1 on violations.

Legacy exceptions (confirmed in LEGACY_ALLOWLIST): `generate-script-docs`, `validate-runtime-scripts`,
`seed-dashboard-test-data`.
