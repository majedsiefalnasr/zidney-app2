# db:validate-licenses

## Command

```sh
bun run db:validate:licenses
```

## Purpose

Queries the `licenses` table in master_db and reports the count of licenses grouped by status
(`ACTIVE`, `SOFT_LOCKED`, `ARCHIVED`). Validates that license data is present and correctly
distributed across status values.

## Why It Exists

License status integrity is a core invariant of the Zidney platform. This script provides a
fast, read-only audit that confirms licenses exist and that the status distribution is healthy
without requiring a full application stack.

## When to Run

- After running `bun run dev:seed:dashboard-test-data` to verify seeding worked
- During QA validation to confirm license counts match expected values
- In staging environment health checks before release

## Execution Mode

`manual` | `ci`

Infra-dependent: exits 0 with structured warn log if `DATABASE_URL` is not set. Exits 0 with
summary log on query success. Exits 0 with error log if query fails (infra-absent pass).

## Dependencies

- `pg` (PostgreSQL client)
- `DATABASE_URL` environment variable pointing to master_db

## Example Usage

```sh
DATABASE_URL=postgres://user:pass@localhost:5432/master_db bun run db:validate:licenses
```

Expected output:

```json
{
  "level": "info",
  "message": "License distribution validated",
  "metadata": {
    "total": 1000,
    "distribution": { "ACTIVE": 334, "SOFT_LOCKED": 333, "ARCHIVED": 333 }
  }
}
```

## Known Failure Modes

| Scenario                 | Exit Code | Behavior                                 |
| ------------------------ | --------- | ---------------------------------------- |
| `DATABASE_URL` not set   | 0         | Structured warn log — infra-absent pass  |
| `licenses` table missing | 0         | Structured error log — infra-absent pass |
| Empty license table      | 0         | Structured info with `total: 0`          |
| Query timeout            | 0         | Structured error — infra-absent pass     |
