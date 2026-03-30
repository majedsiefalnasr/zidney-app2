# dev:profile:scripts

## Command

```sh
bun run dev:profile:scripts
```

## Purpose

Profile governance script execution times across repeated runs to establish a performance baseline.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/dev/profile-script-performance.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run dev:profile:scripts`
- Implementation: scripts/dev/profile-script-performance.ts
- Metadata-backed script file: `scripts/dev/profile-script-performance.ts`

## CI Behavior

No explicit --ci handling detected in the implementation.

## When to Run

- During local development when you need the associated developer workflow.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically in the isolated execution pass.
