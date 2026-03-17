# db:migrate

## Command

```sh
bun run db:migrate
```

Optional CLI arguments:

```sh
bun run db:migrate --migration=<migration-name>
```

## Purpose

Applies pending database migrations to master_db using `drizzle-kit push`. When `--migration=`
is not specified, all pending migrations are applied. When specified, only the named migration
is applied.

## Why It Exists

Schema changes must be applied in a controlled, forward-only manner per the Zidney migration
discipline (ADR-0008). This script provides the standard developer and CI interface for
triggering migrations against the configured `DATABASE_URL`.

## When to Run

- During local development after pulling schema changes
- In CI/CD pipelines before running integration tests
- During staging and production deployments (with snapshot backup first)
- After creating a new migration file

## Execution Mode

`manual` | `ci`

Infra-dependent: exits 0 with structured warn log if `DATABASE_URL` is not set. Exits 0 on
successful migration. Exits 0 with error log if migration fails (infra-absent pass — prevents
CI failure when database is unavailable in certain pipeline stages).

## Dependencies

- `drizzle-kit` (available in apps/api dependencies)
- `DATABASE_URL` environment variable pointing to master_db

## Example Usage

```sh
# Apply all pending migrations
DATABASE_URL=postgres://user:pass@localhost:5432/master_db bun run db:migrate

# Apply a specific named migration
DATABASE_URL=postgres://... bun run db:migrate --migration=0001_initial_schema
```

## Known Failure Modes

| Scenario               | Exit Code | Behavior                                 |
| ---------------------- | --------- | ---------------------------------------- |
| `DATABASE_URL` not set | 0         | Structured warn log — infra-absent pass  |
| Migration conflict     | 0         | Structured error log — infra-absent pass |
| drizzle-kit not found  | 0         | Structured error log — infra-absent pass |
| All current            | 0         | Structured info log — no-op              |
| Success                | 0         | Structured info with migration output    |
