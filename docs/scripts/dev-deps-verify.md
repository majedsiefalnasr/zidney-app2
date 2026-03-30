# dev:deps:verify

## Command

```sh
bun run dev:deps:verify
```

## Purpose

Scan the codebase for dependency usage patterns and produce a conservative unused-dependency candidate report.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/dev/verify-dependency-usage.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run dev:deps:verify`
- Implementation: scripts/dev/verify-dependency-usage.ts
- Metadata-backed script file: `scripts/dev/verify-dependency-usage.ts`

## CI Behavior

No explicit --ci handling detected in the implementation.

## When to Run

- During local development when you need the associated developer workflow.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically in the isolated execution pass.
