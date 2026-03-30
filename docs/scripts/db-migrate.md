# db:migrate

## Command

```sh
bun run db:migrate
```

## Purpose

Validate migration inputs and delegate master migration execution guidance.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/db/migrate.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run db:migrate`
- Implementation: scripts/db/migrate.ts
- Metadata-backed script file: `scripts/db/migrate.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- When operating against a configured database environment for maintenance or diagnostics.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically: requires database connectivity or interactive/manual access.
