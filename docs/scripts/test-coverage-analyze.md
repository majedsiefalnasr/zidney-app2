# test:coverage:analyze

## Command

```sh
bun run test:coverage:analyze
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as critical. Treat as protected. It is a primary quality, build, test, or governance entrypoint. Its implementation lives in scripts/coverage-analyze.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run test:coverage:analyze`
- Implementation: scripts/coverage-analyze.ts
- Metadata-backed script file: `scripts/coverage-analyze.ts`

## CI Behavior

No explicit --ci handling detected in the implementation.

## When to Run

- When running repository quality checks before commit or push.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically in the isolated execution pass.
