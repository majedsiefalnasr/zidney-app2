# db:console

## Command

```sh
bun run db:console
```

## Purpose

Launches an interactive `psql` session connected to the database specified by `DATABASE_URL`.
Provides direct SQL access to master_db for debugging, inspection, and ad-hoc queries.

## Why It Exists

Developers often need direct SQL access to inspect schema state, query data, or run ad-hoc
fixes during development. This script provides a zero-configuration launcher that connects
psql to the configured `DATABASE_URL` without requiring manual URL handling.

## When to Run

- During local development for database inspection
- During incident triage to query live data
- After running migrations to verify schema changes

**Not intended for production use.** Direct production DB access must go through approved
operational procedures.

## Execution Mode

`manual`

Infra-dependent: exits 0 with structured warn log if `DATABASE_URL` is not set or psql is
not on PATH. No `--workspace=` argument — caller sets `DATABASE_URL` directly.

## Dependencies

- `psql` binary must be on PATH (install: `brew install postgresql` / `apt-get install postgresql-client`)
- `DATABASE_URL` environment variable

## Example Usage

```sh
# Connect to local development database
DATABASE_URL=postgres://user:pass@localhost:5432/master_db bun run db:console

# Inside psql:
# \dt               — list tables
# SELECT * FROM licenses LIMIT 5;
# \q                — quit
```

## Known Failure Modes

| Scenario               | Exit Code            | Behavior                                |
| ---------------------- | -------------------- | --------------------------------------- |
| `DATABASE_URL` not set | 0                    | Structured warn log — infra-absent pass |
| `psql` not on PATH     | 0                    | Structured error with install hint      |
| Connection refused     | Non-zero (from psql) | psql error output to terminal           |
| Authentication failure | Non-zero (from psql) | psql error output to terminal           |
