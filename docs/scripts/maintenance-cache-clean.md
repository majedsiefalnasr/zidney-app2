# infra:cache:clean

## Command

```sh
bun run infra:cache:clean
```

## Purpose

Remove build caches and temporary output directories to free disk space

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/maintenance/cache-clean.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run infra:cache:clean`
- Implementation: scripts/maintenance/cache-clean.ts
- Metadata-backed script file: `scripts/maintenance/cache-clean.ts`

## CI Behavior

Explicitly rejected in the implementation; this is a local cleanup command and must not run with --ci.

## When to Run

- When the corresponding repository workflow requires this root runner.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically: destructive maintenance command.
