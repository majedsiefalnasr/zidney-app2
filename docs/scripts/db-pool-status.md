# db:status:pool

## Command

```sh
bun run db:status:pool
```

Registered package.json runner:

```sh
bun run scripts/db/pool-status.ts
```

## Purpose

Check PostgreSQL connection pool health and report status.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/db/pool-status.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/db/pool-status.ts
- Metadata-backed script file: `scripts/db/pool-status.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- When operating against a configured database environment for maintenance or diagnostics.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically: requires database connectivity or interactive/manual access.
