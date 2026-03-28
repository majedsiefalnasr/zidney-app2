# db:console

## Command

```sh
bun run db:console
```

Registered package.json runner:

```sh
bun run scripts/db/console.ts
```

## Purpose

Launch an interactive psql session connected to DATABASE_URL.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/db/console.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/db/console.ts
- Metadata-backed script file: `scripts/db/console.ts`

## CI Behavior

Explicitly rejected in the implementation; this is an interactive command and must not run with --ci.

## When to Run

- When operating against a configured database environment for maintenance or diagnostics.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically: requires database connectivity or interactive/manual access.
