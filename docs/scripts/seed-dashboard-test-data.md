# dev:seed:dashboard-test-data

## Command

```sh
bun run dev:seed:dashboard-test-data
```

Registered package.json runner:

```sh
bun run scripts/seed/dashboard-test-data.ts
```

## Purpose

Seed realistic MMC dashboard test data into master_db for dashboard testing

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/seed/dashboard-test-data.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/seed/dashboard-test-data.ts
- Metadata-backed script file: `scripts/seed/dashboard-test-data.ts`

## CI Behavior

Explicitly rejected in the implementation; this runner seeds database state and must not run with --ci.

## When to Run

- During local development when you need the associated developer workflow.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically in the isolated execution pass.
