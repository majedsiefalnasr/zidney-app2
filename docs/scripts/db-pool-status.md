# db:pool-status

## Command

```sh
bun run db:status:pool
```

## Purpose

Checks the health of the PostgreSQL connection pool by attempting a live connect/ping/release
cycle against `DATABASE_URL`. Reports pool size metrics and latency as structured log output.

## Why It Exists

Database connectivity issues manifest silently during startup. This script provides a fast,
standalone check that confirms the database is reachable and the pool can acquire connections
before running migrations, seeds, or integration tests.

## When to Run

- Before running `bun run db:migrate` in CI pipelines
- After Docker/infrastructure startup to confirm the database is ready
- During incident triage when database connectivity is suspected

## Execution Mode

`manual` | `ci`

Infra-dependent: exits 0 with structured warn log if `DATABASE_URL` is not set (graceful
infra-absent pass). Exits 0 on successful connection. Exits 0 with error log if the database
is unreachable (infra-absent pattern — not a broken script).

## Dependencies

- `pg` (PostgreSQL client — available in devDependencies)
- `DATABASE_URL` environment variable

## Example Usage

```sh
# Check pool health
DATABASE_URL=postgres://user:pass@localhost:5432/master_db bun run db:status:pool

# In CI (DATABASE_URL set via environment)
bun run db:status:pool
```

Expected structured log output on success:

```json
{
  "level": "info",
  "message": "Database pool healthy",
  "context": { "totalConnections": 1, "idleConnections": 1 }
}
```

## Known Failure Modes

| Scenario               | Exit Code | Behavior                                |
| ---------------------- | --------- | --------------------------------------- |
| `DATABASE_URL` not set | 0         | Structured warn log, infra-absent pass  |
| Database unreachable   | 0         | Structured error log, infra-absent pass |
| Connection timeout     | 0         | Structured error log, infra-absent pass |
| Pool healthy           | 0         | Structured info log with pool metrics   |
