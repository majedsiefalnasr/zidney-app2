# db:validate:licenses

## Command

```sh
bun run db:validate:licenses
```

Registered package.json runner:

```sh
bun run scripts/db/validate-licenses.ts
```

## Purpose

Validate license distribution in master_db and report counts by status.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/db/validate-licenses.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/db/validate-licenses.ts
- Metadata-backed script file: `scripts/db/validate-licenses.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- When operating against a configured database environment for maintenance or diagnostics.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically: requires database connectivity or interactive/manual access.
